"""
Authentication Service
======================

Main business logic for authentication operations including registration,
login, email verification, password reset, and 2FA.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, timezone
import logging
import secrets
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.models.user import User
from app.models.plan import Plan

logger = logging.getLogger(__name__)
from app.repositories.user_repository import (
    UserRepository,
    UserTokenRepository,
    UserSessionRepository,
)
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.core.security import (
    hash_password,
    verify_password,
    validate_password_strength,
    validate_username,
    derive_username_base,
    _USERNAME_BASE_MAX_LENGTH,
    USERNAME_MAX_SUFFIX_ATTEMPTS as _MAX_USERNAME_SUFFIX_ATTEMPTS,
    create_access_token,
    create_refresh_token,
    generate_verification_token,
    generate_reset_token,
    generate_2fa_code,
)
from app.core.config import settings

# Redis-backed per-account login-failure tracking for brute-force lockout. This complements the
# IP-based rate limiter (which an attacker can dodge with rotating IPs). It fails OPEN when Redis
# is unavailable so a cache outage can never lock every user out of the platform.
import redis.asyncio as aioredis
from app.db.redis import _redis_pool

_LOGIN_FAIL_PREFIX = "login:fail:"


async def _login_fail_count(user_id: int) -> int:
    """Current consecutive failed-login count for a user (0 if none, or if Redis is down)."""
    try:
        if not _redis_pool:
            return 0
        client = aioredis.Redis(connection_pool=_redis_pool)
        try:
            val = await client.get(f"{_LOGIN_FAIL_PREFIX}{user_id}")
        finally:
            await client.close()
        return int(val) if val else 0
    except Exception as exc:  # fail open
        logger.warning("Login lockout: could not read fail count (%s); failing open", exc)
        return 0


async def _register_login_failure(user_id: int) -> None:
    """Increment the failure counter and (re)arm the lockout window on each wrong password."""
    try:
        if not _redis_pool:
            return
        client = aioredis.Redis(connection_pool=_redis_pool)
        try:
            key = f"{_LOGIN_FAIL_PREFIX}{user_id}"
            await client.incr(key)
            await client.expire(key, settings.login_lockout_minutes * 60)
        finally:
            await client.close()
    except Exception as exc:  # fail open
        logger.warning("Login lockout: could not record failure (%s)", exc)


async def _clear_login_failures(user_id: int) -> None:
    """Reset the counter once the correct password is supplied."""
    try:
        if not _redis_pool:
            return
        client = aioredis.Redis(connection_pool=_redis_pool)
        try:
            await client.delete(f"{_LOGIN_FAIL_PREFIX}{user_id}")
        finally:
            await client.close()
    except Exception as exc:  # fail open
        logger.warning("Login lockout: could not clear failures (%s)", exc)


class AuthService:
    """Service for authentication operations"""

    def __init__(self):
        self.user_repo = UserRepository()
        self.user_token_repo = UserTokenRepository()
        self.session_repo = UserSessionRepository()
        self.operation_limit_repo = OperationLimitRepository()
        from app.services.entitlement_gate import EntitlementGate
        self.entitlement_gate = EntitlementGate()

    # ------------------------------------------------------------------ #
    # Phase 6 — guest → account association (frontend, System Partner 1)
    # ------------------------------------------------------------------ #

    async def _reparent_guest_playlists(
        self, db: AsyncSession, user_id: int, visitor_id: Optional[str]
    ) -> int:
        """Claim any guest-created playlists for this device onto the freshly
        authenticated user. Best-effort: never break auth on failure.

        Scoped to still-unowned rows tagged with THIS ``visitor_id`` under the
        frontend system partner, so it can never claim another visitor's or a
        B2B partner's playlists. Idempotent (a re-run matches nothing once the
        rows are owned and their ``guest_visitor_id`` cleared).

        **Anti-abuse (one-time onboarding only):** reparenting proceeds ONLY when the account has
        no playlists yet. This makes it a genuine guest→first-account convenience and blocks a user
        from farming free guest playlists in incognito and then logging into an *existing* account
        to harvest them (which would sidestep the monthly limit). A brand-new registration always
        has zero playlists, so registration→reparent still works.
        """
        if not visitor_id:
            return 0
        try:
            # Only claim guest work onto an account that has none of its own yet.
            already_has = (await db.execute(
                text("SELECT 1 FROM playlists WHERE user_id = :uid AND partner_id = :pid LIMIT 1"),
                {"uid": user_id, "pid": settings.system_partner_id},
            )).first()
            if already_has is not None:
                return 0
            result = await db.execute(
                text(
                    "UPDATE playlists SET user_id = :uid, guest_visitor_id = NULL "
                    "WHERE guest_visitor_id = :vid AND user_id IS NULL AND partner_id = :pid"
                ),
                {"uid": user_id, "vid": visitor_id, "pid": settings.system_partner_id},
            )
            await db.commit()
            claimed = result.rowcount or 0
            if claimed:
                logger.info("Reparented %d guest playlist(s) to user %s", claimed, user_id)
            return claimed
        except Exception as exc:
            logger.warning("Guest playlist reparent failed for user %s: %s", user_id, exc)
            return 0

    async def _assign_default_plan(self, db: AsyncSession, user: User) -> None:
        """Attach a newly registered user to the default (free) plan. Best-effort;
        resolution already treats a NULL ``plan_id`` as the default, so failure is
        non-fatal — this just makes the assignment explicit for admin queries."""
        try:
            if user.plan_id is not None:
                return
            default_plan = (
                await db.execute(select(Plan).where(Plan.is_default.is_(True)))
            ).scalar_one_or_none()
            if default_plan:
                user.plan_id = default_plan.id
                await db.commit()
        except Exception as exc:
            logger.warning("Default-plan assignment failed for user %s: %s", user.id, exc)

    async def _resolve_derived_username(self, db: AsyncSession, email: str) -> str:
        """Pick a free username for a sign-up that didn't supply one.

        Starts from the email's local part and appends "1" per collision, as agreed:

            usman.naeem2212 -> usman.naeem22121 -> usman.naeem221211 -> …

        Capped so a pathological run can't loop forever; past the cap it falls back to a random
        suffix, which is effectively certain to be free.

        NOTE: this is check-then-create, so two simultaneous sign-ups deriving the same base can
        still collide on the DB's unique index. The window is tiny and the loser gets a clean 400
        rather than a corrupt row; the unique constraint remains the real guarantee.
        """
        base = derive_username_base(email)

        candidate = base
        for _ in range(_MAX_USERNAME_SUFFIX_ATTEMPTS):
            if not await self.user_repo.async_get_by_username(db, candidate):
                return candidate
            candidate = f"{candidate}1"

        # Cap reached — stop lengthening and take a random tail instead.
        return f"{base[:_USERNAME_BASE_MAX_LENGTH]}{secrets.token_hex(3)}"

    async def register_user(
        self,
        db: AsyncSession,
        email: str,
        username: Optional[str] = None,
        password: str = "",
        name: Optional[str] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Tuple[User, str]:
        """
        Register a new user account.

        Args:
            db: Database session
            email: User email address
            username: Unique username. Optional — when omitted (the sign-up form only collects
                email + password) it is derived from the email and de-duplicated server-side.
            password: Plain text password
            name: Optional display name

        Returns:
            Tuple of (User, verification_token)

        Raises:
            HTTPException: If validation fails or user already exists
        """
        # Validate password strength
        is_valid_password, password_error = validate_password_strength(password)
        if not is_valid_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=password_error
            )

        # Check if email already exists. Kept BEFORE username resolution so a returning user gets
        # "this email is already registered" (the frontend turns that into a sign-in prompt)
        # instead of silently burning a derived username.
        existing_user = await self.user_repo.async_get_by_email(db, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        if username:
            # Caller supplied one explicitly — validate and require it to be free, as before.
            is_valid_username, username_error = validate_username(username)
            if not is_valid_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=username_error
                )
            existing_username = await self.user_repo.async_get_by_username(db, username)
            if existing_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
                )
        else:
            username = await self._resolve_derived_username(db, email)

        # Hash password
        password_hash = hash_password(password)

        # Create user
        user = await self.user_repo.async_create_user(
            db=db,
            email=email,
            username=username,
            password_hash=password_hash,
            name=name,
        )

        # Generate verification token
        token = generate_verification_token()
        # Store UTC-naive in DB for consistency with timezone-naive columns
        expires_at = datetime.utcnow() + timedelta(
            hours=settings.email_verification_token_expire_hours
        )

        await self.user_token_repo.async_create_token(
            db=db, user_id=user.id, token=token, token_type="email_verification", expires_at=expires_at
        )

        # TEMPORARY: Grant high playlist creation limit (1000) for testing phase
        # This allows new users to test the platform without immediately hitting limits.
        try:
            op_type = await self.operation_limit_repo.async_get_operation_type_by_code(
                db, "playlist_create"
            )
            if op_type:
                await self.operation_limit_repo.async_upsert_limit(
                    db,
                    user_id=user.id,
                    operation_id=op_type.id,
                    limit_value=1000,
                    window_seconds=None,
                    created_by=None,
                )
        except Exception:
            # Don't fail registration if limit setup fails
            pass

        # Phase 6.2 — put the new user on the default (free) plan explicitly.
        await self._assign_default_plan(db, user)

        # Phase 6.1 — claim any playlists this device created as a guest.
        await self._reparent_guest_playlists(db, user.id, guest_visitor_id)

        return user, token

    async def login_user(
        self,
        db: AsyncSession,
        email_or_username: str,
        password: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authenticate user and create session.

        Args:
            db: Database session
            email_or_username: Email or username for login
            password: Plain text password
            user_agent: User agent string
            ip_address: Client IP address

        Returns:
            Dictionary with tokens and user info, or 2FA requirement

        Raises:
            HTTPException: If credentials are invalid
        """
        # Try to find user by email or username
        user = await self.user_repo.async_get_by_email(db, email_or_username)
        if not user:
            user = await self.user_repo.async_get_by_username(db, email_or_username)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        # Social-login-only accounts (e.g. Google) have no local password yet. Give a clear,
        # actionable message instead of a generic "invalid credentials". (400 so the frontend's
        # 401→refresh interceptor doesn't fire, and it's not mistaken for the 403 "unverified" case.)
        if not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was created with Google sign-in and has no password yet. "
                "Please continue with Google, or use “Forgot password” to set one.",
            )

        # Brute-force lockout: block if this account has too many recent failed attempts.
        if await _login_fail_count(user.id) >= settings.login_max_failed_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Account temporarily locked due to too many failed login attempts. "
                    f"Please try again in about {settings.login_lockout_minutes} minutes, "
                    "or reset your password."
                ),
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            await _register_login_failure(user.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        # Correct password — clear the failed-attempt counter for this account.
        await _clear_login_failures(user.id)

        # Require verified email before issuing tokens
        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify your email before logging in.",
            )

        # Deactivated accounts get no new session.
        #
        # `get_current_user` already blocks an EXISTING token, which is what stops someone
        # mid-session. This is the other door: until now the password path checked the password,
        # the lockout counter, email verification and 2FA — but never `is_active` — so a
        # deactivated user could simply log in again. (Google sign-in has always checked it,
        # which made the gap easy to miss.)
        #
        # Checked AFTER the password so the response cannot be used to enumerate which addresses
        # belong to deactivated accounts.
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCOUNT_DEACTIVATED",
                    "error": "This account is deactivated. Contact support to restore access.",
                },
            )

        # Check if 2FA is enabled
        if user.is_two_factor_enabled:
            # Generate 2FA code
            code = generate_2fa_code(settings.two_factor_code_length)
            expires_at = datetime.utcnow() + timedelta(
                minutes=settings.two_factor_code_expire_minutes
            )

            await self.user_token_repo.async_create_token(
                db=db,
                user_id=user.id,
                token=code,
                token_type="2fa",
                expires_at=expires_at,
            )

            # Return 2FA required response (email service will send code)
            return {
                "requires_2fa": True,
                "user_id": user.id,
                "two_factor_code": code,  # This will be sent via email
            }

        # Generate tokens
        return await self._create_user_session(
            db=db, user=user, user_agent=user_agent, ip_address=ip_address,
            guest_visitor_id=guest_visitor_id,
        )

    async def verify_2fa_and_login(
        self,
        db: AsyncSession,
        user_id: int,
        code: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Verify 2FA code and complete login.

        Args:
            db: Database session
            user_id: User ID from initial login
            code: 2FA code from email
            user_agent: User agent string
            ip_address: Client IP address

        Returns:
            Dictionary with tokens and user info

        Raises:
            HTTPException: If code is invalid or expired
        """
        # Verify code
        token_record = await self.user_token_repo.async_get_by_token(
            db=db, token=code, token_type="2fa"
        )

        if not token_record or token_record.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired 2FA code",
            )
        
        # Delete code after use
        await self.user_token_repo.async_delete_token(db, user_id, "2fa")

        # Get user
        user = await self.user_repo.async_get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Generate tokens
        return await self._create_user_session(
            db=db, user=user, user_agent=user_agent, ip_address=ip_address,
            guest_visitor_id=guest_visitor_id,
        )

    # ------------------------------------------------------------------ #
    # Social login — Google (Google Identity Services, ID-token flow)
    # ------------------------------------------------------------------ #

    async def login_with_google(
        self,
        db: AsyncSession,
        credential: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Verify a Google ID token and sign the user in, creating/linking the account as needed.

        Google is only the front door: after verification we mint OUR normal session via
        ``_create_user_session`` (identical access token + HttpOnly refresh cookie as password
        login), so refresh rotation, cross-subdomain sharing, plans and RBAC are all unchanged.
        """
        claims = self._verify_google_credential(credential)

        provider_uid = claims["sub"]
        email = (claims.get("email") or "").strip().lower()
        email_verified = bool(claims.get("email_verified", False))
        name = claims.get("name")
        picture = claims.get("picture")

        # Never auto-create/link on an unverified email — that would let an attacker claim someone
        # else's address via a fake provider account.
        if not email or not email_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google account email is not verified.",
            )

        # 1) Already linked (by Google's stable 'sub') → sign that user in.
        user = await self.user_repo.async_get_by_provider(db, "google", provider_uid)

        # 2) Not linked, but an account already exists with this verified email → link Google to it.
        if user is None:
            user = await self.user_repo.async_get_by_email(db, email)
            if user is not None:
                await self.user_repo.async_link_provider(db, user.id, "google", provider_uid)

        # 3) Brand new → create the account, link it, and put it on the default (free) plan.
        if user is None:
            username = await self._generate_unique_username(db, email)
            user = await self.user_repo.async_create_oauth_user(
                db, email=email, username=username, name=name, profile_picture=picture,
            )
            await self.user_repo.async_link_provider(db, user.id, "google", provider_uid)
            await self._assign_default_plan(db, user)

        if not user.is_active:
            # Same shape as the password path so one frontend handler covers both.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCOUNT_DEACTIVATED",
                    "error": "This account is deactivated. Contact support to restore access.",
                },
            )

        return await self._create_user_session(
            db=db, user=user, user_agent=user_agent, ip_address=ip_address,
            guest_visitor_id=guest_visitor_id,
        )

    async def link_google_to_user(self, db: AsyncSession, user_id: int, credential: str) -> None:
        """Link a Google identity to the CURRENT user (used by "Connect Google" in the profile).

        Unlike ``login_with_google`` (which finds-or-creates-or-switches accounts and issues a new
        session), this NEVER changes who is signed in and NEVER creates an account — it only attaches
        the verified Google ``sub`` to the already-authenticated user. Refused (409) when that Google
        account is already linked to a DIFFERENT Resomix account, so a Google identity can belong to
        at most one account.
        """
        claims = self._verify_google_credential(credential)
        provider_uid = claims["sub"]
        if not bool(claims.get("email_verified", False)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google account email is not verified.",
            )

        existing = await self.user_repo.async_get_by_provider(db, "google", provider_uid)
        if existing is not None:
            if existing.id == user_id:
                return  # already linked to this account — idempotent
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Google account is already connected to another Resomix account.",
            )

        await self.user_repo.async_link_provider(db, user_id, "google", provider_uid)

    def _verify_google_credential(self, credential: str) -> Dict[str, Any]:
        """Verify a Google ID token's signature, audience, issuer and expiry; return its claims."""
        if not settings.google_client_id:
            logger.error("Google login attempted but GOOGLE_CLIENT_ID is not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google sign-in is not configured.",
            )
        try:
            # Checks the RS256 signature against Google's public keys, and validates
            # aud == our client id, iss, and exp.
            claims = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.google_client_id,
            )
        except ValueError as exc:  # bad signature / wrong audience / expired / malformed
            logger.warning("Google ID token verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential.",
            )
        if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential issuer.",
            )
        if not claims.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential.",
            )
        return claims

    async def _generate_unique_username(self, db: AsyncSession, email: str) -> str:
        """Derive a valid, unique username from an email local-part (policy: starts with a letter,
        3–50 chars, alphanumeric/underscore/hyphen)."""
        import re as _re

        base = _re.sub(r"[^a-zA-Z0-9_-]", "", email.split("@", 1)[0]) or "user"
        if not base[0].isalpha():
            base = "u" + base
        base = base[:40]
        if len(base) < 3:
            base = (base + "user")[:40]
        candidate = base
        suffix = 0
        while await self.user_repo.async_get_by_username(db, candidate) is not None:
            suffix += 1
            candidate = f"{base[:34]}{suffix}"
        return candidate

    async def _create_user_session(
        self,
        db: AsyncSession,
        user: User,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create user session and return tokens"""
        # Create access token
        access_token = create_access_token(data={"sub": user.uuid, "email": user.email})

        # Create refresh token
        refresh_token = create_refresh_token(data={"sub": user.uuid})

        # Hash refresh token for storage
        refresh_token_hash = hash_password(refresh_token)

        # Calculate expiration
        expires_at = datetime.utcnow() + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )

        # Create session
        await self.session_repo.async_create_session(
            db=db,
            user_id=user.id,
            refresh_token_hash=refresh_token_hash,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at,
        )

        # Phase 6.1 — a returning user on a device that has guest playlists claims
        # them at sign-in (covers login and 2FA-verified login through this choke point).
        await self._reparent_guest_playlists(db, user.id, guest_visitor_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "uuid": user.uuid,
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "profile_picture": user.profile_picture,
                "language": user.language,
                "timezone": user.timezone,
                "is_email_verified": user.is_email_verified,
                "is_two_factor_enabled": user.is_two_factor_enabled,
                "two_factor_method": user.two_factor_method,
                # Lets the frontend show "Set password" vs "Change password", and explain login options.
                "has_password": bool(user.password_hash),
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
        }

    async def verify_email(self, db: AsyncSession, token: str) -> Tuple[User, bool]:
        """
        Verify email with token. **Idempotent** — clicking the link more than once (a page refresh,
        a browser/email prefetch, or a mail-security scanner that follows links) returns success
        instead of a scary "expired" error, as long as the token has not expired by time.

        Args:
            db: Database session
            token: Verification token from email

        Returns:
            Tuple of (verified user, newly_verified). ``newly_verified`` is True only on the FIRST
            successful verification so the caller can gate one-time side effects (welcome email).

        Raises:
            HTTPException: If token is invalid or expired
        """
        # Get token (async_get_by_token already excludes rows whose expires_at has passed).
        verification_token = await self.user_token_repo.async_get_by_token(
            db, token, "email_verification"
        )

        if not verification_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token",
            )

        # Was the account already verified before this call? Drives both the one-time signup bonus
        # AND the caller's one-time side effects. Email clients / security scanners routinely GET the
        # link (the frontend auto-fires verification on load) and users refresh the page, so this
        # method IS hit more than once for the same token and must stay idempotent.
        existing = await self.user_repo.async_get_by_id(db, verification_token.user_id)
        already_verified = bool(existing and existing.is_email_verified)

        # Mark email as verified (idempotent no-op when it already was).
        user = await self.user_repo.async_update_email_verified(
            db=db, user_id=verification_token.user_id, is_verified=True
        )

        # NOTE: we deliberately do NOT delete the token here. Deleting it made this endpoint
        # non-idempotent — the first hit consumed the token and any second hit (refresh / prefetch /
        # scanner) then 400'd "Invalid or expired" even though the account was already verified. The
        # token only ever flips is_email_verified (an idempotent action), so leaving it valid until
        # its natural expiry is safe: async_cleanup_expired prunes it, and a resend replaces it
        # (async_create_token deletes same-type tokens before issuing a new one).
        newly_verified = not already_verified

        # Signup bonus: granted once, only on the FIRST verification (best-effort — never blocks
        # verification). Extra playlists are added to the user's current monthly period.
        if newly_verified:
            try:
                granted = await self.entitlement_gate.grant_playlist_signup_bonus(db, user)
                if granted:
                    logger.info("Granted signup bonus of %d playlist(s) to user %s", granted, user.id)
            except Exception as exc:
                logger.warning("Signup bonus grant failed for user %s: %s", user.id, exc)

        return user, newly_verified

    async def resend_verification_email(
        self, db: AsyncSession, email: str
    ) -> Tuple[User, str]:
        """
        Resend verification email.

        Args:
            db: Database session
            email: User email address

        Returns:
            Tuple of (User, verification_token)

        Raises:
            HTTPException: If user not found or already verified
        """
        user = await self.user_repo.async_get_by_email(db, email)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        if user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already verified"
            )

        # Generate new token
        token = generate_verification_token()
        # Store UTC-naive in DB for consistency with timezone-naive columns
        expires_at = datetime.utcnow() + timedelta(
            hours=settings.email_verification_token_expire_hours
        )

        await self.user_token_repo.async_create_token(
            db=db, user_id=user.id, token=token, token_type="email_verification", expires_at=expires_at
        )

        return user, token

    async def request_password_reset(
        self, db: AsyncSession, email: str
    ) -> Tuple[Optional[User], str]:
        """
        Request password reset (always returns success for security).

        Args:
            db: Database session
            email: User email address

        Returns:
            Tuple of (User or None, reset_token)
        """
        user = await self.user_repo.async_get_by_email(db, email)

        if not user:
            # Return dummy token for security (don't reveal if email exists)
            return None, generate_reset_token()

        # Generate reset token
        token = generate_reset_token()
        expires_at = datetime.utcnow() + timedelta(
            hours=settings.password_reset_token_expire_hours
        )

        await self.user_token_repo.async_create_token(
            db=db, user_id=user.id, token=token, token_type="password_reset", expires_at=expires_at
        )

        return user, token

    async def reset_password(
        self, db: AsyncSession, token: str, new_password: str
    ) -> User:
        """
        Reset password with token.

        Args:
            db: Database session
            token: Password reset token
            new_password: New password

        Returns:
            Updated user

        Raises:
            HTTPException: If token is invalid or expired
        """
        # Validate password strength
        is_valid, error = validate_password_strength(new_password)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

        # Get token
        reset_token = await self.user_token_repo.async_get_by_token(db, token, "password_reset")

        if not reset_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
            )

        # Update password
        password_hash = hash_password(new_password)
        user = await self.user_repo.async_update_password(
            db=db, user_id=reset_token.user_id, new_password_hash=password_hash
        )

        # Delete token (fetch-validate-delete pattern)
        await self.user_token_repo.async_delete_token(db, reset_token.user_id, "password_reset")

        # Revoke all user sessions (force re-login)
        await self.session_repo.async_revoke_all_user_sessions(db, user.id)

        return user

    async def refresh_access_token(
        self, db: AsyncSession, refresh_token: str
    ) -> Dict[str, Any]:
        """
        Refresh access token using refresh token with token rotation.

        Args:
            db: Database session
            refresh_token: Valid refresh token

        Returns:
            Dictionary with new access_token, new refresh_token, and token_type

        Raises:
            HTTPException: If refresh token is invalid or revoked
        """
        from app.core.security import decode_token

        # Decode refresh token
        try:
            payload = decode_token(refresh_token)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )

        # Verify token type
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
            )

        # Get user
        user_uuid = payload.get("sub")
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )

        # Verify refresh token hash matches a valid session
        sessions = await self.session_repo.async_get_active_sessions(db, user.id)
        valid_session = None

        for session in sessions:
            if verify_password(refresh_token, session.refresh_token_hash):
                valid_session = session
                break

        if not valid_session:
            # Treat mismatched refresh token as potential replay attack: revoke all sessions
            await self.session_repo.async_revoke_all_user_sessions(db, user.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token reuse detected. All sessions have been revoked.",
            )

        # Generate new access token
        access_token = create_access_token(data={"sub": user.uuid, "email": user.email})

        # Generate new refresh token (token rotation)
        new_refresh_token = create_refresh_token(data={"sub": user.uuid})

        # Hash new refresh token for storage
        new_refresh_token_hash = hash_password(new_refresh_token)

        # Calculate new expiration
        from datetime import datetime, timedelta

        expires_at = datetime.utcnow() + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )

        # Update session with new refresh token hash
        valid_session.refresh_token_hash = new_refresh_token_hash
        valid_session.expires_at = expires_at
        await db.commit()

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }

    async def logout(self, db: AsyncSession, refresh_token: str) -> bool:
        """
        Logout user by revoking session.

        Args:
            db: Database session
            refresh_token: Refresh token to revoke

        Returns:
            True if session revoked
        """
        from app.core.security import decode_token

        try:
            payload = decode_token(refresh_token)
            user_uuid = payload.get("sub")
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)

            if user:
                # Find and revoke the session with this refresh token
                sessions = await self.session_repo.async_get_active_sessions(
                    db, user.id
                )
                for session in sessions:
                    if verify_password(refresh_token, session.refresh_token_hash):
                        await self.session_repo.async_revoke_session(
                            db, session.session_id
                        )
                        return True
        except Exception:
            pass

        return False

    async def logout_all_devices(self, db: AsyncSession, user_id: int) -> int:
        """
        Logout user from all devices.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Number of sessions revoked
        """
        return await self.session_repo.async_revoke_all_user_sessions(db, user_id)

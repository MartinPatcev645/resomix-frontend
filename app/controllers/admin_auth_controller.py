"""
Admin Authentication Controller
===============================

Handles business logic for administrative login and session management.
Verifies credentials and ensures the user has administrative access rights.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_2fa_code,
)
from app.core.config import settings
from app.repositories.user_repository import UserRepository, UserTokenRepository
from app.repositories.rbac_repository import RBACRepository
from app.services.admin_operation_log_service import AdminOperationLogService
from app.services.email_service import EmailService
# Reuse the webapp login's per-account brute-force lockout (Redis-backed, per user id).
from app.services.auth_service import (
    _login_fail_count,
    _register_login_failure,
    _clear_login_failures,
)

# Admin sessions are short and idle-based: a 5-minute access token that the client silently
# refreshes on activity, backed by a 30-minute refresh token that is re-issued (rolled 30 min
# forward) on every refresh. Net effect: the session ends ~30 minutes after the last API call.
ADMIN_ACCESS_TOKEN_MINUTES = 5
ADMIN_SESSION_MINUTES = 30


class AdminAuthController:
    """
    Controller for admin authentication operations.
    """

    def __init__(self):
        self.user_repo = UserRepository()
        self.rbac_repo = RBACRepository()
        self.admin_log_service = AdminOperationLogService()
        self.user_token_repo = UserTokenRepository()
        self.email_service = EmailService()

    async def _authenticate(self, db: AsyncSession, email: str, password: str):
        """Verify email + password + admin:access (+ brute-force lockout) and return the user.

        Shared by both 2FA steps so the code alone is never enough — the password is re-checked
        when the code is submitted. Raises HTTPException on any failure.
        """
        # 1. Fetch user by email
        user = await self.user_repo.async_get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        # 1b. Per-account brute-force lockout: block if this account has too many recent
        # failed attempts (Redis-backed; the same counter as the main-site login).
        if await _login_fail_count(user.id) >= settings.login_max_failed_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Account temporarily locked due to too many failed login attempts. "
                    f"Please try again in about {settings.login_lockout_minutes} minutes, "
                    "or reset your password."
                ),
            )

        # 2. Verify password
        if not user.password_hash or not verify_password(password, user.password_hash):
            await _register_login_failure(user.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        # Correct password — reset the failed-attempt counter for this account.
        await _clear_login_failures(user.id)

        # 3. Check if user is active
        if not getattr(user, "is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )

        # 4. Verify admin:access permission
        permissions = await self.rbac_repo.get_user_permissions(db, user.id)
        if "admin:access" not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Administrative privileges required.",
            )

        return user

    async def _send_admin_2fa_code(self, db: AsyncSession, user) -> None:
        """Issue + email a fresh 2FA code, invalidating any previous one (so resend supersedes)."""
        await self.user_token_repo.async_delete_token(db, user.id, "2fa")
        code = generate_2fa_code(settings.two_factor_code_length)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.two_factor_code_expire_minutes)
        await self.user_token_repo.async_create_token(
            db=db, user_id=user.id, token=code, token_type="2fa", expires_at=expires_at
        )
        await db.commit()

        sent = await self.email_service.send_2fa_code_email(
            email=user.email, username=user.name or user.username or user.email, code=code
        )
        if not sent:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not send the verification code email. Please try again.",
            )

    async def login(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Step 1 of admin login: verify credentials, then email a 2FA code. No tokens yet.

        Admin login is ALWAYS two-factor (email code) — this cannot be disabled.
        """
        user = await self._authenticate(db, email, password)
        await self._send_admin_2fa_code(db, user)
        return {
            "requires_2fa": True,
            "message": "A verification code has been sent to your email.",
        }

    async def verify_2fa(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        code: str,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Step 2 of admin login: re-verify email + password AND the 2FA code, then issue tokens."""
        user = await self._authenticate(db, email, password)

        token_record = await self.user_token_repo.async_get_by_token(
            db=db, token=code, token_type="2fa"
        )
        if not token_record or token_record.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired verification code.",
            )

        # One-time use — burn the code.
        await self.user_token_repo.async_delete_token(db, user.id, "2fa")
        await db.commit()

        await self.admin_log_service.log_operation(
            db=db,
            admin_user_id=user.id,
            action="admin.login",
            target_type="user",
            target_id=str(user.id),
            before_state=None,
            after_state={"email": email},
            ip_address=ip_address,
        )
        return self._issue_admin_tokens(user)

    def _issue_admin_tokens(self, user) -> Dict[str, Any]:
        """Mint a short-lived admin access token + a rolling 30-minute refresh token."""
        access_token = create_access_token(
            data={"sub": user.uuid},
            expires_delta=timedelta(minutes=ADMIN_ACCESS_TOKEN_MINUTES),
            extra_claims={"role": "admin"},
        )
        refresh_token = create_refresh_token(
            data={"sub": user.uuid},
            expires_delta=timedelta(minutes=ADMIN_SESSION_MINUTES),
        )
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": self._user_payload(user),
        }

    @staticmethod
    def _user_payload(user) -> Dict[str, Any]:
        return {
            "uuid": user.uuid,
            "email": user.email,
            "name": user.name,
            "roles": ["admin"],  # In future, list all roles
        }

    async def refresh(self, db: AsyncSession, admin_refresh_token: str) -> Dict[str, Any]:
        """Issue a fresh ADMIN access token from a valid admin refresh token.

        Distinct from the main /auth/refresh: it re-verifies the account still holds `admin:access`
        (so a demoted admin can't keep a session alive) and re-stamps the `role: admin` claim. The
        admin session is JWT-only (admin login creates no DB session), so this is a signature/expiry
        check plus the live permission check — not session-family rotation.
        """
        try:
            payload = decode_token(admin_refresh_token)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        user = await self.user_repo.async_get_by_uuid(db, payload.get("sub"))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session no longer valid")
        if hasattr(user, "is_active") and not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")

        permissions = await self.rbac_repo.get_user_permissions(db, user.id)
        if "admin:access" not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Administrative privileges required.",
            )

        # Roll the session forward: a fresh 5-min access token + a fresh 30-min refresh token.
        return self._issue_admin_tokens(user)

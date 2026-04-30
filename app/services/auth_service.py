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
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
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
    create_access_token,
    create_refresh_token,
    generate_verification_token,
    generate_reset_token,
    generate_2fa_code,
)
from app.core.config import settings


class AuthService:
    """Service for authentication operations"""

    def __init__(self):
        self.user_repo = UserRepository()
        self.user_token_repo = UserTokenRepository()
        self.session_repo = UserSessionRepository()
        self.operation_limit_repo = OperationLimitRepository()

    async def register_user(
        self,
        db: AsyncSession,
        email: str,
        username: str,
        password: str,
        name: Optional[str] = None,
    ) -> Tuple[User, str]:
        """
        Register a new user account.

        Args:
            db: Database session
            email: User email address
            username: Unique username
            password: Plain text password
            name: Optional display name

        Returns:
            Tuple of (User, verification_token)

        Raises:
            HTTPException: If validation fails or user already exists
        """
        # Validate username
        is_valid_username, username_error = validate_username(username)
        if not is_valid_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=username_error
            )

        # Validate password strength
        is_valid_password, password_error = validate_password_strength(password)
        if not is_valid_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=password_error
            )

        # Check if email already exists
        existing_user = await self.user_repo.async_get_by_email(db, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Check if username already exists
        existing_username = await self.user_repo.async_get_by_username(db, username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
            )

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

        return user, token

    async def login_user(
        self,
        db: AsyncSession,
        email_or_username: str,
        password: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
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

        # Verify password
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        # Require verified email before issuing tokens
        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify your email before logging in.",
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
            db=db, user=user, user_agent=user_agent, ip_address=ip_address
        )

    async def verify_2fa_and_login(
        self,
        db: AsyncSession,
        user_id: int,
        code: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
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
            db=db, user=user, user_agent=user_agent, ip_address=ip_address
        )

    async def _create_user_session(
        self,
        db: AsyncSession,
        user: User,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
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
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
        }

    async def verify_email(self, db: AsyncSession, token: str) -> User:
        """
        Verify email with token.

        Args:
            db: Database session
            token: Verification token from email

        Returns:
            Verified user

        Raises:
            HTTPException: If token is invalid or expired
        """
        # Get token
        verification_token = await self.user_token_repo.async_get_by_token(
            db, token, "email_verification"
        )

        if not verification_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token",
            )

        # Mark email as verified
        user = await self.user_repo.async_update_email_verified(
            db=db, user_id=verification_token.user_id, is_verified=True
        )

        # Delete token (fetch-validate-delete pattern)
        await self.user_token_repo.async_delete_token(
            db, verification_token.user_id, "email_verification"
        )

        return user

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

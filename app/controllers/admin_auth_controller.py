"""
Admin Authentication Controller
===============================

Handles business logic for administrative login and session management.
Verifies credentials and ensures the user has administrative access rights.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import Dict, Any, Optional
from datetime import timedelta
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.repositories.rbac_repository import RBACRepository
from app.services.admin_operation_log_service import AdminOperationLogService


class AdminAuthController:
    """
    Controller for admin authentication operations.
    """

    def __init__(self):
        self.user_repo = UserRepository()
        self.rbac_repo = RBACRepository()
        self.admin_log_service = AdminOperationLogService()

    async def login(
        self, 
        db: AsyncSession, 
        email: str, 
        password: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate an admin and return JWT tokens.
        """
        # 1. Fetch user by email
        user = await self.user_repo.async_get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        # 2. Verify password
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        # 3. Check if user is active
        if hasattr(user, 'is_active') and not user.is_active:
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

        # 5. Create tokens with admin claim
        access_token_expires = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        # For admin, we might want a shorter duration, but following settings for now.
        
        access_token = create_access_token(
            data={"sub": user.uuid},
            expires_delta=access_token_expires,
            extra_claims={"role": "admin"}
        )
        
        refresh_token = create_refresh_token(
            data={"sub": user.uuid}
        )

        # Log successful admin login
        await self.admin_log_service.log_operation(
            db=db,
            admin_user_id=user.id,
            action="admin.login",
            target_type="user",
            target_id=str(user.id),
            before_state=None,
            after_state={"email": email},
            ip_address=ip_address
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

        access_token = create_access_token(
            data={"sub": user.uuid},
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
            extra_claims={"role": "admin"},
        )
        new_refresh_token = create_refresh_token(data={"sub": user.uuid})

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": self._user_payload(user),
        }

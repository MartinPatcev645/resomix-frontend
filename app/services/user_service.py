"""
User Service
============

User profile management and updates including profile CRUD, password changes,
and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
from app.repositories.user_repository import (
    UserRepository,
    UserSessionRepository,
)
from app.core.security import hash_password, verify_password, validate_password_strength


class UserService:
    """Service for user profile management"""

    def __init__(self):
        self.user_repo = UserRepository()
        self.session_repo = UserSessionRepository()

    async def get_user_profile(
        self, db: AsyncSession, user_uuid: str
    ) -> Optional[User]:
        """
        Get user profile by UUID (external ID).

        Args:
            db: Database session
            user_uuid: User's external UUID

        Returns:
            User object or None
        """
        return await self.user_repo.async_get_by_uuid(db, user_uuid)

    async def update_profile(
        self,
        db: AsyncSession,
        user_id: int,
        name: Optional[str] = None,
        language: Optional[str] = None,
        timezone: Optional[str] = None,
        profile_picture: Optional[str] = None,
    ) -> User:
        """
        Update user profile information.

        Args:
            db: Database session
            user_id: User's internal ID
            name: Display name
            language: Preferred language
            timezone: User timezone
            profile_picture: Profile picture URL

        Returns:
            Updated user

        Raises:
            HTTPException: If user not found
        """
        user = await self.user_repo.async_get_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Update only provided fields
        if name is not None:
            user.name = name
        if language is not None:
            user.language = language
        if timezone is not None:
            user.timezone = timezone
        if profile_picture is not None:
            user.profile_picture = profile_picture

        await db.commit()
        await db.refresh(user)

        return user

    async def change_password(
        self, db: AsyncSession, user_id: int, current_password: str, new_password: str
    ) -> User:
        """
        Change user password (requires current password).

        Args:
            db: Database session
            user_id: User's internal ID
            current_password: Current password for verification
            new_password: New password

        Returns:
            Updated user

        Raises:
            HTTPException: If validation fails
        """
        user = await self.user_repo.async_get_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Verify current password
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )

        # Validate new password strength
        is_valid, error = validate_password_strength(new_password)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

        # Check if new password is same as current
        if verify_password(new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password",
            )

        # Update password
        password_hash = hash_password(new_password)
        user = await self.user_repo.async_update_password(
            db=db, user_id=user_id, new_password_hash=password_hash
        )

        # Revoke all sessions (force re-login on all devices)
        await self.session_repo.async_revoke_all_user_sessions(db, user_id)

        return user

    async def delete_account(
        self, db: AsyncSession, user_id: int, password: str
    ) -> bool:
        """
        Delete user account (requires password confirmation).

        Args:
            db: Database session
            user_id: User's internal ID
            password: Password for confirmation

        Returns:
            True if deleted successfully

        Raises:
            HTTPException: If password is incorrect
        """
        user = await self.user_repo.async_get_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect"
            )

        # Delete user (cascade will handle related records)
        return await self.user_repo.async_delete(db, user_id)

    async def get_user_sessions(
        self, db: AsyncSession, user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get list of active sessions/devices for user.

        Args:
            db: Database session
            user_id: User's internal ID

        Returns:
            List of session information
        """
        sessions = await self.session_repo.async_get_active_sessions(db, user_id)

        return [
            {
                "session_id": session.session_id,
                "user_agent": session.user_agent,
                "ip_address": session.ip_address,
                "created_at": (
                    session.created_at.isoformat() if session.created_at else None
                ),
                "expires_at": (
                    session.expires_at.isoformat() if session.expires_at else None
                ),
            }
            for session in sessions
        ]

    async def revoke_session(
        self, db: AsyncSession, user_id: int, session_id: str
    ) -> bool:
        """
        Revoke a specific session (logout from specific device).

        Args:
            db: Database session
            user_id: User's internal ID
            session_id: Session ID to revoke

        Returns:
            True if revoked successfully

        Raises:
            HTTPException: If session not found or doesn't belong to user
        """
        session = await self.session_repo.async_get_by_session_id(db, session_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
            )

        # Verify session belongs to user
        if session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to revoke this session",
            )

        return await self.session_repo.async_revoke_session(db, session_id)

    async def search_users(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search users by email, username, UUID, or numeric ID.

        Returns a lightweight representation suitable for admin lookups.
        """
        users = await self.user_repo.async_search_users(db, query=query, limit=limit)
        results: List[Dict[str, Any]] = []

        for user in users:
            results.append(
                {
                    "id": user.id,
                    "uuid": user.uuid,
                    "email": user.email,
                    "username": user.username,
                    "name": user.name,
                    "is_email_verified": user.is_email_verified,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            )

        return results

    async def enable_2fa(
        self, db: AsyncSession, user_id: int, method: str = "email"
    ) -> User:
        """
        Enable two-factor authentication for user.

        Args:
            db: Database session
            user_id: User's internal ID
            method: 2FA method ('email' or 'app')

        Returns:
            Updated user

        Raises:
            HTTPException: If user not found, invalid method, or email not verified
        """
        if method not in ["email", "app"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid 2FA method. Must be 'email' or 'app'",
            )

        # Get user first to check email verification status
        user = await self.user_repo.async_get_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Verify email is verified before enabling 2FA
        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email must be verified before enabling two-factor authentication",
            )

        user = await self.user_repo.async_enable_2fa(db, user_id, method)

        return user

    async def disable_2fa(self, db: AsyncSession, user_id: int, password: str) -> User:
        """
        Disable two-factor authentication (requires password).

        Args:
            db: Database session
            user_id: User's internal ID
            password: Password for confirmation

        Returns:
            Updated user

        Raises:
            HTTPException: If password is incorrect
        """
        user = await self.user_repo.async_get_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect"
            )

        return await self.user_repo.async_disable_2fa(db, user_id)

    # ------------------------------------------------------------------
    # RBAC Management Methods
    # ------------------------------------------------------------------

    async def list_users_admin(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> (List[User], int):
        """List users with filters and RBAC details."""
        return await self.user_repo.async_list_users_admin(
            db, page, page_size, search, role_id, is_active
        )

    async def assign_role(self, db: AsyncSession, user_id: int, role_id: int) -> Dict[str, Any]:
        """Assign a role to a user."""
        try:
            success = await self.user_repo.async_assign_role(db, user_id, role_id)
            if success:
                return {"success": True, "data": {"message": "Role assigned successfully"}}
            return {"success": False, "error": "Failed to assign role or role already assigned"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def remove_role(self, db: AsyncSession, user_id: int, role_id: int) -> Dict[str, Any]:
        """Remove a role from a user."""
        try:
            success = await self.user_repo.async_remove_role(db, user_id, role_id)
            if success:
                return {"success": True, "data": {"message": "Role removed successfully"}}
            return {"success": False, "error": "Failed to remove role or role not assigned"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def update_user_status(self, db: AsyncSession, user_id: int, is_active: bool) -> Dict[str, Any]:
        """Update user active status."""
        try:
            user = await self.user_repo.async_get_by_id(db, user_id)
            if not user:
                return {"success": False, "error": "User not found"}
            
            user.is_active = is_active
            await db.commit()
            return {"success": True, "data": {"is_active": is_active}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_user_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Get user by internal ID."""
        return await self.user_repo.async_get_by_id(db, user_id)

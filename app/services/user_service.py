"""
User Service
============

User profile management and updates including profile CRUD, password changes,
and session management.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
from app.repositories.user_repository import (
    UserRepository,
    UserSessionRepository,
)
from app.repositories.rbac_repository import RBACRepository
from app.core.security import hash_password, verify_password, validate_password_strength
from app.services.admin_operation_log_service import AdminOperationLogService


class UserService:
    """Service for user profile management"""

    def __init__(self):
        self.user_repo = UserRepository()
        self.session_repo = UserSessionRepository()
        self.admin_log_service = AdminOperationLogService()

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
        # Update only provided fields
        update_kwargs = {}
        if name is not None:
            update_kwargs["name"] = name
        if language is not None:
            update_kwargs["language"] = language
        if timezone is not None:
            update_kwargs["timezone"] = timezone
        if profile_picture is not None:
            update_kwargs["profile_picture"] = profile_picture

        user = await self.user_repo.async_update(db, id=user_id, commit=True, **update_kwargs)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

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

        # Social-login accounts (e.g. Google) start with no local password. This same endpoint then
        # doubles as "set a password": require the current password ONLY when one already exists.
        has_existing_password = bool(user.password_hash)
        if has_existing_password:
            # 400 (not 401): the user is authenticated; a wrong value here must not trip the
            # frontend's 401→refresh→logout interceptor.
            if not verify_password(current_password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect",
                )

        # Validate new password strength
        is_valid, error = validate_password_strength(new_password)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

        # Must differ from an existing password (only meaningful when one exists).
        if has_existing_password and verify_password(new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password",
            )

        # Update password
        password_hash = hash_password(new_password)
        user = await self.user_repo.async_update_password(
            db=db, user_id=user_id, new_password_hash=password_hash
        )

        # Force re-login everywhere only when CHANGING an existing password (security). Setting a
        # first password on a social account keeps the current session alive.
        if has_existing_password:
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
    ) -> Tuple[List[User], int]:
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

    async def get_user_detail(self, db: AsyncSession, user_uuid: str) -> Optional[User]:
        """Get detailed user record loading their roles."""
        return await self.user_repo.async_get_user_with_roles(db, user_uuid)

    async def admin_create_user(
        self,
        db: AsyncSession,
        user_data: Dict[str, Any],
        current_admin: User,
        ip_address: Optional[str] = None
    ) -> User:
        """Manually create a new user from administrative console."""
        # Check if email already exists
        existing_email = await self.user_repo.async_get_by_email(db, user_data["email"])
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )

        # Check if username already exists
        existing_username = await self.user_repo.async_get_by_username(db, user_data["username"])
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        pw_hash = hash_password(user_data["password"])
        
        user = await self.user_repo.async_create(
            db=db,
            commit=False,
            email=user_data["email"],
            username=user_data["username"],
            password_hash=pw_hash,
            name=user_data.get("name"),
            partner_id=user_data.get("partner_id", 1),
            is_active=user_data.get("is_active", True),
            is_email_verified=user_data.get("is_email_verified", False)
        )

        await self.admin_log_service.log_operation(
            db=db,
            admin_user_id=current_admin.id,
            action="user.create",
            target_type="user",
            target_id=str(user.uuid),
            before_state=None,
            after_state={
                "email": user.email,
                "username": user.username,
                "partner_id": user.partner_id
            },
            ip_address=ip_address
        )

        await db.commit()
        await db.refresh(user)
        return user

    async def admin_update_user(
        self,
        db: AsyncSession,
        user_uuid: str,
        update_data: Dict[str, Any],
        current_admin: User,
        ip_address: Optional[str] = None
    ) -> User:
        """Update user details manually from admin console."""
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        before_state = {
            "name": user.name,
            "is_active": user.is_active,
            "partner_id": user.partner_id
        }

        # Build update kwargs
        kwargs = {}
        if "name" in update_data:
            kwargs["name"] = update_data["name"]
        if "is_active" in update_data:
            kwargs["is_active"] = update_data["is_active"]
        if "partner_id" in update_data:
            kwargs["partner_id"] = update_data["partner_id"]
        if "password" in update_data:
            kwargs["password_hash"] = hash_password(update_data["password"])

        updated_user = await self.user_repo.async_update(
            db=db,
            id=user.id,
            commit=False,
            **kwargs
        )

        await self.admin_log_service.log_operation(
            db=db,
            admin_user_id=current_admin.id,
            action="user.update",
            target_type="user",
            target_id=user_uuid,
            before_state=before_state,
            after_state=update_data,
            ip_address=ip_address
        )

        await db.commit()
        await db.refresh(updated_user)
        return updated_user

    async def admin_assign_role(
        self,
        db: AsyncSession,
        user_uuid: str,
        role_name: str,
        current_admin: User,
        ip_address: Optional[str] = None
    ) -> bool:
        """Assign role to user by role name."""
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)
        rbac_repo = RBACRepository()
        role = await rbac_repo.get_role_by_name(db, role_name)

        if not user or not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or Role not found"
            )

        success = await self.user_repo.async_assign_role(db, user.id, role.id)
        if success:
            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.role.assign",
                target_type="user",
                target_id=user_uuid,
                before_state=None,
                after_state={"role": role_name},
                ip_address=ip_address
            )
            await db.commit()
            return True
        return False

    async def admin_remove_role(
        self,
        db: AsyncSession,
        user_uuid: str,
        role_name: str,
        current_admin: User,
        ip_address: Optional[str] = None
    ) -> bool:
        """Remove role from user by role name."""
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)
        rbac_repo = RBACRepository()
        role = await rbac_repo.get_role_by_name(db, role_name)

        if not user or not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or Role not found"
            )

        # Prevent removing 'admin' role from self to avoid lock-out
        if user.id == current_admin.id and role_name == "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin role from yourself"
            )

        success = await self.user_repo.async_remove_role(db, user.id, role.id)
        if success:
            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.role.remove",
                target_type="user",
                target_id=user_uuid,
                before_state={"role": role_name},
                after_state=None,
                ip_address=ip_address
            )
            await db.commit()
            return True
        return False

    async def admin_toggle_user_status(
        self,
        db: AsyncSession,
        user_uuid: str,
        current_admin: User,
        ip_address: Optional[str] = None
    ) -> User:
        """Toggle user active/inactive status."""
        user = await self.user_repo.async_get_by_uuid(db, user_uuid)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent deactivating self
        if user.id == current_admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate yourself"
            )

        old_status = user.is_active
        new_status = not old_status

        updated_user = await self.user_repo.async_update(
            db=db,
            id=user.id,
            commit=False,
            is_active=new_status
        )

        await self.admin_log_service.log_operation(
            db=db,
            admin_user_id=current_admin.id,
            action="user.toggle_status",
            target_type="user",
            target_id=user_uuid,
            before_state={"is_active": old_status},
            after_state={"is_active": new_status},
            ip_address=ip_address
        )

        await db.commit()
        await db.refresh(updated_user)
        return updated_user

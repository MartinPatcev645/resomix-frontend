"""
Admin User Controller
=====================

Handles administrative user management operations including CRUD, 
role assignment, and status management.

Version: 1.0.0
Date: May 16, 2026
Author: Muhammad Usman Naeem
"""

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging

from app.repositories.user_repository import UserRepository
from app.repositories.rbac_repository import RBACRepository
from app.services.admin_operation_log_service import AdminOperationLogService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.core.security import hash_password
from app.models.user import User

logger = logging.getLogger(__name__)


class AdminUserController:
    """Controller for administrative user operations."""

    def __init__(self):
        self.user_repo = UserRepository()
        self.rbac_repo = RBACRepository()
        self.admin_log_service = AdminOperationLogService()
        self.logging_service = LoggingService()

    async def get_users_list(
        self,
        db: AsyncSession,
        request: Request,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> JSONResponse:
        """Get paginated list of users with filters."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            users, total = await self.user_repo.async_list_users_admin(
                db, page=page, page_size=page_size, search=search, role_id=role_id, is_active=is_active
            )

            user_list = []
            for u in users:
                user_list.append({
                    "uuid": u.uuid,
                    "email": u.email,
                    "username": u.username,
                    "name": u.name,
                    "partner_id": u.partner_id,
                    "is_active": u.is_active,
                    "is_email_verified": u.is_email_verified,
                    "roles": [r.role.name for r in u.roles],
                    "created_at": u.created_at.isoformat() if u.created_at else None
                })

            duration_ms = (time.time() - start_time) * 1000
            response_data = {
                "success": True,
                "data": user_list,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size if total > 0 else 0
                }
            }

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except Exception as e:
            logger.error(f"Error listing users: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve users list")
            )

    async def get_user_detail(self, db: AsyncSession, user_uuid: str) -> JSONResponse:
        """Get full details for a specific user."""
        try:
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found")
                )

            # Load roles explicitly if not pre-loaded
            from sqlalchemy.orm import selectinload
            from app.models.user import UserRole
            
            # Since we have the user object, we can just access roles if it was loaded
            # or do a fresh fetch with roles
            stmt = (
                UserRepository().model.__table__.select()
                .where(UserRepository().model.uuid == user_uuid)
            )
            # Actually, Repo.async_get_by_uuid doesn't load roles by default.
            # I'll just fetch again with roles for detail view.
            from sqlalchemy import select
            stmt = select(User).where(User.uuid == user_uuid).options(selectinload(User.roles).selectinload(UserRole.role))
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()

            user_data = {
                "uuid": user.uuid,
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "partner_id": user.partner_id,
                "is_active": user.is_active,
                "is_email_verified": user.is_email_verified,
                "is_two_factor_enabled": user.is_two_factor_enabled,
                "two_factor_method": user.two_factor_method,
                "roles": [r.role.name for r in user.roles],
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "last_login": None # In Phase 2, we would pull this from sessions
            }

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=user_data)
            )

        except Exception as e:
            logger.error(f"Error getting user detail: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve user details")
            )

    async def create_user(
        self,
        db: AsyncSession,
        request: Request,
        user_data: Dict[str, Any],
        current_admin: User
    ) -> JSONResponse:
        """Manually create a new user."""
        try:
            # Check for existing
            existing = await self.user_repo.async_get_by_email(db, user_data["email"])
            if existing:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Email already exists")
                )

            # Create user
            pw_hash = hash_password(user_data["password"])
            user = User(
                email=user_data["email"],
                username=user_data["username"],
                password_hash=pw_hash,
                name=user_data.get("name"),
                partner_id=user_data.get("partner_id", 1),
                is_active=user_data.get("is_active", True),
                is_email_verified=user_data.get("is_email_verified", False)
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)

            # Audit log
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
                ip_address=request.client.host if request.client else None
            )

            # Commit all
            await db.commit()

            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=format_response(success=True, data={"uuid": user.uuid, "message": "User created successfully"})
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating user: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to create user")
            )

    async def update_user(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        update_data: Dict[str, Any],
        current_admin: User
    ) -> JSONResponse:
        """Update user profile or status."""
        try:
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found")
                )

            before_state = {
                "name": user.name,
                "is_active": user.is_active,
                "partner_id": user.partner_id
            }

            # Apply updates
            if "name" in update_data: user.name = update_data["name"]
            if "is_active" in update_data: user.is_active = update_data["is_active"]
            if "partner_id" in update_data: user.partner_id = update_data["partner_id"]
            if "password" in update_data: user.password_hash = hash_password(update_data["password"])

            await db.flush()

            # Audit log
            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.update",
                target_type="user",
                target_id=user_uuid,
                before_state=before_state,
                after_state=update_data,
                ip_address=request.client.host if request.client else None
            )

            await db.commit()

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, message="User updated successfully")
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating user: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to update user")
            )

    async def assign_role(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        role_name: str,
        current_admin: User
    ) -> JSONResponse:
        """Assign a role to a user."""
        try:
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)
            role = await self.rbac_repo.get_role_by_name(db, role_name)

            if not user or not role:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User or Role not found")
                )

            success = await self.rbac_repo.assign_role_to_user(db, user.id, role.id, granted_by=current_admin.id)
            if success:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="user.role.assign",
                    target_type="user",
                    target_id=user_uuid,
                    before_state=None,
                    after_state={"role": role_name},
                    ip_address=request.client.host if request.client else None
                )
                await db.commit()
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=f"Role '{role_name}' assigned to user")
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Failed to assign role or already assigned")
                )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error assigning role: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during role assignment")
            )

    async def remove_role(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        role_name: str,
        current_admin: User
    ) -> JSONResponse:
        """Remove a role from a user."""
        try:
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)
            role = await self.rbac_repo.get_role_by_name(db, role_name)

            if not user or not role:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User or Role not found")
                )

            # Prevent removing 'admin' role from self to avoid lock-out
            if user.id == current_admin.id and role_name == "admin":
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Cannot remove admin role from yourself")
                )

            success = await self.rbac_repo.remove_role_from_user(db, user.id, role.id)
            if success:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="user.role.remove",
                    target_type="user",
                    target_id=user_uuid,
                    before_state={"role": role_name},
                    after_state=None,
                    ip_address=request.client.host if request.client else None
                )
                await db.commit()
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=f"Role '{role_name}' removed from user")
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Failed to remove role or not assigned")
                )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error removing role: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during role removal")
            )

    async def toggle_user_status(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        current_admin: User
    ) -> JSONResponse:
        """Toggle user active/inactive status."""
        try:
            user = await self.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found")
                )

            # Prevent deactivating self
            if user.id == current_admin.id:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Cannot deactivate yourself")
                )

            old_status = user.is_active
            user.is_active = not old_status
            await db.flush()

            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.toggle_status",
                target_type="user",
                target_id=user_uuid,
                before_state={"is_active": old_status},
                after_state={"is_active": user.is_active},
                ip_address=request.client.host if request.client else None
            )

            await db.commit()

            status_str = "activated" if user.is_active else "deactivated"
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, message=f"User {status_str} successfully")
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error toggling user status: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to toggle user status")
            )

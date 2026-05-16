"""
Admin Users Router
==================

API endpoints for administrative user management.
Guarded by robust RBAC and DB-backed admin verification.

Version: 1.0.0
Date: May 16, 2026
Author: Muhammad Usman Naeem
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_async_db
from app.api.dependencies.auth import require_admin, require_permission
from app.controllers.admin_user_controller import AdminUserController
from app.schemas.admin_user import (
    AdminUserListResponse,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminRoleAssignRequest
)
from app.models.user import User

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin User Management"],
    dependencies=[Depends(require_admin), Depends(require_permission("user:read"))]
)

user_controller = AdminUserController()


@router.get("", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by email, username, or name"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """List all users with pagination and filters."""
    return await user_controller.get_users_list(
        db, request, page, page_size, search, role_id, is_active
    )


@router.get("/{user_uuid}")
async def get_user(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db)
):
    """Get detailed information for a single user."""
    return await user_controller.get_user_detail(db, user_uuid)


@router.post("", dependencies=[Depends(require_permission("user:create"))])
async def create_user(
    user_data: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Manually create a new user account."""
    return await user_controller.create_user(
        db, request, user_data.model_dump(), current_admin
    )


@router.patch("/{user_uuid}", dependencies=[Depends(require_permission("user:update"))])
async def update_user(
    user_uuid: str,
    update_data: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Update user profile or metadata."""
    return await user_controller.update_user(
        db, request, user_uuid, update_data.model_dump(exclude_unset=True), current_admin
    )


@router.post("/{user_uuid}/roles", dependencies=[Depends(require_permission("user:role:assign"))])
async def assign_role(
    user_uuid: str,
    role_data: AdminRoleAssignRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Assign an RBAC role to a user."""
    return await user_controller.assign_role(
        db, request, user_uuid, role_data.role_name, current_admin
    )


@router.delete("/{user_uuid}/roles/{role_name}", dependencies=[Depends(require_permission("user:role:assign"))])
async def remove_role(
    user_uuid: str,
    role_name: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Remove an RBAC role from a user."""
    return await user_controller.remove_role(
        db, request, user_uuid, role_name, current_admin
    )


@router.post("/{user_uuid}/toggle-status", dependencies=[Depends(require_permission("user:update"))])
async def toggle_status(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Toggle user active status."""
    return await user_controller.toggle_user_status(
        db, request, user_uuid, current_admin
    )

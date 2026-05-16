"""
Admin Roles Router
==================

API endpoints for RBAC role and permission management.
Guarded by robust RBAC and DB-backed admin verification.

Version: 1.0.0
Date: May 16, 2026
Author: Muhammad Usman Naeem
"""

from typing import List
from fastapi import APIRouter, Depends, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_async_db
from app.api.dependencies.auth import require_admin, require_permission
from app.controllers.admin_role_controller import AdminRoleController
from app.models.user import User

router = APIRouter(
    prefix="/admin/roles",
    tags=["Admin RBAC Management"],
    dependencies=[Depends(require_admin), Depends(require_permission("role:read"))]
)

role_controller = AdminRoleController()


@router.get("")
async def list_roles(
    db: AsyncSession = Depends(get_async_db)
):
    """List all defined roles."""
    return await role_controller.list_roles(db)


@router.get("/permissions")
async def list_permissions(
    db: AsyncSession = Depends(get_async_db)
):
    """List all available system permissions."""
    return await role_controller.list_all_permissions(db)


@router.get("/{role_name}")
async def get_role(
    role_name: str,
    db: AsyncSession = Depends(get_async_db)
):
    """Get detailed role information."""
    return await role_controller.get_role_detail(db, role_name)


@router.put("/{role_name}/permissions", dependencies=[Depends(require_permission("role:manage"))])
async def sync_permissions(
    role_name: str,
    permission_names: List[str] = Body(..., embed=True),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Sync the set of permissions assigned to a role."""
    return await role_controller.update_role_permissions(
        db, request, role_name, permission_names, current_admin
    )

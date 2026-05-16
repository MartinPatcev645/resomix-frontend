"""
Admin Role Management API Router
================================

This module defines the FastAPI router for admin role and permission management.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import List
from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.controllers.role_controller import RoleController
from app.schemas.user import (
    RoleCreateRequest,
    RolePermissionsUpdateRequest
)
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/admin/roles",
    tags=["admin-roles"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

controller = RoleController()


@router.get(
    "/",
    summary="List All Roles",
)
async def list_roles(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_roles(db=db, request=request, current_admin=current_admin)


@router.get(
    "/permissions",
    summary="List All Available Permissions",
)
async def list_permissions(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_permissions(db=db, request=request, current_admin=current_admin)


@router.post(
    "/",
    status_code=201,
    summary="Create New Role",
)
async def create_role(
    request: Request,
    payload: RoleCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("roles:manage"))
) -> JSONResponse:
    return await controller.create_role(
        db=db,
        request=request,
        name=payload.name,
        description=payload.description,
        current_admin=current_admin
    )


@router.patch(
    "/{role_id}/permissions",
    summary="Update Role Permissions",
)
async def update_role_permissions(
    request: Request,
    payload: RolePermissionsUpdateRequest,
    role_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("roles:manage"))
) -> JSONResponse:
    return await controller.update_role_permissions(
        db=db,
        request=request,
        role_id=role_id,
        permission_ids=payload.permission_ids,
        current_admin=current_admin
    )

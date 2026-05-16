"""
Admin User Management API Router
================================

This module defines the FastAPI router for admin user and RBAC management.

Version: 1.0.0
Date: May 16, 2026
"""

from typing import Optional
from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.controllers.user_controller import UserController
from app.schemas.user import (
    AdminUserListResponse,
    UserRoleAssignmentRequest,
    UserStatusUpdateRequest,
    UserSearchResultsResponse
)
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/admin/users",
    tags=["admin-users"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

controller = UserController()


@router.get(
    "/",
    response_model=AdminUserListResponse,
    summary="List Users",
    description="Get paginated list of users with RBAC details.",
)
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by email, username, or name"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_users_admin(
        db=db,
        request=request,
        page=page,
        page_size=page_size,
        search=search,
        role_id=role_id,
        is_active=is_active,
        current_admin=current_admin
    )


@router.get(
    "/search",
    response_model=UserSearchResultsResponse,
    summary="Search Users (Legacy/Lightweight)",
)
async def search_users(
    request: Request,
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.search_users(db=db, request=request, query=query, limit=limit)


@router.post(
    "/{user_id}/roles",
    summary="Assign Role to User",
)
async def assign_role(
    request: Request,
    payload: UserRoleAssignmentRequest,
    user_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("roles:manage"))
) -> JSONResponse:
    return await controller.assign_role_admin(
        db=db,
        request=request,
        user_id=user_id,
        role_id=payload.role_id,
        current_admin=current_admin
    )


@router.delete(
    "/{user_id}/roles/{role_id}",
    summary="Remove Role from User",
)
async def remove_role(
    request: Request,
    user_id: int = Path(..., ge=1),
    role_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("roles:manage"))
) -> JSONResponse:
    return await controller.remove_role_admin(
        db=db,
        request=request,
        user_id=user_id,
        role_id=role_id,
        current_admin=current_admin
    )


@router.patch(
    "/{user_id}/status",
    summary="Update User Status",
    description="Activate or deactivate a user account.",
)
async def update_user_status(
    request: Request,
    payload: UserStatusUpdateRequest,
    user_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("users:manage"))
) -> JSONResponse:
    return await controller.update_user_status_admin(
        db=db,
        request=request,
        user_id=user_id,
        is_active=payload.is_active,
        current_admin=current_admin
    )

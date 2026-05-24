"""
Admin Operation Limit API Router
================================

This module defines the FastAPI router for admin operation limit management endpoints.
It handles operation types and user limit management with RBAC.

Version: 1.1.0
Date: May 16, 2026
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.controllers.operation_limit_controller import OperationLimitController
from app.schemas.operation_limit import (
    AdminOperationTypeListResponse,
    UserOperationLimitDeleteResponse,
    UserOperationLimitDetailResponse,
    UserOperationLimitListFilters,
    UserOperationLimitListResponse,
    UserOperationLimitUpsertRequest,
)
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/admin/operation-limits",
    tags=["admin-operation-limits"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

controller = OperationLimitController()


@router.get(
    "/operation-types",
    response_model=AdminOperationTypeListResponse,
    status_code=200,
    summary="List operation types",
    description="Return all operation types that can be limited for users.",
)
async def list_operation_types(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_operation_types(db=db, request=request, current_admin=current_admin)


@router.get(
    "/",
    response_model=UserOperationLimitListResponse,
    status_code=200,
    summary="List user operation limits",
    description="Paginated list of user operation limits with optional filters.",
)
async def list_user_operation_limits(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email, username, UUID, or user id"),
    operation_code: Optional[str] = Query(None, description="Filter by operation code"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    filters = {
        "page": page,
        "page_size": page_size,
        "search": search,
        "operation_code": operation_code,
    }
    return await controller.list_user_operation_limits(db=db, request=request, filters=filters, current_admin=current_admin)


@router.get(
    "/{user_identifier}/{operation_code}",
    response_model=UserOperationLimitDetailResponse,
    status_code=200,
    summary="Get user operation limit",
)
async def get_user_operation_limit(
    request: Request,
    user_identifier: str = Path(..., description="Email, UUID, username, or numeric ID for the user"),
    operation_code: str = Path(..., description="Operation code (e.g., playlist_create)"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.get_user_operation_limit(
        db=db,
        request=request,
        user_identifier=user_identifier,
        operation_code=operation_code,
    )


@router.put(
    "/",
    response_model=UserOperationLimitDetailResponse,
    status_code=200,
    summary="Create or update user limit",
)
async def upsert_user_operation_limit(
    request: Request,
    payload: UserOperationLimitUpsertRequest,
    force: bool = Query(False, description="Force overwrite even if limit exists"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("operation_limit:manage"))
) -> JSONResponse:
    return await controller.upsert_user_operation_limit(
        db=db,
        request=request,
        user_identifier=payload.user_identifier,
        operation_code=payload.operation_code,
        limit_value=payload.limit_value,
        window_seconds=payload.window_seconds,
        created_by=current_admin.id,
        force=force,
        current_admin=current_admin
    )


@router.delete(
    "/{user_identifier}/{operation_code}",
    response_model=UserOperationLimitDeleteResponse,
    status_code=200,
    summary="Delete user limit",
)
async def delete_user_operation_limit(
    request: Request,
    user_identifier: str = Path(..., description="Email, UUID, username, or numeric ID for the user"),
    operation_code: str = Path(..., description="Operation code"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("operation_limit:manage"))
) -> JSONResponse:
    return await controller.delete_user_operation_limit(
        db=db,
        request=request,
        user_identifier=user_identifier,
        operation_code=operation_code,
        current_admin=current_admin
    )

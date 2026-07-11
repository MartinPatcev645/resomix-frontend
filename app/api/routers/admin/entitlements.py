"""
Admin Entitlement API Router
============================

Phase-7 admin endpoints for the frontend plan/entitlement system: list/read plans + features,
edit a plan's per-feature entitlement value (typed-validated, cache-busting), toggle plan flags,
and inspect a user's effective plan. Reads require ``admin:access``; writes additionally require
``plans:manage``.

Scope: frontend consumer plans (System Partner 1 + guests). B2B is untouched.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.controllers.admin_entitlement_controller import AdminEntitlementController
from app.models.user import User
from app.schemas.admin_entitlement import SetEntitlementRequest, UpdatePlanRequest
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/admin",
    tags=["admin-entitlements"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

controller = AdminEntitlementController()


@router.get("/plans", status_code=200, summary="List plans with their entitlements")
async def list_plans(
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_plans(db)


@router.get("/entitlements/metrics", status_code=200, summary="Entitlement gate/cache metrics (in-process)")
async def entitlement_metrics_endpoint(
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.get_metrics()


@router.get("/features", status_code=200, summary="List the feature catalog")
async def list_features(
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.list_features(db)


@router.get("/plans/{code}", status_code=200, summary="Get one plan + its entitlements")
async def get_plan(
    code: str = Path(..., description="Plan code, e.g. guest|free|basic|pro|max"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.get_plan(db, code)


@router.put(
    "/plans/{code}/entitlements/{feature_key}",
    status_code=200,
    summary="Set a plan's entitlement value for a feature",
)
async def set_entitlement(
    payload: SetEntitlementRequest,
    code: str = Path(..., description="Plan code"),
    feature_key: str = Path(..., description="Feature key, e.g. search_playlists_per_month"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("plans:manage")),
) -> JSONResponse:
    return await controller.set_entitlement(db, code, feature_key, payload.value, current_admin)


@router.patch("/plans/{code}", status_code=200, summary="Update plan-level flags")
async def update_plan(
    payload: UpdatePlanRequest,
    code: str = Path(..., description="Plan code"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("plans:manage")),
) -> JSONResponse:
    return await controller.update_plan(
        db, code,
        name=payload.name, is_active=payload.is_active, is_default=payload.is_default,
        current_admin=current_admin,
    )


@router.get(
    "/users/{user_uuid}/effective-plan",
    status_code=200,
    summary="Inspect a user's effective plan, entitlements, and overrides",
)
async def get_user_effective_plan(
    user_uuid: str = Path(..., description="Target user's UUID, email, or username"),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await controller.get_user_effective(db, user_uuid)

"""
Entitlements API Router (consumer-facing)
=========================================

``GET /entitlements/me`` — the caller's effective plan + entitlement map, for the frontend to
drive its UI (dropdown greying, feature show/hide, login/upgrade CTAs). Guests and logged-in
users both supported; requires a valid partner API key (the frontend's system key).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user_optional
from app.api.dependencies.database import get_database_session
from app.api.dependencies.partner import get_current_partner
from app.controllers.entitlement_controller import EntitlementController
from app.models.partner import Partner
from app.models.user import User
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/entitlements",
    tags=["entitlements"],
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)

controller = EntitlementController()


@router.get("/me", status_code=200, summary="Get the caller's effective entitlements")
async def get_my_entitlements(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.get_my_entitlements(db, request, current_user, partner.id)

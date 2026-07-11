"""
Analysis API Router (consumer-facing)
=====================================

Return-visit access to a previously generated analysis (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4):

  * ``GET  /analysis/{analysis_uuid}``        — the single-value summary (owner-or-public).
  * ``POST /analysis/{analysis_uuid}/token``  — mint a retrieval token for the full cached JSON
                                                on the Hetzner served cache (owner-or-public).

Frontend surface (System Partner 1 + guests) — requires the frontend's partner key like the
other consumer routers.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user_optional
from app.api.dependencies.database import get_database_session
from app.api.dependencies.partner import get_public_partner
from app.controllers.analysis_result_controller import AnalysisResultController
from app.models.partner import Partner
from app.models.user import User
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/analysis",
    tags=["analysis"],
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)

controller = AnalysisResultController()


@router.get("/{analysis_uuid}", status_code=200, summary="Get an analysis summary")
async def get_analysis_summary(
    analysis_uuid: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.get_summary(db, analysis_uuid, current_user)


@router.post("/{analysis_uuid}/token", status_code=200, summary="Mint a cached-analysis retrieval token")
async def mint_analysis_token(
    analysis_uuid: str,
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.mint_retrieval_token(db, request, analysis_uuid, current_user)

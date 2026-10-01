"""
Analysis API Router (consumer-facing)
=====================================

Upload + return-visit access for analysis-as-an-artifact (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4):

  * ``POST /analysis/upload``                 — upload a track, foreground its analysis (login-only,
                                                counts vs uploads_per_month), enqueue the sibling.
  * ``GET  /analysis/{id}/status``            — poll job status (owner-or-public).
  * ``GET  /analysis/{id}/result``            — the partial/full canonical result (owner-or-public).
  * ``GET  /analysis/{analysis_uuid}``        — the single-value summary (owner-or-public).
  * ``POST /analysis/{analysis_uuid}/token``  (retired, always 410; the full result comes from
                                                ``/result``, which hides internal fields)

Frontend surface (System Partner 1 + guests) — requires the frontend's partner key like the
other consumer routers.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
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


@router.post("/upload", status_code=200, summary="Upload a track and analyze it")
async def upload_and_analyze(
    request: Request,
    file: UploadFile = File(..., description="Audio file to analyze (max 100MB)."),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.upload_and_analyze(db, request, file, current_user, partner.id)


@router.get("/{analysis_id}/status", status_code=200, summary="Poll analysis job status")
async def get_analysis_status(
    analysis_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.get_status(db, analysis_id, current_user)


@router.get("/{analysis_id}/result", status_code=200, summary="Get the analysis result (partial/full)")
async def get_analysis_result(
    analysis_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.get_result(db, analysis_id, current_user)


@router.get("/{analysis_uuid}", status_code=200, summary="Get an analysis summary")
async def get_analysis_summary(
    analysis_uuid: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.get_summary(db, analysis_uuid, current_user)


@router.post("/{analysis_uuid}/token", status_code=200, summary="Retired (always 410). Use /analysis/{id}/result")
async def mint_analysis_token(
    analysis_uuid: str,
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await controller.mint_retrieval_token(db, request, analysis_uuid, current_user)

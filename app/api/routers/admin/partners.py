"""
Admin Partner API Router
========================

FastAPI router for admin management of partners and API keys.
Requires admin API key authentication.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Security, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.controllers.partner_controller import PartnerController
from app.schemas.partner import (
    PartnerResponse,
    PartnerListResponse,
    PartnerCreateRequest,
    PartnerUpdateRequest,
    ApiKeyIssueRequest,
    ApiKeyIssueSuccessResponse,
    ApiKeyListResponse,
    ApiKeyRevokeRequest,
    ApiKeyRotateRequest,
)

router = APIRouter(
    prefix="/admin/partners",
    tags=["admin-partners"],
    responses={
        401: {"description": "Unauthorized - Admin API key required"},
        500: {"description": "Internal Server Error"},
    },
)

# Initialize controller
partner_controller = PartnerController()


@router.post(
    "/",
    response_model=PartnerResponse,
    status_code=201,
    summary="Create a new Partner",
    description="Registers a new B2B partner tenant. Generates a unique partner_uuid.",
)
async def create_partner(
    request: Request,
    payload: PartnerCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.create_partner(db, request, payload)


@router.patch(
    "/{partner_id}",
    response_model=PartnerResponse,
    summary="Update Partner",
    description="Updates existing partner details. Supports partial updates.",
)
async def update_partner(
    partner_id: int,
    payload: PartnerUpdateRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.update_partner(db, partner_id, payload)


@router.delete(
    "/{partner_id}",
    summary="Delete Partner",
    description="Deletes a partner and revokes all associated API keys.",
)
async def delete_partner(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.delete_partner(db, partner_id)


@router.get(
    "/",
    response_model=PartnerListResponse,
    summary="List Partners",
    description="Returns a paginated list of all partners.",
)
async def list_partners(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    tier: Optional[str] = Query(None, regex="^(sandbox|starter|growth|enterprise)$"),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.list_partners(db, page, page_size, tier, is_active)


@router.post(
    "/api-keys/issue",
    response_model=ApiKeyIssueSuccessResponse,
    status_code=201,
    summary="Issue API Key",
    description="Generates a new SHA-256 hashed API key. Returns the plaintext key ONLY ONCE.",
)
async def issue_api_key(
    payload: ApiKeyIssueRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.issue_api_key(db, payload)


@router.get(
    "/api-keys/{partner_id}",
    response_model=ApiKeyListResponse,
    summary="List Partner API Keys",
    description="Lists all API keys (public details only) for a specific partner.",
)
async def list_api_keys(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.list_api_keys(db, partner_id)


@router.post(
    "/api-keys/revoke",
    summary="Revoke API Key",
    description="Deactivates an API key and records the reason.",
)
async def revoke_api_key(
    payload: ApiKeyRevokeRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.revoke_api_key(db, payload)


@router.post(
    "/api-keys/rotate",
    response_model=ApiKeyIssueSuccessResponse,
    status_code=201,
    summary="Rotate API Key",
    description="Atomic operation: Revokes the old key and issues a new one with same config.",
)
async def rotate_api_key(
    payload: ApiKeyRotateRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await partner_controller.rotate_api_key(db, payload)

"""
Admin Partner API Router
========================

This module defines the FastAPI router for admin partner management endpoints.
It handles partner CRUD and API key lifecycle with RBAC.

Version: 1.1.0
Date: May 16, 2026
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
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
    SftpProvisionRequest,
    SftpProvisionResponse,
    SftpStatusResponse,
)

router = APIRouter(
    prefix="/admin/partners",
    tags=["admin-partners"],
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
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
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.create_partner(db, request, payload, current_admin=current_admin)


@router.get(
    "/{partner_id}",
    response_model=PartnerResponse,
    summary="Get Partner Details",
)
async def get_partner(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await partner_controller.get_partner(db, partner_id, current_admin=current_admin)


@router.patch(
    "/{partner_id}",
    response_model=PartnerResponse,
    summary="Update Partner",
)
async def update_partner(
    request: Request,
    partner_id: int,
    payload: PartnerUpdateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.update_partner(db, request, partner_id, payload, current_admin=current_admin)


@router.delete(
    "/{partner_id}",
    summary="Delete Partner",
)
async def delete_partner(
    request: Request,
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.delete_partner(db, request, partner_id, current_admin=current_admin)


@router.get(
    "/{partner_id}",
    response_model=PartnerResponse,
    summary="Get Partner Details",
)
async def get_partner(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await partner_controller.get_partner(db, partner_id)


@router.get(
    "/",
    response_model=PartnerListResponse,
    summary="List Partners",
)
async def list_partners(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    tier: Optional[str] = Query(None, regex="^(sandbox|starter|growth|enterprise)$"),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await partner_controller.list_partners(db, page, page_size, tier, is_active, current_admin=current_admin)


@router.post(
    "/api-keys/issue",
    response_model=ApiKeyIssueSuccessResponse,
    status_code=201,
    summary="Issue API Key",
)
async def issue_api_key(
    request: Request,
    payload: ApiKeyIssueRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.issue_api_key(db, request, payload, current_admin=current_admin)


@router.get(
    "/api-keys/{partner_id}",
    response_model=ApiKeyListResponse,
    summary="List API Keys",
)
async def list_api_keys(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await partner_controller.list_api_keys(db, partner_id)


@router.post(
    "/api-keys/revoke",
    summary="Revoke API Key",
)
async def revoke_api_key(
    request: Request,
    payload: ApiKeyRevokeRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.revoke_api_key(db, request, payload, current_admin=current_admin)


@router.post(
    "/api-keys/rotate",
    response_model=ApiKeyIssueSuccessResponse,
    status_code=201,
    summary="Rotate API Key",
)
async def rotate_api_key(
    request: Request,
    payload: ApiKeyRotateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.rotate_api_key(db, request, payload, current_admin=current_admin)


@router.post(
    "/sftp/provision",
    response_model=SftpProvisionResponse,
    status_code=201,
    summary="Provision SFTP Access",
)
async def provision_sftp(
    request: Request,
    payload: SftpProvisionRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.provision_partner_sftp(db, request, payload, current_admin=current_admin)


@router.get(
    "/{partner_id}/sftp",
    response_model=SftpStatusResponse,
    summary="Get SFTP Status",
)
async def get_sftp_status(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
) -> JSONResponse:
    return await partner_controller.get_partner_sftp_status(db, partner_id)


@router.post(
    "/{partner_id}/sftp/retry",
    response_model=SftpStatusResponse,
    summary="Retry SFTP Provisioning",
)
async def retry_sftp_provisioning(
    request: Request,
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.retry_partner_sftp(db, request, partner_id, current_admin=current_admin)

"""
Admin Partner API Router
========================

This module defines the FastAPI router for admin partner management endpoints.
It handles partner CRUD and API key lifecycle with RBAC.

Version: 1.1.0
Date: May 16, 2026
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Request, HTTPException
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
    SftpLimitsUpdateRequest,
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


@router.patch(
    "/{partner_id}/sftp/limits",
    response_model=SftpStatusResponse,
    summary="Update SFTP Limits",
    description="Change quota / bandwidth / session / transfer caps for a provisioned partner. Only the fields you send are changed.",
)
async def update_sftp_limits(
    request: Request,
    partner_id: int,
    payload: SftpLimitsUpdateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
) -> JSONResponse:
    return await partner_controller.update_partner_sftp_limits(db, request, partner_id, payload, current_admin=current_admin)


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


# --- NEW: Webhook Administration (CRUD & Logs) & Stripe B2B Checkout ---

from pydantic import BaseModel
from typing import List, Optional
import secrets
from app.models.partner import PartnerWebhook, WebhookDeliveryLog
from sqlalchemy import select, delete

class WebhookCreateRequest(BaseModel):
    partner_id: int
    url: str
    events: List[str]

class WebhookUpdateRequest(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None

class B2BCheckoutRequest(BaseModel):
    tier: str
    billing_cycle: str
    po_number: Optional[str] = None

@router.post(
    "/webhooks",
    status_code=201,
    summary="Register a new Partner Webhook subscription"
)
async def create_partner_webhook(
    payload: WebhookCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    # Generate secure signing secret
    raw_secret = "whsec_" + secrets.token_hex(24)
    
    # Store secret directly in secret_hash for signing outgoing requests
    webhook = PartnerWebhook(
        partner_id=payload.partner_id,
        url=payload.url,
        secret_hash=raw_secret,
        events=payload.events,
        is_active=True
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    
    return {
        "status": "success",
        "webhook": {
            "id": webhook.id,
            "partner_id": webhook.partner_id,
            "url": webhook.url,
            "events": webhook.events,
            "is_active": webhook.is_active,
            "created_at": webhook.created_at.isoformat() if webhook.created_at else None
        },
        "signing_secret": raw_secret
    }

@router.get(
    "/webhooks/{partner_id}",
    summary="Retrieve Webhook subscriptions for a Partner"
)
async def get_partner_webhooks(
    partner_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    stmt = select(PartnerWebhook).where(PartnerWebhook.partner_id == partner_id)
    result = await db.execute(stmt)
    webhooks = result.scalars().all()
    
    return {
        "status": "success",
        "webhooks": [
            {
                "id": w.id,
                "url": w.url,
                "events": w.events,
                "is_active": w.is_active,
                "consecutive_failures": w.consecutive_failures,
                "last_delivery_at": w.last_delivery_at.isoformat() if w.last_delivery_at else None,
                "last_delivery_status_code": w.last_delivery_status_code
            } for w in webhooks
        ]
    }

@router.patch(
    "/webhooks/{webhook_id}",
    summary="Update a Partner Webhook subscription"
)
async def update_partner_webhook(
    webhook_id: int,
    payload: WebhookUpdateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    stmt = select(PartnerWebhook).where(PartnerWebhook.id == webhook_id)
    result = await db.execute(stmt)
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")
        
    if payload.url is not None:
        webhook.url = payload.url
    if payload.events is not None:
        webhook.events = payload.events
    if payload.is_active is not None:
        webhook.is_active = payload.is_active
        if payload.is_active:
            webhook.consecutive_failures = 0
            
    await db.commit()
    return {"status": "success", "message": "Webhook updated"}

@router.delete(
    "/webhooks/{webhook_id}",
    summary="Delete a Partner Webhook subscription"
)
async def delete_partner_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    stmt = delete(PartnerWebhook).where(PartnerWebhook.id == webhook_id)
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "message": "Webhook deleted"}

@router.get(
    "/webhooks/logs/failed",
    summary="List Failed Webhook Deliveries"
)
async def list_failed_webhook_logs(
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    stmt = select(WebhookDeliveryLog).where(
        WebhookDeliveryLog.response_status != 200
    ).order_by(WebhookDeliveryLog.created_at.desc()).limit(50)
    
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    return {
        "status": "success",
        "failed_deliveries": [
            {
                "id": log.id,
                "correlation_id": log.correlation_id,
                "webhook_id": log.webhook_id,
                "partner_id": log.partner_id,
                "event_type": log.event_type,
                "attempt_number": log.attempt_number,
                "response_status": log.response_status,
                "response_latency_ms": log.response_latency_ms,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None
            } for log in logs
        ]
    }

@router.post(
    "/webhooks/logs/{log_id}/retry",
    summary="Manually retry a failed Webhook delivery"
)
async def retry_webhook_delivery(
    log_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    stmt = select(WebhookDeliveryLog).where(WebhookDeliveryLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Webhook log not found")
        
    from app.tasks.webhooks import dispatch_webhook
    dispatch_webhook.delay(
        partner_id=log.partner_id,
        event_type=log.event_type,
        payload=log.payload.get("data", {}) if log.payload else {},
        attempt_number=1,
        webhook_id=log.webhook_id
    )
    
    return {"status": "success", "message": "Manual webhook retry queued in Celery"}

@router.post(
    "/{partner_id}/stripe/checkout",
    summary="Generate a Stripe B2B Checkout Session link for a Partner"
)
async def generate_b2b_checkout(
    partner_id: int,
    payload: B2BCheckoutRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("partners:manage"))
):
    from app.core.context import set_admin_context
    set_admin_context(True)
    
    from app.models.partner import Partner
    stmt = select(Partner).where(Partner.id == partner_id)
    result = await db.execute(stmt)
    partner = result.scalar_one_or_none()
    
    if not partner:
        raise HTTPException(status_code=404, detail="Partner tenant not found")
        
    from app.services.stripe_b2b_service import StripeB2bService
    stripe_service = StripeB2bService()
    
    try:
        checkout_url = await stripe_service.create_b2b_checkout_session(
            db=db,
            partner=partner,
            tier=payload.tier,
            billing_cycle=payload.billing_cycle,
            po_number=payload.po_number
        )
        return {"status": "success", "checkout_url": checkout_url}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Checkout generation failed: {str(exc)}")

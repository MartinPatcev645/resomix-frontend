"""
Internal Notification Hook
==========================

Lets the **media server** (Hetzner) trigger a partner+admin notification for the
events it owns — validation results, ingestion finished/failed, embedding done,
peaks/segments outcomes — without holding any SMTP credentials itself. It simply
POSTs a partner-safe payload here; Alwyzon renders the email, sends it to the
partner and the admin inbox, and writes the audit rows.

Guarded by the shared ``HETZNER_INTERNAL_API_KEY`` (header ``X-Internal-Key``),
the same secret used for every other Alwyzon⇆media internal call.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.notification_service import NotificationService
from database.connection import get_async_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal Notify"])


async def verify_internal_key(x_internal_key: Optional[str] = Header(default=None)) -> None:
    """Reject calls without the shared internal key."""
    expected = settings.hetzner_internal_api_key
    if not expected or x_internal_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing internal key")


class PartnerNotifyRequest(BaseModel):
    partner_id: int
    event_type: str = Field(..., description="ingestion | embedding | peaks | segments | upload_rejected | ...")
    status: str = Field(..., description="success | failed | rejected | warning | info")
    summary: str = Field(..., description="One-line, partner-SAFE description. No internal details.")
    title: Optional[str] = None
    details: Optional[List[str]] = Field(default=None, description="Partner-safe bullet list (e.g. validation errors)")
    counts: Optional[Dict[str, Any]] = Field(default=None, description="{label: value} e.g. total/succeeded/failed")
    reference_path: Optional[str] = Field(default=None, description="SFTP path to the full report")


@router.post(
    "/internal/notify/partner",
    summary="Send a partner+admin notification for an operation outcome",
    dependencies=[Depends(verify_internal_key)],
)
async def notify_partner(req: PartnerNotifyRequest, db: AsyncSession = Depends(get_async_db)):
    try:
        await NotificationService().notify_partner_operation(
            db,
            partner_id=req.partner_id,
            event_type=req.event_type,
            status=req.status,
            summary=req.summary,
            title=req.title,
            details=req.details,
            counts=req.counts,
            reference_path=req.reference_path,
        )
    except Exception as e:  # never surface internals to the caller
        logger.error("[notify] failed for partner %s: %s", req.partner_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="notification failed")
    return {"status": "ok"}

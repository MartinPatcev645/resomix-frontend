"""
Notification Service
====================

Single entry point for "tell the partner (and us) what happened" across every
pipeline stage — ingestion, embedding, peaks, segments, upload rejections, and
whatever comes next. Generic by design: callers pass an ``event_type`` +
``status`` + a partner-safe summary/details, and this service:

  1. Resolves the partner and emails them the outcome.
  2. Emails a copy to the admin/ops inbox, with an extra partner-info block.
  3. Writes one ``PartnerNotification`` audit row per email (partner + admin),
     each tagged with ``partner_id`` so the admin can filter by partner / status.

Nothing here exposes internal details — the caller is responsible for passing
only partner-safe text. SMTP failures never raise; they're logged on the audit
row (``delivered=False``) so a flaky mail server can't break ingestion.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.partner import Partner
from app.models.partner_notification import PartnerNotification
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

# Human labels for the status badge in the email.
_STATUS_LABELS = {
    "success": "Completed",
    "failed": "Failed",
    "rejected": "Rejected",
    "warning": "Warning",
    "info": "Update",
}
# Human labels for known event types (extend as new stages are added).
_EVENT_LABELS = {
    "ingestion": "Ingestion",
    "embedding": "Embedding",
    "peaks": "Waveform peaks",
    "segments": "Streaming segments",
    "upload_rejected": "Upload rejected",
}


class NotificationService:
    """Send + log partner/admin notifications for a partner operation."""

    def __init__(self) -> None:
        self.email_service = EmailService()

    async def notify_partner_operation(
        self,
        db: AsyncSession,
        partner_id: int,
        event_type: str,
        status: str,
        summary: str,
        *,
        title: Optional[str] = None,
        details: Optional[List[str]] = None,
        counts: Optional[Dict[str, Any]] = None,
        reference_path: Optional[str] = None,
        commit: bool = True,
        admin_only: bool = False,
    ) -> None:
        """Email the partner + admin about an operation outcome and log both.

        ``admin_only=True`` sends + logs ONLY the admin copy (no partner email) — used for
        internal ops escalations like "stage failure-rate exceeded the auto-progress threshold;
        downstream paused; review and start manually".

        Args:
            partner_id:   tenant the operation belongs to.
            event_type:   "ingestion" | "embedding" | "peaks" | "segments" | ...
            status:       "success" | "failed" | "rejected" | "warning" | "info".
            summary:      one-line, partner-SAFE description of what happened.
            details:      optional partner-safe bullet list (e.g. validation errors).
            counts:       optional {label: value} summary (total/succeeded/failed).
            reference_path: optional SFTP location of the full report.
        """
        event_label = _EVENT_LABELS.get(event_type, event_type.replace("_", " ").title())
        status_label = _STATUS_LABELS.get(status, status.title())
        resolved_title = title or f"{event_label} {status_label.lower()}"

        partner = await db.get(Partner, partner_id)
        if partner is None:
            logger.warning("[Notify] partner %s not found; skipping notification", partner_id)
            return

        base_ctx: Dict[str, Any] = {
            "event_type": event_type,
            "event_label": event_label,
            "status": status if status in _STATUS_LABELS else "info",
            "status_label": status_label,
            "title": resolved_title,
            "summary": summary,
            "details": details or None,
            "counts": counts or None,
            "reference_path": reference_path,
        }
        subject = f"[Resomix] {event_label} {status_label.lower()}"

        # ── 1. Partner copy (skipped for admin-only escalations) ───────────
        if not admin_only:
            partner_ctx = {**base_ctx, "audience": "partner",
                           "greeting_name": partner.display_name or partner.legal_name}
            await self._send_and_log(
                db, partner_id, event_type, status, "partner",
                partner.contact_email, subject, summary, details, reference_path, partner_ctx,
            )

        # ── 2. Admin copy (with partner info) ──────────────────────────────
        admin_email = settings.admin_notification_email or settings.smtp_from_email
        if admin_email:
            admin_subject = f"[Resomix · partner {partner_id}] {event_label} {status_label.lower()}"
            admin_ctx = {
                **base_ctx, "audience": "admin",
                "partner_info": {
                    "id": partner.id,
                    "name": partner.display_name or partner.legal_name,
                    "email": partner.contact_email,
                    "tier": getattr(partner, "tier", None),
                },
            }
            await self._send_and_log(
                db, partner_id, event_type, status, "admin",
                admin_email, admin_subject, summary, details, reference_path, admin_ctx,
            )

        if commit:
            await db.commit()

    async def _send_and_log(
        self, db, partner_id, event_type, status, audience,
        recipient, subject, summary, details, reference_path, ctx,
    ) -> None:
        """Send one email and write its audit row (never raises)."""
        delivered = False
        error_detail = None
        try:
            if recipient:
                delivered = await self.email_service.send_operation_notification(
                    recipient, subject, ctx
                )
                if not delivered:
                    error_detail = "send returned False (see EMAIL logs)"
            else:
                error_detail = "no recipient address on file"
        except Exception as e:  # belt-and-suspenders; email_service already guards
            error_detail = f"{type(e).__name__}: {e}"
            logger.error("[Notify] send failed partner=%s audience=%s: %s", partner_id, audience, e)

        db.add(PartnerNotification(
            partner_id=partner_id,
            event_type=event_type,
            status=status,
            audience=audience,
            channel="email",
            recipient=recipient,
            subject=subject,
            summary=summary,
            details={"items": details} if details else None,
            reference_path=reference_path,
            delivered=delivered,
            error_detail=error_detail,
        ))

"""
Partner Notification Log
========================

One row per notification we *send about* a partner operation (ingestion,
embedding, peaks, segments, an upload rejection, …). Both the partner-facing
email and the admin copy are logged here, each tagged with ``audience`` and the
``partner_id`` — so the admin can filter "everything that happened for partner
X" or "every failure last week".

This is an internal audit trail; the partner never reads this table. It is
written by ``NotificationService`` whenever an email is sent (or attempted),
and by the internal ``/internal/notify/partner`` endpoint the media server
calls for the events it owns.
"""

from __future__ import annotations

from typing import Optional, Any, Dict
from sqlalchemy import String, Text, Boolean, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


class PartnerNotification(Base):
    """Audit row for a single notification email (partner copy or admin copy)."""

    __tablename__ = "partner_notifications"
    __table_args__ = (
        Index("idx_pn_partner_time", "partner_id", "created_at"),
        Index("idx_pn_event_status", "event_type", "status"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        comment="Partner the operation belongs to (set on BOTH partner and admin rows for filtering)",
    )
    # "ingestion" | "embedding" | "peaks" | "segments" | "upload_rejected" | …
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    # "success" | "failed" | "rejected" | "warning" | "info"
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    # "partner" | "admin"
    audience: Mapped[str] = mapped_column(String(10), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="email")
    recipient: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Structured, partner-safe payload (counts, error rows, reference path, …)
    details: Mapped[Optional[Dict[str, Any]]] = mapped_column(mysql.JSON(), nullable=True)
    # Where the partner can find the full detail (e.g. processing/<dt>/errors.txt)
    reference_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # Did the email actually go out? (False = send failed / SMTP error — still logged)
    delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_detail: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="SMTP/send error if delivered is False"
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

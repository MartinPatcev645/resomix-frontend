"""
Consumption Event Model
========================

This module defines the ConsumptionEvent SQLAlchemy model for the Resomix application.
It maps to the consumption_events table which stores DSRF-compliant stream telemetry
events including stream starts, completions, skips, and download successes.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class ConsumptionEvent(Base):
    """
    ConsumptionEvent model representing the consumption_events table.

    Stores all playback telemetry events for DSRF-compliant reporting.
    The four event categories are:
        - stream_start: User pressed play (diagnostic, not reported to labels)
        - stream_complete: User listened >= 30 seconds (royalty-bearing)
        - stream_skip: User skipped before 30 seconds
        - download_success: Purchased lossless file delivered
    """

    __tablename__ = "consumption_events"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key (BIGINT UNSIGNED for high volume)
    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    # Event type
    event_category: Mapped[str] = mapped_column(
        Enum(
            "stream_start",
            "stream_complete",
            "stream_skip",
            "download_success",
            name="consumption_event_category",
        ),
        nullable=False,
    )

    # Track reference (INT UNSIGNED)
    track_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ──────────────────────────────────────────────────────────────
    # ⚠️ Server-Side Resolved Fields
    # ──────────────────────────────────────────────────────────────

    # ISRC: Resolved from tracks.isrc
    isrc: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Label ID: Resolved from releases.label_id
    label_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("labels.id", ondelete="SET NULL"),
        nullable=True,
    )

    # User ID: Resolved from users.id
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id"),
        nullable=False,
        default=1,
        index=True,
    )

    # Country Code: Populated via GeoIP lookup
    country_code: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)

    # Context Data
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    playback_context: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    source_device: Mapped[str] = mapped_column(
        Enum("web", "ios", "android", "desktop", "other", name="source_device_type"),
        default="web",
    )

    # Session ID: Per browser tab session
    session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    # Duration: Actual seconds of audio consumed
    duration_seconds: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)

    # event_timestamp: Server time
    event_timestamp: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), index=True
    )

    # Relationships
    track: Mapped[Optional["Track"]] = relationship("Track")
    label: Mapped[Optional["Label"]] = relationship("Label")
    user: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self):
        return (
            f"<ConsumptionEvent(id={self.id}, category={self.event_category}, "
            f"track_id={self.track_id}, duration={self.duration_seconds}s)>"
        )

    def to_dict(self):
        """Convert event to dictionary for API responses or logging."""
        return {
            "id": self.id,
            "event_category": self.event_category,
            "track_id": self.track_id,
            "isrc": self.isrc,
            "label_id": self.label_id,
            "user_id": self.user_id,
            "country_code": self.country_code,
            "client_ip": self.client_ip,
            "playback_context": self.playback_context,
            "source_device": self.source_device,
            "session_id": self.session_id,
            "duration_seconds": self.duration_seconds,
            "event_timestamp": self.event_timestamp.isoformat() if self.event_timestamp else None,
        }

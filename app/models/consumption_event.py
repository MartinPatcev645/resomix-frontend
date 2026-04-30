"""
Consumption Event Model
========================

This module defines the ConsumptionEvent SQLAlchemy model for the Resomix application.
It maps to the consumption_events table which stores DSRF-compliant stream telemetry
events including stream starts, completions, skips, and download successes.

Used for royalty reporting (DDEX DSRF), fraud detection, and analytics.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
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

    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)

    # Event type
    event_category = Column(
        Enum(
            "stream_start",
            "stream_complete",
            "stream_skip",
            "download_success",
            name="consumption_event_category",
        ),
        nullable=False,
    )

    # Track reference (resolved from UUID during bulk insert)
    track_id = Column(
        BigInteger,
        ForeignKey("tracks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Track Format reference (identifies exactly which version was downloaded)
    track_format_id = Column(
        BigInteger,
        ForeignKey("track_formats.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ──────────────────────────────────────────────────────────────
    # ⚠️ DON'T DELETE — Server-Side Resolved Fields
    # These fields are NOT sent by the frontend. They are populated
    # server-side during the background worker's bulk-insert phase.
    # ──────────────────────────────────────────────────────────────

    # ISRC: Resolved from tracks.isrc by joining on track_id during bulk insert.
    # Required for DSRF report generation (labels group royalties by ISRC).
    # Source: tracks.isrc (via track_id lookup)
    isrc = Column(String(15), nullable=True)

    # Label ID: Resolved from tracks.label_id by joining on track_id during bulk insert.
    # Required for per-label DSRF aggregation and revenue splitting.
    # Source: tracks.label_id (via track_id lookup)
    label_id = Column(
        Integer,
        ForeignKey("labels.id", ondelete="SET NULL"),
        nullable=True,
    )

    # User ID: Resolved from users.id by matching the frontend's user UUID.
    # Source: users.id (via users.uuid lookup from frontend user_id field)
    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Country Code: Will be populated via GeoIP lookup on client_ip.
    # Required for DSRF territorial reporting (streams grouped by country).
    # Source: GeoIP service (e.g., MaxMind) applied to client_ip — NOT YET IMPLEMENTED
    country_code = Column(String(2), nullable=True)

    # ──────────────────────────────────────────────────────────────
    # End of server-side resolved fields
    # ──────────────────────────────────────────────────────────────

    # Client IP: Captured from the HTTP request on the hot path (controller layer).
    # Used for fraud analysis and future GeoIP resolution.
    client_ip = Column(String(45), nullable=True)

    # Playback context: Maps from the frontend "context" field.
    # Describes where in the UI the user triggered playback.
    # Values: "playlist_view", "search_results", "upload_page", "direct_link"
    playback_context = Column(String(50), nullable=True)

    # Source device: Hardcoded to 'web' for now (frontend is web-only).
    # Will be dynamically set when iOS/Android clients are introduced.
    # Source: Determined by client type — currently always 'web'
    source_device = Column(
        Enum("web", "ios", "android", "desktop", "other", name="source_device_type"),
        default="web",
    )

    # Session ID: Maps from the frontend "tab_id" field.
    # Unique per browser tab session, used for deduplication and fraud detection.
    session_id = Column(String(36), nullable=True, index=True)

    # Duration: Actual seconds of audio consumed (pause doesn't reset).
    # For stream_start: always 0.
    # For stream_complete: >= 30 (royalty threshold).
    # For stream_skip: < 30.
    # For download_success: always 0.
    duration_seconds = Column(Integer, nullable=False)

    # Timestamp: When the event was persisted to DB (server time).
    timestamp = Column(
        DateTime, nullable=False, server_default=func.current_timestamp(), index=True
    )

    # Relationships (read-only, no back_populates needed)
    track = relationship("Track", back_populates=None)
    track_format = relationship("TrackFormat", back_populates=None)
    label = relationship("Label", back_populates=None)
    user = relationship("User", back_populates=None)

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
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

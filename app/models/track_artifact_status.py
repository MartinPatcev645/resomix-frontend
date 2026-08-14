"""
Track Artifact Status model
===========================

Per-**consumer-upload** state for the two sibling artifacts every upload produces: the similarity
playlist ("Sonic Discovery") and the analysis. One row per uploaded track, seeded the moment the
track is persisted, resolved by the Celery tasks that build each artifact.

Why this table exists
---------------------
The Library had no way to answer "is this still running?". A missing ``playlist_uuid`` /
``analysis_uuid`` collapses four different situations into one absence:

    still queued · running now · ran and produced nothing · failed

so the client was guessing from ``created_at`` — anything younger than 15 minutes was called
"generating", anything older was called *"Analysis coming soon"*. A slow analysis therefore turned
into a message about an unbuilt feature, and a failed one was indistinguishable from a healthy one.
This table is the fact the guess was standing in for.

Not ``track_processing_status``
-------------------------------
That table looks like the natural home and is not: it is the **partner SFTP ingestion** state
machine (transcode → embedding → peaks → segments → FAISS), written only by
``ingestion_persist``/``ingestion_service``. A consumer upload never gets a row in it, and its
stages are not the two artifacts a user sees. Same shape, different pipeline — deliberately kept
apart so neither one's stages leak into the other.

Relationship to ``track_analysis_results.sibling_playlist_state``
-----------------------------------------------------------------
That column solved exactly this problem for one direction only: the analysis-upload path recording
what happened to *its* similarity sibling. It stays where it is (the analysis screen reads it), and
``_record_sibling_state`` now writes both in one place so the two can never disagree. What it could
not do is cover the similarity-upload path, because a ``track_analysis_results`` row cannot exist
before an analysis id is minted — and the Library needs a state from the moment the upload is
accepted.

States
------
``pending`` (queued) · ``processing`` (running) · ``ready`` (the artifact exists) ·
``unavailable`` (ran to completion, produced nothing) · ``failed`` (it broke).

``unavailable`` is a real outcome, not a synonym for failure: an upload with no near neighbours in
the catalogue produces no playlist, and nothing went wrong. It needs different copy from ``failed``,
which is the entire reason the state exists rather than a boolean.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


# The domain, shared by every writer and the serializer. Kept as plain strings (like
# PROCESSING_STAGE_STATES) so an unrecognised value read from an older row degrades to "unknown"
# rather than raising.
ARTIFACT_PENDING = "pending"
ARTIFACT_PROCESSING = "processing"
ARTIFACT_READY = "ready"
ARTIFACT_UNAVAILABLE = "unavailable"
ARTIFACT_FAILED = "failed"

ARTIFACT_STATES = (
    ARTIFACT_PENDING,
    ARTIFACT_PROCESSING,
    ARTIFACT_READY,
    ARTIFACT_UNAVAILABLE,
    ARTIFACT_FAILED,
)

# States the client should keep polling on. Everything else is terminal — this tuple is what stops
# the Library polling forever, and it is defined here so the backend and the frontend cannot drift.
ARTIFACT_IN_FLIGHT = (ARTIFACT_PENDING, ARTIFACT_PROCESSING)


class TrackArtifactStatus(Base):
    """``track_artifact_status`` — sibling-artifact state for one consumer upload."""

    __tablename__ = "track_artifact_status"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # One row per track. The uniqueness is what makes the writes idempotent: every setter is an
    # UPDATE keyed on track_id, so a retried Celery task cannot create a second, contradictory row.
    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # Tenant scope — the multi-tenancy failsafe auto-filters any model exposing partner_id.
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    # Nullable and SET NULL to match `track_analysis_results`: an account scrub must not cascade
    # into deleting pipeline state, and the row survives the user it belonged to.
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Sonic Discovery (similarity playlist) --- #
    playlist_state: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ARTIFACT_PENDING, index=True
    )
    playlist_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    playlist_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # --- Analysis --- #
    analysis_state: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ARTIFACT_PENDING, index=True
    )
    analysis_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    analysis_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    track: Mapped["Track"] = relationship("Track", foreign_keys=[track_id])

    def __repr__(self):
        return (
            f"<TrackArtifactStatus(track_id={self.track_id}, "
            f"playlist={self.playlist_state}, analysis={self.analysis_state})>"
        )

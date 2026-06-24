"""
Track Processing Status Model
=============================

One row per ingested (live) track, tracking the state of each post-ingestion
processing stage (embeddings, peaks, segments, FAISS indexing). This is the
**stage state machine** — the actual generated artifacts (paths/sizes) are
registered separately in ``audio_files`` / ``image_files`` / ``document_files``.

Stages move through: pending -> processing -> completed | failed.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


# Stage status values (kept as plain strings for forward-compatibility; validated in code).
PROCESSING_STAGE_STATES = ("pending", "processing", "completed", "failed")


class TrackProcessingStatus(Base):
    """track_processing_status — per-track pipeline state."""

    __tablename__ = "track_processing_status"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    ingest_log_id: Mapped[Optional[int]] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("ingest_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    audio_filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # Which SFTP env the source audio lives in ("test" | "live"). Drives where the
    # processing job reads the audio from (partner_paths.sftp_dir(pid, env)).
    sftp_env: Mapped[str] = mapped_column(String(16), nullable=False, default="live")

    # Stage states. transcode is the FIRST post-ingestion stage (raw -> 128k mp3); the
    # embedding/peaks/segments jobs all consume its output, so it's tracked like the rest.
    transcode_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    embedding_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    peaks_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    segments_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    faiss_indexed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # Per-stage error messages
    transcode_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    embedding_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    peaks_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    segments_error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)

    # Per-stage completion timestamps
    transcode_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    embedding_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    peaks_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    segments_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    faiss_indexed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    track: Mapped["Track"] = relationship("Track", foreign_keys=[track_id])
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return (
            f"<TrackProcessingStatus(track_id={self.track_id}, "
            f"embedding={self.embedding_status}, faiss={self.faiss_indexed})>"
        )

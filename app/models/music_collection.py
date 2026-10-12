"""
User music collection models
============================

Items a user owns on an external store, imported into Resomix so Sonic Discovery and Track
Intelligence can work from them. Bandcamp is the only source today (``source='bandcamp'``); the
table is keyed by ``(user_id, source, external_id)`` so another store plugs in without a schema
change and a re-import is an upsert, never a duplicate.

``sync_jobs`` is the progress record a client polls while an import runs in the Celery worker.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import CHAR, Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


COLLECTION_SOURCE_BANDCAMP = "bandcamp"

ITEM_TYPE_ALBUM = "album"
ITEM_TYPE_TRACK = "track"

SYNC_QUEUED = "queued"
SYNC_RUNNING = "running"
SYNC_DONE = "done"
SYNC_PARTIAL = "partial"
SYNC_FAILED = "failed"
SYNC_ACTIVE = (SYNC_QUEUED, SYNC_RUNNING)


class UserMusicCollectionItem(Base):
    """One album or track from a user's external collection (``user_music_collection``)."""

    __tablename__ = "user_music_collection"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "external_id", name="uq_user_music_collection_item"),
        Index("ix_user_music_collection_user_source", "user_id", "source"),
        Index("ix_user_music_collection_source_url", "source_url"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False, default=COLLECTION_SOURCE_BANDCAMP)
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    item_type: Mapped[str] = mapped_column(String(10), nullable=False)

    artist: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    album: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    artwork_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    # When the fan added the item to their Bandcamp collection (from the item token), not when we imported it.
    added_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # SET NULL: a catalogue track being removed must not delete what the user owns.
    resomix_track_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source": self.source,
            "external_id": self.external_id,
            "item_type": self.item_type,
            "artist": self.artist,
            "title": self.title,
            "album": self.album,
            "artwork_url": self.artwork_url,
            "source_url": self.source_url,
            "resomix_track_id": self.resomix_track_id,
            "added_at": self.added_at.isoformat() if self.added_at else None,
        }


class SyncJob(Base):
    """Progress of one collection import (``sync_jobs``). ``id`` is the public ``job_id``."""

    __tablename__ = "sync_jobs"
    __table_args__ = (
        Index("ix_sync_jobs_user_source", "user_id", "source"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False, default=COLLECTION_SOURCE_BANDCAMP)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=SYNC_QUEUED)
    total: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    processed: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    error: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    # Decided in connect, while the previous connection status is still visible.
    # A ready connection re-syncs newest-first and stops at the first known page;
    # resume_token continues a sync that stopped at the request cap.
    incremental: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    resume_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def to_status_dict(self) -> dict:
        return {
            "status": self.status,
            "processed": self.processed,
            "total": self.total,
            "error": self.error,
        }

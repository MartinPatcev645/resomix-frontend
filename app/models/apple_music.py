"""
Apple Music match model
=======================

One row per catalogue track that matched a recording on Apple Music (the reverse-lookup of the old
catalogue — see ``scripts/apple_music/``). Keyed by ``track_id`` (one Apple match per track), it
holds Apple's identifiers + rich metadata so the frontend can deep-link, preview, and show artwork
without re-querying Apple.

Notes:
  * Apple returns **no record label** — the in-house ``labels`` stay authoritative.
  * ``apple_song_id`` / ``isrc`` are indexed but **not unique**: two in-house recordings can map to
    the same Apple song. ``track_id`` is the unique key (one Apple row per track).
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, DECIMAL, ForeignKey, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


class AppleMusicTrack(Base):
    """Apple Music match for a catalogue track (``apple_music_tracks``)."""

    __tablename__ = "apple_music_tracks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # One Apple match per track.
    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Apple identifiers (indexed, NOT unique — dup matches allowed).
    apple_song_id: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    isrc: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)

    # Apple metadata.
    name: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    artist: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    album: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    genres: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # pipe string, e.g. "House | Music | Dance"
    release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    artwork_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    deep_link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Provenance from the matcher's review (song_url / chosen_rank / matched_query intentionally dropped).
    match_score: Mapped[Optional[float]] = mapped_column(DECIMAL(5, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return f"<AppleMusicTrack(track_id={self.track_id}, apple_song_id='{self.apple_song_id}', isrc='{self.isrc}')>"

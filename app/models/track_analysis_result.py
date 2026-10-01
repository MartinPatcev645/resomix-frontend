"""
Track Analysis Result model
===========================

One row per analysed uploaded track — the **single-value summary** of a full analysis, plus
linkage (owner, partner, visibility). It powers fast library lists and future "share analysis"
without fetching the full canonical JSON (which lives in the Hetzner served cache, retrieved via
a tokenized request — see ``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4-5).

Rule: **single-value only** — for any list in the canonical result (e.g. genre top-7) we keep
only the top one. "Vibe" is the ``valence``/``arousal`` pair (no derived scalar).

The DB column for the musical key is ``music_key`` (not ``key``) to avoid the SQL reserved word.
"""

from typing import Optional

from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


# Domain of `TrackAnalysisResult.sibling_playlist_state`. Shared by the controller that seeds it and
# the Celery task that resolves it, so the two can never drift apart.
SIBLING_PENDING = "pending"          # enqueued; still queued or running
SIBLING_READY = "ready"              # a similarity playlist was created for this upload
SIBLING_UNAVAILABLE = "unavailable"  # ran to completion but produced no playlist
SIBLING_FAILED = "failed"            # the task raised


class TrackAnalysisResult(Base):
    """Single-value analysis summary for an uploaded track (``track_analysis_results``)."""

    __tablename__ = "track_analysis_results"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # Linkage
    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Alwyzon-owned analysis id — also the key for the Hetzner served-cache retrieval + token match.
    analysis_uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Tenant scope (the multi-tenancy failsafe auto-filters any model exposing partner_id).
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    # Future "share analysis" (mirrors playlists.is_public). Scaffolded now, enforced later.
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Single-value summary (source: canonical analysis JSON) --- #
    bpm: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)              # rhythm.bpm
    music_key: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)           # tonality.key
    scale: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)              # tonality.scale
    camelot: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)             # tonality.camelot
    loudness_lufs: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)   # technical.integrated_loudness_lufs
    top_genre: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)         # semantics.genre_top[0]
    top_style: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)         # top label of the semantics style list
    top_mood: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)          # semantics.mood_theme_top[0]
    top_instrument: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)    # semantics.instrument_top[0]
    danceability: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)    # semantics.danceability
    valence: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)         # semantics.valence
    arousal: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)         # semantics.arousal
    voice_score: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)     # semantics.voice_score
    voice_instrumental: Mapped[Optional[str]] = mapped_column(String(16), nullable=True) # semantics.voice_instrumental
    duration_ms: Mapped[Optional[float]] = mapped_column(mysql.FLOAT, nullable=True)     # identity.duration_ms
    sample_rate_hz: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)  # identity.sample_rate_hz
    bit_rate: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)        # identity.bit_rate
    channels: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True)       # identity.channel_count
    codec: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)              # identity.codec

    # Outcome of the best-effort similarity sibling (Celery `generate_similarity_sibling`).
    # The client cannot infer this from `playlist_uuid` alone: a missing uuid means "still
    # running", "failed" or "ran but produced nothing" — three states that need different UI.
    # 'pending' on enqueue; the task writes the terminal value.
    #   pending | ready | unavailable (ran, no playlist) | failed
    sibling_playlist_state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # Timestamps (UTC-naive, DB-defaulted — matches the rest of the schema)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    # Relationships
    track: Mapped["Track"] = relationship("Track", foreign_keys=[track_id])

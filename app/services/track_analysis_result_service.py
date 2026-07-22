"""
Track Analysis Result Service
=============================

Parses the canonical analysis JSON (see the analysis service's ``CanonicalAnalysis``) into the
single-value summary stored in ``track_analysis_results``, persists it (idempotent upsert), and
exposes read helpers for library lists / detail.

Only the TOP item of any list (e.g. genre top-7) is kept; "vibe" is the valence/arousal pair.
The full canonical JSON is NOT stored here — it lives in the Hetzner served cache and is fetched
via a tokenized request (see ``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4).

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TrackAnalysisResult
from app.repositories.track_analysis_result_repository import TrackAnalysisResultRepository


def _to_int(value: Any) -> Optional[int]:
    """Coerce a numeric (canonical sample_rate_hz is a float) to int; None-safe."""
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _clip(value: Any, max_len: int) -> Optional[str]:
    """Coerce to str and clip to a column's max length (defensive against long labels)."""
    if value is None:
        return None
    text = str(value)
    return text[:max_len] if len(text) > max_len else text


class TrackAnalysisResultService:
    """Summarize + persist + read the single-value analysis summary."""

    def __init__(self) -> None:
        self.repo = TrackAnalysisResultRepository()

    # ------------------------------------------------------------------ #
    # Parsing
    # ------------------------------------------------------------------ #
    @staticmethod
    def _top_label(items: Any) -> Optional[str]:
        """Top-1 label of a ``[{label, score}, ...]`` list (the canonical top-k shape)."""
        if isinstance(items, list) and items:
            first = items[0]
            if isinstance(first, dict):
                return first.get("label")
        return None

    @staticmethod
    def _genre_leaf(label: Optional[str]) -> Optional[str]:
        """Discogs genres are hierarchical (``Parent---Child``, e.g. ``Electronic---Deep House``).
        We store/display the leaf only (``Deep House``) — matches the frontend's ``shortGenre`` and
        keeps the stored value clean at the root instead of relying on display-time trimming."""
        if not label:
            return label
        return label.split("---")[-1].strip() or label

    @classmethod
    def summarize(cls, result: Dict[str, Any]) -> Dict[str, Any]:
        """Map the canonical analysis JSON → the summary column values (single-value only)."""
        identity = result.get("identity") or {}
        technical = result.get("technical") or {}
        rhythm = result.get("rhythm") or {}
        tonality = result.get("tonality") or {}
        semantics = result.get("semantics") or {}

        return {
            "bpm": rhythm.get("bpm"),
            "music_key": _clip(tonality.get("key"), 8),
            "scale": _clip(tonality.get("scale"), 16),
            "camelot": _clip(tonality.get("camelot"), 8),
            "loudness_lufs": technical.get("integrated_loudness_lufs"),
            "top_genre": _clip(cls._genre_leaf(cls._top_label(semantics.get("genre_top"))), 128),
            "top_style": _clip(cls._top_label(semantics.get("style_maest_top")), 128),
            "top_mood": _clip(cls._top_label(semantics.get("mood_theme_top")), 128),
            "top_instrument": _clip(cls._top_label(semantics.get("instrument_top")), 128),
            "danceability": semantics.get("danceability"),
            "valence": semantics.get("valence"),
            "arousal": semantics.get("arousal"),
            "voice_score": semantics.get("voice_score"),
            "voice_instrumental": _clip(semantics.get("voice_instrumental"), 16),
            "duration_ms": identity.get("duration_ms"),
            "sample_rate_hz": _to_int(identity.get("sample_rate_hz")),
            "bit_rate": _to_int(identity.get("bit_rate")),
            "channels": _to_int(identity.get("channel_count")),
            "codec": _clip(identity.get("codec"), 32),
        }

    # ------------------------------------------------------------------ #
    # Persistence
    # ------------------------------------------------------------------ #
    async def record_from_canonical(
        self,
        db: AsyncSession,
        *,
        analysis_uuid: str,
        result: Dict[str, Any],
        track_id: int,
        user_id: Optional[int],
        partner_id: int,
    ) -> TrackAnalysisResult:
        """Upsert the summary row from a completed canonical result and commit."""
        fields = self.summarize(result or {})
        row = await self.repo.async_upsert(
            db,
            analysis_uuid=analysis_uuid,
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id,
            fields=fields,
        )
        await db.commit()
        return row

    # ------------------------------------------------------------------ #
    # Reads
    # ------------------------------------------------------------------ #
    async def get_by_analysis_uuid(
        self, db: AsyncSession, analysis_uuid: str
    ) -> Optional[TrackAnalysisResult]:
        return await self.repo.async_get_by_analysis_uuid(db, analysis_uuid)

    async def get_latest_for_track(
        self, db: AsyncSession, track_id: int
    ) -> Optional[TrackAnalysisResult]:
        return await self.repo.async_get_latest_by_track_id(db, track_id)

    @staticmethod
    def to_dict(row: TrackAnalysisResult) -> Dict[str, Any]:
        """Serialize a summary row for API responses (the ``key`` field is surfaced as ``key``)."""
        return {
            "analysis_uuid": row.analysis_uuid,
            "track_id": row.track_id,
            "is_public": row.is_public,
            "bpm": row.bpm,
            "key": row.music_key,
            "scale": row.scale,
            "camelot": row.camelot,
            "loudness_lufs": row.loudness_lufs,
            "top_genre": row.top_genre,
            "top_style": row.top_style,
            "top_mood": row.top_mood,
            "top_instrument": row.top_instrument,
            "danceability": row.danceability,
            "valence": row.valence,
            "arousal": row.arousal,
            "voice_score": row.voice_score,
            "voice_instrumental": row.voice_instrumental,
            "duration_ms": row.duration_ms,
            "sample_rate_hz": row.sample_rate_hz,
            "bit_rate": row.bit_rate,
            "channels": row.channels,
            "codec": row.codec,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

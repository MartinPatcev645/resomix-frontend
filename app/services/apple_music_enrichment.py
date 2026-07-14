"""
Apple Music playback enrichment
===============================

The public catalogue plays from Apple Music previews, not our HLS/peaks stack (see
``docs/PLAYBACK_APPLE_MUSIC_PLAN.md``). This module joins ``apple_music_tracks`` onto the track dicts
we serialize for the frontend and merges metadata per the locked rule:

  * ``title`` and ``artist`` stay from our in-house ``tracks`` table.
  * ``album`` / ``genre`` / ``year`` / ``duration`` / ``isrc`` / ``artwork`` come from Apple, falling
    back to the in-house value when the Apple field is NULL.
  * We add ``preview_url``, ``artwork_url``, ``deep_link_url``, ``apple_song_id`` and a ``playback``
    hint: ``"preview"`` when an Apple preview exists, else ``"hls"`` (uploads / anything without a
    preview keep the existing segment-based player).

Each track dict must carry a numeric ``track_id`` for the join (left in the payload; the frontend
ignores it). Enrichment is idempotent-safe: it runs once per response, before demo redaction.
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.apple_music_repository import AppleMusicRepository

logger = logging.getLogger(__name__)

_apple_repo = AppleMusicRepository()


def _merge_apple_into_track(track: Dict[str, Any], apple: Optional[Dict[str, Any]]) -> None:
    """Mutate one serialized track dict in place with Apple data + the ``playback`` hint."""
    preview_url = apple.get("preview_url") if apple else None
    if preview_url:
        track["playback"] = "preview"
        track["preview_url"] = preview_url
        track["artwork_url"] = apple.get("artwork_url")
        track["deep_link_url"] = apple.get("deep_link_url")
        track["apple_song_id"] = apple.get("apple_song_id")
        # Apple is authoritative for these; fall back to the in-house value only when Apple is NULL.
        if apple.get("album"):
            track["album"] = apple["album"]
        if apple.get("genres"):
            track["genre"] = apple["genres"]
        if apple.get("isrc"):
            track["isrc"] = apple["isrc"]
        if apple.get("duration_ms") is not None:
            # Full track length (shown as metadata). The player scrubs the preview's own length.
            track["duration"] = float(apple["duration_ms"]) / 1000.0
        if apple.get("release_date") is not None:
            try:
                track["year"] = apple["release_date"].year
            except Exception:
                pass
    else:
        # No Apple preview (uploads, or any track without a match) → keep the HLS/segment player.
        track["playback"] = "hls"

    # track_id is an internal PK used only for the join above — never expose it on the response.
    track.pop("track_id", None)


async def enrich_tracks_with_apple(db: AsyncSession, tracks: List[Dict[str, Any]]) -> None:
    """Batch-join Apple data onto a list of serialized track dicts (each carrying numeric track_id)."""
    if not tracks:
        return
    track_ids = [t.get("track_id") for t in tracks if isinstance(t, dict) and t.get("track_id") is not None]
    # Best-effort: an Apple preview lookup must never break the similarity/playlist response. On any
    # failure we fall back to an empty map, so tracks degrade to the HLS/segment player (playback="hls").
    apple_map: Dict[int, Dict[str, Any]] = {}
    if track_ids:
        try:
            apple_map = await _apple_repo.async_get_by_track_ids(db, track_ids)
        except Exception as exc:  # noqa: BLE001 - non-critical enrichment
            logger.warning("Apple Music enrichment failed (%s tracks) — falling back to HLS: %s", len(track_ids), exc)
    for t in tracks:
        if isinstance(t, dict):
            _merge_apple_into_track(t, apple_map.get(t.get("track_id")))


async def enrich_similarity_data_with_apple(db: AsyncSession, data: Dict[str, Any]) -> None:
    """Enrich a ``{queried_track, similar_tracks}`` payload in place (seed + all members)."""
    if not isinstance(data, dict):
        return
    bundle: List[Dict[str, Any]] = []
    seed = data.get("queried_track")
    if isinstance(seed, dict):
        bundle.append(seed)
    members = data.get("similar_tracks")
    if isinstance(members, list):
        bundle.extend(m for m in members if isinstance(m, dict))
    await enrich_tracks_with_apple(db, bundle)

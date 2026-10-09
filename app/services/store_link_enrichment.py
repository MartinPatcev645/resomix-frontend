"""
Store link enrichment
=====================

Adds ``traxsource_url`` and ``bandcamp_url`` to the track dicts we serialize for the frontend, from
``track_store_links``. The frontend shows a "Buy on ..." button for each one that is set, and
nothing when both are empty.

Runs inside ``apple_music_enrichment.enrich_tracks_with_apple`` (every playlist, similarity and
rating payload already passes through it), before that step drops the internal ``track_id``. Both
keys are always present, ``None`` when there is no link, so the payload shape does not depend on
the track. Demo-mode redaction nulls them for hidden tracks, like the Apple links: a store URL
names the recording.
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.store_link_repository import StoreLinkRepository

logger = logging.getLogger(__name__)

STORE_LINK_KEYS = ("traxsource_url", "bandcamp_url")

_store_repo = StoreLinkRepository()


async def fetch_store_link_map(db: AsyncSession, track_ids: List[int]) -> Dict[int, Dict[str, Optional[str]]]:
    """``{track_id: links}``. Never raises: a missing buy button must not break the response."""
    ids = [i for i in track_ids if i is not None]
    if not ids:
        return {}
    try:
        return await _store_repo.async_get_by_track_ids(db, ids)
    except Exception as exc:  # noqa: BLE001 - non-critical enrichment
        logger.warning("Store link lookup failed (%s tracks), no buy buttons this time: %s", len(ids), exc)
        return {}


def merge_store_links(track: Dict[str, Any], links: Optional[Dict[str, Optional[str]]]) -> None:
    """Set both store link keys on one serialized track dict, ``None`` where there is no link."""
    for key in STORE_LINK_KEYS:
        track[key] = (links or {}).get(key) or None

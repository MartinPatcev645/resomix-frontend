"""
Track resolver
==============

Matches imported collection items (Bandcamp today) to tracks already in the Resomix catalogue and
sets ``resomix_track_id``. A matched item is immediately usable by Sonic Discovery
(``/similarity/search`` by track UUID) and by any analysis already stored for that track.

Matching, in order:
  1. ``source_url`` — another user's row for the same Bandcamp URL that was already matched. This is
     how one resolution is reused across users.
  2. Normalized artist + title against catalogue tracks (uploads excluded), with duration as a
     tie-breaker/guard when both sides have one. Only a single unambiguous match is accepted.

Albums are not matched: an album is not one track, and the collection data does not list the
album's tracklist.

Unmatched items stay ``analysis_status='none'``. The existing analysis pipeline only accepts
uploaded audio bytes (``AnalysisService.create_analysis``), not an external URL, and audio must not
be downloaded or persisted here — so there is deliberately no analysis fallback in this module.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional, Sequence, Tuple

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.constants import TrackType
from app.models.music_collection import (
    ANALYSIS_DONE,
    COLLECTION_SOURCE_BANDCAMP,
    ITEM_TYPE_TRACK,
    UserMusicCollectionItem,
)
from app.models.track import Track

DURATION_TOLERANCE_MS = 5000
MAX_CANDIDATES = 50

# (track_id, artist, title, duration_ms)
Candidate = Tuple[int, Optional[str], Optional[str], Optional[int]]

_NON_WORD = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES = re.compile(r"\s+")


def normalize(value: Optional[str]) -> str:
    """Lowercase, strip accents and punctuation, collapse whitespace."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = _NON_WORD.sub(" ", text.lower().replace("&", " and "))
    return _SPACES.sub(" ", text).strip()


def pick_match(
    artist: Optional[str],
    title: Optional[str],
    duration_ms: Optional[int],
    candidates: Iterable[Candidate],
) -> Optional[int]:
    """Return the one candidate id matching artist + title (+ duration if known), else None."""
    want_artist, want_title = normalize(artist), normalize(title)
    if not want_artist or not want_title:
        return None

    matches = set()
    for track_id, c_artist, c_title, c_duration in candidates:
        if normalize(c_artist) != want_artist or normalize(c_title) != want_title:
            continue
        if duration_ms and c_duration and abs(duration_ms - c_duration) > DURATION_TOLERANCE_MS:
            continue
        matches.add(track_id)
    return matches.pop() if len(matches) == 1 else None


class TrackResolver:
    """Sets ``resomix_track_id`` on a user's unmatched collection items. Caller commits."""

    async def resolve_user_items(self, db: AsyncSession, user_id: int) -> int:
        items = (
            await db.execute(
                select(UserMusicCollectionItem).where(
                    UserMusicCollectionItem.user_id == user_id,
                    UserMusicCollectionItem.source == COLLECTION_SOURCE_BANDCAMP,
                    UserMusicCollectionItem.item_type == ITEM_TYPE_TRACK,
                    UserMusicCollectionItem.resomix_track_id.is_(None),
                )
            )
        ).scalars().all()

        matched = 0
        for item in items:
            track_id = await self._by_source_url(db, item) or await self._by_metadata(db, item)
            if track_id:
                item.resomix_track_id = track_id
                item.analysis_status = ANALYSIS_DONE
                matched += 1
        await db.flush()
        return matched

    async def _by_source_url(self, db: AsyncSession, item: UserMusicCollectionItem) -> Optional[int]:
        if not item.source_url:
            return None
        return (
            await db.execute(
                select(UserMusicCollectionItem.resomix_track_id)
                .where(
                    UserMusicCollectionItem.source == item.source,
                    UserMusicCollectionItem.source_url == item.source_url,
                    UserMusicCollectionItem.resomix_track_id.is_not(None),
                )
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _by_metadata(self, db: AsyncSession, item: UserMusicCollectionItem) -> Optional[int]:
        if not item.title or not item.artist:
            return None
        # Table collation is case/accent-insensitive, so equality uses the title index;
        # pick_match then applies the stricter normalized comparison.
        rows: Sequence[Candidate] = (
            await db.execute(
                select(Track.id, Track.display_artist, Track.title, Track.duration_ms)
                .where(
                    Track.title == item.title,
                    Track.is_active.is_(True),
                    or_(Track.track_type.is_(None), Track.track_type != TrackType.UPLOAD),
                )
                .limit(MAX_CANDIDATES)
            )
        ).all()
        return pick_match(item.artist, item.title, item.duration_ms, rows)

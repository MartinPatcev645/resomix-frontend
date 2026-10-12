"""
Track resolver
==============

Matches imported collection items (Bandcamp today) to tracks already in the Resomix catalogue and
sets ``resomix_track_id``. A matched item reaches any analysis already stored for that track
through ``resomix_track_id``. Nothing here analyses audio, and audio is never downloaded.

Matching, in order, for tracks only:
  1. ``track_store_links.bandcamp_url`` — one ``IN (...)`` query per page of items. Compared
     without scheme, case or a trailing slash, so a custom-domain link still hits.
  2. ``source_url`` — another user's row for the same Bandcamp URL that was already matched.
  3. Normalized artist + title against catalogue tracks (uploads excluded), with duration as a
     tie-breaker when both sides have one. Only a single unambiguous match is accepted. This
     rarely hits: label accounts put the label in ``band_name``, and titles often read
     "Artist - Title (Mix)".

Albums are skipped. An album is not one catalogue track, and this import does not fetch album
pages from Bandcamp (that would cost a request per album). Bandcamp track and album ids are not
on ``track_store_links`` yet; once they are, the ``t<id>`` and ``a<id>`` external ids can match
directly, albums included.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.constants import TrackType
from app.models.music_collection import (
    COLLECTION_SOURCE_BANDCAMP,
    ITEM_TYPE_TRACK,
    UserMusicCollectionItem,
)
from app.models.track import Track
from app.models.track_store_link import TrackStoreLink

DURATION_TOLERANCE_MS = 5000
MAX_CANDIDATES = 50
STORE_LINK_BATCH = 100

# (track_id, artist, title, duration_ms)
Candidate = Tuple[int, Optional[str], Optional[str], Optional[int]]

_NON_WORD = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES = re.compile(r"\s+")
_SCHEME = re.compile(r"^https?://", re.IGNORECASE)


def normalize(value: Optional[str]) -> str:
    """Lowercase, strip accents and punctuation, collapse whitespace."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = _NON_WORD.sub(" ", text.lower().replace("&", " and "))
    return _SPACES.sub(" ", text).strip()


def bandcamp_url_key(url: Optional[str]) -> str:
    """Host and path, without scheme, case or a trailing slash."""
    if not url:
        return ""
    return _SCHEME.sub("", url.strip()).rstrip("/").lower()


def bandcamp_url_variants(url: Optional[str]) -> List[str]:
    """Spellings of ``url`` that an indexed equality lookup can hit.

    The column collation is case-insensitive, so only scheme and a trailing slash vary.
    """
    key = bandcamp_url_key(url)
    if not key:
        return []
    return [f"{scheme}{key}{slash}" for scheme in ("https://", "http://") for slash in ("", "/")]


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
    """Sets ``resomix_track_id`` on a user's unmatched collection tracks. Caller commits."""

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
        pending = list(items)
        for start in range(0, len(pending), STORE_LINK_BATCH):
            batch = pending[start:start + STORE_LINK_BATCH]
            matched += await self._by_store_links(db, batch)
            for item in batch:
                if item.resomix_track_id is not None:
                    continue
                track_id = await self._by_source_url(db, item) or await self._by_metadata(db, item)
                if track_id:
                    item.resomix_track_id = track_id
                    matched += 1
        await db.flush()
        return matched

    async def _by_store_links(self, db: AsyncSession, items: Sequence[UserMusicCollectionItem]) -> int:
        """Match a page of items to ``track_store_links.bandcamp_url`` in one query."""
        by_key: Dict[str, List[UserMusicCollectionItem]] = {}
        variants: set = set()
        for item in items:
            key = bandcamp_url_key(item.source_url)
            if not key:
                continue
            by_key.setdefault(key, []).append(item)
            variants.update(bandcamp_url_variants(item.source_url))
        if not variants:
            return 0

        rows = (
            await db.execute(
                select(TrackStoreLink.track_id, TrackStoreLink.bandcamp_url).where(
                    TrackStoreLink.bandcamp_url.in_(variants)
                )
            )
        ).all()

        found: Dict[str, int] = {}
        ambiguous = set()
        for track_id, url in rows:
            key = bandcamp_url_key(url)
            if not key or key in ambiguous:
                continue
            if key in found and found[key] != track_id:
                ambiguous.add(key)
                del found[key]
                continue
            found[key] = track_id

        matched = 0
        for key, group in by_key.items():
            track_id = found.get(key)
            if track_id is None:
                continue
            for item in group:
                item.resomix_track_id = track_id
                matched += 1
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

"""
Apple Music playback enrichment
===============================

The public catalogue plays from Apple Music previews, not our HLS/peaks stack (see
``docs/PLAYBACK_APPLE_MUSIC_PLAN.md``). This module joins ``apple_music_tracks`` onto the track dicts
we serialize for the frontend and merges metadata per the locked rule:

  * **Apple is preferred for every display field** — ``title`` (Apple's ``name``), ``artist``,
    ``album``, ``genre``, ``year``, ``duration``, ``isrc``, ``artwork``. The in-house ``tracks``
    value is used only when the Apple field is NULL/empty.
  * When BOTH are missing: ``title``/``artist`` keep their existing "Unknown"/"N/A" placeholders
    (set by the repositories, which run before this merge); ``label``/``genre``/``album`` are left
    empty, as before.
  * ``label`` is the one field Apple never supplies — its *song* object carries no record label (it
    lives on the Album resource, which we do not fetch), so label is always in-house.
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
from app.services.store_link_enrichment import fetch_store_link_map, merge_store_links
from app.utils.similarity_utils import dedupe_by_apple_identity

logger = logging.getLogger(__name__)

_apple_repo = AppleMusicRepository()


async def fetch_apple_map(db: AsyncSession, track_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    """Best-effort ``{track_id: apple_row}`` map (apple_song_id / isrc / name / artist / …) used to
    build de-dup keys BEFORE the final truncation. Never raises — an Apple lookup must not break
    similarity/playlist creation; on failure dedup simply falls back to the in-house fields."""
    ids = [i for i in track_ids if i is not None]
    if not ids:
        return {}
    try:
        return await _apple_repo.async_get_by_track_ids(db, ids)
    except Exception as exc:  # noqa: BLE001 - non-critical
        logger.warning("Apple map fetch failed (%s ids) — dedup falls back to in-house: %s", len(ids), exc)
        return {}


def _merge_apple_into_track(track: Dict[str, Any], apple: Optional[Dict[str, Any]]) -> None:
    """Mutate one serialized track dict in place with Apple data + the ``playback`` hint."""
    preview_url = apple.get("preview_url") if apple else None
    if preview_url:
        track["playback"] = "preview"
        track["preview_url"] = preview_url
        track["artwork_url"] = apple.get("artwork_url")
        track["deep_link_url"] = apple.get("deep_link_url")
        track["apple_song_id"] = apple.get("apple_song_id")
        # Apple is authoritative for ALL display metadata; the in-house value (already set by the
        # repositories, which run before this merge) is only a fallback for when the Apple field is
        # NULL/empty. If both are missing, title/artist keep their "Unknown"/"N/A" placeholder while
        # album/genre stay empty — i.e. we never overwrite a good in-house value with nothing.
        # NB: Apple calls the track title `name` (stored in apple_music_tracks.name).
        if apple.get("name"):
            track["title"] = apple["name"]
        if apple.get("artist"):
            track["artist"] = apple["artist"]
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
    """Batch-join Apple data onto a list of serialized track dicts (each carrying numeric track_id),
    plus the outside store links (``store_link_enrichment``), which need the same track_id before
    the Apple merge drops it."""
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
    store_map = await fetch_store_link_map(db, track_ids)
    for t in tracks:
        if isinstance(t, dict):
            merge_store_links(t, store_map.get(t.get("track_id")))
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

    # Capture the seed's "Artist - Title" BEFORE Apple overwrites those fields, so we can tell
    # whether the stored playlist name is still the auto-generated default or a user rename.
    default_before = (
        f"{seed.get('artist') or ''} - {seed.get('title') or ''}" if isinstance(seed, dict) else None
    )

    await enrich_tracks_with_apple(db, bundle)

    # ── Apple Music identity de-duplication (fix-on-read) ───────────────────────────────────────
    # New playlists are already Apple/ISRC-deduped at creation (deduplicate_tracks fetches the Apple
    # map and dedupes BEFORE truncation). This pass cleans EXISTING stored playlists on every read —
    # dropping any member sharing the seed's apple_song_id or isrc, and collapsing members that share
    # an id/isrc — without a migration. Members with neither id (uploads / unmatched) are untouched.
    # Same fix-on-read pattern as the playlist-name re-derivation below (rewrites the response only).
    if isinstance(members, list) and members:
        deduped = dedupe_by_apple_identity(
            members,
            seed.get("apple_song_id") if isinstance(seed, dict) else None,
            seed.get("isrc") if isinstance(seed, dict) else None,
            lambda m: (m.get("apple_song_id"), m.get("isrc")) if isinstance(m, dict) else (None, None),
        )
        if len(deduped) != len(members):
            for i, m in enumerate(deduped):
                if isinstance(m, dict):
                    m["rank"] = i + 1
            data["similar_tracks"] = deduped

    # Playlist names are generated at creation from the seed's IN-HOUSE artist/title
    # (generate_playlist_name_from_seed_track, which runs before enrichment). Now that Apple is
    # authoritative for those fields, an un-renamed playlist would keep its in-house name while the
    # UI renders Apple's — so the frontend's "has the user renamed this?" check (it compares
    # `artist + " - " + title` against `playlist.name`) fails and surfaces a near-duplicate title
    # line under the heading. Re-derive the default name from the merged values, using the exact
    # same formula the frontend compares with, so the two agree by construction.
    #
    # Only touched when the name still equals the pre-merge default: a renamed playlist never
    # matches, so user names are never clobbered. This rewrites the response only — the stored row
    # is left alone, so older playlists are fixed on read without a migration.
    playlist = data.get("playlist")
    if isinstance(seed, dict) and isinstance(playlist, dict) and default_before:
        if playlist.get("name") == default_before:
            default_after = f"{seed.get('artist') or ''} - {seed.get('title') or ''}"
            if default_after != default_before:
                playlist["name"] = default_after

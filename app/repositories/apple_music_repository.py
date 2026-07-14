"""
Apple Music repository
======================

Read access to ``apple_music_tracks`` — the 1:1 catalogue-match table (one Apple Music match per
in-house track, keyed by ``track_id``). Used by the playback layer to serve Apple preview URLs +
metadata for the public catalogue (see ``docs/PLAYBACK_APPLE_MUSIC_PLAN.md``).
"""
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AppleMusicRepository:
    """Batch reads over the ``apple_music_tracks`` table."""

    async def async_get_by_track_ids(
        self, db: AsyncSession, track_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """
        Fetch the Apple match row for each of the given numeric track ids.

        Returns a dict keyed by ``track_id``. Tracks with no Apple match are simply absent from the
        result (the caller treats "no row / no preview" as the HLS/segment fallback).
        """
        ids = [int(i) for i in track_ids if i is not None]
        if not ids:
            return {}

        query = text(
            """
            SELECT track_id, apple_song_id, isrc, name, artist, album, genres,
                   release_date, duration_ms, artwork_url, preview_url, deep_link_url
            FROM apple_music_tracks
            WHERE track_id IN :ids
            """
        )
        result = await db.execute(query, {"ids": tuple(ids)})

        out: Dict[int, Dict[str, Any]] = {}
        for row in result.fetchall():
            out[int(row.track_id)] = {
                "apple_song_id": row.apple_song_id,
                "isrc": row.isrc,
                "name": row.name,
                "artist": row.artist,
                "album": row.album,
                "genres": row.genres,
                "release_date": row.release_date,
                "duration_ms": row.duration_ms,
                "artwork_url": row.artwork_url,
                "preview_url": row.preview_url,
                "deep_link_url": row.deep_link_url,
            }
        return out

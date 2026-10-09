"""
Store link repository
=====================

Read access to ``track_store_links`` — one row per catalogue track that has a page on an outside
download store (Traxsource, later Bandcamp), keyed by ``track_id``. Used to put the "Buy on ..."
links on the tracks we serialize for the frontend.
"""
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class StoreLinkRepository:
    """Batch reads over the ``track_store_links`` table."""

    async def async_get_by_track_ids(
        self, db: AsyncSession, track_ids: List[int]
    ) -> Dict[int, Dict[str, Optional[str]]]:
        """
        ``{track_id: {"traxsource_url": ..., "bandcamp_url": ...}}`` for the given numeric track ids.
        Tracks with no row are absent from the result (no store button).
        """
        ids = [int(i) for i in track_ids if i is not None]
        if not ids:
            return {}

        query = text(
            """
            SELECT track_id, traxsource_url, bandcamp_url
            FROM track_store_links
            WHERE track_id IN :ids
            """
        )
        result = await db.execute(query, {"ids": tuple(ids)})
        return {
            int(row.track_id): {"traxsource_url": row.traxsource_url, "bandcamp_url": row.bandcamp_url}
            for row in result.fetchall()
        }

"""
Open Tracks – Insert Tracks From JSON
=====================================

This script reads the JSON produced by `extract_tracks_info.py` and inserts
tracks into the MariaDB database using the same semantics as the monthly
pipeline / upload flow:

- Creates/links artists, labels, genres, albums.
- Inserts rows into `tracks` with uuid, title, year, duration_sec, file_path,
  preview_path, file_size, type (here: TrackType.OPEN).
- Creates rows in `track_artists` for track↔artist relations.

Usage (from project root):
    python -m scripts.open_tracks.insert_tracks_from_json open_tracks_tracks.json

The script is idempotent per uuid: if a track with the same uuid already
exists in `tracks`, it will be skipped.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from typing import List, Dict, Any

from sqlalchemy import text, select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.constants import TrackType
from app.models.track import Track, TrackArtist
from app.utils.sanitization import (
    sanitize_artist_name,
    sanitize_label_name,
    sanitize_genre_name,
    sanitize_album_title,
)
from database.connection import AsyncSessionLocal


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class Cache:
    """
    Lightweight in‑memory cache for name→id lookups, mirroring
    the `Cache` class in TrackUploadService.
    """

    def __init__(self) -> None:
        self.artists: Dict[str, int] = {}
        self.labels: Dict[str, int] = {}
        self.genres: Dict[str, int] = {}
        self.albums: Dict[tuple[str, int], int] = {}

    @staticmethod
    async def _fetch_table(db: AsyncSession, table: str) -> Dict[str, int]:
        result = await db.execute(text(f"SELECT name, id FROM {table}"))
        return {name.lower(): id_ for name, id_ in result.fetchall()}

    async def preload(self, db: AsyncSession) -> None:
        self.artists = await self._fetch_table(db, "artists")
        self.labels = await self._fetch_table(db, "labels")
        self.genres = await self._fetch_table(db, "genres")
        # albums: (title, artist_id) fetch
        result = await db.execute(text("SELECT title, artist_id, id FROM albums"))
        self.albums = {
            (title.lower(), artist_id): id_
            for title, artist_id, id_ in result.fetchall()
        }

    async def _get_or_create(
        self, db: AsyncSession, table: str, cache: Dict[str, int], name: str
    ) -> int:
        original_name = name or ""

        if table == "artists":
            sanitized_name = sanitize_artist_name(original_name)
        elif table == "labels":
            sanitized_name = sanitize_label_name(original_name)
        elif table == "genres":
            sanitized_name = sanitize_genre_name(original_name)
        else:
            sanitized_name = sanitize_artist_name(original_name)

        key = sanitized_name.lower()
        if key in cache:
            return cache[key]

        insert_sql = text(f"INSERT IGNORE INTO {table} (name) VALUES (:name)")
        await db.execute(insert_sql, {"name": sanitized_name})

        select_result = await db.execute(
            text(f"SELECT id FROM {table} WHERE name = :name"),
            {"name": sanitized_name},
        )
        row = select_result.first()
        if row is None:
            raise RuntimeError(
                f"Failed to insert or find {table} record for name='{sanitized_name}'"
            )

        id_ = row[0]
        cache[key] = id_
        return id_

    async def artist(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "artists", self.artists, name)

    async def label(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "labels", self.labels, name)

    async def genre(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "genres", self.genres, name)

    async def album(self, db: AsyncSession, title: str, primary_artist_id: int) -> int:
        original_title = title or ""
        sanitized_title = sanitize_album_title(original_title)

        key = (sanitized_title.lower(), primary_artist_id)
        if key in self.albums:
            return self.albums[key]

        insert_sql = text(
            "INSERT IGNORE INTO albums (artist_id, title) VALUES (:artist_id, :title)"
        )
        await db.execute(
            insert_sql, {"artist_id": primary_artist_id, "title": sanitized_title}
        )

        select_result = await db.execute(
            text(
                "SELECT id FROM albums WHERE artist_id = :artist_id AND title = :title"
            ),
            {"artist_id": primary_artist_id, "title": sanitized_title},
        )
        row = select_result.first()
        if row is None:
            raise RuntimeError(
                f"Failed to insert or find album record for title='{sanitized_title}', artist_id={primary_artist_id}"
            )

        id_ = row[0]
        self.albums[key] = id_
        return id_


async def insert_from_json(json_path: str, batch_size: int = 100) -> None:
    """
    Insert tracks from the JSON produced by `extract_tracks_info.py`.
    """
    logger.info("Loading JSON from %s", json_path)
    with open(json_path, "r", encoding="utf-8") as f:
        data: List[Dict[str, Any]] = json.load(f)

    if not data:
        logger.info("No tracks found in JSON; nothing to insert.")
        return

    cache = Cache()

    async with AsyncSessionLocal() as db:
        await cache.preload(db)

        inserted = 0
        skipped = 0

        for idx, item in enumerate(data):
            uuid_val: str = item.get("uuid")
            if not uuid_val:
                logger.warning("Skipping record without uuid at index %s", idx)
                skipped += 1
                continue

            # Idempotency: skip if track already exists
            existing = await db.execute(select(Track.id).where(Track.uuid == uuid_val))
            if existing.first():
                skipped += 1
                continue

            title = (item.get("title") or "").strip()
            if not title:
                # Use filename as a last‑resort default, DB enforces NOT NULL
                title = (item.get("filename") or "Untitled Track")[:255]

            year = item.get("year")
            duration_sec = item.get("duration_sec")
            file_path = item.get("original_path") or ""
            file_size = item.get("file_size")
            track_type = item.get("type") or TrackType.OPEN

            # Artist handling
            artist_names: List[str] = item.get("artist_names") or []
            if not artist_names and item.get("artist"):
                artist_names = [
                    sanitize_artist_name(name.strip())
                    for name in item["artist"].split(",")
                    if name.strip()
                ]
            if not artist_names:
                artist_names = [sanitize_artist_name("Unknown")]

            # Label / genre / album
            raw_label = (item.get("label") or "").strip()
            raw_genre = (item.get("genre") or "").strip()
            raw_album = (item.get("album") or "").strip()

            label_name = sanitize_label_name(raw_label) if raw_label else None
            genre_name = sanitize_genre_name(raw_genre) if raw_genre else "Unknown"
            album_title = sanitize_album_title(raw_album) if raw_album else None

            # Resolve or create catalog entities
            artist_ids: List[int] = []
            for name in artist_names:
                artist_id = await cache.artist(db, name)
                artist_ids.append(artist_id)

            primary_artist_id = artist_ids[0]

            label_id = None
            if label_name:
                label_id = await cache.label(db, label_name)

            genre_id = await cache.genre(db, genre_name)

            album_id = None
            if album_title:
                album_id = await cache.album(db, album_title, primary_artist_id)

            # Preview path for open tracks: mirror monthly/open convention
            preview_path = f"/mnt/data/OPEN/{uuid_val}.mp3"

            track_insert = insert(Track).values(
                uuid=uuid_val,
                album_id=album_id,
                label_id=label_id,
                genre_id=genre_id,
                title=title[:255],
                year=year,
                duration_sec=duration_sec,
                file_path=file_path[:500],
                preview_path=preview_path,
                file_size=file_size,
                type=track_type,
            )
            await db.execute(track_insert)

            track_id_result = await db.execute(
                select(Track.id).where(Track.uuid == uuid_val)
            )
            row = track_id_result.first()
            if row is None:
                raise RuntimeError(
                    f"Inserted track with uuid={uuid_val} but could not retrieve ID"
                )

            track_id = row[0]

            # Insert track_artists entries
            for artist_id in artist_ids:
                ta_insert = insert(TrackArtist).values(
                    track_id=track_id,
                    artist_id=artist_id,
                )
                await db.execute(ta_insert)

            inserted += 1

            if inserted % batch_size == 0:
                await db.commit()
                logger.info(
                    "Committed batch: inserted=%s, skipped=%s (up to index %s)",
                    inserted,
                    skipped,
                    idx,
                )

        # Final commit
        await db.commit()
        logger.info(
            "Done. Inserted %s new tracks, skipped %s existing/invalid records.",
            inserted,
            skipped,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Insert tracks into the database from an open‑tracks JSON file."
    )
    parser.add_argument(
        "json_path",
        help="Path to JSON file produced by extract_tracks_info.py",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of inserts per commit (default: 100).",
    )

    args = parser.parse_args()
    asyncio.run(insert_from_json(args.json_path, batch_size=max(1, args.batch_size)))


if __name__ == "__main__":
    main()



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

The script is idempotent per uuid: if a track with the same uuid already
exists in `tracks`, it will be skipped.

Features:
- Concurrent database insertion with configurable workers
- Test mode with time tracking and ETA predictions
- Resume capability (UUID-based deduplication)
- Progress tracking and batch commits
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Add project root to Python path to allow imports from 'app' module
# This script is in scripts/open_tracks/, so we go up 2 levels to reach project root
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

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



# ============================================================================
# CONFIGURATION - Modify these variables as needed
# ============================================================================

# Input/Output Configuration
JSON_PATH = "open_tracks.json"  # Path to JSON file from extract_tracks_info.py

# Processing Configuration
CONCURRENT_INSERTS = 30  # Number of tracks to insert concurrently (1-50 recommended)
BATCH_COMMIT_SIZE = 100  # Commit every N tracks

# Test Mode Configuration
TEST_MODE = False  # Set to True to run in test mode with limited tracks
TEST_TRACK_LIMIT = 90  # Number of tracks to process in test mode


# ============================================================================
# LOGGING
# ============================================================================

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ============================================================================
# CACHE CLASS (Entity Deduplication)
# ============================================================================

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


# ============================================================================
# TRACK INSERTION LOGIC
# ============================================================================

async def insert_single_track(
    db: AsyncSession,
    cache: Cache,
    item: Dict[str, Any]
) -> bool:
    """
    Insert a single track into the database.
    
    Args:
        db: Database session
        cache: Entity cache
        item: Track data from JSON
        
    Returns:
        True if inserted, False if skipped
    """
    uuid_val: str = item.get("uuid")
    if not uuid_val:
        logger.warning("Skipping record without uuid")
        return False

    # Idempotency: skip if track already exists
    existing = await db.execute(select(Track.id).where(Track.uuid == uuid_val))
    if existing.first():
        return False  # Skipped

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

    return True  # Inserted


async def insert_track_batch(
    db: AsyncSession,
    cache: Cache,
    tracks_batch: List[Dict[str, Any]]
) -> Tuple[int, int]:
    """
    Insert a batch of tracks concurrently.
    
    Args:
        db: Database session
        cache: Entity cache
        tracks_batch: List of track data dictionaries
        
    Returns:
        Tuple of (inserted_count, skipped_count)
    """
    tasks = [
        insert_single_track(db, cache, track_data)
        for track_data in tracks_batch
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    inserted = sum(1 for r in results if r is True)
    skipped = sum(1 for r in results if r is False or isinstance(r, Exception))
    
    # Log any exceptions
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error(f"Error inserting track {tracks_batch[i].get('uuid')}: {r}")
    
    return inserted, skipped


async def insert_from_json(data: List[Dict[str, Any]]) -> Tuple[int, int]:
    """
    Insert tracks from the JSON data.
    
    Args:
        data: List of track dictionaries
        
    Returns:
        Tuple of (total_inserted, total_skipped)
    """
    if not data:
        logger.info("No tracks found in JSON; nothing to insert.")
        return 0, 0

    cache = Cache()

    async with AsyncSessionLocal() as db:
        await cache.preload(db)

        total_inserted = 0
        total_skipped = 0
        total_tracks = len(data)

        logger.info(f"Processing {total_tracks} tracks with {CONCURRENT_INSERTS} concurrent workers...")

        # Process in batches
        for i in range(0, total_tracks, CONCURRENT_INSERTS):
            batch = data[i:i + CONCURRENT_INSERTS]
            batch_inserted, batch_skipped = await insert_track_batch(db, cache, batch)
            
            total_inserted += batch_inserted
            total_skipped += batch_skipped
            
            # Progress update
            processed = i + len(batch)
            percentage = (processed / total_tracks) * 100
            logger.info(
                f"[PROGRESS] {processed}/{total_tracks} ({percentage:.1f}%) - "
                f"Inserted: {total_inserted}, Skipped: {total_skipped}"
            )
            
            # Commit every BATCH_COMMIT_SIZE tracks
            if total_inserted > 0 and total_inserted % BATCH_COMMIT_SIZE == 0:
                await db.commit()
                logger.info(f"[COMMIT] Saved progress: {total_inserted} inserted")

        # Final commit
        await db.commit()
        logger.info(
            f"Done. Inserted {total_inserted} new tracks, skipped {total_skipped} existing/invalid records."
        )

    return total_inserted, total_skipped


# ============================================================================
# TEST MODE UTILITIES
# ============================================================================

def format_time(seconds: float) -> str:
    """Format seconds into human-readable time string."""
    if seconds < 60:
        return f"{seconds:.1f} seconds"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f} minutes"
    else:
        hours = seconds / 3600
        return f"{hours:.1f} hours"


def print_test_mode_summary(
    processed: int,
    total_available: int,
    inserted: int,
    skipped: int,
    elapsed_time: float
) -> None:
    """Print test mode summary with time estimates."""
    avg_per_track = elapsed_time / processed if processed > 0 else 0
    estimated_total = avg_per_track * total_available if total_available > 0 else 0
    
    print("\n" + "="*60)
    print("[TEST MODE] Test run completed!")
    print("="*60)
    print(f"[TEST MODE] Tracks processed: {processed:,} / {total_available:,} total available")
    print(f"[TEST MODE] Inserted: {inserted:,}, Skipped: {skipped:,}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Total time: {format_time(elapsed_time)}")
    print(f"[TEST MODE] Average per track: {avg_per_track:.2f} seconds")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] ESTIMATED TIME FOR FULL DATASET:")
    print(f"[TEST MODE] - Total tracks: {total_available:,}")
    print(f"[TEST MODE] - Estimated time: ~{format_time(estimated_total)}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Set TEST_MODE = False to process all tracks.")
    print("="*60 + "\n")


# ============================================================================
# MAIN
# ============================================================================

def main() -> None:
    """Main entry point."""
    
    # Load JSON
    logger.info(f"Loading JSON from {JSON_PATH}")
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            all_data: List[Dict[str, Any]] = json.load(f)
    except FileNotFoundError:
        logger.error(f"ERROR: JSON file not found: {JSON_PATH}")
        logger.error(f"Please edit the JSON_PATH variable at the top of this script.")
        return
    except json.JSONDecodeError as e:
        logger.error(f"ERROR: Invalid JSON file: {e}")
        return

    if not all_data:
        logger.info("No tracks found in JSON; nothing to insert.")
        return

    # Apply test mode limit
    if TEST_MODE:
        data = all_data[:TEST_TRACK_LIMIT]
        print(f"\n{'='*60}")
        print(f"[TEST MODE] ENABLED - Processing {len(data)} / {len(all_data)} tracks")
        print(f"{'='*60}\n")
    else:
        data = all_data

    # Track time
    start_time = time.time()

    # Process
    inserted, skipped = asyncio.run(insert_from_json(data))

    # Calculate elapsed time
    elapsed_time = time.time() - start_time

    # Test mode summary
    if TEST_MODE:
        print_test_mode_summary(
            processed=len(data),
            total_available=len(all_data),
            inserted=inserted,
            skipped=skipped,
            elapsed_time=elapsed_time
        )
    else:
        logger.info(f"Total time: {format_time(elapsed_time)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Open Tracks – Remove Tracks From JSON
=====================================

This script reads the removal_tracks.json file and removes tracks from the
MariaDB database based on their UUIDs. It performs the following operations:

1. Deletes entries from the `track_artists` table (many-to-many relationship)
2. Deletes entries from the `tracks` table

The script preserves all metadata (artists, albums, labels, genres) in the
database, only removing the track records and their associations.

Features:
- Batch deletion for performance
- Test mode with limited deletion
- Progress tracking and reporting
- Detailed logging of deletion operations
- Dry run mode to preview deletions without executing them

WARNING: This script performs DESTRUCTIVE operations. Always backup your database
before running this script, especially without TEST_MODE or DRY_RUN enabled.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple, Set

# Add project root to Python path
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.track import Track, TrackArtist
from database.connection import AsyncSessionLocal


# ============================================================================
# CONFIGURATION - Modify these variables as needed
# ============================================================================

# Input Configuration
JSON_PATH = "removal_tracks.json"  # Path to JSON file with tracks to remove

# Processing Configuration
BATCH_SIZE = 100  # Process deletions in batches for better performance
COMMIT_INTERVAL = 500  # Commit every N deletions

# Test Mode Configuration
TEST_MODE = False  # Set to True to run in test mode with limited deletions
TEST_TRACK_LIMIT = 50  # Number of tracks to process in test mode

# Dry Run Mode
DRY_RUN = True  # Set to True to preview deletions without executing


# ============================================================================
# LOGGING
# ============================================================================

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


# ============================================================================
# TRACK DELETION LOGIC
# ============================================================================

async def get_track_id_by_uuid(db: AsyncSession, uuid: str) -> int | None:
    """
    Get track ID from database by UUID.
    
    Args:
        db: Database session
        uuid: Track UUID
        
    Returns:
        Track ID if found, None otherwise
    """
    result = await db.execute(
        select(Track.id).where(Track.uuid == uuid)
    )
    row = result.first()
    return row[0] if row else None


async def delete_track_artists(db: AsyncSession, track_ids: List[int], dry_run: bool = False) -> int:
    """
    Delete track-artist associations for given track IDs.
    
    Args:
        db: Database session
        track_ids: List of track IDs to delete associations for
        dry_run: If True, only count but don't delete
        
    Returns:
        Number of rows affected
    """
    if not track_ids:
        return 0
    
    if dry_run:
        # Count how many would be deleted
        result = await db.execute(
            text("SELECT COUNT(*) FROM track_artists WHERE track_id IN :track_ids"),
            {"track_ids": tuple(track_ids)}
        )
        count = result.scalar()
        return count or 0
    
    # Delete track_artist associations
    delete_stmt = delete(TrackArtist).where(TrackArtist.track_id.in_(track_ids))
    result = await db.execute(delete_stmt)
    return result.rowcount


async def delete_tracks(db: AsyncSession, track_ids: List[int], dry_run: bool = False) -> int:
    """
    Delete tracks by their IDs.
    
    Args:
        db: Database session
        track_ids: List of track IDs to delete
        dry_run: If True, only count but don't delete
        
    Returns:
        Number of rows affected
    """
    if not track_ids:
        return 0
    
    if dry_run:
        # All track_ids exist, so just return the count
        return len(track_ids)
    
    # Delete tracks
    delete_stmt = delete(Track).where(Track.id.in_(track_ids))
    result = await db.execute(delete_stmt)
    return result.rowcount


async def process_batch(
    db: AsyncSession,
    uuids: List[str],
    dry_run: bool = False
) -> Tuple[int, int, int]:
    """
    Process a batch of UUIDs for deletion.
    
    Args:
        db: Database session
        uuids: List of track UUIDs to delete
        dry_run: If True, only preview deletions
        
    Returns:
        Tuple of (tracks_deleted, track_artists_deleted, not_found)
    """
    # Get track IDs for the given UUIDs
    track_ids = []
    not_found = 0
    
    for uuid in uuids:
        track_id = await get_track_id_by_uuid(db, uuid)
        if track_id:
            track_ids.append(track_id)
        else:
            not_found += 1
    
    if not track_ids:
        return 0, 0, not_found
    
    # Delete track_artists associations
    track_artists_deleted = await delete_track_artists(db, track_ids, dry_run)
    
    # Delete tracks
    tracks_deleted = await delete_tracks(db, track_ids, dry_run)
    
    return tracks_deleted, track_artists_deleted, not_found


async def remove_tracks_from_json(
    uuids: List[str],
    dry_run: bool = False
) -> Tuple[int, int, int]:
    """
    Remove tracks based on UUIDs from JSON.
    
    Args:
        uuids: List of track UUIDs to remove
        dry_run: If True, only preview deletions
        
    Returns:
        Tuple of (total_tracks_deleted, total_track_artists_deleted, total_not_found)
    """
    if not uuids:
        logger.info("No UUIDs provided; nothing to delete.")
        return 0, 0, 0
    
    total_tracks_deleted = 0
    total_track_artists_deleted = 0
    total_not_found = 0
    
    async with AsyncSessionLocal() as db:
        try:
            total_uuids = len(uuids)
            logger.info(f"Processing {total_uuids} UUIDs for deletion (dry_run={dry_run})...")
            
            # Process in batches
            for i in range(0, total_uuids, BATCH_SIZE):
                batch = uuids[i:i + BATCH_SIZE]
                
                tracks_deleted, track_artists_deleted, not_found = await process_batch(
                    db, batch, dry_run
                )
                
                total_tracks_deleted += tracks_deleted
                total_track_artists_deleted += track_artists_deleted
                total_not_found += not_found
                
                # Progress update
                processed = min(i + BATCH_SIZE, total_uuids)
                percentage = (processed / total_uuids) * 100
                logger.info(
                    f"[PROGRESS] {processed}/{total_uuids} ({percentage:.1f}%) - "
                    f"Tracks: {total_tracks_deleted}, TrackArtists: {total_track_artists_deleted}, "
                    f"Not Found: {total_not_found}"
                )
                
                # Commit at intervals (if not dry run)
                if not dry_run and total_tracks_deleted > 0 and total_tracks_deleted % COMMIT_INTERVAL == 0:
                    await db.commit()
                    logger.info(f"[COMMIT] Saved progress: {total_tracks_deleted} tracks deleted")
            
            # Final commit
            if not dry_run:
                await db.commit()
                logger.info(
                    f"Done. Deleted {total_tracks_deleted} tracks and "
                    f"{total_track_artists_deleted} track-artist associations. "
                    f"{total_not_found} UUIDs not found in database."
                )
            else:
                logger.info(
                    f"[DRY RUN] Would delete {total_tracks_deleted} tracks and "
                    f"{total_track_artists_deleted} track-artist associations. "
                    f"{total_not_found} UUIDs not found in database."
                )
            
            return total_tracks_deleted, total_track_artists_deleted, total_not_found
            
        finally:
            await db.close()


# ============================================================================
# UTILITIES
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
    tracks_deleted: int,
    track_artists_deleted: int,
    not_found: int,
    elapsed_time: float,
    dry_run: bool = False
) -> None:
    """Print test mode summary with estimates."""
    avg_per_track = elapsed_time / processed if processed > 0 else 0
    estimated_total = avg_per_track * total_available if total_available > 0 else 0
    
    print("\n" + "="*70)
    print("[TEST MODE] Test run completed!")
    print("="*70)
    print(f"[TEST MODE] UUIDs processed: {processed:,} / {total_available:,} total available")
    
    if dry_run:
        print(f"[TEST MODE] Would delete:")
    else:
        print(f"[TEST MODE] Deleted:")
    
    print(f"[TEST MODE]   - Tracks: {tracks_deleted:,}")
    print(f"[TEST MODE]   - Track-Artist associations: {track_artists_deleted:,}")
    print(f"[TEST MODE]   - Not found: {not_found:,}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Total time: {format_time(elapsed_time)}")
    print(f"[TEST MODE] Average per UUID: {avg_per_track:.2f} seconds")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] ESTIMATED TIME FOR FULL DATASET:")
    print(f"[TEST MODE] - Total UUIDs: {total_available:,}")
    print(f"[TEST MODE] - Estimated time: ~{format_time(estimated_total)}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Set TEST_MODE = False to process all tracks.")
    print("="*70 + "\n")


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
        logger.error(f"Please ensure removal_tracks.json exists in the script directory.")
        return
    except json.JSONDecodeError as e:
        logger.error(f"ERROR: Invalid JSON file: {e}")
        return
    
    if not all_data:
        logger.info("No tracks found in JSON; nothing to delete.")
        return
    
    # Extract UUIDs, filtering out empty ones
    all_uuids = [item.get("uuid", "").strip() for item in all_data]
    all_uuids = [uuid for uuid in all_uuids if uuid]  # Remove empty UUIDs
    
    if not all_uuids:
        logger.error("ERROR: No valid UUIDs found in JSON file.")
        logger.error("Please ensure UUIDs have been populated using populate_removal_uuids.py")
        return
    
    # Apply test mode limit
    if TEST_MODE:
        uuids = all_uuids[:TEST_TRACK_LIMIT]
        print(f"\n{'='*70}")
        print(f"[TEST MODE] ENABLED - Processing {len(uuids)} / {len(all_uuids)} UUIDs")
        print(f"{'='*70}\n")
    else:
        uuids = all_uuids
    
    # Dry run warning
    if DRY_RUN:
        print(f"\n{'='*70}")
        print(f"[DRY RUN] ENABLED - No deletions will be executed")
        print(f"{'='*70}\n")
    
    # Confirmation prompt (if not in test mode and not dry run)
    if not TEST_MODE and not DRY_RUN:
        print(f"\n{'!'*70}")
        print(f"WARNING: You are about to DELETE {len(uuids):,} tracks from the database!")
        print(f"This operation is DESTRUCTIVE and cannot be undone.")
        print(f"{'!'*70}\n")
        response = input("Are you sure you want to continue? (yes/no): ").strip().lower()
        if response != "yes":
            logger.info("Operation cancelled by user.")
            return
        print()
    
    # Track time
    start_time = time.time()
    
    # Process deletions
    tracks_deleted, track_artists_deleted, not_found = asyncio.run(
        remove_tracks_from_json(uuids, dry_run=DRY_RUN)
    )
    
    # Calculate elapsed time
    elapsed_time = time.time() - start_time
    
    # Test mode summary
    if TEST_MODE:
        print_test_mode_summary(
            processed=len(uuids),
            total_available=len(all_uuids),
            tracks_deleted=tracks_deleted,
            track_artists_deleted=track_artists_deleted,
            not_found=not_found,
            elapsed_time=elapsed_time,
            dry_run=DRY_RUN
        )
    else:
        logger.info(f"Total time: {format_time(elapsed_time)}")
        
        if DRY_RUN:
            print(f"\n{'='*70}")
            print(f"[DRY RUN] Summary:")
            print(f"  Would delete {tracks_deleted:,} tracks")
            print(f"  Would delete {track_artists_deleted:,} track-artist associations")
            print(f"  {not_found:,} UUIDs not found in database")
            print(f"  Set DRY_RUN = False to execute deletions")
            print(f"{'='*70}\n")


if __name__ == "__main__":
    main()

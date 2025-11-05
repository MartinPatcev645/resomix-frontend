#!/usr/bin/env python3
"""
Backfill num_tracks and play_time for playlists
===============================================

This script scans the playlists table and fixes rows where either
num_tracks = 0 or play_time = 0 by:
- Counting tracks from playlist_tracks
- Summing duration_sec for those tracks
- Including duration_sec of the seed track if present

Usage:
    python scripts/playlist/count_and_play_time.py \
        --host 127.0.0.1 --port 3306 --user resomix --password secret --database resomix_db \
        [--batch-size 500] [--chunk-size 1000] [--dry-run]

Notes:
- Mirrors DB connection style from scripts/extract_production_data.py
- duration_sec is treated as seconds; summed as int(sum(int(float(duration))))
"""

import argparse
import logging
from typing import List, Dict, Any, Optional

import pymysql
from pymysql.cursors import DictCursor


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_connection(cfg: Dict[str, Any]):
    return pymysql.connect(
        host=cfg['host'],
        user=cfg['user'],
        password=cfg['password'],
        database=cfg['database'],
        port=cfg.get('port', 3306),
        cursorclass=DictCursor,
        autocommit=False,
    )


def fetch_target_playlists(conn, batch_size: int) -> List[Dict[str, Any]]:
    """Fetch a batch of playlists where num_tracks=0 OR play_time=0."""
    sql = (
        "SELECT id, seed_track_id, num_tracks, play_time "
        "FROM playlists "
        "WHERE num_tracks = 0 OR play_time = 0 "
        "LIMIT %s"
    )
    with conn.cursor() as cur:
        cur.execute(sql, (batch_size,))
        return cur.fetchall()


def fetch_playlist_track_ids(conn, playlist_id: int) -> List[int]:
    sql = "SELECT track_id FROM playlist_tracks WHERE playlist_id = %s"
    with conn.cursor() as cur:
        cur.execute(sql, (playlist_id,))
        return [row['track_id'] for row in cur.fetchall()]


def fetch_track_durations(conn, track_ids: List[int], chunk_size: int = 1000) -> Dict[int, Optional[float]]:
    """Fetch track durations in chunks to avoid very large IN() clauses."""
    if not track_ids:
        return {}
    durations: Dict[int, Optional[float]] = {}
    with conn.cursor() as cur:
        for i in range(0, len(track_ids), chunk_size):
            chunk = track_ids[i:i+chunk_size]
            placeholders = ','.join(['%s'] * len(chunk))
            sql = f"SELECT id, duration_sec FROM tracks WHERE id IN ({placeholders})"
            cur.execute(sql, chunk)
            for row in cur.fetchall():
                durations[row['id']] = row['duration_sec']
    return durations


def compute_counts_and_playtime(
    conn,
    playlist_id: int,
    seed_track_id: Optional[int],
    chunk_size: int = 1000
) -> Dict[str, int]:
    track_ids = fetch_playlist_track_ids(conn, playlist_id)
    num_tracks = len(track_ids)

    all_ids: List[int] = list(track_ids)
    if seed_track_id:
        all_ids.append(seed_track_id)

    durations_map = fetch_track_durations(conn, all_ids, chunk_size)

    # Sum with float precision first, then cast to int at the end to
    # avoid losing sub-second precision during accumulation
    play_time_float = 0.0
    for tid in all_ids:
        dur = durations_map.get(tid)
        if dur is not None:
            try:
                play_time_float += float(dur)
            except Exception:
                # malformed value, skip
                continue

    play_time = int(play_time_float)
    return {"num_tracks": num_tracks, "play_time": play_time}


def update_playlist(conn, playlist_id: int, num_tracks: int, play_time: int, dry_run: bool = False) -> None:
    if dry_run:
        logger.info(f"DRY-RUN update playlists SET num_tracks={num_tracks}, play_time={play_time} WHERE id={playlist_id}")
        return
    sql = "UPDATE playlists SET num_tracks = %s, play_time = %s WHERE id = %s"
    with conn.cursor() as cur:
        cur.execute(sql, (num_tracks, play_time, playlist_id))


def process_all(cfg: Dict[str, Any], batch_size: int, chunk_size: int, dry_run: bool):
    """
    Process ALL playlists where num_tracks=0 OR play_time=0.
    
    Args:
        batch_size: Number of playlists to process per transaction (commits after each batch)
        chunk_size: Max track IDs per IN() query when fetching durations (avoids query size limits)
        dry_run: If True, don't commit changes
    """
    conn = get_connection(cfg)
    try:
        total_fixed = 0
        batch_num = 0
        while True:
            targets = fetch_target_playlists(conn, batch_size)
            if not targets:
                break

            batch_num += 1
            logger.info(f"Batch {batch_num}: Found {len(targets)} playlists to process")

            processed = 0
            for p in targets:
                pid = p['id']
                seed_id = p.get('seed_track_id')

                stats = compute_counts_and_playtime(conn, pid, seed_id, chunk_size)
                update_playlist(conn, pid, stats['num_tracks'], stats['play_time'], dry_run=dry_run)
                processed += 1
                total_fixed += 1

                if processed % 100 == 0:
                    logger.info(f"  Processed {processed}/{len(targets)} in this batch")

            if dry_run:
                logger.info("DRY-RUN - rolling back changes")
                conn.rollback()
            else:
                conn.commit()

        logger.info(f"Done. Total playlists updated: {total_fixed}{' (dry-run)' if dry_run else ''}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="Backfill playlists num_tracks and play_time")
    parser.add_argument('--host', default='127.0.0.1', help='Database host')
    parser.add_argument('--port', type=int, default=3306, help='Database port')
    parser.add_argument('--user', default='resomix', help='Database user')
    parser.add_argument('--password', default='secret', help='Database password')
    parser.add_argument('--database', default='resomix_db', help='Database name')
    parser.add_argument('--batch-size', type=int, default=500, 
                        help='Playlists to process per transaction (default: 500). Script processes ALL playlists in batches.')
    parser.add_argument('--chunk-size', type=int, default=1000, 
                        help='Max track IDs per IN() query when fetching durations (default: 1000). Prevents query size limits.')
    parser.add_argument('--dry-run', action='store_true', help='Do not write changes')

    args = parser.parse_args()
    cfg = {
        'host': args.host,
        'port': args.port,
        'user': args.user,
        'password': args.password,
        'database': args.database,
    }

    process_all(cfg, batch_size=args.batch_size, chunk_size=args.chunk_size, dry_run=args.dry_run)


if __name__ == '__main__':
    main()


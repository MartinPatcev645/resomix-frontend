#!/usr/bin/env python3
"""Bulk migrates track documents from MongoDB into the Resomix MariaDB schema.

Usage
-----
$ python migrate_mongo_to_mariadb.py --batch-size 1000
$ python migrate_mongo_to_mariadb.py --batch-size 1000 --retry-errors

The script is idempotent thanks to unique constraints +
`INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` strategies.

Resume functionality: The script automatically skips already processed tracks
by checking existing UUIDs in MariaDB.

Error handling: Errors are logged to errors.log and can be retried with --retry-errors flag.
"""

import os
import re
import html
import logging
import argparse
import time
from typing import Dict, Tuple, List, Set
from dotenv import load_dotenv

from pymongo import MongoClient
from sqlalchemy import text
from mariadb_ import engine  # reuse the SQLAlchemy engine you already configured

# Load environment variables from .env file
load_dotenv()

# --- Global Testing Configuration ---
TESTING = False  # Set to False for full migration
TESTING_LIMIT = 2000  # Number of tracks to process in testing mode

# --- Settings ----------------------------------------------------------------

BATCH_SIZE_DEFAULT = 1000
ERROR_LOG_FILE = "errors.log"
MAX_ERRORS = 1000  # Increased from 100
DELIM_PATTERN = re.compile(
    r"""\s*(?:,|;|\s+&\s+|\s+&amp;\s+)\s*""", re.IGNORECASE
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
)

# --- Helper functions --------------------------------------------------------

def setup_error_logging():
    """Setup error logging to file."""
    error_logger = logging.getLogger('error_logger')
    error_logger.setLevel(logging.ERROR)
    
    # Remove existing handlers to avoid duplicates
    for handler in error_logger.handlers[:]:
        error_logger.removeHandler(handler)
    
    error_handler = logging.FileHandler(ERROR_LOG_FILE, mode='a', encoding='utf-8')
    error_formatter = logging.Formatter('[%(asctime)s] ERROR: %(message)s')
    error_handler.setFormatter(error_formatter)
    error_logger.addHandler(error_handler)
    error_logger.propagate = False  # Don't propagate to root logger
    
    return error_logger

def log_error_to_file(error_logger, uuid: str, error_msg: str, document: Dict):
    """Log error details to file."""
    error_logger.error(f"Error processing document {uuid}: {error_msg}")
    error_logger.error(f"Document: {document}")

def load_error_uuids() -> Set[str]:
    """Load UUIDs of previously failed documents from error log."""
    error_uuids = set()
    if os.path.exists(ERROR_LOG_FILE):
        try:
            with open(ERROR_LOG_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if "Error processing document" in line:
                        # Extract UUID from log line
                        match = re.search(r'document ([a-f0-9]{24}):', line)
                        if match:
                            error_uuids.add(match.group(1))
        except Exception as e:
            logging.warning(f"Could not load error UUIDs: {e}")
    
    logging.info(f"Loaded {len(error_uuids)} error UUIDs from previous runs")
    return error_uuids

def extract_first_genre(genre_string: str) -> str:
    """Extract the first genre from a comma-separated genre string and ensure it fits in DB."""
    if not genre_string or not genre_string.strip():
        return "Unknown"
    
    # Split by common delimiters and take the first one
    genres = re.split(r'[,;]', genre_string.strip())
    first_genre = genres[0].strip()
    
    # Ensure it fits in the database column (VARCHAR(80))
    if len(first_genre) > 80:
        first_genre = first_genre[:77] + "..."
    
    return first_genre if first_genre else "Unknown"

def parse_artist_names(raw: str) -> List[str]:
    """Split the artist field into individual names."""
    if not raw:
        return []
    raw = html.unescape(raw)
    parts = DELIM_PATTERN.split(raw)
    return [p.strip() for p in parts if p.strip()]


class Cache:
    """Thin in‑memory cache of lookup‑tables (name → id)."""

    def __init__(self):
        self.artists: Dict[str, int] = {}
        self.labels: Dict[str, int] = {}
        self.genres: Dict[str, int] = {}
        self.albums: Dict[Tuple[str, int], int] = {}

    # --- generic helpers -----------------------------------------------------

    @staticmethod
    def _fetch_table(conn, table: str):
        return {name.lower(): id_ for name, id_ in conn.execute(text(f"SELECT name, id FROM {table}"))}

    def preload(self, conn):
        self.artists = self._fetch_table(conn, "artists")
        self.labels = self._fetch_table(conn, "labels")
        self.genres = self._fetch_table(conn, "genres")
        # albums: (title, artist_id) fetch
        self.albums = {
            (title.lower(), artist_id): id_
            for title, artist_id, id_ in conn.execute(
                text("SELECT title, artist_id, id FROM albums")
            )
        }

    # --- get-or-create helpers ----------------------------------------------

    def _get_or_create(
        self, conn, table: str, cache: Dict[str, int], name: str
    ) -> int:
        key = name.lower()
        if key in cache:
            return cache[key]
        insert_sql = text(f"INSERT IGNORE INTO {table} (name) VALUES (:name)")
        result = conn.execute(insert_sql, {"name": name})
        
        # Get the ID - handle potential duplicates
        select_result = conn.execute(
            text(f"SELECT id FROM {table} WHERE name = :name"), {"name": name}
        )
        row = select_result.first()
        if row is None:
            raise Exception(f"Failed to insert or find {table} record for name: {name}")
        
        id_ = row[0]
        cache[key] = id_
        return id_

    def artist(self, conn, name: str) -> int:
        return self._get_or_create(conn, "artists", self.artists, name)

    def label(self, conn, name: str) -> int:
        return self._get_or_create(conn, "labels", self.labels, name)

    def genre(self, conn, name: str) -> int:
        return self._get_or_create(conn, "genres", self.genres, name)

    def album(self, conn, title: str, primary_artist_id: int) -> int:
        key = (title.lower(), primary_artist_id)
        if key in self.albums:
            return self.albums[key]
        insert_sql = text(
            """INSERT IGNORE INTO albums (artist_id, title) 
                   VALUES (:artist_id, :title) """
        )
        result = conn.execute(
            insert_sql, {"artist_id": primary_artist_id, "title": title}
        )
        
        # Get the ID - handle potential duplicates
        select_result = conn.execute(
            text(
                "SELECT id FROM albums WHERE artist_id = :artist_id AND title = :title"
            ),
            {"artist_id": primary_artist_id, "title": title},
        )
        row = select_result.first()
        if row is None:
            raise Exception(f"Failed to insert or find album record for: {title} by artist_id {primary_artist_id}")
        
        id_ = row[0]
        self.albums[key] = id_
        return id_


# --- Main migration logic ----------------------------------------------------

def get_existing_uuids(conn) -> Set[str]:
    """Fetch all existing UUIDs from MariaDB tracks table for resume functionality."""
    logging.info("Fetching existing UUIDs from MariaDB for resume functionality...")
    start_time = time.time()
    
    try:
        result = conn.execute(text("SELECT uuid FROM tracks"))
        existing_uuids = {row[0] for row in result}
        elapsed = time.time() - start_time
        logging.info(f"Found {len(existing_uuids)} existing tracks in MariaDB (took {elapsed:.2f}s)")
        return existing_uuids
    except Exception as e:
        logging.error(f"Error fetching existing UUIDs: {e}")
        return set()

def get_total_mongo_count(mcol) -> int:
    """Get total count of documents in MongoDB collection."""
    try:
        total = mcol.count_documents({})
        logging.info(f"Total documents in MongoDB: {total:,}")
        return total
    except Exception as e:
        logging.error(f"Error getting MongoDB count: {e}")
        return 0

def log_progress(processed: int, total: int, start_time: float, batch_time: float):
    """Log detailed progress information."""
    if total > 0:
        percent = (processed / total) * 100
        elapsed = time.time() - start_time
        rate = processed / elapsed if elapsed > 0 else 0
        
        if rate > 0:
            eta_seconds = (total - processed) / rate
            eta_hours = eta_seconds / 3600
            eta_str = f", ETA: {eta_hours:.1f}h" if eta_hours > 1 else f", ETA: {eta_seconds/60:.1f}m"
        else:
            eta_str = ""
        
        logging.info(f"Progress: {processed:,}/{total:,} ({percent:.2f}%) - "
                    f"Rate: {rate:.1f} tracks/sec - "
                    f"Batch time: {batch_time:.2f}s{eta_str}")

def migrate(batch_size: int, retry_errors: bool = False):
    # Setup error logging
    error_logger = setup_error_logging()
    
    # Get MongoDB connection details from environment variables
    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        logging.error("MONGODB_URI environment variable is not set")
        return
    
    # Extract database and collection from environment or use defaults
    db_name = os.getenv("MONGO_DB_NAME", "Data")
    collection_name = os.getenv("MONGO_COLLECTION_NAME", "Tracks")

    if TESTING:
        logging.info(f"🧪 TESTING MODE: Will process only {TESTING_LIMIT} tracks")
    
    if retry_errors:
        logging.info("🔄 RETRY MODE: Will only process previously failed documents")
    
    logging.info(f"Connecting to MongoDB: {mongo_uri}")
    logging.info(f"Using database: {db_name}, collection: {collection_name}")
    logging.info(f"Batch size: {batch_size}")
    logging.info(f"Max errors before stopping: {MAX_ERRORS}")
    
    client = MongoClient(mongo_uri)
    mcol = client[db_name][collection_name]

    # Get total count for progress tracking
    total_mongo_docs = get_total_mongo_count(mcol)
    
    cache = Cache()
    start_time = time.time()
    processed = 0
    skipped = 0
    errors = 0

    # Load error UUIDs if in retry mode
    error_uuids_to_retry = set()
    if retry_errors:
        error_uuids_to_retry = load_error_uuids()
        if not error_uuids_to_retry:
            logging.info("No error UUIDs found to retry. Exiting.")
            return

    # MariaDB connection and setup
    with engine.begin() as conn:
        cache.preload(conn)
        
        # Get existing UUIDs for resume functionality
        existing_uuids = get_existing_uuids(conn)

    # Use find with no_cursor_timeout but add session handling for large datasets
    cursor = mcol.find({}, no_cursor_timeout=True).batch_size(batch_size)
    batch_tracks = []
    batch_track_artists = []
    last_batch_time = time.time()

    def flush(conn):
        nonlocal batch_tracks, batch_track_artists
        if not batch_tracks:
            return
        
        batch_start = time.time()
        logging.info("Inserting %d tracks", len(batch_tracks))

        try:
            track_sql = text(
                """INSERT IGNORE INTO tracks
                   (uuid, album_id, label_id, genre_id, title, year, duration_sec,
                    file_path, preview_path, file_size)
                   VALUES (:uuid, :album_id, :label_id, :genre_id, :title, :year,
                           :duration_sec, :file_path, :preview_path, :file_size)
                """
            )
            result = conn.execute(track_sql, batch_tracks)
            
            # Check how many rows were actually inserted
            if hasattr(result, 'rowcount'):
                logging.info(f"INSERT result: {result.rowcount} rows affected")
            
            # Verify the insertion by counting tracks in a sample batch
            if len(batch_tracks) <= 10:  # Only for small batches to avoid performance impact
                sample_uuids = [t["uuid"] for t in batch_tracks[:5]]
                placeholders = ','.join([f"'{uuid}'" for uuid in sample_uuids])
                count_result = conn.execute(text(f"SELECT COUNT(*) FROM tracks WHERE uuid IN ({placeholders})"))
                actual_count = count_result.scalar()
                logging.info(f"Verification: Found {actual_count} out of {len(sample_uuids)} sample tracks in DB")

            # fetch ids for the newly inserted / existing tracks
            uuids = [t["uuid"] for t in batch_tracks]
            
            # Fix: Create placeholder string for IN clause
            placeholders = ','.join([':uuid' + str(i) for i in range(len(uuids))])
            uuid_params = {f'uuid{i}': uuid for i, uuid in enumerate(uuids)}
            
            id_map = {}
            result = conn.execute(
                text(f"SELECT uuid, id FROM tracks WHERE uuid IN ({placeholders})"),
                uuid_params
            )
            for uuid, id_ in result:
                id_map[uuid] = id_
            
            logging.info(f"Found {len(id_map)} track IDs out of {len(uuids)} UUIDs")
            
            # Only process track_artists for tracks that were actually inserted
            valid_track_artists = []
            for rec in batch_track_artists:
                if rec["uuid"] in id_map:
                    rec["track_id"] = id_map[rec["uuid"]]
                    valid_track_artists.append(rec)
            
            if valid_track_artists:
                ta_sql = text(
                    "INSERT IGNORE INTO track_artists (track_id, artist_id) VALUES (:track_id, :artist_id)"
                )
                ta_result = conn.execute(ta_sql, valid_track_artists)
                if hasattr(ta_result, 'rowcount'):
                    logging.info(f"Track-artists INSERT result: {ta_result.rowcount} rows affected")

            batch_flush_time = time.time() - batch_start
            logging.info(f"Batch insert completed in {batch_flush_time:.2f}s")

        except Exception as e:
            logging.error(f"Error during batch insert: {e}")
            # Log the problematic batch for debugging
            logging.error(f"Problematic UUIDs: {[t['uuid'] for t in batch_tracks]}")
            # Log a sample track for debugging
            if batch_tracks:
                logging.error(f"Sample track data: {batch_tracks[0]}")
            raise

        batch_tracks = []
        batch_track_artists = []

    try:
        with engine.begin() as conn:
            for doc in cursor:
                # Check testing limit
                if TESTING and processed >= TESTING_LIMIT:
                    logging.info(f"🧪 TESTING MODE: Reached limit of {TESTING_LIMIT} tracks. Stopping migration.")
                    break
                
                uuid = str(doc["_id"])
                
                # Retry mode: only process documents that previously failed
                if retry_errors:
                    if uuid not in error_uuids_to_retry:
                        continue
                
                # Resume functionality: Skip if already exists (and not in retry mode)
                if not retry_errors and uuid in existing_uuids:
                    skipped += 1
                    if skipped % 10000 == 0:  # Log every 10k skipped
                        logging.info(f"Skipped {skipped} existing tracks so far...")
                    continue
                
                try:
                    info = doc.get("info", {})
                    file = doc.get("file", {})

                    # Log the document structure for debugging (first few only)
                    if processed < 3:
                        logging.info(f"Processing document {processed + 1}: {doc}")

                    title = info.get("Title") or file.get("filename") or ""
                    year = info.get("Year")
                    try:
                        year = int(year) if year else None
                    except ValueError:
                        year = None
                    duration = info.get("length")
                    try:
                        duration = int(duration) if duration else None
                    except ValueError:
                        duration = None

                    # artists
                    artist_field = info.get("Artist", "")
                    artist_names = parse_artist_names(artist_field) or ["Unknown"]
                    artist_ids = [cache.artist(conn, n) for n in artist_names]
                    primary_artist_id = artist_ids[0]

                    # label
                    label_name = info.get("Label", "").strip()
                    label_id = (
                        cache.label(conn, label_name) if label_name else None
                    )

                    # genre - FIX: Handle long genre strings
                    genre_name = extract_first_genre(info.get("Genre", ""))
                    genre_id = cache.genre(conn, genre_name)

                    # album
                    album_title = info.get("Album", "").strip()
                    album_id = (
                        cache.album(conn, album_title, primary_artist_id)
                        if album_title
                        else None
                    )

                    file_path = file.get("path", "")
                    size = file.get("size")
                    try:
                        size = int(size) if size else None
                    except ValueError:
                        size = None

                    preview_path = f"/mnt/data/PREVIEWS/{uuid}.mp3"

                    # Log what will be inserted for debugging (first few only)
                    track_data = {
                        "uuid": uuid,
                        "album_id": album_id,
                        "label_id": label_id,
                        "genre_id": genre_id,
                        "title": title[:255],
                        "year": year,
                        "duration_sec": duration,
                        "file_path": file_path[:500],  # Updated to match new column size
                        "preview_path": preview_path,
                        "file_size": size,
                    }
                    
                    if processed < 3:
                        logging.info(f"Track data to insert: {track_data}")

                    batch_tracks.append(track_data)

                    for aid in artist_ids:
                        batch_track_artists.append({"uuid": uuid, "artist_id": aid})

                    processed += 1
                    
                    # Flush batch and log progress
                    if processed % batch_size == 0:
                        flush(conn)
                        batch_time = time.time() - last_batch_time
                        log_progress(processed, total_mongo_docs, start_time, batch_time)
                        last_batch_time = time.time()

                except Exception as e:
                    errors += 1
                    error_msg = str(e)
                    logging.error(f"Error processing document {uuid}: {error_msg}")
                    
                    # Log to error file
                    log_error_to_file(error_logger, uuid, error_msg, doc)
                    
                    # Don't stop on individual errors, just log and continue
                    if errors >= MAX_ERRORS:  # Increased threshold
                        logging.error(f"Too many errors ({errors}), stopping migration")
                        break

            # Final flush
            flush(conn)
            
    except KeyboardInterrupt:
        logging.info("Migration interrupted by user. Progress saved.")
    except Exception as e:
        logging.error(f"Fatal error during migration: {e}")
        raise
    finally:
        cursor.close()
        client.close()

    # Final statistics
    elapsed_hours = (time.time() - start_time) / 3600
    logging.info("="*60)
    logging.info("MIGRATION COMPLETE")
    logging.info(f"Total processed: {processed:,} tracks")
    logging.info(f"Total skipped: {skipped:,} tracks (already existed)")
    logging.info(f"Total errors: {errors}")
    logging.info(f"Total time: {elapsed_hours:.2f} hours")
    if processed > 0:
        logging.info(f"Average rate: {processed / (elapsed_hours * 3600):.1f} tracks/second")
    
    if errors > 0:
        logging.info(f"Error details logged to: {ERROR_LOG_FILE}")
        logging.info(f"To retry failed documents, run with --retry-errors flag")
    
    logging.info("="*60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate tracks MongoDB → MariaDB")
    parser.add_argument(
        "--batch-size", type=int, default=BATCH_SIZE_DEFAULT, help="Bulk insert size"
    )
    parser.add_argument(
        "--retry-errors", action="store_true", help="Only retry previously failed documents"
    )
    args = parser.parse_args()
    migrate(args.batch_size, args.retry_errors)

#!/usr/bin/env python3
"""Bulk migrates track documents from MongoDB into the Resomix MariaDB schema.

Usage
-----
$ python migrate_mongo_to_mariadb.py --batch-size 1000

The script is idempotent thanks to unique constraints +
`INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` strategies.
"""

import os
import re
import html
import logging
import argparse
from typing import Dict, Tuple, List
from dotenv import load_dotenv

from pymongo import MongoClient
from sqlalchemy import text
from mariadb_ import engine  # reuse the SQLAlchemy engine you already configured

# Load environment variables from .env file
load_dotenv()

# --- Global Testing Configuration ---
TESTING = True  # Set to False for full migration
TESTING_LIMIT = 5  # Number of tracks to process in testing mode

# --- Settings ----------------------------------------------------------------

BATCH_SIZE_DEFAULT = 1000
DELIM_PATTERN = re.compile(
    r"""\s*(?:,|;|\s+&\s+|\s+&amp;\s+)\s*""", re.IGNORECASE
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
)

# --- Helper functions --------------------------------------------------------


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
        conn.execute(insert_sql, {"name": name})
        id_ = conn.execute(
            text(f"SELECT id FROM {table} WHERE name = :name"), {"name": name}
        ).scalar_one()
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
        conn.execute(
            insert_sql, {"artist_id": primary_artist_id, "title": title}
        )
        id_ = conn.execute(
            text(
                "SELECT id FROM albums WHERE artist_id = :artist_id AND title = :title"
            ),
            {"artist_id": primary_artist_id, "title": title},
        ).scalar_one()
        self.albums[key] = id_
        return id_


# --- Main migration logic ----------------------------------------------------


def migrate(batch_size: int):
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
    
    logging.info(f"Connecting to MongoDB: {mongo_uri}")
    logging.info(f"Using database: {db_name}, collection: {collection_name}")
    
    client = MongoClient(mongo_uri)
    mcol = client[db_name][collection_name]

    cache = Cache()

    processed = 0
    # MariaDB connection
    with engine.begin() as conn:
        cache.preload(conn)

    cursor = mcol.find({}, no_cursor_timeout=True).batch_size(batch_size)
    batch_tracks = []
    batch_track_artists = []

    def flush(conn):
        nonlocal batch_tracks, batch_track_artists
        if not batch_tracks:
            return
        logging.info("Inserting %d tracks", len(batch_tracks))

        track_sql = text(
            """INSERT IGNORE INTO tracks
               (uuid, album_id, label_id, genre_id, title, year, duration_sec,
                file_path, preview_path, file_size)
               VALUES (:uuid, :album_id, :label_id, :genre_id, :title, :year,
                       :duration_sec, :file_path, :preview_path, :file_size)
            """
        )
        conn.execute(track_sql, batch_tracks)

        # fetch ids for the newly inserted / existing tracks
        uuids = [t["uuid"] for t in batch_tracks]
        id_map = {
            uuid: id_
            for uuid, id_ in conn.execute(
                text(
                    "SELECT uuid, id FROM tracks WHERE uuid IN :uuids"
                ),
                {"uuids": tuple(uuids)},
            )
        }

        for rec in batch_track_artists:
            rec["track_id"] = id_map[rec["uuid"]]

        ta_sql = text(
            "INSERT IGNORE INTO track_artists (track_id, artist_id) VALUES (:track_id, :artist_id)"
        )
        conn.execute(ta_sql, batch_track_artists)

        batch_tracks = []
        batch_track_artists = []

    with engine.begin() as conn:
        for doc in cursor:
            # Check testing limit
            if TESTING and processed >= TESTING_LIMIT:
                logging.info(f"🧪 TESTING MODE: Reached limit of {TESTING_LIMIT} tracks. Stopping migration.")
                break
                
            uuid = str(doc["_id"])
            info = doc.get("info", {})
            file = doc.get("file", {})

            # Log the document structure for debugging
            if processed < 3:  # Log first 3 documents for inspection
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

            # genre
            genre_name = info.get("Genre", "").strip()
            genre_id = (
                cache.genre(conn, genre_name) if genre_name else None
            )

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

            # Log what will be inserted for debugging
            track_data = {
                "uuid": uuid,
                "album_id": album_id,
                "label_id": label_id,
                "genre_id": genre_id,
                "title": title[:255],
                "year": year,
                "duration_sec": duration,
                "file_path": file_path[:255],
                "preview_path": preview_path,
                "file_size": size,
            }
            
            if processed < 3:  # Log first 3 track insertions
                logging.info(f"Track data to insert: {track_data}")

            batch_tracks.append(track_data)

            for aid in artist_ids:
                batch_track_artists.append({"uuid": uuid, "artist_id": aid})

            processed += 1
            if processed % batch_size == 0:
                flush(conn)
                logging.info("Processed %d documents", processed)

        flush(conn)
        logging.info("Migration complete. Total documents: %d", processed)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate tracks MongoDB → MariaDB")
    parser.add_argument(
        "--batch-size", type=int, default=BATCH_SIZE_DEFAULT, help="Bulk insert size"
    )
    args = parser.parse_args()
    migrate(args.batch_size)

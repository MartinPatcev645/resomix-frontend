"""
Track Upload Service
====================

This service handles uploading tracks for similarity analysis.
It extracts metadata, generates UUIDs, calculates file sizes,
and inserts track data into MariaDB with proper artist/album/label/genre handling.

Manages track type="upload" records, file path generation,
and database relationships following the same pattern as the MongoDB migration.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import re
import html  
import logging
import secrets
from typing import Dict, Tuple, List, Optional, BinaryIO
from fastapi import UploadFile

from sqlalchemy import text
from database.connection import engine
from app.services.metadata_service import MetadataService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Delimiter pattern for parsing artist names (from migration script)
DELIM_PATTERN = re.compile(
    r"""\s*(?:,|;|\s+&\s+|\s+&amp;\s+)\s*""", re.IGNORECASE
)


def generate_track_uuid() -> str:
    """Generate a random 24-character hex UUID like the MongoDB ObjectIds."""
    return secrets.token_hex(12)  # 12 bytes = 24 hex characters


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
    """In-memory cache of lookup tables (name → id) - copied from migration script."""

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


class TrackUploadService:
    """Service for handling track uploads and database insertion."""
    
    def __init__(self):
        self.metadata_service = MetadataService()
        self.cache = Cache()
        
    def upload_track_to_database(
        self, 
        file: UploadFile, 
        file_content: bytes
    ) -> Dict[str, any]:
        """
        Upload a track to the database with extracted metadata.
        
        Args:
            file: The uploaded file object
            file_content: The file content as bytes
            
        Returns:
            Dict containing the track UUID and insertion status
        """
        try:
            # Generate UUID for the track
            track_uuid = generate_track_uuid()
            logger.info(f"Generated UUID for track: {track_uuid}")
            
            # Extract metadata using the existing service
            file.file.seek(0)  # Reset file pointer
            metadata = self.metadata_service.extract_metadata(file.file, file.filename, mode="limited")
            
            if "error" in metadata:
                raise Exception(f"Metadata extraction failed: {metadata['error']}")
            
            # Calculate file size
            file_size = len(file_content)
            
            # Extract basic info with defaults
            title = metadata.get("Title", "") or file.filename or "Unknown"
            year = self._parse_year(metadata.get("Year"))
            
            # Parse artist names
            artist_field = metadata.get("Artist", "")
            artist_names = parse_artist_names(artist_field) or ["Unknown"]
            
            # Extract label and genre
            label_name = metadata.get("Label", "").strip()
            genre_name = extract_first_genre(metadata.get("Genre", ""))
            
            # Extract album
            album_title = metadata.get("Album", "").strip()
            
            # Set file paths
            file_path = file.filename or "unknown_file"
            preview_path = f"/mnt/data/UPLOADS/{track_uuid}.mp3"
            
            # Insert into database
            with engine.begin() as conn:
                # Preload cache
                logger.info("Preloading database cache...")
                self.cache.preload(conn)
                
                # Get or create artists
                artist_ids = [self.cache.artist(conn, name) for name in artist_names]
                primary_artist_id = artist_ids[0]
                
                # Get or create label (optional)
                label_id = None
                if label_name:
                    label_id = self.cache.label(conn, label_name)
                
                # Get or create genre
                genre_id = self.cache.genre(conn, genre_name)
                
                # Get or create album (optional)
                album_id = None
                if album_title:
                    album_id = self.cache.album(conn, album_title, primary_artist_id)
                
                # Insert track
                track_data = {
                    "uuid": track_uuid,
                    "album_id": album_id,
                    "label_id": label_id,
                    "genre_id": genre_id,
                    "title": title[:255],  # Ensure it fits in the column
                    "year": year,
                    "duration_sec": None,  # User said to ignore duration for now
                    "file_path": file_path[:500],  # Ensure it fits in the column
                    "preview_path": preview_path,
                    "file_size": file_size,
                    "type": "upload"  # Set the type to "upload"
                }
                
                logger.info(f"Inserting track: {track_data}")
                
                track_sql = text(
                    """INSERT INTO tracks
                       (uuid, album_id, label_id, genre_id, title, year, duration_sec,
                        file_path, preview_path, file_size, type)
                       VALUES (:uuid, :album_id, :label_id, :genre_id, :title, :year,
                               :duration_sec, :file_path, :preview_path, :file_size, :type)
                    """
                )
                result = conn.execute(track_sql, track_data)
                
                # Get the track ID
                track_id_result = conn.execute(
                    text("SELECT id FROM tracks WHERE uuid = :uuid"),
                    {"uuid": track_uuid}
                )
                track_row = track_id_result.first()
                if track_row is None:
                    raise Exception("Failed to insert track or retrieve track ID")
                
                track_id = track_row[0]
                
                # Insert track-artist relationships
                for artist_id in artist_ids:
                    ta_sql = text(
                        "INSERT IGNORE INTO track_artists (track_id, artist_id) VALUES (:track_id, :artist_id)"
                    )
                    conn.execute(ta_sql, {"track_id": track_id, "artist_id": artist_id})
                
                logger.info(f"Successfully inserted track {track_uuid} with ID {track_id}")
                
                return {
                    "success": True,
                    "uuid": track_uuid,
                    "track_id": track_id,
                    "metadata": metadata,
                    "file_size": file_size,
                    "artist_names": artist_names,
                    "album_title": album_title,
                    "label_name": label_name,
                    "genre_name": genre_name
                }
                
        except Exception as e:
            logger.error(f"Error uploading track to database: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _parse_year(self, year_str: Optional[str]) -> Optional[int]:
        """Parse year from string, handling various formats."""
        if not year_str:
            return None
        
        try:
            # Try to extract 4-digit year from the string
            year_match = re.search(r'\b(\d{4})\b', str(year_str))
            if year_match:
                year = int(year_match.group(1))
                # Validate year range (reasonable range for music)
                if 1900 <= year <= 2030:
                    return year
            return None
        except (ValueError, AttributeError):
            return None
    
    def upload_track_to_database_with_uuid(
        self, 
        file: UploadFile, 
        file_content: bytes,
        track_uuid: str,
        track_type: str = "upload",
        duration_sec: Optional[int] = None
    ) -> Dict[str, any]:
        """
        Upload a track to the database with a pre-generated UUID and specific track type.
        
        Args:
            file: The uploaded file object
            file_content: The file content as bytes
            track_uuid: Pre-generated UUID for the track
            track_type: The type of track (e.g., "upload", "monthly_pipeline")
            duration_sec: Track duration in seconds (optional)
            
        Returns:
            Dict containing the track UUID and insertion status
        """
        try:
            logger.info(f"Using provided UUID for track: {track_uuid}")
            
            # Extract metadata using the existing service
            file.file.seek(0)  # Reset file pointer
            metadata = self.metadata_service.extract_metadata(file.file, file.filename, mode="limited")
            
            if "error" in metadata:
                raise Exception(f"Metadata extraction failed: {metadata['error']}")
            
            # Calculate file size
            file_size = len(file_content)
            
            # Extract basic info with defaults
            title = metadata.get("Title", "") or file.filename or "Unknown"
            year = self._parse_year(metadata.get("Year"))
            
            # Parse artist names
            artist_field = metadata.get("Artist", "")
            artist_names = parse_artist_names(artist_field) or ["Unknown"]
            
            # Extract label and genre
            label_name = metadata.get("Label", "").strip()
            genre_name = extract_first_genre(metadata.get("Genre", ""))
            
            # Extract album
            album_title = metadata.get("Album", "").strip()
            
            # Set file paths
            file_path = file.filename or "unknown_file"
            preview_path = f"/mnt/data/UPLOADS/{track_uuid}.mp3"
            
            # Insert into database
            with engine.begin() as conn:
                # Preload cache
                logger.info("Preloading database cache...")
                self.cache.preload(conn)
                
                # Get or create artists
                artist_ids = [self.cache.artist(conn, name) for name in artist_names]
                primary_artist_id = artist_ids[0]
                
                # Get or create label (optional)
                label_id = None
                if label_name:
                    label_id = self.cache.label(conn, label_name)
                
                # Get or create genre
                genre_id = self.cache.genre(conn, genre_name)
                
                # Get or create album (optional)
                album_id = None
                if album_title:
                    album_id = self.cache.album(conn, album_title, primary_artist_id)
                
                # Insert track
                track_data = {
                    "uuid": track_uuid,
                    "album_id": album_id,
                    "label_id": label_id,
                    "genre_id": genre_id,
                    "title": title[:255],  # Ensure it fits in the column
                    "year": year,
                    "duration_sec": duration_sec,
                    "file_path": file_path[:500],  # Ensure it fits in the column
                    "preview_path": preview_path,
                    "file_size": file_size,
                    "type": track_type  # Use the provided track type
                }
                
                logger.info(f"Inserting track with type '{track_type}': {track_data}")
                
                track_sql = text(
                    """INSERT INTO tracks
                       (uuid, album_id, label_id, genre_id, title, year, duration_sec,
                        file_path, preview_path, file_size, type)
                       VALUES (:uuid, :album_id, :label_id, :genre_id, :title, :year,
                               :duration_sec, :file_path, :preview_path, :file_size, :type)
                    """
                )
                result = conn.execute(track_sql, track_data)
                
                # Get the track ID
                track_id_result = conn.execute(
                    text("SELECT id FROM tracks WHERE uuid = :uuid"),
                    {"uuid": track_uuid}
                )
                track_row = track_id_result.first()
                if track_row is None:
                    raise Exception("Failed to insert track or retrieve track ID")
                
                track_id = track_row[0]
                
                # Insert track-artist relationships
                for artist_id in artist_ids:
                    ta_sql = text(
                        "INSERT IGNORE INTO track_artists (track_id, artist_id) VALUES (:track_id, :artist_id)"
                    )
                    conn.execute(ta_sql, {"track_id": track_id, "artist_id": artist_id})
                
                logger.info(f"Successfully inserted track {track_uuid} with ID {track_id} and type '{track_type}'")
                
                return {
                    "success": True,
                    "uuid": track_uuid,
                    "track_id": track_id,
                    "track_type": track_type,
                    "metadata": metadata,
                    "file_size": file_size,
                    "artist_names": artist_names,
                    "album_title": album_title,
                    "label_name": label_name,
                    "genre_name": genre_name
                }
                
        except Exception as e:
            logger.error(f"Error uploading track to database with UUID {track_uuid}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

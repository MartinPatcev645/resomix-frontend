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
from typing import Dict, Tuple, List, Optional, BinaryIO, Any
from fastapi import UploadFile

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.constants import TrackType
from app.services.metadata_service import MetadataService
from app.utils.sanitization import (
    sanitize_artist_name,
    sanitize_label_name,
    sanitize_genre_name,
    sanitize_album_title
)

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
    """
    Parse artist names from a comma/separator-delimited string.
    
    Args:
        raw: Raw artist string from metadata
        
    Returns:
        List of individual artist names
    """
    if not raw:
        return []
    
    raw = html.unescape(raw)
    parts = DELIM_PATTERN.split(raw)
    return [p.strip() for p in parts if p.strip()]


class Cache:
    """In-memory cache of lookup tables (name → id) - updated for async operations."""

    def __init__(self):
        self.artists: Dict[str, int] = {}
        self.labels: Dict[str, int] = {}
        self.genres: Dict[str, int] = {}
        self.albums: Dict[Tuple[str, int], int] = {}

    # --- generic helpers -----------------------------------------------------

    @staticmethod
    async def _fetch_table(db: AsyncSession, table: str):
        result = await db.execute(text(f"SELECT name, id FROM {table}"))
        return {name.lower(): id_ for name, id_ in result.fetchall()}

    async def preload(self, db: AsyncSession):
        self.artists = await self._fetch_table(db, "artists")
        self.labels = await self._fetch_table(db, "labels")
        self.genres = await self._fetch_table(db, "genres")
        # albums: (title, artist_id) fetch
        result = await db.execute(text("SELECT title, artist_id, id FROM albums"))
        self.albums = {
            (title.lower(), artist_id): id_
            for title, artist_id, id_ in result.fetchall()
        }

    # --- get-or-create helpers ----------------------------------------------

    async def _get_or_create(
        self, db: AsyncSession, table: str, cache: Dict[str, int], name: str
    ) -> int:
        # Sanitize the name for database insertion based on table type
        original_name = name
        
        if table == "artists":
            sanitized_name = sanitize_artist_name(name)
        elif table == "labels":
            sanitized_name = sanitize_label_name(name)
        elif table == "genres":
            sanitized_name = sanitize_genre_name(name)
        else:
            sanitized_name = sanitize_artist_name(name)  # Default to artist sanitization
        
        # Log if sanitization changed the name
        if original_name != sanitized_name:
            logger.warning(f"Sanitized {table} name: '{original_name}' -> '{sanitized_name}'")
        
        key = sanitized_name.lower()
        if key in cache:
            return cache[key]
        
        try:
            insert_sql = text(f"INSERT IGNORE INTO {table} (name) VALUES (:name)")
            await db.execute(insert_sql, {"name": sanitized_name})
            
            # Get the ID - handle potential duplicates
            select_result = await db.execute(
                text(f"SELECT id FROM {table} WHERE name = :name"), {"name": sanitized_name}
            )
            row = select_result.first()
            if row is None:
                raise Exception(f"Failed to insert or find {table} record for name: '{sanitized_name}' (original: '{original_name}')")
            
            id_ = row[0]
            cache[key] = id_
            return id_
            
        except Exception as e:
            logger.error(f"Error in _get_or_create for {table} '{sanitized_name}': {e}")
            raise

    async def artist(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "artists", self.artists, name)

    async def label(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "labels", self.labels, name)

    async def genre(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "genres", self.genres, name)

    async def album(self, db: AsyncSession, title: str, primary_artist_id: int) -> int:
        # Sanitize the album title
        original_title = title
        sanitized_title = sanitize_album_title(title)
        
        # Log if sanitization changed the title
        if original_title != sanitized_title:
            logger.warning(f"Sanitized album title: '{original_title}' -> '{sanitized_title}'")
        
        key = (sanitized_title.lower(), primary_artist_id)
        if key in self.albums:
            return self.albums[key]
        
        try:
            insert_sql = text(
                """INSERT IGNORE INTO albums (artist_id, title) 
                       VALUES (:artist_id, :title) """
            )
            await db.execute(
                insert_sql, {"artist_id": primary_artist_id, "title": sanitized_title}
            )
            
            # Get the ID - handle potential duplicates
            select_result = await db.execute(
                text(
                    "SELECT id FROM albums WHERE artist_id = :artist_id AND title = :title"
                ),
                {"artist_id": primary_artist_id, "title": sanitized_title},
            )
            row = select_result.first()
            if row is None:
                raise Exception(f"Failed to insert or find album record for: '{sanitized_title}' by artist_id {primary_artist_id} (original: '{original_title}')")
            
            id_ = row[0]
            self.albums[key] = id_
            return id_
            
        except Exception as e:
            logger.error(f"Error in album creation for '{sanitized_title}': {e}")
            raise


class TrackUploadService:
    """Service for handling track uploads and database insertion."""
    
    def __init__(self):
        self.metadata_service = MetadataService()
        self.cache = Cache()
        
    async def upload_track_to_database(
        self, 
        db: AsyncSession,
        file: UploadFile, 
        file_content: bytes
    ) -> Dict[str, any]:
        """
        Upload a track to the database and store its metadata.
        
        Args:
            db: Database session
            file: The uploaded file object
            file_content: The file content as bytes
            
        Returns:
            Dict containing the track UUID and insertion status
        """
        try:
            # Generate new UUID for the track
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
            
            # Insert into database using async session
            # Preload cache
            logger.info("Preloading database cache...")
            await self.cache.preload(db)
            
            # Get or create artists
            artist_ids = []
            for name in artist_names:
                artist_id = await self.cache.artist(db, name)
                artist_ids.append(artist_id)
            primary_artist_id = artist_ids[0]
            
            # Get or create label (optional)
            label_id = None
            if label_name:
                label_id = await self.cache.label(db, label_name)
            
            # Get or create genre
            genre_id = await self.cache.genre(db, genre_name)
            
            # Get or create album (optional)
            album_id = None
            if album_title:
                album_id = await self.cache.album(db, album_title, primary_artist_id)
            
            # Insert track
            track_data = {
                "uuid": track_uuid,
                "album_id": album_id,
                "label_id": label_id,
                "genre_id": genre_id,
                "title": title[:255],  # Ensure it fits in the column
                "year": year,
                "duration_sec": None,  # Will be updated from similarity server response
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
            await db.execute(track_sql, track_data)
            
            # Get the track ID
            track_id_result = await db.execute(
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
                await db.execute(ta_sql, {"track_id": track_id, "artist_id": artist_id})
            
            # Commit the transaction
            await db.commit()
            
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
            await db.rollback()
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
    
    async def upload_track_to_database_with_uuid(
        self, 
        db: AsyncSession,
        file: UploadFile, 
        file_content: bytes,
        track_uuid: str,
        track_type: str = TrackType.UPLOAD,
        duration_sec: Optional[float] = None,
        full_path: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Upload a track to the database with a pre-generated UUID and specific track type.
        
        Args:
            db: Database session
            file: The uploaded file object
            file_content: The file content as bytes
            track_uuid: Pre-generated UUID for the track
            track_type: The type of track (e.g., "upload", "electrobuzz")
            duration_sec: Track duration in seconds with decimal precision (optional)
            full_path: Full file path for monthly pipeline (optional, defaults to filename)
            
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
            
            # Set file paths - use full_path if provided (for monthly pipeline), otherwise use filename
            file_path = full_path if full_path else (file.filename or "unknown_file")
            
            # Set preview path based on track type
            if track_type == TrackType.ELECTROBUZZ:
                preview_path = f"/mnt/data/PREVIEWS/{track_uuid}.mp3"
            else:
                preview_path = f"/mnt/data/UPLOADS/{track_uuid}.mp3"
            
            # Insert into database using async session
            # Preload cache
            logger.info("Preloading database cache...")
            await self.cache.preload(db)
            
            # Get or create artists
            artist_ids = []
            for name in artist_names:
                artist_id = await self.cache.artist(db, name)
                artist_ids.append(artist_id)
            primary_artist_id = artist_ids[0]
            
            # Get or create label (optional)
            label_id = None
            if label_name:
                label_id = await self.cache.label(db, label_name)
            
            # Get or create genre
            genre_id = await self.cache.genre(db, genre_name)
            
            # Get or create album (optional)
            album_id = None
            if album_title:
                album_id = await self.cache.album(db, album_title, primary_artist_id)
            
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
            await db.execute(track_sql, track_data)
            
            # Get the track ID
            track_id_result = await db.execute(
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
                await db.execute(ta_sql, {"track_id": track_id, "artist_id": artist_id})
            
            # Commit the transaction
            await db.commit()
            
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
            await db.rollback()
            logger.error(f"Error uploading track to database with UUID {track_uuid}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

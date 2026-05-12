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

import re
import html
import logging
import uuid
from typing import Dict, Tuple, List, Optional
from fastapi import UploadFile

from sqlalchemy import text, select, insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.constants import TrackType
from app.models.track import Track
from app.models.track_contributor import TrackContributor
from app.models.contributor import Contributor
from app.models.release import Release
from app.models.release_contributor import ReleaseContributor
from app.services.metadata_service import MetadataService
from app.utils.sanitization import (
    sanitize_artist_name,
    sanitize_label_name,
    sanitize_genre_name,
    sanitize_album_title,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Delimiter pattern for parsing artist names (from migration script)
DELIM_PATTERN = re.compile(r"""\s*(?:,|;|\s+&\s+|\s+&amp;\s+)\s*""", re.IGNORECASE)


def generate_track_uuid() -> str:
    """Generate a random standard UUID (v4)."""
    return str(uuid.uuid4())


def extract_first_genre(genre_string: str) -> str:
    """Extract the first genre from a comma-separated genre string and ensure it fits in DB."""
    if not genre_string or not genre_string.strip():
        return "Unknown"

    # Split by common delimiters and take the first one
    genres = re.split(r"[,;]", genre_string.strip())
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
        self.releases: Dict[str, int] = {}  # title.lower() -> id
        self.party_id: str = "ARGO_01"
        self.message_id: str = "MSG_2026_001"

    # --- generic helpers -----------------------------------------------------

    @staticmethod
    async def _fetch_table(db: AsyncSession, table: str):
        result = await db.execute(text(f"SELECT name, id FROM {table}"))
        return {name.lower(): id_ for name, id_ in result.fetchall()}

    async def preload(self, db: AsyncSession):
        # Fetch default party and message for manual uploads
        res_party = await db.execute(text("SELECT party_id FROM parties LIMIT 1"))
        party_row = res_party.first()
        if party_row:
            self.party_id = party_row[0]

        res_msg = await db.execute(text("SELECT message_id FROM messages LIMIT 1"))
        msg_row = res_msg.first()
        if msg_row:
            self.message_id = msg_row[0]

        result_contributors = await db.execute(text("SELECT full_name, id FROM contributors"))
        self.artists = {name.lower(): id_ for name, id_ in result_contributors.fetchall()}
        
        result_labels = await db.execute(text("SELECT label_name, id FROM labels"))
        self.labels = {name.lower(): id_ for name, id_ in result_labels.fetchall()}
        
        result_genres = await db.execute(text("SELECT name, id FROM genres"))
        self.genres = {name.lower(): id_ for name, id_ in result_genres.fetchall()}
        
        # releases: title fetch (artist_id is no longer a column in releases)
        result_releases = await db.execute(text("SELECT title, id FROM releases"))
        self.releases = {
            title.lower(): id_
            for title, id_ in result_releases.fetchall()
        }

    # --- get-or-create helpers ----------------------------------------------

    async def _get_or_create(
        self, db: AsyncSession, table: str, cache: Dict[str, int], name: str, partner_id: Optional[int] = None
    ) -> int:
        # Sanitize the name for database insertion based on table type
        original_name = name

        if table == "contributors":
            sanitized_name = sanitize_artist_name(name)
        elif table == "labels":
            sanitized_name = sanitize_label_name(name)
        elif table == "genres":
            sanitized_name = sanitize_genre_name(name)
        else:
            sanitized_name = sanitize_artist_name(
                name
            )  # Default to artist sanitization

        # Log if sanitization changed the name
        if original_name != sanitized_name:
            logger.warning(
                f"Sanitized {table} name: '{original_name}' -> '{sanitized_name}'"
            )

        key = sanitized_name.lower()
        if key in cache:
            return cache[key]

        try:
            col_name = "name"
            if table == "contributors":
                col_name = "full_name"
            elif table == "labels":
                col_name = "label_name"
                
            # Only contributors and labels tables use party_id
            if table in ["contributors", "labels"]:
                # Use partner_id if provided, otherwise default to 1
                pid = partner_id if partner_id is not None else 1
                insert_sql = text(f"INSERT IGNORE INTO {table} ({col_name}, party_id, partner_id) VALUES (:name, :party_id, :partner_id)")
                await db.execute(insert_sql, {"name": sanitized_name, "party_id": self.party_id, "partner_id": pid})
            else:
                insert_sql = text(f"INSERT IGNORE INTO {table} ({col_name}) VALUES (:name)")
                await db.execute(insert_sql, {"name": sanitized_name})

            # Get the ID - handle potential duplicates
            # For contributors and labels, we scope by party_id and partner_id for safety
            if table in ["contributors", "labels"]:
                select_sql = text(f"SELECT id FROM {table} WHERE {col_name} = :name AND party_id = :party_id")
                select_result = await db.execute(select_sql, {"name": sanitized_name, "party_id": self.party_id})
            else:
                select_sql = text(f"SELECT id FROM {table} WHERE {col_name} = :name")
                select_result = await db.execute(select_sql, {"name": sanitized_name})
                
            row = select_result.first()
            if row is None:
                raise Exception(
                    f"Failed to insert or find {table} record for name: '{sanitized_name}' (original: '{original_name}')"
                )

            id_ = row[0]
            cache[key] = id_
            return id_

        except Exception as e:
            logger.error(f"Error in _get_or_create for {table} '{sanitized_name}': {e}")
            raise

    async def artist(self, db: AsyncSession, name: str, partner_id: Optional[int] = None) -> int:
        return await self._get_or_create(db, "contributors", self.artists, name, partner_id=partner_id)

    async def label(self, db: AsyncSession, name: str, partner_id: Optional[int] = None) -> int:
        return await self._get_or_create(db, "labels", self.labels, name, partner_id=partner_id)

    async def genre(self, db: AsyncSession, name: str) -> int:
        return await self._get_or_create(db, "genres", self.genres, name)

    async def release(self, db: AsyncSession, title: str, primary_artist_id: int, partner_id: int) -> int:
        # Sanitize the album title
        original_title = title
        sanitized_title = sanitize_album_title(title)

        # Log if sanitization changed the title
        if original_title != sanitized_title:
            logger.warning(
                f"Sanitized release title: '{original_title}' -> '{sanitized_title}'"
            )

        key = sanitized_title.lower()
        if key in self.releases:
            return self.releases[key]

        try:
            # Insert into releases table
            insert_sql = text(
                """INSERT IGNORE INTO releases (title, party_id, message_id, partner_id) 
                       VALUES (:title, :party_id, :message_id, :partner_id) """
            )
            await db.execute(
                insert_sql, {
                    "title": sanitized_title, 
                    "party_id": self.party_id, 
                    "message_id": self.message_id,
                    "partner_id": partner_id
                }
            )

            # Get the ID - scoped by partner_id
            select_result = await db.execute(
                text("SELECT id FROM releases WHERE title = :title AND partner_id = :partner_id"),
                {"title": sanitized_title, "partner_id": partner_id},
            )
            row = select_result.first()
            if row is None:
                raise Exception(
                    f"Failed to insert or find album record for: '{sanitized_title}' (original: '{original_title}') with partner_id {partner_id}"
                )

            id_ = row[0]
            
            # Also link the primary artist in release_contributors junction table
            rc_insert = insert(ReleaseContributor).values(
                release_id=id_,
                person_id=primary_artist_id,
                role='MainArtist',
                sequence_num=1
            )
            await db.execute(rc_insert)
            
            self.releases[key] = id_
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
        file_content: bytes,
        partner_id: int,
        user_id: Optional[int] = None,
    ) -> Dict[str, any]:
        """
        Upload a track to the database and store its metadata.

        Args:
            db: Database session
            file: The uploaded file object
            file_content: The file content as bytes
            user_id: ID of the user uploading the track
            partner_id: ID of the partner tenant owning the track

        Returns:
            Dict containing the track UUID and insertion status
        """
        return await self._process_and_insert_track(
            db=db,
            file=file,
            file_content=file_content,
            track_type=TrackType.UPLOAD,
            user_id=user_id,
            partner_id=partner_id,
        )

    def _parse_year(self, year_str: Optional[str]) -> Optional[int]:
        """Parse year from string, handling various formats."""
        if not year_str:
            return None

        try:
            # Try to extract 4-digit year from the string
            year_match = re.search(r"\b(\d{4})\b", str(year_str))
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
        partner_id: int,
        track_type: str = TrackType.UPLOAD,
        duration_sec: Optional[float] = None,
        full_path: Optional[str] = None,
        user_id: Optional[int] = None,
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
            user_id: ID of the user uploading the track
            partner_id: ID of the partner tenant owning the track

        Returns:
            Dict containing the track UUID and insertion status
        """
        return await self._process_and_insert_track(
            db=db,
            file=file,
            file_content=file_content,
            track_uuid=track_uuid,
            track_type=track_type,
            duration_sec=duration_sec,
            full_path=full_path,
            user_id=user_id,
            partner_id=partner_id,
        )

    async def _process_and_insert_track(
        self,
        db: AsyncSession,
        file: UploadFile,
        file_content: bytes,
        partner_id: int,
        track_uuid: Optional[str] = None,
        track_type: str = TrackType.UPLOAD,
        duration_sec: Optional[float] = None,
        full_path: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, any]:
        """
        Internal method to handle the core logic of processing and inserting a track.
        """
        try:
            # Use provided UUID or generate new one
            if not track_uuid:
                track_uuid = generate_track_uuid()

            logger.info(
                f"Processing track upload with UUID: {track_uuid} (Type: {track_type})"
            )

            # Generate secure temporary filename for processing (NEVER trust uploaded filename)
            secure_filename = f"upload_{track_uuid}.tmp"

            # Extract metadata using the existing service
            file.file.seek(0)  # Reset file pointer
            metadata = self.metadata_service.extract_metadata(
                file.file, secure_filename, mode="limited"
            )

            if "error" in metadata:
                raise Exception(f"Metadata extraction failed: {metadata['error']}")

            # Calculate file size
            file_size = len(file_content)

            # Extract basic info with defaults - NEVER use uploaded filename
            title = metadata.get("Title", "") or "Uploaded Track"
            year = self._parse_year(metadata.get("Year"))

            # Parse artist names
            artist_field = metadata.get("Artist", "")
            artist_names = parse_artist_names(artist_field) or ["Unknown"]

            # Extract label and genre
            label_name = metadata.get("Label", "").strip()
            genre_name = extract_first_genre(metadata.get("Genre", ""))

            # Extract album
            album_title = metadata.get("Album", "").strip()

            # Extract ISRC (if available) or generate a fallback
            isrc = metadata.get("ISRC", "").strip()
            if not isrc:
                isrc = f"USER-{track_uuid[:18].upper()}" # Fallback ISRC

            # Set file paths - use full_path if provided (for monthly pipeline), otherwise use secure filename
            file_path = full_path if full_path else f"upload_{track_uuid}.tmp"

            # Set preview path based on track type
            # NOTE: logic preserved from original implementation
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
                artist_id = await self.cache.artist(db, name, partner_id=partner_id)
                artist_ids.append(artist_id)
            primary_artist_id = artist_ids[0]

            # Get or create label (optional)
            label_id = None
            if label_name:
                label_id = await self.cache.label(db, label_name, partner_id=partner_id)

            # Get or create genre
            genre_id = await self.cache.genre(db, genre_name)

            # Get or create release (optional)
            release_id = None
            if album_title:
                release_id = await self.cache.release(db, album_title, primary_artist_id, partner_id=partner_id)

            # Insert track
            track_data = {
                "uuid": track_uuid,
                "user_id": user_id,
                "isrc": isrc,
                "genre": genre_name[:255],
                "title": title[:255],  # Ensure it fits in the column
                "year": year,
                "duration_ms": int(duration_sec * 1000) if duration_sec else None,
                "track_type": track_type,
                "partner_id": partner_id,
            }

            logger.info(f"Inserting track with type '{track_type}': {track_data}")

            # Insert track using ORM
            track_insert = insert(Track).values(
                uuid=track_data["uuid"],
                user_id=track_data["user_id"],
                isrc=track_data["isrc"],
                title=track_data["title"],
                p_line_year=track_data["year"],
                duration_ms=track_data["duration_ms"],
                track_type=track_data["track_type"],
                genre=track_data["genre"],
                partner_id=track_data["partner_id"]
            )
            await db.execute(track_insert)

            # Get the track ID using ORM
            track_id_result = await db.execute(
                select(Track.id).where(Track.uuid == track_uuid)
            )
            track_row = track_id_result.first()
            if track_row is None:
                raise Exception("Failed to insert track or retrieve track ID")

            track_id = track_row[0]

            # NEW: Insert into audio_files table for path tracking
            from app.models.audio_file import AudioFile
            
            # Use current partner_id from context if partner_id argument is not sufficient
            # or just use the passed partner_id
            
            # Fetch a default ingest_log_id (since it's NOT NULL)
            # In a real production scenario, we'd create a proper log entry
            res_log = await db.execute(text("SELECT id FROM ingest_logs LIMIT 1"))
            log_row = res_log.first()
            ingest_log_id = log_row[0] if log_row else 1 # Fallback to 1 if no logs exist
            
            audio_file_insert = insert(AudioFile).values(
                track_id=track_id,
                party_id=self.cache.party_id,
                partner_id=partner_id,
                ingest_log_id=ingest_log_id,
                asset_class='Master',
                original_filename=file.filename or secure_filename,
                stored_path=full_path if full_path else secure_filename,
                file_size_bytes=file_size,
                duration_seconds=int(duration_sec) if duration_sec else None,
                mime_type=file.content_type
            )
            await db.execute(audio_file_insert)

            # Insert track-artist relationships using ORM
            for artist_id in artist_ids:
                ta_insert = insert(TrackContributor).values(
                    track_id=track_id, 
                    person_id=artist_id, 
                    role='MainArtist', 
                    royalty_type='MasterRights',
                    sequence_num=1
                )
                await db.execute(ta_insert)

            # Insert release relationship if exists
            if release_id:
                from app.models.release_track import ReleaseTrack
                rt_insert = insert(ReleaseTrack).values(
                    release_id=release_id, track_id=track_id, sequence_num=1
                )
                await db.execute(rt_insert)

            # Commit the transaction
            await db.commit()

            logger.info(
                f"Successfully inserted track {track_uuid} with ID {track_id} and type '{track_type}'"
            )

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
                "genre_name": genre_name,
            }

        except Exception as e:
            await db.rollback()
            logger.error(
                f"Error uploading track to database with UUID {track_uuid}: {e}"
            )
            return {"success": False, "error": str(e)}

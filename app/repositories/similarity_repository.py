"""
Similarity Repository
=====================

This repository handles database operations for similarity-related functionality.
It provides methods for fetching track details, updating track durations,
and other similarity-specific database operations using MariaDB with SQLAlchemy ORM.

Implements proper repository pattern for similarity service database operations,
replacing direct SQL queries with proper ORM methods.

Version: 3.0.1
Init Date: September 26, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from ..models.track import Track
from ..repositories.base_repository import BaseRepository


class SimilarityRepository(BaseRepository[Track]):
    """Repository for similarity-related database operations."""

    def __init__(self):
        """Initialize SimilarityRepository with Track model."""
        super().__init__(Track)

    def _find_existing(self, db: Session, **kwargs) -> Optional[Track]:
        """Find existing track by UUID."""
        uuid = kwargs.get("uuid")
        if not uuid:
            return None
        return db.query(self.model).filter(self.model.uuid == uuid).first()

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Track]:
        """Async version of _find_existing."""
        uuid = kwargs.get("uuid")
        if not uuid:
            return None
        stmt = select(self.model).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_reference_track_details_by_path(
        self, db: AsyncSession, track_path: str, partner_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch complete track details from the database by audio file stored_path
        for reference track formatting.

        Args:
            db: Database session
            track_path: The stored_path to lookup in audio_files table

        Returns:
            Dictionary with track details or None if not found
        """
        try:
            query = text(
                """
                SELECT 
                    t.uuid as id,
                    t.title,
                    t.p_line_year as year,
                    t.duration_ms as duration,
                    t.type as type,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                        COALESCE(t.display_artist, '')
                    ) as artist
                FROM tracks t
                LEFT JOIN audio_files af ON t.id = af.track_id
                LEFT JOIN track_contributors tc ON t.id = tc.track_id
                LEFT JOIN contributors c ON tc.person_id = c.id
                WHERE af.stored_path = :track_path
                AND t.partner_id = :partner_id
                GROUP BY t.id, t.uuid, t.title, t.p_line_year, t.duration_ms, t.type
                LIMIT 1
            """
            )

            result = await db.execute(query, {"track_path": track_path, "partner_id": partner_id})
            row = result.first()

            if row:
                return {
                    "id": row.id,
                    "title": row.title or "Unknown",
                    "year": row.year,
                    "duration": (
                        float(row.duration) / 1000.0 if row.duration is not None else 0.0
                    ),
                    "label": "",  # Label is now on releases, not tracks
                    "artist": row.artist or "Unknown",
                    "type": "upload" if row.type == "upload" else "internal",
                }
            return None
        except Exception as e:
            print(f"Error fetching reference track details by path: {e}")
            raise e

    async def async_get_reference_track_details_by_uuid(
        self, db: AsyncSession, track_uuid: str, partner_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch complete track details from the database by UUID for reference track formatting.

        Args:
            db: Database session
            track_uuid: The UUID to lookup in the database

        Returns:
            Dictionary with track details or None if not found
        """
        try:
            query = text(
                """
                SELECT 
                    t.uuid as id,
                    t.title,
                    t.p_line_year as year,
                    t.duration_ms as duration,
                    t.type as type,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                        COALESCE(t.display_artist, '')
                    ) as artist
                FROM tracks t
                LEFT JOIN track_contributors tc ON t.id = tc.track_id
                LEFT JOIN contributors c ON tc.person_id = c.id
                WHERE t.uuid = :track_uuid
                AND t.partner_id = :partner_id
                GROUP BY t.id, t.uuid, t.title, t.p_line_year, t.duration_ms, t.type
                LIMIT 1
            """
            )

            result = await db.execute(query, {"track_uuid": track_uuid, "partner_id": partner_id})
            row = result.first()

            if row:
                return {
                    "id": row.id,
                    "title": row.title or "Unknown",
                    "year": row.year,
                    "duration": (
                        float(row.duration) / 1000.0 if row.duration is not None else 0.0
                    ),
                    "label": "",  # Label is now on releases, not tracks
                    "artist": row.artist or "Unknown",
                    "type": "upload" if row.type == "upload" else "internal",
                }
            return None
        except Exception as e:
            print(f"Error fetching reference track details by UUID: {e}")
            raise e

    async def async_get_track_details_by_paths(
        self, db: AsyncSession, track_paths: List[str], partner_id: Optional[int] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetches full track details from MariaDB based on a list of file paths
        returned by the similarity server. Enforces partner scoping.

        Args:
            db: Database session
            track_paths: A list of file paths (e.g., veggera/public_html/audio.mp3).
            partner_id: Optional partner ID for tenant scoping

        Returns:
            A dictionary mapping file_path to track_details_dict.
            Track_details_dict contains: id, track_id, filename, album, duration, artist, all_artists.
        """
        if not track_paths:
            return {}

        # Use paths as-is since they're already in the correct format
        paths_to_query = set(track_paths)

        if not paths_to_query:
            return {}

        details_map: Dict[str, Dict[str, Any]] = {}
        try:
            # Use the existing track repository method for getting tracks by file paths
            from ..repositories.track_repository import TrackRepository

            track_repo = TrackRepository()
            tracks = await track_repo.async_get_tracks_by_file_paths(
                db, list(paths_to_query), partner_id=partner_id
            )

            for track in tracks:
                # Get primary artist from display_artist or first contributor
                artist_name = track.display_artist or "N/A"
                all_artists = []

                if track.recording_contributors:
                    if artist_name == "N/A":
                        artist_name = track.recording_contributors[0].contributor.full_name
                    # Collect all artists for deduplication purposes
                    all_artists = [tc.contributor.full_name for tc in track.recording_contributors]

                # Get the stored_path from master audio file for mapping key
                stored_path = None
                for af in track.audio_files:
                    if af.asset_class == 'Master':
                        stored_path = af.stored_path
                        break
                if not stored_path and track.audio_files:
                    stored_path = track.audio_files[0].stored_path

                track_data = {
                    "id": track.uuid,  # Use UUID for compatibility with existing API
                    "track_id": track.id,  # Add database ID for playlist creation
                    "label": "",  # Label is now on releases, not tracks
                    "duration": (
                        float(track.duration_ms) / 1000.0
                        if track.duration_ms is not None
                        else 0.0
                    ),
                    "artist": artist_name,  # Primary artist for display
                    "all_artists": all_artists,  # All artists for deduplication
                    "title": track.title or "N/A",
                    "year": track.p_line_year,
                    "type": "upload" if track.track_type == "upload" else "internal",
                }
                if stored_path:
                    details_map[stored_path] = track_data

            print(
                f"MariaDB: Fetched details for {len(details_map)} out of {len(paths_to_query)} unique paths."
            )

        except Exception as e:
            print(f"Error during MariaDB fetch for track details: {e}")
            raise e

        return details_map

    async def async_get_track_details_by_uuids(
        self, db: AsyncSession, track_uuids: List[str], partner_id: Optional[int] = None,
        exclude_uploads: bool = True
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetches full track details from MariaDB based on a list of UUIDs
        returned by the similarity server.

        Args:
            db: Database session
            track_uuids: A list of track UUIDs.
            partner_id: Optional tenant scope.
            exclude_uploads: When True (default), partner-uploaded tracks are
                dropped from the result set. This is the search path, so uploads
                must never appear as similarity results — only ingested catalog
                tracks. (The query/reference track is fetched via a separate
                method that is not affected by this filter.)

        Returns:
            A dictionary mapping UUID to track_details_dict.
            Track_details_dict contains: id, track_id, filename, album, duration, artist, all_artists.
        """
        if not track_uuids:
            return {}

        uuids_to_query = set(track_uuids)

        if not uuids_to_query:
            return {}

        details_map: Dict[str, Dict[str, Any]] = {}
        try:
            # Use the existing track repository method for getting tracks by UUIDs
            from ..repositories.track_repository import TrackRepository

            track_repo = TrackRepository()
            tracks = await track_repo.async_get_tracks_by_uuids(
                db, list(uuids_to_query), partner_id=partner_id, exclude_uploads=exclude_uploads
            )

            for track in tracks:
                # Get primary artist from display_artist or first contributor
                artist_name = track.display_artist or "N/A"
                all_artists = []

                if track.recording_contributors:
                    if artist_name == "N/A":
                        artist_name = track.recording_contributors[0].contributor.full_name
                    # Collect all artists for deduplication purposes
                    all_artists = [tc.contributor.full_name for tc in track.recording_contributors]

                track_data = {
                    "id": track.uuid,  # Use UUID for compatibility with existing API
                    "track_id": track.id,  # Add database ID for playlist creation
                    "label": "",  # Label is now on releases, not tracks
                    "duration": (
                        float(track.duration_ms) / 1000.0
                        if track.duration_ms is not None
                        else 0.0
                    ),
                    "artist": artist_name,  # Primary artist for display
                    "all_artists": all_artists,  # All artists for deduplication
                    "title": track.title or "N/A",
                    "year": track.p_line_year,
                    "type": "upload" if track.track_type == "upload" else "internal",
                }
                details_map[track.uuid] = track_data

            print(
                f"MariaDB: Fetched details for {len(details_map)} out of {len(uuids_to_query)} unique UUIDs."
            )

        except Exception as e:
            print(f"Error during MariaDB fetch for track details by UUIDs: {e}")
            raise e

        return details_map

    async def async_update_track_duration(
        self, db: AsyncSession, track_uuid: str, duration: float, partner_id: Optional[int] = None
    ) -> bool:
        """
        Updates the duration of a track in the database. Enforces partner scoping.

        Args:
            db: Database session
            track_uuid: Track UUID
            duration: New duration in milliseconds
            partner_id: Optional partner ID for tenant scoping

        Returns:
            True if updated successfully, False otherwise
        """
        try:
            # Store as integer milliseconds (input duration is in seconds)
            duration_ms = int(round(duration * 1000.0)) if duration is not None else None

            query = text(
                """
                UPDATE tracks
                SET duration_ms = :duration
                WHERE uuid = :track_uuid
                AND partner_id = :partner_id
            """
            )

            result = await db.execute(
                query, {"duration": duration_ms, "track_uuid": track_uuid, "partner_id": partner_id}
            )
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            print(f"Error updating track duration: {e}")
            raise e

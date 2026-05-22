"""
Track Repository
================

This repository handles CRUD operations and complex queries for Track and TrackArtist models.
It provides comprehensive track search functionality, relationship management,
and bulk operations using MariaDB with SQLAlchemy ORM.

Implements advanced search capabilities including text search, artist/album/genre filtering,
BPM range queries, and musical key searches with proper relationship loading.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import IntegrityError

from app.models.track import Track
from app.models.track_contributor import TrackContributor
from app.models.contributor import Contributor
from app.models.audio_file import AudioFile
from app.models.genre import Genre
from app.models.constants import TrackType
from app.repositories.base_repository import BaseRepository


class TrackRepository(BaseRepository[Track]):
    """Repository for Track model operations.
    
    Combines MongoDB search logic from src/search.py with MariaDB track operations,
    implementing both CRUD operations and advanced search functionality.
    """
    
    def __init__(self):
        """Initialize TrackRepository with Track model."""
        super().__init__(Track)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Track]:
        """Find existing track by UUID.
        
        Tracks are uniquely identified by UUID as seen in migration logic.
        
        Args:
            db: Database session
            **kwargs: Should contain 'uuid' field
            
        Returns:
            Existing Track instance or None
        """
        uuid = kwargs.get('uuid')
        if not uuid:
            return None
            
        return db.query(self.model).filter(self.model.uuid == uuid).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Track]:
        """Async version of _find_existing."""
        uuid = kwargs.get('uuid')
        if not uuid:
            return None
            
        stmt = select(self.model).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Track-specific CRUD methods ---
    
    def get_by_uuid(self, db: Session, uuid: str, partner_id: Optional[int] = None) -> Optional[Track]:
        """Get track by UUID with optional partner scoping.
        
        This mirrors get_track_path_by_id from src/search.py but for full track data.
        
        Args:
            db: Database session
            uuid: Track UUID to search for
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            Track instance or None
        """
        query = db.query(self.model).filter(self.model.uuid == uuid)
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
        return query.first()
    
    async def async_get_by_uuid(self, db: AsyncSession, uuid: str, partner_id: Optional[int] = None) -> Optional[Track]:
        """Async version of get_by_uuid with optional partner scoping."""
        stmt = select(self.model).where(self.model.uuid == uuid)
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_id_by_uuid(self, db: AsyncSession, uuid: str) -> Optional[int]:
        """Resolve a track UUID to its internal integer database ID."""
        stmt = select(self.model.id).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        return result.scalar()

    async def async_get_uuid_by_id(self, db: AsyncSession, track_id: int) -> Optional[str]:
        """Resolve an internal integer database ID to its public UUID."""
        stmt = select(self.model.uuid).where(self.model.id == track_id)
        result = await db.execute(stmt)
        return result.scalar()

    async def async_get_audio_file_count_by_path(
        self, db: AsyncSession, path: str, partner_id: Optional[int] = None
    ) -> int:
        """Count how many AudioFiles match a specific stored path, optionally scoped by partner ID."""
        stmt = select(func.count(AudioFile.id)).where(AudioFile.stored_path == path)
        if partner_id is not None:
            stmt = stmt.where(AudioFile.partner_id == partner_id)
        result = await db.execute(stmt)
        return result.scalar() or 0
    
    def get_track_path_by_uuid(self, db: Session, uuid: str, partner_id: Optional[int] = None) -> Optional[str]:
        """Get the absolute master audio file path for a track by its UUID.
        
        Args:
            db: Database session
            uuid: Track UUID
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            File path string or None if not found
        """
        query = (
            db.query(AudioFile.stored_path)
            .join(Track, AudioFile.track_id == Track.id)
            .filter(Track.uuid == uuid)
            .filter(AudioFile.asset_class == 'Master')
        )
        if partner_id is not None:
            query = query.filter(Track.partner_id == partner_id)
            
        result = query.first()
        return result[0] if result else None
    
    async def async_get_track_path_by_uuid(self, db: AsyncSession, uuid: str, partner_id: Optional[int] = None) -> Optional[str]:
        """Async version of get_track_path_by_uuid with partner scoping."""
        stmt = (
            select(AudioFile.stored_path)
            .join(Track, AudioFile.track_id == Track.id)
            .where(Track.uuid == uuid)
            .where(AudioFile.asset_class == 'Master')
        )
        if partner_id is not None:
            stmt = stmt.where(Track.partner_id == partner_id)
            
        result = await db.execute(stmt)
        path = result.scalar_one_or_none()
        return path
    
    def get_with_relationships(self, db: Session, uuid: str, partner_id: Optional[int] = None) -> Optional[Track]:
        """Get track with all relationships loaded and optional partner scoping.
        
        Args:
            db: Database session
            uuid: Track UUID
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            Track with audio_files and recording_contributors loaded
        """
        query = (
            db.query(self.model)
            .options(
                joinedload(self.model.audio_files),
                joinedload(self.model.recording_contributors).joinedload(TrackContributor.contributor)
            )
            .filter(self.model.uuid == uuid)
        )
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
        return query.first()
    
    async def async_get_with_relationships(self, db: AsyncSession, uuid: str, partner_id: Optional[int] = None) -> Optional[Track]:
        """Async version of get_with_relationships with partner scoping."""
        stmt = (
            select(self.model)
            .options(
                joinedload(self.model.audio_files),
                joinedload(self.model.recording_contributors).joinedload(TrackContributor.contributor)
            )
            .where(self.model.uuid == uuid)
        )
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
            
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_tracks_by_uuids(self, db: AsyncSession, uuids: List[str], partner_id: Optional[int] = None) -> List[Track]:
        """Async version of get_tracks_by_uuids with partner scoping."""
        if not uuids:
            return []
            
        stmt = (
            select(self.model)
            .options(
                joinedload(self.model.audio_files),
                joinedload(self.model.recording_contributors).joinedload(TrackContributor.contributor)
            )
            .where(self.model.uuid.in_(uuids))
        )
        
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
            
        result = await db.execute(stmt)
        return result.scalars().unique().all()
    
    # --- Search methods (from src/search.py logic) ---
    
    def search_tracks(self, db: Session, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search tracks by title, artist, or filename.
        
        Implements the search logic from src/search.py but for MariaDB.
        
        Args:
            db: Database session
            query: Search query string
            limit: Maximum number of results
            
        Returns:
            List of track dictionaries with search-relevant fields
        """
        # Build search conditions — search title and contributor names
        search_conditions = or_(
            self.model.title.ilike(f"%{query}%"),
            self.model.display_artist.ilike(f"%{query}%"),
            # Search in contributor names through relationship
            Contributor.full_name.ilike(f"%{query}%")
        )
        
        tracks = (
            db.query(self.model)
            .join(TrackContributor, TrackContributor.track_id == self.model.id, isouter=True)
            .join(Contributor, Contributor.id == TrackContributor.person_id, isouter=True)
            .filter(search_conditions)
            .filter(self.model.track_type != TrackType.UPLOAD)
            .distinct()
            .limit(limit)
            .all()
        )
        
        # Format results similar to src/search.py format
        results = []
        for track in tracks:
            # Get primary artist from display_artist or first contributor
            artist_name = track.display_artist or "N/A"
            
            track_data = {
                "id": track.uuid,  # Use UUID for compatibility with existing API
                "artist": artist_name,
                "duration": float(track.duration_ms) / 1000.0 if track.duration_ms is not None else 0.0,
                "title": track.title,
            }
            results.append(track_data)
        
        return results
    
    async def async_search_tracks(self, db: AsyncSession, query: str, limit: int = 20, partner_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Async version of search_tracks with partner scoping."""
        search_conditions = or_(
            self.model.title.ilike(f"%{query}%"),
            self.model.display_artist.ilike(f"%{query}%"),
            Contributor.full_name.ilike(f"%{query}%")
        )
        
        stmt = (
            select(self.model)
            .join(TrackContributor, TrackContributor.track_id == self.model.id, isouter=True)
            .join(Contributor, Contributor.id == TrackContributor.person_id, isouter=True)
            .where(and_(search_conditions, self.model.track_type != TrackType.UPLOAD))
        )
        
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
            
        stmt = stmt.distinct().limit(limit)
        
        result = await db.execute(stmt)
        tracks = result.scalars().all()
        
        # Format results
        results = []
        for track in tracks:
            # Get primary artist from display_artist or first contributor
            artist_name = track.display_artist or "N/A"
            if artist_name == "N/A":
                # Fallback: fetch first contributor
                artist_stmt = (
                    select(Contributor.full_name)
                    .join(TrackContributor)
                    .where(TrackContributor.track_id == track.id)
                    .limit(1)
                )
                artist_result = await db.execute(artist_stmt)
                artist_name = artist_result.scalar_one_or_none() or "N/A"
            
            track_data = {
                "id": track.uuid,
                "artist": artist_name,
                "duration": float(track.duration_ms) / 1000.0 if track.duration_ms is not None else 0.0,
                "title": track.title,
            }
            results.append(track_data)
        
        return results
    
    # --- Advanced search methods ---
    
    def search_by_artist(self, db: Session, artist_name: str, limit: int = 100, partner_id: Optional[int] = None) -> List[Track]:
        """Search tracks by artist/contributor name with optional partner scoping.
        
        Args:
            db: Database session
            artist_name: Artist/contributor name to search for
            limit: Maximum number of results
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            List of Track instances
        """
        query = (
            db.query(self.model)
            .join(TrackContributor, TrackContributor.track_id == self.model.id)
            .join(Contributor, Contributor.id == TrackContributor.person_id)
            .filter(Contributor.full_name.ilike(f"%{artist_name}%"))
        )
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
            
        return query.limit(limit).all()
    
    def search_by_album(self, db: Session, album_title: str, limit: int = 100) -> List[Track]:
        """Search tracks by album title (REMOVED: Use Release search instead)."""
        return []
    
    def search_by_genre(self, db: Session, genre_name: str, limit: int = 100, partner_id: Optional[int] = None) -> List[Track]:
        """Search tracks by genre name with optional partner scoping.
        
        Args:
            db: Database session
            genre_name: Genre name to search for
            limit: Maximum number of results
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            List of Track instances
        """
        query = (
            db.query(self.model)
            .join(Genre, self.model.genre_id == Genre.id)
            .filter(Genre.name.ilike(f"%{genre_name}%"))
        )
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
            
        return query.limit(limit).all()
    
    def get_by_bpm_range(self, db: Session, min_bpm: int, max_bpm: int, limit: int = 100, partner_id: Optional[int] = None) -> List[Track]:
        """Get tracks within BPM range with optional partner scoping.
        
        Args:
            db: Database session
            min_bpm: Minimum BPM
            max_bpm: Maximum BPM
            limit: Maximum number of results
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            List of Track instances
        """
        query = (
            db.query(self.model)
            .filter(
                and_(
                    self.model.bpm >= min_bpm,
                    self.model.bpm <= max_bpm
                )
            )
        )
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
            
        return query.limit(limit).all()
    
    def get_by_key(self, db: Session, musical_key: str, limit: int = 100, partner_id: Optional[int] = None) -> List[Track]:
        """Get tracks by musical key with optional partner scoping.
        
        Args:
            db: Database session
            musical_key: Musical key (e.g., "C#m")
            limit: Maximum number of results
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            List of Track instances
        """
        query = db.query(self.model).filter(self.model.musical_key == musical_key)
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
            
        return query.limit(limit).all()
    
    # --- Migration-style bulk operations ---
    
    def bulk_create_tracks(self, db: Session, tracks_data: List[Dict[str, Any]]) -> List[Track]:
        """Bulk create tracks with migration-style logic.
        
        Implements the batch insert pattern from migration logic.
        
        Args:
            db: Database session
            tracks_data: List of track data dictionaries
            
        Returns:
            List of created Track instances
        """
        created_tracks = []
        
        for track_data in tracks_data:
            try:
                # Use get_or_create to handle duplicates like migration
                track, was_created = self.get_or_create(db, **track_data)
                created_tracks.append(track)
            except IntegrityError:
                # Handle UUID conflicts gracefully
                db.rollback()
                existing = self.get_by_uuid(db, track_data.get('uuid'))
                if existing:
                    created_tracks.append(existing)
        
        return created_tracks
    
    def get_tracks_by_uuids(self, db: Session, uuids: List[str], partner_id: Optional[int] = None) -> Dict[str, int]:
        """Get track ID mapping by UUIDs with partner scoping.
        
        Mirrors the UUID->ID mapping logic from migration.
        
        Args:
            db: Database session
            uuids: List of track UUIDs
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            Dictionary mapping UUID to track ID
        """
        query = db.query(self.model.uuid, self.model.id).filter(self.model.uuid.in_(uuids))
        if partner_id is not None:
            query = query.filter(self.model.partner_id == partner_id)
            
        tracks = query.all()
        return {uuid: track_id for uuid, track_id in tracks}
    
    
    # --- TrackContributor relationship methods ---
    
    def add_contributor_to_track(self, db: Session, track_id: int, person_id: int, role: str = 'MainArtist', royalty_type: str = 'NeighboringRights') -> TrackContributor:
        """Add contributor to track (create TrackContributor relationship).
        
        Args:
            db: Database session
            track_id: Track ID
            person_id: Contributor ID
            role: DDEX role enum value
            royalty_type: Royalty type enum value
            
        Returns:
            Created TrackContributor instance
            
        Raises:
            IntegrityError: If relationship already exists
        """
        track_contributor = TrackContributor(
            track_id=track_id, person_id=person_id, role=role, royalty_type=royalty_type
        )
        db.add(track_contributor)
        try:
            db.commit()
            db.refresh(track_contributor)
            return track_contributor
        except IntegrityError:
            db.rollback()
            # Return existing relationship
            existing = (
                db.query(TrackContributor)
                .filter(
                    and_(
                        TrackContributor.track_id == track_id,
                        TrackContributor.person_id == person_id,
                        TrackContributor.role == role
                    )
                )
                .first()
            )
            return existing
    
    def remove_contributor_from_track(self, db: Session, track_id: int, person_id: int, role: str = None) -> bool:
        """Remove contributor from track.
        
        Args:
            db: Database session
            track_id: Track ID
            person_id: Contributor ID
            role: Optional role filter (if None, removes all roles for this person on this track)
            
        Returns:
            True if removed, False if not found
        """
        query = db.query(TrackContributor).filter(
            and_(
                TrackContributor.track_id == track_id,
                TrackContributor.person_id == person_id
            )
        )
        if role:
            query = query.filter(TrackContributor.role == role)
        
        track_contributor = query.first()
        
        if track_contributor:
            db.delete(track_contributor)
            db.commit()
            return True
        return False
    
    def get_contributors_for_track(self, db: Session, track_id: int) -> List[Contributor]:
        """Get all contributors for a track.
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            List of Contributor instances
        """
        return (
            db.query(Contributor)
            .join(TrackContributor, TrackContributor.person_id == Contributor.id)
            .filter(TrackContributor.track_id == track_id)
            .all()
        )
    
    async def async_get_track_contributors(self, db: AsyncSession, track_id: int) -> List[Contributor]:
        """Get all contributors for a track (async version).
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            List of Contributor instances
        """
        stmt = (
            select(Contributor)
            .join(TrackContributor, TrackContributor.person_id == Contributor.id)
            .where(TrackContributor.track_id == track_id)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_tracks_for_contributor(self, db: Session, person_id: int, skip: int = 0, limit: int = 100) -> List[Track]:
        """Get all tracks for a contributor.
        
        Args:
            db: Database session
            person_id: Contributor ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .join(TrackContributor, TrackContributor.track_id == self.model.id)
            .filter(TrackContributor.person_id == person_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    # --- Backward-compatible aliases ---
    # These preserve the old method names for callers that haven't been updated yet
    
    def add_artist_to_track(self, db: Session, track_id: int, artist_id: int) -> TrackContributor:
        """Backward-compatible alias for add_contributor_to_track."""
        return self.add_contributor_to_track(db, track_id, artist_id)
    
    def remove_artist_from_track(self, db: Session, track_id: int, artist_id: int) -> bool:
        """Backward-compatible alias for remove_contributor_from_track."""
        return self.remove_contributor_from_track(db, track_id, artist_id)
    
    def get_artists_for_track(self, db: Session, track_id: int) -> List[Contributor]:
        """Backward-compatible alias for get_contributors_for_track."""
        return self.get_contributors_for_track(db, track_id)
    
    async def async_get_track_artists(self, db: AsyncSession, track_id: int) -> List[Contributor]:
        """Backward-compatible alias for async_get_track_contributors."""
        return await self.async_get_track_contributors(db, track_id)
    
    def get_tracks_for_artist(self, db: Session, artist_id: int, skip: int = 0, limit: int = 100) -> List[Track]:
        """Backward-compatible alias for get_tracks_for_contributor."""
        return self.get_tracks_for_contributor(db, artist_id, skip, limit)

    async def async_get_tracks_by_file_paths(self, db: AsyncSession, file_paths: List[str], partner_id: Optional[int] = None) -> List[Track]:
        """Get tracks with full relationships by audio file stored_paths with partner scoping.
        
        Args:
            db: Database session
            file_paths: List of stored_path values to search for in audio_files
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            List of Track instances with relationships loaded
        """
        if not file_paths:
            return []
            
        stmt = (
            select(self.model)
            .join(AudioFile, AudioFile.track_id == self.model.id)
            .options(
                joinedload(self.model.audio_files),
                joinedload(self.model.recording_contributors).joinedload(TrackContributor.contributor)
            )
            .where(AudioFile.stored_path.in_(file_paths))
        )
        
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
            
        result = await db.execute(stmt)
        # Use unique() to deduplicate rows when using joinedload with collections
        return result.scalars().unique().all()

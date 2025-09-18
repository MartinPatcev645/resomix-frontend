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

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text, func, desc
from sqlalchemy.exc import IntegrityError

from app.models.track import Track, TrackArtist
from app.models.artist import Artist
from app.models.album import Album
from app.models.label import Label
from app.models.genre import Genre
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
    
    def get_by_uuid(self, db: Session, uuid: str) -> Optional[Track]:
        """Get track by UUID.
        
        This mirrors get_track_path_by_id from src/search.py but for full track data.
        
        Args:
            db: Database session
            uuid: Track UUID to search for
            
        Returns:
            Track instance or None
        """
        return db.query(self.model).filter(self.model.uuid == uuid).first()
    
    async def async_get_by_uuid(self, db: AsyncSession, uuid: str) -> Optional[Track]:
        """Async version of get_by_uuid."""
        stmt = select(self.model).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_track_path_by_uuid(self, db: Session, uuid: str) -> Optional[str]:
        """Get track file path by UUID.
        
        Mirrors get_track_path_by_id from src/search.py functionality.
        
        Args:
            db: Database session
            uuid: Track UUID
            
        Returns:
            File path string or None if not found
        """
        track = db.query(self.model.file_path).filter(self.model.uuid == uuid).first()
        return track.file_path if track else None
    
    async def async_get_track_path_by_uuid(self, db: AsyncSession, uuid: str) -> Optional[str]:
        """Async version of get_track_path_by_uuid."""
        stmt = select(self.model.file_path).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        path = result.scalar_one_or_none()
        return path
    
    def get_with_relationships(self, db: Session, uuid: str) -> Optional[Track]:
        """Get track with all relationships loaded.
        
        Args:
            db: Database session
            uuid: Track UUID
            
        Returns:
            Track with album, label, genre, and artists loaded
        """
        return (
            db.query(self.model)
            .options(
                joinedload(self.model.album),
                joinedload(self.model.label),
                joinedload(self.model.genre),
                joinedload(self.model.track_artists).joinedload(TrackArtist.artist)
            )
            .filter(self.model.uuid == uuid)
            .first()
        )
    
    async def async_get_with_relationships(self, db: AsyncSession, uuid: str) -> Optional[Track]:
        """Async version of get_with_relationships."""
        stmt = (
            select(self.model)
            .options(
                joinedload(self.model.album),
                joinedload(self.model.label),
                joinedload(self.model.genre),
                joinedload(self.model.track_artists).joinedload(TrackArtist.artist)
            )
            .where(self.model.uuid == uuid)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
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
        # Build search conditions similar to MongoDB $or query
        search_conditions = or_(
            self.model.title.ilike(f"%{query}%"),
            self.model.file_path.ilike(f"%{query}%"),
            # Search in artist names through relationship
            Artist.name.ilike(f"%{query}%")
        )
        
        tracks = (
            db.query(self.model)
            .join(TrackArtist, TrackArtist.track_id == self.model.id, isouter=True)
            .join(Artist, Artist.id == TrackArtist.artist_id, isouter=True)
            .filter(search_conditions)
            .distinct()
            .limit(limit)
            .all()
        )
        
        # Format results similar to src/search.py format
        results = []
        for track in tracks:
            # Get primary artist (first artist in track_artists)
            artist_name = "N/A"
            if track.track_artists:
                artist_name = track.track_artists[0].artist.name
            
            # Extract filename from file_path
            filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
            
            track_data = {
                "id": track.uuid,  # Use UUID for compatibility with existing API
                "artist": artist_name,
                "duration": float(track.duration_sec) if track.duration_sec is not None else 0.0,
                "filename": filename,
                "title": track.title,
                "file_path": track.file_path
            }
            results.append(track_data)
        
        return results
    
    async def async_search_tracks(self, db: AsyncSession, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Async version of search_tracks."""
        search_conditions = or_(
            self.model.title.ilike(f"%{query}%"),
            self.model.file_path.ilike(f"%{query}%"),
            Artist.name.ilike(f"%{query}%")
        )
        
        stmt = (
            select(self.model)
            .join(TrackArtist, TrackArtist.track_id == self.model.id, isouter=True)
            .join(Artist, Artist.id == TrackArtist.artist_id, isouter=True)
            .where(search_conditions)
            .distinct()
            .limit(limit)
        )
        
        result = await db.execute(stmt)
        tracks = result.scalars().all()
        
        # Format results (need to load relationships separately in async)
        results = []
        for track in tracks:
            # Get artists for this track
            artist_stmt = (
                select(Artist.name)
                .join(TrackArtist)
                .where(TrackArtist.track_id == track.id)
                .limit(1)
            )
            artist_result = await db.execute(artist_stmt)
            artist_name = artist_result.scalar_one_or_none() or "N/A"
            
            filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
            
            track_data = {
                "id": track.uuid,
                "artist": artist_name,
                "duration": float(track.duration_sec) if track.duration_sec is not None else 0.0,
                "filename": filename,
                "title": track.title,
                "file_path": track.file_path
            }
            results.append(track_data)
        
        return results
    
    # --- Advanced search methods ---
    
    def search_by_artist(self, db: Session, artist_name: str, limit: int = 100) -> List[Track]:
        """Search tracks by artist name.
        
        Args:
            db: Database session
            artist_name: Artist name to search for
            limit: Maximum number of results
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .join(TrackArtist)
            .join(Artist)
            .filter(Artist.name.ilike(f"%{artist_name}%"))
            .limit(limit)
            .all()
        )
    
    def search_by_album(self, db: Session, album_title: str, limit: int = 100) -> List[Track]:
        """Search tracks by album title.
        
        Args:
            db: Database session
            album_title: Album title to search for
            limit: Maximum number of results
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .join(Album)
            .filter(Album.title.ilike(f"%{album_title}%"))
            .limit(limit)
            .all()
        )
    
    def search_by_genre(self, db: Session, genre_name: str, limit: int = 100) -> List[Track]:
        """Search tracks by genre name.
        
        Args:
            db: Database session
            genre_name: Genre name to search for
            limit: Maximum number of results
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .join(Genre)
            .filter(Genre.name.ilike(f"%{genre_name}%"))
            .limit(limit)
            .all()
        )
    
    def get_by_bpm_range(self, db: Session, min_bpm: int, max_bpm: int, limit: int = 100) -> List[Track]:
        """Get tracks within BPM range.
        
        Args:
            db: Database session
            min_bpm: Minimum BPM
            max_bpm: Maximum BPM
            limit: Maximum number of results
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.bpm >= min_bpm,
                    self.model.bpm <= max_bpm
                )
            )
            .limit(limit)
            .all()
        )
    
    def get_by_key(self, db: Session, musical_key: str, limit: int = 100) -> List[Track]:
        """Get tracks by musical key.
        
        Args:
            db: Database session
            musical_key: Musical key (e.g., "C#m")
            limit: Maximum number of results
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .filter(self.model.musical_key == musical_key)
            .limit(limit)
            .all()
        )
    
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
    
    def get_tracks_by_uuids(self, db: Session, uuids: List[str]) -> Dict[str, int]:
        """Get track ID mapping by UUIDs.
        
        Mirrors the UUID->ID mapping logic from migration.
        
        Args:
            db: Database session
            uuids: List of track UUIDs
            
        Returns:
            Dictionary mapping UUID to track ID
        """
        tracks = (
            db.query(self.model.uuid, self.model.id)
            .filter(self.model.uuid.in_(uuids))
            .all()
        )
        
        return {uuid: track_id for uuid, track_id in tracks}
    
    async def async_get_tracks_by_uuids(self, db: AsyncSession, uuids: List[str]) -> List[Track]:
        """Bulk fetch tracks by a list of UUIDs (async).
        Args:
            db: AsyncSession
            uuids: list of track UUID strings
        Returns:
            List[Track] objects corresponding to given UUIDs.
        """
        if not uuids:
            return []

        stmt = (
            select(self.model)
            .options(joinedload(self.model.track_artists).joinedload(TrackArtist.artist))
            .where(self.model.uuid.in_(uuids))
        )
        result = await db.execute(stmt)
        return result.scalars().unique().all()
    
    # --- TrackArtist relationship methods ---
    
    def add_artist_to_track(self, db: Session, track_id: int, artist_id: int) -> TrackArtist:
        """Add artist to track (create TrackArtist relationship).
        
        Args:
            db: Database session
            track_id: Track ID
            artist_id: Artist ID
            
        Returns:
            Created TrackArtist instance
            
        Raises:
            IntegrityError: If relationship already exists
        """
        track_artist = TrackArtist(track_id=track_id, artist_id=artist_id)
        db.add(track_artist)
        try:
            db.commit()
            db.refresh(track_artist)
            return track_artist
        except IntegrityError:
            db.rollback()
            # Return existing relationship
            existing = (
                db.query(TrackArtist)
                .filter(
                    and_(
                        TrackArtist.track_id == track_id,
                        TrackArtist.artist_id == artist_id
                    )
                )
                .first()
            )
            return existing
    
    def remove_artist_from_track(self, db: Session, track_id: int, artist_id: int) -> bool:
        """Remove artist from track.
        
        Args:
            db: Database session
            track_id: Track ID
            artist_id: Artist ID
            
        Returns:
            True if removed, False if not found
        """
        track_artist = (
            db.query(TrackArtist)
            .filter(
                and_(
                    TrackArtist.track_id == track_id,
                    TrackArtist.artist_id == artist_id
                )
            )
            .first()
        )
        
        if track_artist:
            db.delete(track_artist)
            db.commit()
            return True
        return False
    
    def get_artists_for_track(self, db: Session, track_id: int) -> List[Artist]:
        """Get all artists for a track.
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            List of Artist instances
        """
        return (
            db.query(Artist)
            .join(TrackArtist)
            .filter(TrackArtist.track_id == track_id)
            .all()
        )
    
    async def async_get_track_artists(self, db: AsyncSession, track_id: int) -> List[Artist]:
        """Get all artists for a track (async version).
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            List of Artist instances
        """
        stmt = (
            select(Artist)
            .join(TrackArtist)
            .where(TrackArtist.track_id == track_id)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_tracks_for_artist(self, db: Session, artist_id: int, skip: int = 0, limit: int = 100) -> List[Track]:
        """Get all tracks for an artist.
        
        Args:
            db: Database session
            artist_id: Artist ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Track instances
        """
        return (
            db.query(self.model)
            .join(TrackArtist)
            .filter(TrackArtist.artist_id == artist_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    async def async_get_tracks_by_file_paths(self, db: AsyncSession, file_paths: List[str]) -> List[Track]:
        """Get tracks with full relationships by file paths.
        
        Args:
            db: Database session
            file_paths: List of file paths to search for
            
        Returns:
            List of Track instances with relationships loaded
        """
        if not file_paths:
            return []
            
        stmt = (
            select(self.model)
            .options(
                joinedload(self.model.album),
                joinedload(self.model.label),
                joinedload(self.model.genre),
                joinedload(self.model.track_artists).joinedload(TrackArtist.artist)
            )
            .where(self.model.file_path.in_(file_paths))
        )
        result = await db.execute(stmt)
        # Use unique() to deduplicate rows when using joinedload with collections
        return result.scalars().unique().all()

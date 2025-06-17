"""
Playlist Repository
===================

This repository handles CRUD operations for Playlist and PlaylistTrack models.
It provides playlist creation, track management, and relationship handling
using MariaDB with SQLAlchemy ORM.

Implements playlist operations including similarity playlist creation,
track ordering, and user-based playlist management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.models.playlist import Playlist, PlaylistTrack
from app.models.constants import PlaylistType
from app.repositories.base_repository import BaseRepository


class PlaylistRepository(BaseRepository[Playlist]):
    """Repository for Playlist model operations."""
    
    def __init__(self):
        """Initialize PlaylistRepository with Playlist model."""
        super().__init__(Playlist)
    
    async def async_create_similarity_playlist(
        self, 
        db: AsyncSession, 
        seed_track_id: int, 
        track_ids: List[int],
        track_scores: List[float] = None,
        name: str = "Playlist"
    ) -> Dict[str, Any]:
        """
        Create a similarity playlist with tracks.
        
        Args:
            db: Database session
            seed_track_id: The ID of the seed track for similarity
            track_ids: List of track IDs to include in playlist (similar tracks)
            track_scores: List of similarity scores for each track (optional)
            name: Playlist name (defaults to "Playlist")
            
        Returns:
            Dictionary with playlist info including uuid (as id) and name
        """
        try:
            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=None,  # Anonymous playlist
                name=name,
                is_public=False,  # Keep is_public as 0
                type=PlaylistType.SIMILARITY,
                seed_track_id=seed_track_id
            )
            
            db.add(playlist)
            await db.flush()  # Flush to get the playlist ID
            
            # Add tracks to playlist with positions and scores
            playlist_tracks = []
            for position, track_id in enumerate(track_ids, start=1):
                score = None
                if track_scores and position <= len(track_scores):
                    score = str(track_scores[position - 1])  # Convert to string
                
                playlist_track = PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=track_id,
                    position=position,
                    score=score
                )
                playlist_tracks.append(playlist_track)
            
            db.add_all(playlist_tracks)
            await db.commit()
            
            return {
                "id": playlist.uuid,  # Return UUID as 'id' field
                "name": playlist.name
            }
            
        except Exception as e:
            await db.rollback()
            print(f"Error creating similarity playlist: {e}")
            raise e
    
    async def async_get_playlist_with_tracks(self, db: AsyncSession, playlist_id: int) -> Optional[Playlist]:
        """
        Get playlist with all tracks loaded.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            Playlist with tracks loaded or None if not found
        """
        stmt = (
            select(self.model)
            .where(self.model.id == playlist_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_tracks_by_playlist_id(self, db: AsyncSession, playlist_id: int) -> List[PlaylistTrack]:
        """
        Get all playlist tracks for a playlist ordered by position.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            List of PlaylistTrack instances ordered by position
        """
        stmt = (
            select(PlaylistTrack)
            .where(PlaylistTrack.playlist_id == playlist_id)
            .order_by(PlaylistTrack.position)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def create_similarity_playlist_sync(
        self, 
        db: Session, 
        seed_track_id: int, 
        track_ids: List[int],
        name: str = "Playlist"
    ) -> Dict[str, Any]:
        """
        Synchronous version of create_similarity_playlist.
        
        Args:
            db: Database session
            seed_track_id: The ID of the seed track for similarity
            track_ids: List of track IDs to include in playlist (similar tracks)
            name: Playlist name (defaults to "Playlist")
            
        Returns:
            Dictionary with playlist info including uuid (as id) and name
        """
        try:
            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=None,  # Anonymous playlist
                name=name,
                is_public=False,  # Keep is_public as 0
                type=PlaylistType.SIMILARITY,
                seed_track_id=seed_track_id
            )
            
            db.add(playlist)
            db.flush()  # Flush to get the playlist ID
            
            # Add tracks to playlist with positions
            playlist_tracks = []
            for position, track_id in enumerate(track_ids, start=1):
                playlist_track = PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=track_id,
                    position=position
                )
                playlist_tracks.append(playlist_track)
            
            db.add_all(playlist_tracks)
            db.commit()
            
            return {
                "id": playlist.uuid,  # Return UUID as 'id' field
                "name": playlist.name
            }
            
        except Exception as e:
            db.rollback()
            print(f"Error creating similarity playlist: {e}")
            raise e
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Playlist]:
        """Find existing playlist by provided fields.
        
        For playlists, we typically look up by ID or user_id + name combination.
        
        Args:
            db: Database session
            **kwargs: Fields to search with
            
        Returns:
            Existing Playlist instance or None
        """
        if 'id' in kwargs:
            return db.query(self.model).filter(self.model.id == kwargs['id']).first()
        
        # For similarity playlists, they're typically unique by type and seed_track_id
        if 'type' in kwargs and 'seed_track_id' in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.type == kwargs['type'],
                        self.model.seed_track_id == kwargs['seed_track_id']
                    )
                )
                .first()
            )
        
        # Fallback: look up by user_id and name
        if 'user_id' in kwargs and 'name' in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.user_id == kwargs['user_id'],
                        self.model.name == kwargs['name']
                    )
                )
                .first()
            )
        
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Playlist]:
        """Async version of _find_existing."""
        if 'id' in kwargs:
            stmt = select(self.model).where(self.model.id == kwargs['id'])
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        # For similarity playlists, they're typically unique by type and seed_track_id
        if 'type' in kwargs and 'seed_track_id' in kwargs:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.type == kwargs['type'],
                        self.model.seed_track_id == kwargs['seed_track_id']
                    )
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        # Fallback: look up by user_id and name
        if 'user_id' in kwargs and 'name' in kwargs:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.user_id == kwargs['user_id'],
                        self.model.name == kwargs['name']
                    )
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        return None

    async def async_get_playlist_by_uuid(self, db: AsyncSession, playlist_uuid: str) -> Optional[Playlist]:
        """
        Get playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Playlist instance or None if not found
        """
        stmt = select(self.model).where(self.model.uuid == playlist_uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_rename_playlist(self, db: AsyncSession, playlist_uuid: str, new_name: str) -> bool:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            
        Returns:
            True if successful, False if playlist not found
        """
        try:
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return False
            
            playlist.name = new_name
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error renaming playlist: {e}")
            raise e

    async def async_make_playlist_public(self, db: AsyncSession, playlist_uuid: str, is_public: bool = True) -> bool:
        """
        Make a playlist public or private by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            is_public: Whether to make the playlist public
            
        Returns:
            True if successful, False if playlist not found
        """
        try:
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return False
            
            playlist.is_public = is_public
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error updating playlist visibility: {e}")
            raise e

    async def async_get_playlist_similarity_data(self, db: AsyncSession, playlist_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Get playlist with all tracks and similarity data formatted like similarity response.
        Only returns data for public playlists (is_public = 1).
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with similarity-formatted data or None if not found or not public
        """
        try:
            from sqlalchemy.orm import selectinload
            from sqlalchemy import text
            
            # Get playlist with tracks
            stmt = (
                select(self.model)
                .options(selectinload(self.model.playlist_tracks))
                .where(self.model.uuid == playlist_uuid)
            )
            result = await db.execute(stmt)
            playlist = result.scalar_one_or_none()
            
            if not playlist:
                return None
            
            # Check if playlist is public
            if not playlist.is_public:
                return {"error": "playlist_not_public"}
            
            # Get seed track details if it exists
            queried_track = None
            if playlist.seed_track_id:
                seed_query = text("""
                    SELECT 
                        t.uuid as id,
                        t.title,
                        t.year,
                        t.duration_sec as duration,
                        COALESCE(l.name, '') as label,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                            ''
                        ) as artist
                    FROM tracks t
                    LEFT JOIN labels l ON t.label_id = l.id
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    WHERE t.id = :track_id
                    GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
                    LIMIT 1
                """)
                
                seed_result = await db.execute(seed_query, {"track_id": playlist.seed_track_id})
                seed_row = seed_result.first()
                
                if seed_row:
                    queried_track = {
                        "rank": 0,
                        "score": 1.0,
                        "id": seed_row.id,
                        "title": seed_row.title or "Unknown",
                        "year": seed_row.year,
                        "duration": seed_row.duration,
                        "label": seed_row.label,
                        "artist": seed_row.artist or "Unknown"
                    }
            
            # Get all tracks in playlist with details
            if playlist.playlist_tracks:
                track_ids = [pt.track_id for pt in playlist.playlist_tracks]
                tracks_query = text("""
                    SELECT 
                        t.id as track_id,
                        t.uuid as id,
                        t.title,
                        t.year,
                        t.duration_sec as duration,
                        COALESCE(l.name, '') as label,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                            ''
                        ) as artist
                    FROM tracks t
                    LEFT JOIN labels l ON t.label_id = l.id
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    WHERE t.id IN :track_ids
                    GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
                """)
                
                tracks_result = await db.execute(tracks_query, {"track_ids": tuple(track_ids)})
                tracks_data = {row.track_id: row for row in tracks_result.fetchall()}
                
                # Build similar tracks list with proper ordering and scores
                similar_tracks = []
                for pt in sorted(playlist.playlist_tracks, key=lambda x: x.position):
                    track_data = tracks_data.get(pt.track_id)
                    if track_data:
                        track_info = {
                            "rank": pt.position,
                            "score": float(pt.score) if pt.score else 0.0,
                            "id": track_data.id,
                            "title": track_data.title or "Unknown",
                            "year": track_data.year,
                            "duration": track_data.duration,
                            "label": track_data.label,
                            "artist": track_data.artist or "Unknown"
                        }
                        similar_tracks.append(track_info)
            else:
                similar_tracks = []
            
            # Format response like similarity endpoints
            response_data = {
                "queried_track": queried_track,
                "similar_tracks": similar_tracks,
                "playlist": {
                    "id": playlist.uuid,
                    "name": playlist.name
                }
            }
            
            return response_data
            
        except Exception as e:
            print(f"Error getting playlist similarity data: {e}")
            raise e

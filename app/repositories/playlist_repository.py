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
        name: str = "Playlist"
    ) -> Dict[str, Any]:
        """
        Create a similarity playlist with tracks.
        
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
            await db.flush()  # Flush to get the playlist ID
            
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

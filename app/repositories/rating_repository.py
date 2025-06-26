"""
Rating Repository
=================

This repository handles CRUD operations for TrackRating and PlaylistRating models.
It provides rating creation, updates, retrieval, and statistics functionality
using MariaDB with SQLAlchemy ORM.

Implements rating operations including user-based rating management,
rating statistics, and duplicate rating handling.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete
from sqlalchemy.exc import IntegrityError

from app.models.rating import TrackRating, PlaylistRating
from app.models.track import Track
from app.models.playlist import Playlist
from app.repositories.base_repository import BaseRepository


class TrackRatingRepository(BaseRepository[TrackRating]):
    """Repository for TrackRating model operations."""
    
    def __init__(self):
        """Initialize TrackRatingRepository with TrackRating model."""
        super().__init__(TrackRating)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[TrackRating]:
        """Find existing track rating by user_id and track_id."""
        if 'user_id' in kwargs and 'track_id' in kwargs:
            return db.query(self.model).filter(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.track_id == kwargs['track_id']
                )
            ).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[TrackRating]:
        """Find existing track rating by user_id and track_id (async)."""
        if 'user_id' in kwargs and 'track_id' in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.track_id == kwargs['track_id']
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None
    
    async def async_rate_track(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        rating: int, 
        user_id: Optional[str] = None
    ) -> Optional[TrackRating]:
        """
        Rate a track or update existing rating.
        
        Args:
            db: Database session
            track_id: Track UUID to rate
            rating: Rating value (0 or 1)
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            TrackRating instance or None if track doesn't exist
        """
        try:
            # First, get the numeric track ID from UUID
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            if not track_numeric_id:
                return None  # Track not found
            
            # Check for existing rating
            existing_rating = await self._async_find_existing(
                db, user_id=user_id, track_id=track_numeric_id
            )
            
            if existing_rating:
                # Update existing rating
                existing_rating.rating = rating
                existing_rating.rated_at = func.current_timestamp()
                await db.commit()
                await db.refresh(existing_rating)
                return existing_rating
            else:
                # Create new rating
                new_rating = TrackRating(
                    user_id=user_id,
                    track_id=track_numeric_id,
                    rating=rating
                )
                db.add(new_rating)
                await db.commit()
                await db.refresh(new_rating)
                return new_rating
                
        except Exception as e:
            await db.rollback()
            print(f"Error rating track: {e}")
            raise e
    
    async def async_get_track_rating(
        self, 
        db: AsyncSession, 
        track_id: int, 
        user_id: Optional[str] = None
    ) -> Optional[TrackRating]:
        """
        Get user's rating for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            TrackRating instance or None if not found
        """
        try:
            return await self._async_find_existing(db, user_id=user_id, track_id=track_id)
        except Exception as e:
            print(f"Error getting track rating: {e}")
            raise e
    
    async def async_delete_track_rating(
        self, 
        db: AsyncSession, 
        track_id: int, 
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete user's rating for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            True if deleted, False if not found
        """
        try:
            stmt = delete(self.model).where(
                and_(
                    self.model.track_id == track_id,
                    self.model.user_id == user_id
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            print(f"Error deleting track rating: {e}")
            raise e
    
    async def async_get_track_rating_stats(self, db: AsyncSession, track_id: int) -> Dict[str, Any]:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            # Get total count and distribution
            stmt = select(
                func.count(self.model.id).label('total_ratings'),
                func.sum(func.case((self.model.rating == 0, 1), else_=0)).label('not_similar'),
                func.sum(func.case((self.model.rating == 1, 1), else_=0)).label('similar')
            ).where(self.model.track_id == track_id)
            
            result = await db.execute(stmt)
            row = result.first()
            
            return {
                "total_ratings": row.total_ratings or 0,
                "average_rating": None,  # Not applicable for binary ratings
                "rating_distribution": {
                    "0": row.not_similar or 0,
                    "1": row.similar or 0
                }
            }
        except Exception as e:
            print(f"Error getting track rating stats: {e}")
            raise e


class PlaylistRatingRepository(BaseRepository[PlaylistRating]):
    """Repository for PlaylistRating model operations."""
    
    def __init__(self):
        """Initialize PlaylistRatingRepository with PlaylistRating model."""
        super().__init__(PlaylistRating)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[PlaylistRating]:
        """Find existing playlist rating by user_id and playlist_id."""
        if 'user_id' in kwargs and 'playlist_id' in kwargs:
            return db.query(self.model).filter(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            ).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[PlaylistRating]:
        """Find existing playlist rating by user_id and playlist_id (async)."""
        if 'user_id' in kwargs and 'playlist_id' in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None
    
    async def async_rate_playlist(
        self, 
        db: AsyncSession, 
        playlist_id: str,  # Changed from int to str (UUID)
        rating: int, 
        user_id: Optional[str] = None,
        message: Optional[str] = None
    ) -> Optional[PlaylistRating]:
        """
        Rate a playlist or update existing rating.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID to rate
            rating: Rating value (0-3)
            user_id: User ID (optional for anonymous ratings)
            message: Optional user message/feedback
            
        Returns:
            PlaylistRating instance or None if playlist doesn't exist
        """
        try:
            # First, get the numeric playlist ID from UUID
            from app.models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found
            
            # Check for existing rating
            existing_rating = await self._async_find_existing(
                db, user_id=user_id, playlist_id=playlist_numeric_id
            )
            
            if existing_rating:
                # Update existing rating
                existing_rating.rating = rating
                existing_rating.message = message
                existing_rating.rated_at = func.current_timestamp()
                await db.commit()
                await db.refresh(existing_rating)
                return existing_rating
            else:
                # Create new rating
                new_rating = PlaylistRating(
                    user_id=user_id,
                    playlist_id=playlist_numeric_id,
                    rating=rating,
                    message=message
                )
                db.add(new_rating)
                await db.commit()
                await db.refresh(new_rating)
                return new_rating
                
        except Exception as e:
            await db.rollback()
            print(f"Error rating playlist: {e}")
            raise e
    
    async def async_get_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> Optional[PlaylistRating]:
        """
        Get user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            PlaylistRating instance or None if not found
        """
        try:
            return await self._async_find_existing(db, user_id=user_id, playlist_id=playlist_id)
        except Exception as e:
            print(f"Error getting playlist rating: {e}")
            raise e
    
    async def async_delete_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            True if deleted, False if not found
        """
        try:
            stmt = delete(self.model).where(
                and_(
                    self.model.playlist_id == playlist_id,
                    self.model.user_id == user_id
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            print(f"Error deleting playlist rating: {e}")
            raise e
    
    async def async_get_playlist_rating_stats(self, db: AsyncSession, playlist_id: int) -> Dict[str, Any]:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            # Get total count, average, and distribution
            stmt = select(
                func.count(self.model.id).label('total_ratings'),
                func.avg(self.model.rating).label('average_rating'),
                func.sum(func.case((self.model.rating == 0, 1), else_=0)).label('rating_0'),
                func.sum(func.case((self.model.rating == 1, 1), else_=0)).label('rating_1'),
                func.sum(func.case((self.model.rating == 2, 1), else_=0)).label('rating_2'),
                func.sum(func.case((self.model.rating == 3, 1), else_=0)).label('rating_3')
            ).where(self.model.playlist_id == playlist_id)
            
            result = await db.execute(stmt)
            row = result.first()
            
            return {
                "total_ratings": row.total_ratings or 0,
                "average_rating": float(row.average_rating) if row.average_rating else None,
                "rating_distribution": {
                    "0": row.rating_0 or 0,
                    "1": row.rating_1 or 0,
                    "2": row.rating_2 or 0,
                    "3": row.rating_3 or 0
                }
            }
        except Exception as e:
            print(f"Error getting playlist rating stats: {e}")
            raise e

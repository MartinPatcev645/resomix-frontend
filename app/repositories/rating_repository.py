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

from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete, text, case

from ..models.rating import TrackRating, PlaylistRating
from ..models.track import Track
from ..repositories.base_repository import BaseRepository


class TrackRatingRepository(BaseRepository[TrackRating]):
    """Repository for TrackRating model operations."""
    
    def __init__(self):
        """Initialize TrackRatingRepository with TrackRating model."""
        super().__init__(TrackRating)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[TrackRating]:
        """Find existing track rating by user_id, track_id, and playlist_id."""
        if 'user_id' in kwargs and 'track_id' in kwargs and 'playlist_id' in kwargs:
            return db.query(self.model).filter(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.track_id == kwargs['track_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            ).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[TrackRating]:
        """Find existing track rating by user_id, track_id, and playlist_id (async)."""
        if 'user_id' in kwargs and 'track_id' in kwargs and 'playlist_id' in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.track_id == kwargs['track_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None
    
    async def async_rate_track(
        self,
        db: AsyncSession,
        track_id: str,
        playlist_id: str,
        rating: int,
        user_id: Optional[int] = None,
    ) -> Optional[TrackRating]:
        """
        Rate a track with UUID support for both track and playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID)
            playlist_id: Playlist ID (UUID)
            rating: Rating value (0 or 1)
            user_id: Optional user ID
            
        Returns:
            TrackRating instance or None if track or playlist doesn't exist
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return None  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found
            
            # Always create new rating (no duplicate checking)
            new_rating = TrackRating(
                user_id=user_id,
                track_id=track_numeric_id,
                playlist_id=playlist_numeric_id,
                rating=rating
            )
            db.add(new_rating)
            await db.commit()
            await db.refresh(new_rating)
            return new_rating
                
        except Exception as e:
            await db.rollback()
            raise e
    
    async def async_get_track_rating(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> Optional[TrackRating]:
        """
        Get user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID, ObjectId, or other format)
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            TrackRating instance or None if not found
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return None  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found
            
            return await self._async_find_existing(db, user_id=user_id, track_id=track_numeric_id, playlist_id=playlist_numeric_id)
        except Exception as e:
            print(f"Error getting track rating: {e}")
            raise e
    
    async def async_delete_track_rating(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID, ObjectId, or other format)
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            True if deleted, False if not found
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return False  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return False  # Playlist not found
            
            stmt = delete(self.model).where(
                and_(
                    self.model.track_id == track_numeric_id,
                    self.model.playlist_id == playlist_numeric_id,
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
    
    async def async_get_track_rating_stats(self, db: AsyncSession, track_id: str) -> Dict[str, Any]:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID (UUID)
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            # First, resolve the numeric track ID from UUID
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found by UUID and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except (ValueError, TypeError):
                    pass
            
            if not track_numeric_id:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0}
                }
            
            # Aggregate stats using a single query
            stmt = select(
                func.count(TrackRating.id).label('total_ratings'),
                func.sum(case((TrackRating.rating == 0, 1), else_=0)).label('not_similar'),
                func.sum(case((TrackRating.rating == 1, 1), else_=0)).label('similar')
            ).where(TrackRating.track_id == track_numeric_id)

            result = await db.execute(stmt)
            row = result.mappings().one()
            
            total = int(row['total_ratings'] or 0)
            if total == 0:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0}
                }

            return {
                "total_ratings": total,
                "average_rating": None,
                "rating_distribution": {
                    "0": int(row['not_similar'] or 0),
                    "1": int(row['similar'] or 0)
                }
            }
        except Exception as e:
            # Silently handle but log for server-side debugging
            # logger.error(f"Error getting track rating stats for {track_id}: {e}")
            return {
                "total_ratings": 0,
                "average_rating": None,
                "rating_distribution": {"0": 0, "1": 0}
            }



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
        message: Optional[str] = None,
        visitor_id: Optional[str] = None,
    ) -> Optional[PlaylistRating]:
        """
        Rate a playlist by creating a new rating entry.
        
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
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found
            
            # Always create new rating (no duplicate checking). Guests are tagged by visitor_id.
            new_rating = PlaylistRating(
                user_id=user_id,
                visitor_id=visitor_id if not user_id else None,
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
    
    async def async_get_playlist_rating_stats(self, db: AsyncSession, playlist_id: Union[int, str]) -> Dict[str, Any]:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID (numeric ID or UUID string)
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            from app.models.playlist import Playlist
            
            # Resolve numeric ID if UUID provided
            playlist_numeric_id = None
            if isinstance(playlist_id, int):
                playlist_numeric_id = playlist_id
            elif isinstance(playlist_id, str):
                # Try to look up by UUID
                stmt = select(Playlist.id).where(Playlist.uuid == playlist_id)
                result = await db.execute(stmt)
                playlist_numeric_id = result.scalar_one_or_none()
                
                # If not found and it looks like a number, try direct ID
                if not playlist_numeric_id and playlist_id.isdigit():
                    playlist_numeric_id = int(playlist_id)

            if not playlist_numeric_id:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0}
                }

            # Get total count, average, and distribution
            stmt = select(
                func.count(PlaylistRating.id).label('total_ratings'),
                func.avg(PlaylistRating.rating).label('average_rating'),
                func.sum(case((PlaylistRating.rating == 0, 1), else_=0)).label('rating_0'),
                func.sum(case((PlaylistRating.rating == 1, 1), else_=0)).label('rating_1'),
                func.sum(case((PlaylistRating.rating == 2, 1), else_=0)).label('rating_2'),
                func.sum(case((PlaylistRating.rating == 3, 1), else_=0)).label('rating_3')
            ).where(PlaylistRating.playlist_id == playlist_numeric_id)

            result = await db.execute(stmt)
            row = result.mappings().one()
            
            total = int(row['total_ratings'] or 0)
            if total == 0:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0}
                }

            return {
                "total_ratings": total,
                "average_rating": float(row['average_rating']) if row['average_rating'] is not None else None,
                "rating_distribution": {
                    "0": int(row['rating_0'] or 0),
                    "1": int(row['rating_1'] or 0),
                    "2": int(row['rating_2'] or 0),
                    "3": int(row['rating_3'] or 0)
                }
            }
        except Exception as e:
            return {
                "total_ratings": 0,
                "average_rating": None,
                "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0},
                "error": str(e)
            }

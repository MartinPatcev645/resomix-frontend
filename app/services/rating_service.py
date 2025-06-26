"""
Rating Service
==============

This service handles rating-related business logic including track and playlist ratings,
rating management, and statistics aggregation. It provides functionality for
rating operations, user rating retrieval, and rating analytics.

Coordinates with rating repositories for database operations and formats
responses for rating-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.rating_repository import TrackRatingRepository, PlaylistRatingRepository
from app.schemas.rating import RatingResponse


class RatingService:
    """Service for rating-related operations."""
    
    def __init__(self):
        """Initialize rating service."""
        self.track_rating_repository = TrackRatingRepository()
        self.playlist_rating_repository = PlaylistRatingRepository()
    
    def _format_rating_response(self, rating_obj) -> RatingResponse:
        """Format rating object to response schema."""
        return RatingResponse(
            id=rating_obj.id,
            track_id=getattr(rating_obj, 'track_id', None),
            playlist_id=getattr(rating_obj, 'playlist_id', None),
            user_id=rating_obj.user_id,
            rating=rating_obj.rating,
            message=getattr(rating_obj, 'message', None),
            rated_at=rating_obj.rated_at
        )
    
    def _format_playlist_rating_response(self, rating_obj, playlist_uuid: str) -> RatingResponse:
        """Format playlist rating object to response schema with UUID."""
        return RatingResponse(
            id=rating_obj.id,
            track_id=None,
            playlist_id=playlist_uuid,  # Use the UUID instead of numeric ID
            user_id=rating_obj.user_id,
            rating=rating_obj.rating,
            message=getattr(rating_obj, 'message', None),
            rated_at=rating_obj.rated_at
        )
    
    # Track Rating Operations
    async def rate_track(
        self, 
        db: AsyncSession, 
        track_id: int, 
        rating: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rate a track or update existing rating.
        
        Args:
            db: Database session
            track_id: Track ID to rate
            rating: Rating value (0 or 1)
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status, message, and rating data
        """
        try:
            rating_obj = await self.track_rating_repository.async_rate_track(
                db, track_id, rating, user_id
            )
            
            if rating_obj:
                action = "updated" if rating_obj.rated_at != rating_obj.rated_at else "created"
                return {
                    "success": True,
                    "message": f"Track rating {action} successfully",
                    "data": self._format_rating_response(rating_obj)
                }
            else:
                return {
                    "success": False,
                    "error": "Track not found"
                }
                
        except Exception as e:
            print(f"Error in rating service rate_track: {e}")
            return {
                "success": False,
                "error": "An error occurred while rating the track"
            }
    
    async def get_track_rating(
        self, 
        db: AsyncSession, 
        track_id: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's rating for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and rating data
        """
        try:
            rating_obj = await self.track_rating_repository.async_get_track_rating(
                db, track_id, user_id
            )
            
            if rating_obj:
                return {
                    "success": True,
                    "data": self._format_rating_response(rating_obj)
                }
            else:
                return {
                    "success": False,
                    "error": "Rating not found"
                }
                
        except Exception as e:
            print(f"Error in rating service get_track_rating: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving the rating"
            }
    
    async def delete_track_rating(
        self, 
        db: AsyncSession, 
        track_id: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete user's rating for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.track_rating_repository.async_delete_track_rating(
                db, track_id, user_id
            )
            
            if success:
                return {
                    "success": True,
                    "message": "Track rating deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Rating not found"
                }
                
        except Exception as e:
            print(f"Error in rating service delete_track_rating: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the rating"
            }
    
    async def get_track_rating_stats(self, db: AsyncSession, track_id: int) -> Dict[str, Any]:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID
            
        Returns:
            Dictionary with success status and rating statistics
        """
        try:
            stats = await self.track_rating_repository.async_get_track_rating_stats(db, track_id)
            
            return {
                "success": True,
                "data": stats
            }
                
        except Exception as e:
            print(f"Error in rating service get_track_rating_stats: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving rating statistics"
            }
    
    # Playlist Rating Operations
    async def rate_playlist(
        self, 
        db: AsyncSession, 
        playlist_id: str,
        rating: int, 
        user_id: str = None,
        message: str = None
    ) -> Dict[str, Any]:
        """
        Rate a playlist or update existing rating.
        
        Args:
            db: Database session
            playlist_id: Playlist ID to rate
            rating: Rating value (0-3)
            user_id: User ID (optional for anonymous ratings)
            message: Optional user message/feedback
            
        Returns:
            Dictionary with success status, message, and rating data
        """
        try:
            # Validate inputs
            if rating not in [0, 1, 2, 3]:
                return {
                    "success": False,
                    "error": "Playlist rating must be between 0 and 3 stars"
                }
            
            rating_obj = await self.playlist_rating_repository.async_rate_playlist(
                db, playlist_id, rating, user_id, message
            )
            
            if rating_obj:
                action = "updated" if rating_obj.rated_at != rating_obj.rated_at else "created"
                return {
                    "success": True,
                    "message": f"Playlist rating {action} successfully",
                    "data": self._format_playlist_rating_response(rating_obj, playlist_id)
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error in rating service rate_playlist: {e}")
            return {
                "success": False,
                "error": "An error occurred while rating the playlist"
            }
    
    async def get_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and rating data
        """
        try:
            rating_obj = await self.playlist_rating_repository.async_get_playlist_rating(
                db, playlist_id, user_id
            )
            
            if rating_obj:
                return {
                    "success": True,
                    "data": self._format_playlist_rating_response(rating_obj, playlist_id)
                }
            else:
                return {
                    "success": False,
                    "error": "Rating not found"
                }
                
        except Exception as e:
            print(f"Error in rating service get_playlist_rating: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving the rating"
            }
    
    async def delete_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.playlist_rating_repository.async_delete_playlist_rating(
                db, playlist_id, user_id
            )
            
            if success:
                return {
                    "success": True,
                    "message": "Playlist rating deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Rating not found"
                }
                
        except Exception as e:
            print(f"Error in rating service delete_playlist_rating: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the rating"
            }
    
    async def get_playlist_rating_stats(self, db: AsyncSession, playlist_id: int) -> Dict[str, Any]:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            Dictionary with success status and rating statistics
        """
        try:
            stats = await self.playlist_rating_repository.async_get_playlist_rating_stats(db, playlist_id)
            
            return {
                "success": True,
                "data": stats
            }
                
        except Exception as e:
            print(f"Error in rating service get_playlist_rating_stats: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving rating statistics"
            }

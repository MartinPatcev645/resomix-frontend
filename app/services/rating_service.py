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
    
    def _format_track_rating_response(self, rating_obj, track_uuid: str, playlist_uuid: str) -> dict:
        """Format track rating object to response dictionary with UUIDs."""
        return {
            "id": rating_obj.id,
            "track_id": track_uuid,  # Use the UUID instead of numeric ID
            "playlist_id": playlist_uuid,  # Use the playlist UUID
            "user_id": rating_obj.user_id,
            "rating": rating_obj.rating,
            "message": None,  # Track ratings don't have messages
            "rated_at": rating_obj.rated_at.isoformat() if rating_obj.rated_at else None
        }
    
    def _format_playlist_rating_response(self, rating_obj, playlist_uuid: str) -> dict:
        """Format playlist rating object to response dictionary with UUID."""
        return {
            "id": rating_obj.id,
            "track_id": None,
            "playlist_id": playlist_uuid,  # Use the UUID instead of numeric ID
            "user_id": rating_obj.user_id,
            "rating": rating_obj.rating,
            "message": getattr(rating_obj, 'message', None),
            "rated_at": rating_obj.rated_at.isoformat() if rating_obj.rated_at else None
        }
    
    # Track Rating Operations
    async def rate_track(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        rating: int, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rate a track by creating a new rating entry.
        
        Args:
            db: Database session
            track_id: Track UUID to rate
            playlist_id: Playlist UUID from which the rating is being submitted
            rating: Rating value (0 or 1)
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status, message, and rating data
        """
        try:
            rating_obj = await self.track_rating_repository.async_rate_track(
                db, track_id, playlist_id, rating, user_id
            )
            
            if rating_obj:
                return {
                    "success": True,
                    "message": "Track rated successfully",
                    "data": self._format_track_rating_response(rating_obj, track_id, playlist_id)
                }
            else:
                return {
                    "success": False,
                    "error": "Track or playlist not found"
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
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track UUID
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and rating data
        """
        try:
            rating_obj = await self.track_rating_repository.async_get_track_rating(
                db, track_id, playlist_id, user_id
            )
            
            if rating_obj:
                return {
                    "success": True,
                    "data": self._format_track_rating_response(rating_obj, track_id, playlist_id)
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
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track UUID
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            Dictionary with success status and message
        """
        try:
            deleted = await self.track_rating_repository.async_delete_track_rating(
                db, track_id, playlist_id, user_id
            )
            
            if deleted:
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
    
    async def get_track_rating_stats(self, db: AsyncSession, track_id: str) -> Dict[str, Any]:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track UUID
            
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
        message: str = None,
        visitor_id: str = None,
    ) -> Dict[str, Any]:
        """
        Rate a playlist by creating a new rating entry.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID to rate
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
                db, playlist_id, rating, user_id, message, visitor_id=visitor_id
            )
            
            if rating_obj:
                return {
                    "success": True,
                    "message": "Playlist rated successfully",
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
            playlist_id: Playlist UUID
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
        playlist_id: str, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
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
    
    async def get_playlist_rating_stats(self, db: AsyncSession, playlist_id: str) -> Dict[str, Any]:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
            
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

    # Combined / admin retrieval
    async def get_liked_tracks(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """A page of the user's liked tracks, Apple-enriched.

        The enrichment is the same call the playlist screen makes, so a liked track renders with the
        same artwork, title and preview it had where the user liked it. Without it the tab would
        show in-house metadata for catalogue tracks — a different title and no cover for the same
        row the user is looking at elsewhere.
        """
        try:
            rows, total = await self.track_rating_repository.async_get_liked_tracks(
                db, user_id, page=page, page_size=page_size, partner_id=partner_id
            )
            if rows:
                from app.services.apple_music_enrichment import enrich_tracks_with_apple

                # Mutates in place and swallows its own failures — a missing Apple row degrades the
                # track to the HLS player rather than failing the page.
                await enrich_tracks_with_apple(db, rows)
            return {
                "success": True,
                "data": rows,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        except Exception as exc:
            print(f"Error getting liked tracks: {exc}")
            return {
                "success": False,
                "error": "An error occurred while retrieving liked tracks",
                "data": [],
                "total": 0,
            }

    async def unlike_track(
        self, db: AsyncSession, track_uuid: str, user_id: int
    ) -> Dict[str, Any]:
        """Remove the user's like for one track, everywhere it was given."""
        try:
            removed = await self.track_rating_repository.async_unlike_track(db, track_uuid, user_id)
            if not removed:
                # Idempotent by design: un-liking something already un-liked (a double click, or a
                # stale tab) is not an error, and reporting one would make the UI show a failure for
                # an action that reached the state the user wanted.
                return {"success": True, "data": {"track_id": track_uuid, "removed": 0}}
            return {"success": True, "data": {"track_id": track_uuid, "removed": removed}}
        except Exception as exc:
            print(f"Error un-liking track: {exc}")
            return {"success": False, "error": "An error occurred while removing the like"}

    async def get_my_playlist_ratings(
        self, db: AsyncSession, playlist_uuid: str, user_id: Optional[int]
    ) -> Dict[str, Any]:
        """The current user's ratings for a whole playlist in one call.

        Returns their per-track thumbs (``{track_uuid: 0|1}``) plus their playlist star rating,
        so the playlist screen can hydrate everything on load.
        """
        try:
            track_ratings = await self.track_rating_repository.async_get_user_ratings_for_playlist(
                db, playlist_uuid, user_id
            )
            pr = await self.playlist_rating_repository.async_get_user_playlist_rating(
                db, playlist_uuid, user_id
            )
            return {
                "success": True,
                "data": {
                    "playlist_id": playlist_uuid,
                    "track_ratings": track_ratings,
                    "playlist_rating": (
                        {"rating": pr.rating, "message": pr.message} if pr is not None else None
                    ),
                },
            }
        except Exception as e:
            print(f"Error in rating service get_my_playlist_ratings: {e}")
            return {"success": False, "error": "An error occurred while retrieving your ratings"}

    async def get_playlist_ratings_detail(self, db: AsyncSession, playlist_uuid: str) -> Dict[str, Any]:
        """Admin: full ratings breakdown for a playlist (creator highlighted + per-track thumbs)."""
        try:
            data = await self.playlist_rating_repository.async_get_playlist_ratings_detail(db, playlist_uuid)
            if data is None:
                return {"success": False, "error": "Playlist not found"}
            return {"success": True, "data": data}
        except Exception as e:
            print(f"Error in rating service get_playlist_ratings_detail: {e}")
            return {"success": False, "error": "An error occurred while retrieving playlist ratings"}

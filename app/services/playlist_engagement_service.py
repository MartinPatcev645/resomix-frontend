"""
Playlist Engagement Service
===========================

This service handles playlist engagement-related business logic including favorites
and follows. It provides functionality for adding/removing favorites and
following/unfollowing playlists.

Coordinates with playlist engagement repository and playlist repository for
database operations and formats responses for engagement-related API endpoints.

Version: 3.0.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.playlist_engagement_repository import PlaylistEngagementRepository
from app.repositories.playlist_repository import PlaylistRepository


class PlaylistEngagementService:
    """Service for playlist engagement-related operations."""
    
    def __init__(self):
        """Initialize playlist engagement service."""
        self.engagement_repository = PlaylistEngagementRepository()
        self.playlist_repository = PlaylistRepository()
    
    async def enrich_playlist_with_engagement(
        self,
        db: AsyncSession,
        playlist_dict: Dict[str, Any],
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Enrich a playlist dictionary with engagement data (is_favorite, is_following).
        
        Args:
            db: Database session
            playlist_dict: Dictionary containing playlist data (must have 'id' field with UUID)
            user_id: Optional user ID to check engagement for
            
        Returns:
            Dictionary with added is_favorite and is_following fields (defaults to False if user not logged in)
        """
        # `is_following` is intentionally not exposed on the playlist response (unused by the
        # frontend — see docs/PLAYBACK_APPLE_MUSIC_PLAN.md); the favorite field is kept.
        playlist_dict["is_favorite"] = False

        # Only fetch engagement if user is logged in
        if user_id and playlist_dict.get("id"):
            try:
                playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_dict["id"])
                if playlist:
                    engagement = await self.engagement_repository.async_get_engagement(
                        db, user_id, playlist.id
                    )
                    if engagement:
                        playlist_dict["is_favorite"] = engagement.is_favorite
            except Exception as e:
                # If engagement lookup fails, just use defaults (False)
                print(f"Error enriching playlist with engagement: {e}")
        
        return playlist_dict
    
    async def add_favorite(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Add a playlist to user's favorites.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID (public identifier)
            user_id: User ID (internal BIGINT)
            
        Returns:
            Dictionary with success status and engagement data or error message
        """
        try:
            # Validate playlist exists
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }

            # Anti-abuse guard: a playlist created by a guest (no owning user — only a visitor_id)
            # cannot be favorited. Otherwise a user who has hit their playlist cap could open an
            # incognito tab, create guest playlists (public by default), and "collect" them as
            # favorites to bypass the limit. The guest must register / log in first so the playlist
            # is reparented onto a real user_id. Checked BEFORE get-or-create so no engagement row
            # is ever written for a guest playlist.
            if playlist.user_id is None:
                return {
                    "success": False,
                    "error": "This playlist was created by a guest and can't be added to favorites. "
                             "Ask its creator to sign in and save it first.",
                    "status_code": 403,
                }

            # Visibility guard: a user may favorite their OWN playlist (any visibility) or any PUBLIC
            # playlist — never someone else's private playlist (treated as not found so we don't leak
            # that it exists).
            if playlist.user_id != user_id and not playlist.is_public:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }

            # Get current engagement state
            engagement = await self.engagement_repository.async_get_engagement(
                db, user_id, playlist.id
            )
            if not engagement:
                return {
                    "success": False,
                    "error": "Failed to get or create engagement record"
                }

            # If already favorite, return success without changing
            if engagement.is_favorite:
                return {
                    "success": True,
                    "data": {
                        "is_favorite": engagement.is_favorite,
                        "is_following": engagement.is_following
                    }
                }
            
            # Toggle to add favorite (changes False to True)
            result = await self.engagement_repository.async_toggle_favorite(db, user_id, playlist.id)
            if not result:
                return {
                    "success": False,
                    "error": "Failed to add favorite"
                }
            
            # Return only engagement state, not IDs
            return {
                "success": True,
                "data": {
                    "is_favorite": result["is_favorite"],
                    "is_following": result["is_following"]
                }
            }
            
        except Exception as e:
            print(f"Error in playlist engagement service add_favorite: {e}")
            return {
                "success": False,
                "error": "An error occurred while adding favorite"
            }
    
    async def remove_favorite(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Remove a playlist from user's favorites.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID (public identifier)
            user_id: User ID (internal BIGINT)
            
        Returns:
            Dictionary with success status and engagement data or error message
        """
        try:
            # Validate playlist exists
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            
            # Get current engagement state
            engagement = await self.engagement_repository.async_get_engagement(
                db, user_id, playlist.id
            )
            if not engagement:
                return {
                    "success": False,
                    "error": "Failed to get or create engagement record"
                }
            
            # If not favorite, return success without changing
            if not engagement.is_favorite:
                return {
                    "success": True,
                    "data": {
                        "is_favorite": engagement.is_favorite,
                        "is_following": engagement.is_following
                    }
                }
            
            # Toggle to remove favorite (changes True to False)
            result = await self.engagement_repository.async_toggle_favorite(db, user_id, playlist.id)
            if not result:
                return {
                    "success": False,
                    "error": "Failed to remove favorite"
                }
            
            # Return only engagement state, not IDs
            return {
                "success": True,
                "data": {
                    "is_favorite": result["is_favorite"],
                    "is_following": result["is_following"]
                }
            }
            
        except Exception as e:
            print(f"Error in playlist engagement service remove_favorite: {e}")
            return {
                "success": False,
                "error": "An error occurred while removing favorite"
            }
    
    async def follow(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Follow a playlist.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID (public identifier)
            user_id: User ID (internal BIGINT)
            
        Returns:
            Dictionary with success status and engagement data or error message
        """
        try:
            # Validate playlist exists
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            
            # Get current engagement state
            engagement = await self.engagement_repository.async_get_engagement(
                db, user_id, playlist.id
            )
            if not engagement:
                return {
                    "success": False,
                    "error": "Failed to get or create engagement record"
                }
            
            # If already following, return success without changing
            if engagement.is_following:
                return {
                    "success": True,
                    "data": {
                        "is_favorite": engagement.is_favorite,
                        "is_following": engagement.is_following
                    }
                }
            
            # Toggle to add follow (changes False to True)
            result = await self.engagement_repository.async_toggle_follow(db, user_id, playlist.id)
            if not result:
                return {
                    "success": False,
                    "error": "Failed to follow playlist"
                }
            
            # Return only engagement state, not IDs
            return {
                "success": True,
                "data": {
                    "is_favorite": result["is_favorite"],
                    "is_following": result["is_following"]
                }
            }
            
        except Exception as e:
            print(f"Error in playlist engagement service follow: {e}")
            return {
                "success": False,
                "error": "An error occurred while following playlist"
            }
    
    async def unfollow(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Unfollow a playlist.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID (public identifier)
            user_id: User ID (internal BIGINT)
            
        Returns:
            Dictionary with success status and engagement data or error message
        """
        try:
            # Validate playlist exists
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            
            # Get current engagement state
            engagement = await self.engagement_repository.async_get_engagement(
                db, user_id, playlist.id
            )
            if not engagement:
                return {
                    "success": False,
                    "error": "Failed to get or create engagement record"
                }
            
            # If not following, return success without changing
            if not engagement.is_following:
                return {
                    "success": True,
                    "data": {
                        "is_favorite": engagement.is_favorite,
                        "is_following": engagement.is_following
                    }
                }
            
            # Toggle to remove follow (changes True to False)
            result = await self.engagement_repository.async_toggle_follow(db, user_id, playlist.id)
            if not result:
                return {
                    "success": False,
                    "error": "Failed to unfollow playlist"
                }
            
            # Return only engagement state, not IDs
            return {
                "success": True,
                "data": {
                    "is_favorite": result["is_favorite"],
                    "is_following": result["is_following"]
                }
            }
            
        except Exception as e:
            print(f"Error in playlist engagement service unfollow: {e}")
            return {
                "success": False,
                "error": "An error occurred while unfollowing playlist"
            }


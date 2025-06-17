"""
Playlist Service
================

This service handles playlist-related business logic including playlist management,
track organization, and similarity data formatting. It provides functionality for
rename operations, visibility changes, and similarity data retrieval.

Coordinates with playlist repository for database operations and formats
responses for playlist-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.playlist_repository import PlaylistRepository


class PlaylistService:
    """Service for playlist-related operations."""
    
    def __init__(self):
        """Initialize playlist service."""
        self.playlist_repository = PlaylistRepository()
    
    async def rename_playlist(self, db: AsyncSession, playlist_uuid: str, new_name: str) -> Dict[str, Any]:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            
        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.playlist_repository.async_rename_playlist(db, playlist_uuid, new_name)
            
            if success:
                return {
                    "success": True,
                    "message": "Playlist renamed successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error in playlist service rename: {e}")
            return {
                "success": False,
                "error": "An error occurred while renaming the playlist"
            }
    
    async def change_playlist_visibility(self, db: AsyncSession, playlist_uuid: str, is_public: bool) -> Dict[str, Any]:
        """
        Change playlist visibility (public/private) by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            is_public: Whether to make the playlist public
            
        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.playlist_repository.async_make_playlist_public(db, playlist_uuid, is_public)
            
            if success:
                visibility = "public" if is_public else "private"
                return {
                    "success": True,
                    "message": f"Playlist visibility changed to {visibility} successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error in playlist service visibility change: {e}")
            return {
                "success": False,
                "error": "An error occurred while changing playlist visibility"
            }
    
    async def get_playlist_similarity_data(self, db: AsyncSession, playlist_uuid: str) -> Dict[str, Any]:
        """
        Get playlist with similarity data formatted like similarity endpoints.
        Only returns data for public playlists.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with similarity-formatted data or error
        """
        try:
            similarity_data = await self.playlist_repository.async_get_playlist_similarity_data(db, playlist_uuid)
            
            if similarity_data is None:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            elif isinstance(similarity_data, dict) and similarity_data.get("error") == "playlist_not_public":
                return {
                    "success": False,
                    "error": "Playlist is not public. Only public playlists can be accessed."
                }
            else:
                return {
                    "success": True,
                    "data": similarity_data
                }
                
        except Exception as e:
            print(f"Error in playlist service get similarity data: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlist data"
            }

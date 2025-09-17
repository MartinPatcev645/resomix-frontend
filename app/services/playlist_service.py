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
from app.services.metadata_service import MetadataService
from app.utils.hls_utils import generate_m3u8_playlist


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
    
    def _apply_playlist_response_filtering(self, similarity_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply metadata filtering to playlist similarity data.
        This ensures existing tracks in playlists get filtered even if they weren't filtered during upload.
        
        Args:
            similarity_data: Playlist similarity data dictionary
            
        Returns:
            Filtered similarity data
        """
        filtered_data = similarity_data.copy()
        
        # Filter queried_track if it exists
        if filtered_data.get("queried_track"):
            track = filtered_data["queried_track"]
            if track.get("title"):
                track["title"] = MetadataService._filter_title_field(track["title"])
            if track.get("artist"):
                track["artist"] = MetadataService._filter_metadata_field(track["artist"], "Artist")
            if track.get("label"):
                track["label"] = MetadataService._filter_metadata_field(track["label"], "Label")
        
        # Filter similar_tracks
        if filtered_data.get("similar_tracks"):
            for track in filtered_data["similar_tracks"]:
                if track.get("title"):
                    track["title"] = MetadataService._filter_title_field(track["title"])
                if track.get("artist"):
                    track["artist"] = MetadataService._filter_metadata_field(track["artist"], "Artist")
                if track.get("label"):
                    track["label"] = MetadataService._filter_metadata_field(track["label"], "Label")
        
        return filtered_data

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
                filtered_data = self._apply_playlist_response_filtering(similarity_data)
                return {
                    "success": True,
                    "data": filtered_data
                }
                
        except Exception as e:
            print(f"Error in playlist service get similarity data: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlist data"
            }
    
    async def get_playlist_hls_data(self, db: AsyncSession, playlist_uuid: str) -> Dict[str, Any]:
        """
        Get playlist as HLS M3U8 format.
        Works with both public and private playlists.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with M3U8 content or error
        """
        try:
            # First check if playlist exists and is public
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
            
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            
            # Get playlist tracks with full metadata
            hls_data = await self.playlist_repository.async_get_playlist_hls_data(db, playlist_uuid)
            
            if not hls_data or not hls_data.get("tracks"):
                return {
                    "success": False,
                    "error": "Playlist has no tracks"
                }
            
            # Generate M3U8 playlist
            m3u8_content = generate_m3u8_playlist(hls_data["tracks"])
            
            return {
                "success": True,
                "m3u8_content": m3u8_content,
                "playlist_name": hls_data.get("playlist_name", "Unknown Playlist"),
                "track_count": len(hls_data["tracks"])
            }
            
        except Exception as e:
            print(f"Error in playlist service get HLS data: {e}")
            return {
                "success": False,
                "error": "An error occurred while generating HLS playlist"
            }

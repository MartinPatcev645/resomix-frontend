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

import httpx
import json
import urllib.parse
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.playlist_repository import PlaylistRepository
from app.services.metadata_service import MetadataService
from app.utils.hls_utils import generate_m3u8_playlist
from app.core.config import settings


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

    async def _call_media_server(self, endpoint: str, data: Optional[Dict] = None) -> str:
        """
        Helper function to call the media server for HLS M3U8 generation.
        Returns the M3U8 content as string or raises exception on error.
        """
        if not settings.hls_media_base_url:
            raise ValueError("HLS media base URL not configured")
        
        # Build target URL
        base_url = settings.hls_media_base_url.rstrip("/")
        target_url = f"{base_url}{endpoint}"
        
        # Add API key as query parameter
        url_parts = list(urllib.parse.urlparse(target_url))
        query = dict(urllib.parse.parse_qsl(url_parts[4]))
        query.update({"api_key": settings.api_key})
        url_parts[4] = urllib.parse.urlencode(query)
        signed_url = urllib.parse.urlunparse(url_parts)
        
        print(f"Calling media server: {signed_url} with data: {data}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    signed_url,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.apple.mpegurl",
                    },
                    content=json.dumps(data) if data else None,
                )
                response.raise_for_status()
                return response.text
            except httpx.HTTPStatusError as e:
                print(f"HTTP error calling media server {signed_url}: {e.response.status_code} - {e.response.text}")
                raise ValueError(f"Media server HTTP error: {e.response.status_code}")
            except httpx.RequestError as e:
                print(f"Request error calling media server {signed_url}: {e}")
                raise ValueError(f"Could not connect to media server: {e}")
            except Exception as e:
                print(f"Generic error calling media server {signed_url}: {e}")
                raise ValueError(f"An unexpected error occurred: {e}")

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
        Get playlist as HLS M3U8 format by calling media server.
        Only works with public playlists.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with M3U8 content or error
        """
        try:
            # Get playlist tracks with metadata (includes public check)
            hls_data = await self.playlist_repository.async_get_playlist_hls_data(db, playlist_uuid)
            
            if not hls_data:
                return {"success": False, "error": "Playlist not found"}

            tracks = hls_data.get("tracks", [])
            if not tracks:
                return {"success": False, "error": "Playlist has no tracks"}

            # Extract ordered UUIDs (seed track first, then similar tracks by position)
            uuid_list = [track.get("uuid") for track in tracks if track.get("uuid")]
            
            # Call media server to generate segmented M3U8
            m3u8_content = await self._call_media_server("/hls-m3u8/", {"uuids": uuid_list})
            
            return {
                "success": True,
                "m3u8_content": m3u8_content,
                "playlist_name": hls_data.get("playlist_name", "Unknown Playlist"),
                "track_count": len(uuid_list)
            }
            
        except Exception as e:
            print(f"Error in playlist service get HLS data: {e}")
            return {
                "success": False,
                "error": "An error occurred while generating HLS playlist"
            }

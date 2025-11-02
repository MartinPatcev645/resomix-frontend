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
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.services.metadata_service import MetadataService
from app.utils.hls_utils import generate_m3u8_playlist
from app.core.config import settings


class PlaylistService:
    """Service for playlist-related operations."""
    
    def __init__(self):
        """Initialize playlist service."""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
    
    async def rename_playlist(self, db: AsyncSession, playlist_uuid: str, new_name: str) -> Dict[str, Any]:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            
        Returns:
            Dictionary with success status, message, and old_name
        """
        try:
            result = await self.playlist_repository.async_rename_playlist(db, playlist_uuid, new_name)
            
            if result["success"]:
                return {
                    "success": True,
                    "message": "Playlist renamed successfully",
                    "old_name": result["old_name"]
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found",
                    "old_name": None
                }
                
        except Exception as e:
            print(f"Error in playlist service rename: {e}")
            return {
                "success": False,
                "error": "An error occurred while renaming the playlist",
                "old_name": None
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
        
        print(f"Calling media server: {signed_url}")
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    signed_url,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.apple.mpegurl",
                        "Origin": "https://bserver.resomix.com",
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

    async def get_playlist_similarity_data(self, db: AsyncSession, playlist_uuid: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get playlist with similarity data formatted like similarity endpoints.
        Only returns data for public playlists, or private playlists if user is the owner.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            user_id: Optional user ID - if provided, allows access to user's own private playlists
            
        Returns:
            Dictionary with similarity-formatted data or error
        """
        try:
            similarity_data = await self.playlist_repository.async_get_playlist_similarity_data(db, playlist_uuid, user_id=user_id)
            
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
    
    async def fork_playlist(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Fork (copy) a public playlist for a user.
        
        Args:
            db: Database session
            playlist_uuid: UUID of the playlist to fork
            user_id: ID of the user forking the playlist
            
        Returns:
            Dictionary with success status and forked playlist data or error message
        """
        try:
            # Call repository method
            result = await self.playlist_repository.async_fork_playlist(db, playlist_uuid, user_id)
            
            # Handle response cases
            if result is None:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            elif isinstance(result, dict) and result.get("error") == "not_public":
                return {
                    "success": False,
                    "error": "Cannot fork private playlists. Only public playlists can be forked."
                }
            elif isinstance(result, dict) and result.get("error") == "already_owner":
                return {
                    "success": False,
                    "error": "You already own this playlist. No need to fork it."
                }
            else:
                # Valid data returned - apply metadata filtering
                filtered_data = self._apply_playlist_response_filtering(result)
                return {
                    "success": True,
                    "data": filtered_data
                }
                
        except Exception as e:
            print(f"Error in playlist service fork playlist: {e}")
            return {
                "success": False,
                "error": "An error occurred while forking the playlist"
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
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_playlist_list_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get paginated playlist list for admin with filters.
        
        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            
        Returns:
            Dictionary with success status and playlist data
        """
        try:
            result = await self.playlist_repository.async_get_playlist_list_admin(db, filters)
            return {
                "success": True,
                **result
            }
        except Exception as e:
            print(f"Error getting playlist list for admin: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlists"
            }
    
    async def delete_playlist_admin(
        self,
        db: AsyncSession,
        playlist_id: int
    ) -> Dict[str, Any]:
        """
        Delete a playlist by ID.
        
        Args:
            db: Database session
            playlist_id: Playlist ID to delete
            
        Returns:
            Dictionary with success status and message
        """
        try:
            deleted = await self.playlist_repository.async_delete_playlist_admin(db, playlist_id)
            
            if deleted:
                return {
                    "success": True,
                    "message": "Playlist deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error deleting playlist: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the playlist"
            }
    
    async def batch_delete_playlists_admin(
        self,
        db: AsyncSession,
        playlist_ids: list
    ) -> Dict[str, Any]:
        """
        Delete multiple playlists.
        
        Args:
            db: Database session
            playlist_ids: List of playlist IDs to delete
            
        Returns:
            Dictionary with success status, count, and message
        """
        try:
            deleted_count = await self.playlist_repository.async_batch_delete_playlists_admin(
                db, playlist_ids
            )
            
            if deleted_count > 0:
                message = f"Successfully deleted {deleted_count} playlist{'s' if deleted_count > 1 else ''}"
            else:
                message = "No playlists were deleted"
            
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": message
            }
            
        except Exception as e:
            print(f"Error batch deleting playlists: {e}")
            return {
                "success": False,
                "error": "An error occurred while batch deleting playlists"
            }
    
    async def change_playlist_visibility_admin(
        self,
        db: AsyncSession,
        playlist_id: int,
        is_public: bool
    ) -> Dict[str, Any]:
        """
        Change playlist visibility by ID (admin).
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            is_public: Whether to make the playlist public
            
        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.playlist_repository.async_change_playlist_visibility_by_id(
                db, playlist_id, is_public
            )
            
            if success:
                visibility = "public" if is_public else "private"
                return {
                    "success": True,
                    "message": f"Playlist made {visibility} successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error changing playlist visibility: {e}")
            return {
                "success": False,
                "error": "An error occurred while changing playlist visibility"
            }
    
    async def batch_change_playlist_visibility_admin(
        self,
        db: AsyncSession,
        playlist_ids: List[int],
        is_public: bool
    ) -> Dict[str, Any]:
        """
        Change visibility for multiple playlists (admin).
        
        Args:
            db: Database session
            playlist_ids: List of playlist IDs to update
            is_public: Whether to make the playlists public
            
        Returns:
            Dictionary with success status, updated count, and message
        """
        try:
            updated_count = await self.playlist_repository.async_batch_change_playlist_visibility(
                db, playlist_ids, is_public
            )
            
            total_requested = len(playlist_ids)
            
            if updated_count == total_requested:
                message = f"Successfully updated {updated_count} playlist{'s' if updated_count > 1 else ''}"
            elif updated_count > 0:
                message = f"Updated {updated_count} out of {total_requested} playlists. {total_requested - updated_count} not found."
            else:
                message = "No playlists were updated. None of the provided IDs were found."
            
            return {
                "success": True,
                "updated_count": updated_count,
                "message": message
            }
            
        except Exception as e:
            print(f"Error batch changing playlist visibility: {e}")
            return {
                "success": False,
                "error": "An error occurred while batch changing playlist visibility",
                "updated_count": 0
            }
    
    async def export_playlists_csv_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Export playlists to CSV.
        
        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            
        Returns:
            Dictionary with download URL, filename, and expiry
        """
        try:
            import csv
            import os
            from datetime import datetime, timedelta
            
            # Get all playlists matching filters
            playlists = await self.playlist_repository.async_get_all_playlists_for_export(
                db, filters
            )
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"playlist_export_{timestamp}.csv"
            
            # Ensure exports directory exists
            exports_dir = os.path.join("exports")
            os.makedirs(exports_dir, exist_ok=True)
            
            filepath = os.path.join(exports_dir, filename)
            
            # Write CSV with UTF-8 BOM for Excel compatibility
            with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                # Write header
                writer.writerow([
                    'ID', 'UUID', 'User ID', 'Name', 
                    'Visibility', 'Type', 'Seed Track ID', 'Fork ID', 'Forked At', 'Fork Count', 'Created At'
                ])
                
                # Write data
                for playlist in playlists:
                    writer.writerow([
                        playlist.get('id', ''),
                        playlist.get('uuid', ''),
                        playlist.get('user_id', ''),
                        playlist.get('name', ''),
                        playlist.get('is_public', ''),
                        playlist.get('type', ''),
                        playlist.get('seed_track_id', ''),
                        playlist.get('fork_id', ''),
                        playlist.get('forked_at', ''),
                        playlist.get('fork_count', ''),
                        playlist.get('created_at', '')
                    ])
            
            # Generate download URL (expires in 1 hour)
            download_url = f"/exports/{filename}"
            expires_at = (datetime.now() + timedelta(hours=1)).isoformat()
            
            return {
                "success": True,
                "download_url": download_url,
                "filename": filename,
                "expires_at": expires_at
            }
            
        except Exception as e:
            print(f"Error exporting playlists to CSV: {e}")
            return {
                "success": False,
                "error": "An error occurred while exporting playlists"
            }
    
    async def get_playlist_detail_by_uuid_admin(
        self,
        db: AsyncSession,
        playlist_uuid: str
    ) -> Dict[str, Any]:
        """
        Get detailed playlist information by UUID for admin.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with success status and playlist details
        """
        try:
            # Validate UUID format
            import re
            uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            if not re.match(uuid_pattern, playlist_uuid.lower()):
                return {
                    "success": False,
                    "error": "Invalid playlist UUID format"
                }
            
            result = await self.playlist_repository.async_get_playlist_detail_by_uuid_admin(
                db, playlist_uuid
            )
            
            if result:
                return {
                    "success": True,
                    "data": result
                }
            else:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
                
        except Exception as e:
            print(f"Error getting playlist detail by UUID: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlist details"
            }

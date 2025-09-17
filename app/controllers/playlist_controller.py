"""
Playlist Controller
===================

This controller handles HTTP requests for playlist management functionality.
It processes playlist operations including rename, visibility changes, and
similarity data retrieval with proper validation and response formatting.

Manages playlist-related API endpoints and coordinates with playlist service
for business logic execution.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.playlist_service import PlaylistService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class PlaylistController:
    """Controller for playlist-related HTTP requests."""
    
    def __init__(self):
        """Initialize playlist controller."""
        self.playlist_service = PlaylistService()
    
    async def rename_playlist(self, db: AsyncSession, playlist_id: str, new_name: str) -> JSONResponse:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
            new_name: New playlist name
            
        Returns:
            JSON response with operation result
        """
        log_request("rename_playlist", "PUT", {"playlist_id": playlist_id, "new_name": new_name})
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        if not new_name or not new_name.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="new_name cannot be empty"
                )
            )
        
        try:
            result = await self.playlist_service.rename_playlist(db, playlist_id, new_name.strip())
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            print(f"Error in playlist controller rename: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while renaming the playlist"
                )
            )
    
    async def change_playlist_visibility(self, db: AsyncSession, playlist_id: str, is_public: bool) -> JSONResponse:
        """
        Change playlist visibility (public/private).
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
            is_public: Whether to make the playlist public
            
        Returns:
            JSON response with operation result
        """
        log_request("change_playlist_visibility", "PUT", {"playlist_id": playlist_id, "is_public": is_public})
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        try:
            result = await self.playlist_service.change_playlist_visibility(db, playlist_id, is_public)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            print(f"Error in playlist controller visibility change: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while changing playlist visibility"
                )
            )
    
    async def get_playlist_similarity_data(self, db: AsyncSession, playlist_id: str) -> JSONResponse:
        """
        Get playlist with similarity data.
        Only returns data for public playlists.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
            
        Returns:
            JSON response with similarity data
        """
        log_request("get_playlist_similarity_data", "GET", {"playlist_id": playlist_id})
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        try:
            result = await self.playlist_service.get_playlist_similarity_data(db, playlist_id)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            elif "not public" in result.get("error", "").lower():
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=result
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            print(f"Error in playlist controller get similarity data: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving playlist data"
                )
            )
    
    async def get_playlist_hls_data(self, db: AsyncSession, playlist_id: str) -> Response:
        """
        Get playlist as HLS M3U8 format.
        Only returns data for public playlists.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID
            
        Returns:
            Response with M3U8 content or error
        """
        log_request("get_playlist_hls_data", "GET", {"playlist_id": playlist_id})
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        try:
            result = await self.playlist_service.get_playlist_hls_data(db, playlist_id)
            
            if result.get("success"):
                # Return M3U8 content with proper MIME type and CORS headers
                response = Response(
                    content=result["m3u8_content"],
                    media_type="application/vnd.apple.mpegurl",
                    status_code=status.HTTP_200_OK
                )
                # Add CORS headers
                response.headers["Access-Control-Allow-Origin"] = "*"
                response.headers["Cache-Control"] = "no-store"
                return response
            elif "not public" in result.get("error", "").lower():
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            print(f"Error in playlist controller get HLS data: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while generating HLS playlist"
                )
            )

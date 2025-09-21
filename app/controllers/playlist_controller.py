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

from fastapi import status, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.services.playlist_service import PlaylistService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response


class PlaylistController:
    """Controller for playlist-related HTTP requests."""
    
    def __init__(self):
        """Initialize playlist controller."""
        self.playlist_service = PlaylistService()
        self.logging_service = LoggingService()
    
    async def rename_playlist(self, db: AsyncSession, request: Request, playlist_id: str, new_name: str) -> JSONResponse:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist UUID
            new_name: New playlist name
            
        Returns:
            JSON response with operation result
        """
        import time
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            # Log validation failure
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_user_action(
                db=db,
                action="rename_playlist_validation_failed",
                message="Playlist rename failed: empty playlist_id",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={"error": "playlist_id cannot be empty"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id cannot be empty"
                )
            )
        
        if not new_name or not new_name.strip():
            # Log validation failure
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_user_action(
                db=db,
                action="rename_playlist_validation_failed",
                message="Playlist rename failed: empty new_name",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={"error": "new_name cannot be empty"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="new_name cannot be empty"
                )
            )
        
        try:
            # First, get the playlist to obtain the integer ID for logging
            playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist.id if playlist else None
            
            result = await self.playlist_service.rename_playlist(db, playlist_id, new_name.strip())
            
            # Calculate operation duration
            duration_ms = (time.time() - start_time) * 1000
            
            if result.get("success"):
                # Log successful rename - use integer ID for foreign key
                self.logging_service.log_user_action(
                    db=db,
                    action="rename_playlist_success",
                    message=f"Playlist renamed successfully: {playlist_id} -> {new_name.strip()}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={"old_name": result.get("old_name"), "new_name": new_name.strip()}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                # Log playlist not found - use integer ID for foreign key (may be None)
                self.logging_service.log_user_action(
                    db=db,
                    action="rename_playlist_not_found",
                    message=f"Playlist rename failed: playlist not found {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={"error": result.get("error")}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            # Log error with full context - use integer ID if available
            duration_ms = (time.time() - start_time) * 1000
            playlist_int_id = None
            try:
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
                playlist_int_id = playlist.id if playlist else None
            except:
                pass  # Ignore errors when getting playlist for logging
                
            self.logging_service.log_error(
                db=db,
                error=e,
                context="playlist rename operation",
                correlation_id=correlation_id,
                request=request,
                playlist_id=playlist_int_id,
                metadata={"playlist_uuid": playlist_id, "new_name": new_name, "duration_ms": duration_ms}
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An error occurred while renaming the playlist"
                )
            )
    
    async def change_playlist_visibility(self, db: AsyncSession, request: Request, playlist_id: str, is_public: bool) -> JSONResponse:
        """
        Change playlist visibility (public/private).
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist UUID
            is_public: Whether to make the playlist public
            
        Returns:
            JSON response with operation result
        """
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            # Log validation failure
            self.logging_service.log_user_action(
                db=db,
                action="change_visibility_validation_failed",
                message="Playlist visibility change failed: empty playlist_id",
                correlation_id=correlation_id,
                metadata={"error": "playlist_id cannot be empty"}
            )
            
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
                # Log successful visibility change
                self.logging_service.log_user_action(
                    db=db,
                    action="change_playlist_visibility_success",
                    message=f"Playlist visibility changed successfully: {playlist_id} -> {'public' if is_public else 'private'}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"is_public": is_public, "previous_visibility": result.get("previous_visibility")}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                # Log playlist not found
                self.logging_service.log_user_action(
                    db=db,
                    action="change_visibility_not_found",
                    message=f"Playlist visibility change failed: playlist not found {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"error": result.get("error")}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            # Log error with full context
            self.logging_service.log_error(
                db=db,
                error=e,
                context="playlist visibility change operation",
                correlation_id=correlation_id,
                request=request,
                playlist_id=playlist_id,
                metadata={
                    "playlist_id": playlist_id,
                    "is_public": is_public,
                    "operation": "change_playlist_visibility"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while changing playlist visibility"
                )
            )

    async def get_playlist_similarity_data(self, db: AsyncSession, request: Request, playlist_id: str) -> JSONResponse:
        """
        Get playlist with similarity data.
        Only returns data for public playlists.
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist UUID
            
        Returns:
            JSON response with similarity data
        """
        correlation_id = self.logging_service.generate_correlation_id()
        
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
                # Log successful access
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_similarity_data_success",
                    message=f"User accessed playlist similarity data: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            elif "not public" in result.get("error", "").lower():
                # Log access denied due to privacy
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_similarity_data_forbidden",
                    message=f"Access denied to private playlist: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"error": "playlist_not_public"}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=result
                )
            else:
                # Log not found
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_similarity_data_not_found",
                    message=f"Playlist not found: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"error": result.get("error")}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            # Log error with full context
            self.logging_service.log_error(
                db=db,
                error=e,
                context="get playlist similarity data",
                correlation_id=correlation_id,
                request=request,
                playlist_id=playlist_id,
                metadata={"operation": "get_playlist_similarity_data"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving playlist data"
                )
            )

    async def get_playlist_hls_data(self, db: AsyncSession, request: Request, playlist_id: str) -> Response:
        """
        Get playlist as HLS M3U8 format.
        Only returns data for public playlists.
        
        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist UUID
            
        Returns:
            Response with M3U8 content or error
        """
        correlation_id = self.logging_service.generate_correlation_id()
        
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
                # Log successful HLS access
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_hls_data_success",
                    message=f"User accessed playlist HLS data: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id
                )
                
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
                # Log access denied
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_hls_data_forbidden",
                    message=f"Access denied to private playlist HLS: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"error": "playlist_not_public"}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
            else:
                # Log not found
                self.logging_service.log_user_action(
                    db=db,
                    action="get_playlist_hls_data_not_found",
                    message=f"Playlist not found for HLS: {playlist_id}",
                    correlation_id=correlation_id,
                    playlist_id=playlist_id,
                    metadata={"error": result.get("error")}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            # Log error with full context
            self.logging_service.log_error(
                db=db,
                error=e,
                context="get playlist HLS data",
                correlation_id=correlation_id,
                request=request,
                playlist_id=playlist_id,
                metadata={"operation": "get_playlist_hls_data"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while generating HLS playlist"
                )
            )

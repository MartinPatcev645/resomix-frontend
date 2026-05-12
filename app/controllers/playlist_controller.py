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
from typing import Optional, List
import time
from app.services.playlist_service import PlaylistService
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.services.operation_limit_evaluator import OperationLimitEvaluator
from app.services.logging_service import LoggingService
from app.utils.demo_mode_utils import apply_demo_mode_redaction
from app.utils.response_utils import format_response
from app.models.user import User
from app.core.config import settings


class PlaylistController:
    """Controller for playlist-related HTTP requests."""

    def __init__(self):
        """Initialize playlist controller."""
        self.playlist_service = PlaylistService()
        self.logging_service = LoggingService()
        self.operation_limit_evaluator = OperationLimitEvaluator()
        self.operation_limit_repository = OperationLimitRepository()

    async def rename_playlist(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        new_name: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            # Log validation failure
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="playlist_id cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="rename_playlist_validation_failed",
                message="Playlist rename failed: empty playlist_id provided",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "error": "playlist_id cannot be empty",
                    "validation_step": "playlist_id_check",
                    "new_name": new_name,
                    "response": response_data,
                    "operation": "playlist_rename",
                },
            )

            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )

        if not new_name or not new_name.strip():
            # Log validation failure
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="new_name cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="rename_playlist_validation_failed",
                message="Playlist rename failed: empty new_name provided",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "error": "new_name cannot be empty",
                    "validation_step": "new_name_check",
                    "playlist_id": playlist_id,
                    "response": response_data,
                    "operation": "playlist_rename",
                },
            )

            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )

        try:
            # Extract partner_id from request state (set by get_current_partner dependency)
            partner_id = getattr(request.state, "partner_id", None)

            # First, get the playlist to obtain the integer ID for logging
            playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                db, playlist_id, partner_id=partner_id
            )
            playlist_int_id = playlist.id if playlist else None

            result = await self.playlist_service.rename_playlist(
                db, playlist_id, new_name.strip(), partner_id=partner_id
            )

            # Calculate operation duration
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                # Log successful rename - use integer ID for foreign key
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="rename_playlist_success",
                    message=f"Playlist renamed successfully: {playlist_id} -> {new_name.strip()}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "old_name": result.get("old_name"),
                        "new_name": new_name.strip(),
                        "response": result,
                        "operation": "playlist_rename",
                    },
                )

                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                # Log playlist not found - use integer ID for foreign key (may be None)
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="rename_playlist_not_found",
                    message=f"Playlist rename failed: playlist not found {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "new_name": new_name.strip(),
                        "error": result.get("error"),
                        "response": result,
                        "operation": "playlist_rename",
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=result
                )

        except Exception as e:
            # Log error with full context - use integer ID if available
            duration_ms = (time.time() - start_time) * 1000
            playlist_int_id = None
            try:
                partner_id = getattr(request.state, "partner_id", None)
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, playlist_id, partner_id=partner_id
                )
                playlist_int_id = playlist.id if playlist else None
            except Exception:
                pass  # Ignore errors when getting playlist for logging

            response_data = format_response(
                success=False, error="An error occurred while renaming the playlist"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="rename_playlist_exception",
                message="Exception occurred during playlist rename operation",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="playlist rename operation",
                playlist_id=playlist_int_id,
                metadata={
                    "playlist_uuid": playlist_id,
                    "playlist_int_id": playlist_int_id,
                    "new_name": new_name,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "playlist_rename",
                },
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    async def change_playlist_visibility(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        is_public: bool,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="playlist_id cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="change_visibility_validation_failed",
                message="Playlist visibility change failed: empty playlist_id provided",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "error": "playlist_id cannot be empty",
                    "validation_step": "playlist_id_check",
                    "is_public": is_public,
                    "response": response_data,
                    "operation": "playlist_visibility_change",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )

        try:
            # Extract partner_id from request state
            partner_id = getattr(request.state, "partner_id", None)

            result = await self.playlist_service.change_playlist_visibility(
                db, playlist_id, is_public, partner_id=partner_id
            )
            duration_ms = (time.time() - start_time) * 1000
            playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                db, playlist_id, partner_id=partner_id
            )
            playlist_int_id = playlist.id if playlist else None

            if result.get("success"):
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="change_playlist_visibility_success",
                    message=f"Playlist visibility changed successfully: {playlist_id} -> {'public' if is_public else 'private'}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "is_public": is_public,
                        "previous_visibility": result.get("previous_visibility"),
                        "visibility_change": f"{'private' if result.get('previous_visibility') else 'unknown'} -> {'public' if is_public else 'private'}",
                        "response": result,
                        "operation": "playlist_visibility_change",
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="change_visibility_not_found",
                    message=f"Playlist visibility change failed: playlist not found {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "is_public": is_public,
                        "error": result.get("error"),
                        "response": result,
                        "operation": "playlist_visibility_change",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=result
                )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while changing playlist visibility",
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="change_playlist_visibility_exception",
                message="Exception occurred during playlist visibility change operation",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="playlist visibility change operation",
                playlist_id=None,
                metadata={
                    "playlist_uuid": playlist_id,
                    "is_public": is_public,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "playlist_visibility_change",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    async def get_playlist_similarity_data(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Validate inputs
        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="playlist_id cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="get_playlist_similarity_data_validation_failed",
                message="Get playlist similarity data failed: playlist_id cannot be empty",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "error": "playlist_id cannot be empty",
                    "validation_step": "playlist_id_check",
                    "response": response_data,
                    "operation": "get_playlist_similarity_data",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )

        try:
            # Extract partner_id from request state
            partner_id = getattr(request.state, "partner_id", None)

            result = await self.playlist_service.get_playlist_similarity_data(
                db,
                playlist_id,
                current_user.id if current_user else None,
                partner_id=partner_id,
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                if settings.demo_mode:
                    apply_demo_mode_redaction(result)
                # Extract playlist integer ID if available
                playlist_int_id = None
                try:
                    playlist_data = result.get("data", {})
                    playlist_int_id = (
                        playlist_data.get("id")
                        if isinstance(playlist_data.get("id"), int)
                        else None
                    )
                except Exception:
                    pass

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="get_playlist_similarity_data_success",
                    message=f"User accessed playlist similarity data: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "tracks_count": (
                            len(result.get("data", {}).get("tracks", []))
                            if result.get("data")
                            else 0
                        ),
                        "response": result,
                        "operation": "get_playlist_similarity_data",
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            elif "not public" in result.get("error", "").lower():
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_playlist_similarity_data_forbidden",
                    message=f"Access denied to private playlist: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=403,
                    playlist_id=None,  # Don't have access to get the integer ID for private playlists
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "error": "playlist_not_public",
                        "access_denied_reason": "private_playlist",
                        "response": result,
                        "operation": "get_playlist_similarity_data",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN, content=result
                )
            else:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_playlist_similarity_data_not_found",
                    message=f"Playlist not found: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    playlist_id=None,  # Playlist doesn't exist so no integer ID
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                        "response": result,
                        "operation": "get_playlist_similarity_data",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=result
                )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while retrieving playlist data",
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_playlist_similarity_data_exception",
                message="Exception occurred while retrieving playlist similarity data",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get playlist similarity data",
                playlist_id=None,  # Don't try to parse UUID as integer
                metadata={
                    "playlist_uuid": playlist_id,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "get_playlist_similarity_data",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    async def get_playlist_hls_data(
        self, db: AsyncSession, request: Request, playlist_id: str, current_user: User
    ) -> Response:
        """
        Get playlist as HLS M3U8 format.
        Only returns data for public playlists.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="playlist_id cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="get_playlist_hls_data_validation_failed",
                message="Get playlist HLS data failed: playlist_id cannot be empty",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "error": "playlist_id cannot be empty",
                    "validation_step": "playlist_id_check",
                    "response": response_data,
                    "operation": "get_playlist_hls_data",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )
        try:
            # Extract partner_id from request state
            partner_id = getattr(request.state, "partner_id", None)

            # Extract Edge Authorization token if present (to propagate to manifest segments)
            # Use getlist and index 0 to strictly take the first token if multiple are provided
            all_tokens = request.query_params.getlist("token")
            token = all_tokens[0] if all_tokens else None
            
            result = await self.playlist_service.get_playlist_hls_data(db, playlist_id, token, partner_id=partner_id)
            duration_ms = (time.time() - start_time) * 1000
            if result.get("success"):
                # Extract playlist integer ID if available
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, playlist_id, partner_id=partner_id
                )
                playlist_int_id = playlist.id if playlist else None

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="get_playlist_hls_data_success",
                    message=f"User accessed playlist HLS data: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    playlist_id=playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "playlist_int_id": playlist_int_id,
                        "m3u8_content_length": len(result.get("m3u8_content", "")),
                        "tracks_count": result.get("tracks_count", 0),
                        "media_type": "application/vnd.apple.mpegurl",
                        "operation": "get_playlist_hls_data",
                    },
                )
                response = Response(
                    content=result["m3u8_content"],
                    media_type="application/vnd.apple.mpegurl",
                    status_code=status.HTTP_200_OK,
                )
                response.headers["Access-Control-Allow-Origin"] = "*"
                response.headers["Cache-Control"] = "no-store"
                return response
            elif "not public" in result.get("error", "").lower():
                response_data = format_response(
                    success=False, error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_playlist_hls_data_forbidden",
                    message=f"Access denied to private playlist HLS: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=403,
                    playlist_id=None,  # Don't have access to get the integer ID for private playlists
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "error": "playlist_not_public",
                        "access_denied_reason": "private_playlist",
                        "media_type": "application/vnd.apple.mpegurl",
                        "response": response_data,
                        "operation": "get_playlist_hls_data",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN, content=response_data
                )
            else:
                response_data = format_response(
                    success=False, error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_playlist_hls_data_not_found",
                    message=f"Playlist not found for HLS: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    playlist_id=None,  # Playlist doesn't exist so no integer ID
                    duration_ms=duration_ms,
                    metadata={
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                        "media_type": "application/vnd.apple.mpegurl",
                        "response": response_data,
                        "operation": "get_playlist_hls_data",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=response_data
                )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while generating HLS playlist",
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_playlist_hls_data_exception",
                message="Exception occurred while generating playlist HLS data",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get playlist HLS data",
                playlist_id=None,  # Don't try to parse UUID as integer
                metadata={
                    "playlist_uuid": playlist_id,
                    "error_type": type(e).__name__,
                    "media_type": "application/vnd.apple.mpegurl",
                    "response": response_data,
                    "operation": "get_playlist_hls_data",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    async def fork_playlist(
        self, db: AsyncSession, request: Request, playlist_id: str, current_user: User
    ) -> JSONResponse:
        """
        Fork (copy) a public playlist for a user.

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: UUID of the playlist to fork
            current_user: Authenticated user object

        Returns:
            JSON response with forked playlist data or error message
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Validate input
        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False, error="playlist_id cannot be empty"
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="fork_playlist_validation_failed",
                message="Fork playlist failed: playlist_id cannot be empty",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "user_uuid": current_user.uuid,
                    "original_playlist_uuid": playlist_id,
                    "error": "playlist_id cannot be empty",
                    "validation_step": "playlist_id_check",
                    "response": response_data,
                    "operation": "playlist_fork",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data
            )

        # Check operation limits before forking
        limit_check = await self.operation_limit_evaluator.check(
            db,
            user_id=current_user.id,
            operation_code="playlist_create",
        )
        if not limit_check.allowed:
            response_data = format_response(
                success=False,
                error=limit_check.message or "Operation not permitted",
            )
            return JSONResponse(
                status_code=limit_check.status_code,
                content=response_data,
            )

        try:
            # Call service layer
            result = await self.playlist_service.fork_playlist(
                db, playlist_id, current_user.id
            )

            duration_ms = (time.time() - start_time) * 1000

            # Handle success response
            if result.get("success"):
                # Extract playlist integer ID from result data for logging
                new_playlist_uuid = result.get("data", {}).get("playlist", {}).get("id")
                track_count = len(result.get("data", {}).get("similar_tracks", []))

                # Get new playlist integer ID for logging
                new_playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, new_playlist_uuid
                )
                new_playlist_int_id = new_playlist.id if new_playlist else None

                # Get original playlist integer ID for logging
                original_playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(
                    db, playlist_id
                )
                original_playlist_int_id = (
                    original_playlist.id if original_playlist else None
                )

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="fork_playlist_success",
                    message=f"User forked playlist successfully: {playlist_id} -> {new_playlist_uuid}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=201,
                    playlist_id=new_playlist_int_id,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "original_playlist_uuid": playlist_id,
                        "new_playlist_uuid": new_playlist_uuid,
                        "original_playlist_int_id": original_playlist_int_id,
                        "new_playlist_int_id": new_playlist_int_id,
                        "track_count": track_count,
                        "operation": "playlist_fork",
                        "response": result,
                    },
                )
                # Increment operation usage for playlist_create on successful fork
                try:
                    await self.operation_limit_repository.async_increment_usage(
                        db,
                        user_id=current_user.id,
                        operation_code="playlist_create",
                        increment=1,
                    )
                except Exception:
                    pass
                return JSONResponse(status_code=status.HTTP_201_CREATED, content=result)

            # Handle error responses
            error_message = result.get("error", "")

            if "not found" in error_message.lower():
                response_data = format_response(success=False, error=error_message)
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="fork_playlist_not_found",
                    message=f"Fork playlist failed: playlist not found: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "original_playlist_uuid": playlist_id,
                        "error": error_message,
                        "response": response_data,
                        "operation": "playlist_fork",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=response_data
                )

            elif (
                "private" in error_message.lower() or "public" in error_message.lower()
            ):
                response_data = format_response(success=False, error=error_message)
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="fork_playlist_forbidden",
                    message=f"Fork playlist failed: private playlist: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=403,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "original_playlist_uuid": playlist_id,
                        "error": error_message,
                        "response": response_data,
                        "operation": "playlist_fork",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN, content=response_data
                )

            elif "already own" in error_message.lower():
                response_data = format_response(success=False, error=error_message)
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="fork_playlist_already_owner",
                    message=f"Fork playlist failed: user already owns playlist: {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=400,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "original_playlist_uuid": playlist_id,
                        "error": error_message,
                        "response": response_data,
                        "operation": "playlist_fork",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response_data
                )

            else:
                # Generic error
                response_data = format_response(success=False, error=error_message)
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ERROR",
                    action="fork_playlist_failed",
                    message=f"Fork playlist failed: {error_message}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "original_playlist_uuid": playlist_id,
                        "error": error_message,
                        "response": response_data,
                        "operation": "playlist_fork",
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data,
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while forking the playlist",
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="fork_playlist_exception",
                message="Exception occurred while forking playlist",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="fork playlist",
                metadata={
                    "user_id": current_user.id,
                    "user_uuid": current_user.uuid,
                    "original_playlist_uuid": playlist_id,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "playlist_fork",
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    # ============================================================================
    # Admin Methods
    # ============================================================================

    async def get_playlist_list_admin(
        self, db: AsyncSession, request: Request, filters: dict
    ) -> JSONResponse:
        """
        Get paginated playlist list for admin.

        Args:
            db: Database session
            request: FastAPI Request object
            filters: Dictionary containing filter parameters

        Returns:
            JSON response with playlist list and pagination
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.get_playlist_list_admin(db, filters)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "data": result.get("data", []),
                    "pagination": result.get("pagination", {}),
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="get_playlist_list_admin",
                    message="Admin retrieved playlist list successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist list",
                    metadata={
                        "filters": filters,
                        "result_count": len(result.get("data", [])),
                        "total": result.get("pagination", {}).get("total", 0),
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error")
                )

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ADMIN",
                    action="get_playlist_list_admin_failed",
                    message="Failed to retrieve playlist list for admin",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    context="admin playlist list",
                    metadata={"filters": filters, "error": result.get("error")},
                )

                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_content,
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while retrieving playlists",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_playlist_list_admin_exception",
                message="Exception occurred while retrieving playlist list",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist list",
                metadata={
                    "filters": filters,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def delete_playlist_admin(
        self, db: AsyncSession, request: Request, playlist_id: int
    ) -> JSONResponse:
        """
        Delete a single playlist.

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist ID to delete

        Returns:
            JSON response with deletion result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.delete_playlist_admin(db, playlist_id)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "data": {
                        "message": result.get(
                            "message", "Playlist deleted successfully"
                        )
                    },
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="delete_playlist_admin",
                    message=f"Admin deleted playlist ID {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist delete",
                    playlist_id=playlist_id,
                    metadata={"playlist_id": playlist_id},
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                # Playlist not found
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error", "Playlist not found")
                )

                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN",
                    action="delete_playlist_admin_not_found",
                    message=f"Playlist ID {playlist_id} not found for deletion",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    context="admin playlist delete",
                    metadata={"playlist_id": playlist_id},
                )

                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=response_content
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while deleting the playlist",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="delete_playlist_admin_exception",
                message="Exception occurred while deleting playlist",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist delete",
                metadata={
                    "playlist_id": playlist_id,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def batch_delete_playlist_admin(
        self, db: AsyncSession, request: Request, playlist_ids: list
    ) -> JSONResponse:
        """
        Delete multiple playlists.

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_ids: List of playlist IDs to delete

        Returns:
            JSON response with batch deletion result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.batch_delete_playlists_admin(
                db, playlist_ids
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "deleted_count": result.get("deleted_count", 0),
                    "message": result.get("message", "Playlists deleted successfully"),
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="batch_delete_playlist_admin",
                    message=f"Admin batch deleted {result.get('deleted_count', 0)} playlists",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist batch delete",
                    metadata={
                        "playlist_ids": playlist_ids,
                        "deleted_count": result.get("deleted_count", 0),
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error")
                )

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ADMIN",
                    action="batch_delete_playlist_admin_failed",
                    message="Failed to batch delete playlists",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    context="admin playlist batch delete",
                    metadata={
                        "playlist_ids": playlist_ids,
                        "error": result.get("error"),
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_content,
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while batch deleting playlists",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="batch_delete_playlist_admin_exception",
                message="Exception occurred while batch deleting playlists",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist batch delete",
                metadata={
                    "playlist_ids": playlist_ids,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def change_playlist_visibility_admin(
        self, db: AsyncSession, request: Request, playlist_id: int, is_public: bool
    ) -> JSONResponse:
        """
        Change playlist visibility (admin).

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_id: Playlist ID
            is_public: Whether to make the playlist public

        Returns:
            JSON response with visibility change result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.change_playlist_visibility_admin(
                db, playlist_id, is_public
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "message": result.get(
                        "message", "Playlist visibility changed successfully"
                    ),
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="change_playlist_visibility_admin",
                    message=f"Admin changed visibility of playlist ID {playlist_id} to {'public' if is_public else 'private'}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist visibility change",
                    playlist_id=playlist_id,
                    metadata={"playlist_id": playlist_id, "is_public": is_public},
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                # Playlist not found
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error", "Playlist not found")
                )

                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN",
                    action="change_playlist_visibility_admin_not_found",
                    message=f"Playlist ID {playlist_id} not found for visibility change",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    context="admin playlist visibility change",
                    metadata={"playlist_id": playlist_id, "is_public": is_public},
                )

                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND, content=response_content
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while changing playlist visibility",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="change_playlist_visibility_admin_exception",
                message="Exception occurred while changing playlist visibility",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist visibility change",
                metadata={
                    "playlist_id": playlist_id,
                    "is_public": is_public,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def batch_change_playlist_visibility_admin(
        self,
        db: AsyncSession,
        request: Request,
        playlist_ids: List[int],
        is_public: bool,
    ) -> JSONResponse:
        """
        Change visibility for multiple playlists (admin).

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_ids: List of playlist IDs to update
            is_public: Whether to make the playlists public

        Returns:
            JSON response with batch visibility change result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.batch_change_playlist_visibility_admin(
                db, playlist_ids, is_public
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "updated_count": result.get("updated_count", 0),
                    "message": result.get("message", "Playlists updated successfully"),
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="batch_change_playlist_visibility_admin",
                    message=f"Admin batch changed visibility of {result.get('updated_count', 0)} playlists to {'public' if is_public else 'private'}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist batch visibility change",
                    metadata={
                        "playlist_ids": playlist_ids,
                        "updated_count": result.get("updated_count", 0),
                        "is_public": is_public,
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error")
                )

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ADMIN",
                    action="batch_change_playlist_visibility_admin_failed",
                    message="Failed to batch change playlist visibility",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    context="admin playlist batch visibility change",
                    metadata={
                        "playlist_ids": playlist_ids,
                        "is_public": is_public,
                        "error": result.get("error"),
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_content,
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while batch changing playlist visibility",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="batch_change_playlist_visibility_admin_exception",
                message="Exception occurred while batch changing playlist visibility",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist batch visibility change",
                metadata={
                    "playlist_ids": playlist_ids,
                    "is_public": is_public,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def export_playlist_csv_admin(
        self, db: AsyncSession, request: Request, filters: dict
    ) -> JSONResponse:
        """
        Export playlists to CSV.

        Args:
            db: Database session
            request: FastAPI Request object
            filters: Dictionary containing filter parameters

        Returns:
            JSON response with download URL
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.export_playlists_csv_admin(db, filters)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {
                    "success": True,
                    "download_url": result.get("download_url"),
                    "filename": result.get("filename"),
                    "expires_at": result.get("expires_at"),
                }

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="export_playlist_csv_admin",
                    message="Admin exported playlists to CSV",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist export",
                    metadata={"filters": filters, "filename": result.get("filename")},
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False, error=result.get("error")
                )

                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ADMIN",
                    action="export_playlist_csv_admin_failed",
                    message="Failed to export playlists to CSV",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    context="admin playlist export",
                    metadata={"filters": filters, "error": result.get("error")},
                )

                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_content,
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while exporting playlists",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="export_playlist_csv_admin_exception",
                message="Exception occurred while exporting playlists",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist export",
                metadata={
                    "filters": filters,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def get_playlist_detail_by_uuid_admin(
        self, db: AsyncSession, request: Request, playlist_uuid: str
    ) -> JSONResponse:
        """
        Get detailed playlist information by UUID.

        Args:
            db: Database session
            request: FastAPI Request object
            playlist_uuid: Playlist UUID

        Returns:
            JSON response with playlist details
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            result = await self.playlist_service.get_playlist_detail_by_uuid_admin(
                db, playlist_uuid
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                response_content = {"success": True, "data": result.get("data")}

                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN",
                    action="get_playlist_detail_admin",
                    message=f"Admin retrieved playlist detail for UUID {playlist_uuid}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    context="admin playlist detail",
                    metadata={
                        "playlist_uuid": playlist_uuid,
                        "track_count": result.get("data", {})
                        .get("playlist", {})
                        .get("track_count", 0),
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK, content=response_content
                )
            else:
                error_message = result.get("error", "Playlist not found")
                status_code = (
                    status.HTTP_404_NOT_FOUND
                    if "not found" in error_message.lower()
                    else status.HTTP_400_BAD_REQUEST
                )
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(success=False, error=error_message)

                self.logging_service.log(
                    async_db=db,
                    level="WARNING" if status_code == 404 else "ERROR",
                    category="ADMIN",
                    action="get_playlist_detail_admin_failed",
                    message=f"Failed to retrieve playlist detail: {error_message}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    context="admin playlist detail",
                    metadata={"playlist_uuid": playlist_uuid, "error": error_message},
                )

                return JSONResponse(status_code=status_code, content=response_content)

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback

            response_content = format_response(
                success=False,
                error="An internal server error occurred while retrieving playlist details",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_playlist_detail_admin_exception",
                message="Exception occurred while retrieving playlist detail",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="admin playlist detail",
                metadata={
                    "playlist_uuid": playlist_uuid,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content,
            )

    async def get_all_user_playlists(
        self,
        db: AsyncSession,
        request: Request,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
        filters=None,
    ) -> JSONResponse:
        """
        Get all playlists owned by the authenticated user.

        Args:
            db: Database session
            request: FastAPI Request object
            current_user: Authenticated user object

        Returns:
            JSON response with list of user's playlists
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            # Extract partner_id from request state
            partner_id = getattr(request.state, "partner_id", None)
            result = await self.playlist_service.get_all_user_playlists(
                db, current_user.id, page, page_size, filters, partner_id=partner_id
            )
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="get_all_user_playlists_success",
                    message=f"User retrieved all playlists: {len(result.get('data', []))} playlists",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "user_id": current_user.id,
                        "playlist_count": len(result.get("data", [])),
                        "page": page,
                        "page_size": page_size,
                        "operation": "get_all_user_playlists",
                    },
                )

                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ERROR",
                    action="get_all_user_playlists_failed",
                    message="Failed to retrieve user playlists",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "user_uuid": current_user.uuid,
                        "user_id": current_user.id,
                        "error": result.get("error"),
                        "operation": "get_all_user_playlists",
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=result
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while retrieving playlists",
            )

            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_all_user_playlists_exception",
                message="Exception occurred while retrieving user playlists",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get all user playlists",
                metadata={
                    "user_uuid": current_user.uuid,
                    "user_id": current_user.id,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "get_all_user_playlists",
                },
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data
            )

    async def get_playlist_playback_session(
        self, request: Request, playlist_id: str
    ):
        """
        Evaluate territory restrictions and generate an Edge Authorization session token
        for playing a server-stitched playlist.
        """
        client_ip = request.client.host if request.client else "unknown"
        result = await self.playlist_service.get_playlist_playback_session(playlist_id, client_ip)
        
        if result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"playback_url": result["playback_url"]}
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": result.get("error", "Failed to generate playback session")}
            )

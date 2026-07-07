"""
Playlist Engagement Controller
==============================

This controller handles HTTP requests for playlist engagement functionality.
It processes operations for favorites and follows with proper validation,
logging, and response formatting.

Coordinates with PlaylistEngagementService for business logic execution and
LoggingService for observability.

Version: 3.0.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
import time
from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.playlist_engagement_service import PlaylistEngagementService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.models.user import User


class PlaylistEngagementController:
    """Controller for playlist engagement-related HTTP requests."""

    def __init__(self):
        self.service = PlaylistEngagementService()
        self.logging = LoggingService()

    async def add_favorite(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
        """
        Add a playlist to user's favorites.
        """
        start_time = time.time()
        correlation_id = self.logging.generate_correlation_id()

        # Validate input
        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="playlist_id cannot be empty")
            self.logging.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="playlist_add_favorite_validation_failed",
                message="Add favorite failed: empty playlist_id",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "operation": "add_favorite",
                    "error": "playlist_id cannot be empty",
                    "user_uuid": getattr(current_user, "uuid", None),
                },
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_content)

        try:
            # Pre-fetch playlist integer ID for logging (may be None if not found)
            playlist = await self.service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist.id if playlist else None

            result = await self.service.add_favorite(db, playlist_id, current_user.id if current_user else None)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                self.logging.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="playlist_add_favorite_success",
                    message=f"Added favorite for playlist {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "add_favorite",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "engagement": result.get("data"),
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                # Honor an explicit status_code from the service (e.g. 403 for the guest-playlist
                # anti-abuse guard); otherwise infer 404 for "not found", 500 for anything else.
                status_code = result.get("status_code") or (
                    status.HTTP_404_NOT_FOUND if "not found" in (result.get("error", "").lower())
                    else status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                self.logging.log(
                    async_db=db,
                    level="WARNING" if status_code < 500 else "ERROR",
                    category="USER_ACTION",
                    action="playlist_add_favorite_failed",
                    message=f"Add favorite failed for playlist {playlist_id}: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "add_favorite",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                    },
                )
                return JSONResponse(status_code=status_code, content=format_response(False, error=result.get("error")))
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="An internal server error occurred")
            self.logging.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="playlist_add_favorite_exception",
                message="Exception during add favorite",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="add_favorite",
                metadata={
                    "operation": "add_favorite",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "playlist_uuid": playlist_id,
                },
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_content)

    async def remove_favorite(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
        """
        Remove a playlist from user's favorites.
        """
        start_time = time.time()
        correlation_id = self.logging.generate_correlation_id()

        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="playlist_id cannot be empty")
            self.logging.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="playlist_remove_favorite_validation_failed",
                message="Remove favorite failed: empty playlist_id",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "operation": "remove_favorite",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "error": "playlist_id cannot be empty",
                },
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_content)

        try:
            playlist = await self.service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist.id if playlist else None

            result = await self.service.remove_favorite(db, playlist_id, current_user.id if current_user else None)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                self.logging.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="playlist_remove_favorite_success",
                    message=f"Removed favorite for playlist {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "remove_favorite",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "engagement": result.get("data"),
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                status_code = status.HTTP_404_NOT_FOUND if "not found" in (result.get("error", "").lower()) else status.HTTP_500_INTERNAL_SERVER_ERROR
                self.logging.log(
                    async_db=db,
                    level="WARNING" if status_code == 404 else "ERROR",
                    category="USER_ACTION",
                    action="playlist_remove_favorite_failed",
                    message=f"Remove favorite failed for playlist {playlist_id}: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "remove_favorite",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                    },
                )
                return JSONResponse(status_code=status_code, content=format_response(False, error=result.get("error")))
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="An internal server error occurred")
            self.logging.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="playlist_remove_favorite_exception",
                message="Exception during remove favorite",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="remove_favorite",
                metadata={
                    "operation": "remove_favorite",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "playlist_uuid": playlist_id,
                },
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_content)

    async def follow(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
        """
        Follow a playlist.
        """
        start_time = time.time()
        correlation_id = self.logging.generate_correlation_id()

        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="playlist_id cannot be empty")
            self.logging.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="playlist_follow_validation_failed",
                message="Follow failed: empty playlist_id",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "operation": "follow",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "error": "playlist_id cannot be empty",
                },
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_content)

        try:
            playlist = await self.service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist.id if playlist else None

            result = await self.service.follow(db, playlist_id, current_user.id if current_user else None)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                self.logging.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="playlist_follow_success",
                    message=f"Followed playlist {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "follow",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "engagement": result.get("data"),
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                status_code = status.HTTP_404_NOT_FOUND if "not found" in (result.get("error", "").lower()) else status.HTTP_500_INTERNAL_SERVER_ERROR
                self.logging.log(
                    async_db=db,
                    level="WARNING" if status_code == 404 else "ERROR",
                    category="USER_ACTION",
                    action="playlist_follow_failed",
                    message=f"Follow failed for playlist {playlist_id}: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "follow",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                    },
                )
                return JSONResponse(status_code=status_code, content=format_response(False, error=result.get("error")))
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="An internal server error occurred")
            self.logging.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="playlist_follow_exception",
                message="Exception during follow",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="follow",
                metadata={
                    "operation": "follow",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "playlist_uuid": playlist_id,
                },
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_content)

    async def unfollow(
        self,
        db: AsyncSession,
        request: Request,
        playlist_id: str,
        current_user: Optional[User] = None,
    ) -> JSONResponse:
        """
        Unfollow a playlist.
        """
        start_time = time.time()
        correlation_id = self.logging.generate_correlation_id()

        if not playlist_id or not playlist_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="playlist_id cannot be empty")
            self.logging.log(
                async_db=db,
                level="WARNING",
                category="USER_ACTION",
                action="playlist_unfollow_validation_failed",
                message="Unfollow failed: empty playlist_id",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                metadata={
                    "operation": "unfollow",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "error": "playlist_id cannot be empty",
                },
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_content)

        try:
            playlist = await self.service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist.id if playlist else None

            result = await self.service.unfollow(db, playlist_id, current_user.id if current_user else None)
            duration_ms = (time.time() - start_time) * 1000

            if result.get("success"):
                self.logging.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="playlist_unfollow_success",
                    message=f"Unfollowed playlist {playlist_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "unfollow",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "engagement": result.get("data"),
                    },
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            else:
                status_code = status.HTTP_404_NOT_FOUND if "not found" in (result.get("error", "").lower()) else status.HTTP_500_INTERNAL_SERVER_ERROR
                self.logging.log(
                    async_db=db,
                    level="WARNING" if status_code == 404 else "ERROR",
                    category="USER_ACTION",
                    action="playlist_unfollow_failed",
                    message=f"Unfollow failed for playlist {playlist_id}: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    metadata={
                        "operation": "unfollow",
                        "user_uuid": getattr(current_user, "uuid", None),
                        "playlist_uuid": playlist_id,
                        "error": result.get("error"),
                    },
                )
                return JSONResponse(status_code=status_code, content=format_response(False, error=result.get("error")))
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_content = format_response(success=False, error="An internal server error occurred")
            self.logging.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="playlist_unfollow_exception",
                message="Exception during unfollow",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="unfollow",
                metadata={
                    "operation": "unfollow",
                    "user_uuid": getattr(current_user, "uuid", None),
                    "playlist_uuid": playlist_id,
                },
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_content)

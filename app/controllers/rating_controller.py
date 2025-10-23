"""
Rating Controller
=================

This controller handles HTTP requests for rating functionality.
It processes rating operations including track and playlist ratings,
rating retrieval, and statistics with proper validation and response formatting.

Manages rating-related API endpoints and coordinates with rating service
for business logic execution.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import time
from app.services.rating_service import RatingService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.schemas.rating import TrackRatingRequest, PlaylistRatingRequest
from app.core.exceptions import ValidationError
from app.services.playlist_service import PlaylistService
from app.models.user import User


class RatingController:
    """Controller for rating-related HTTP requests."""
    
    def __init__(self):
        """Initialize rating controller."""
        self.rating_service = RatingService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
    
    # Track Rating Endpoints
    async def rate_track(self, db: AsyncSession, request: Request, request_data: TrackRatingRequest, current_user: Optional[User] = None) -> JSONResponse:
        """Rate a track endpoint handler."""
        start_time = time.time()
        try:
            correlation_id = self.logging_service.generate_correlation_id()
            
            # Prioritize JWT user over request body user_id
            user_id = current_user.uuid if current_user else request_data.user_id
            
            result = await self.rating_service.rate_track(
                db, 
                request_data.track_id,  # Now a string UUID
                request_data.playlist_id,  # Playlist UUID
                request_data.rating, 
                user_id
            )
            # Resolve integer IDs for logging
            track_obj = await self.playlist_service.track_repository.async_get_by_uuid(db, request_data.track_id)
            track_int_id = track_obj.id if track_obj else None
            playlist_obj = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, request_data.playlist_id)
            playlist_int_id = playlist_obj.id if playlist_obj else None
            
            if result["success"]:
                # log success
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="rate_track_success",
                    message="Track rated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating submission",
                    metadata={
                        "track_uuid": request_data.track_id,
                        "playlist_uuid": request_data.playlist_id,
                        "rating": request_data.rating,
                        "result": result,
                        "response": result
                    },
                    operation="track_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                error_code = status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_422_UNPROCESSABLE_ENTITY
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="rate_track_failed",
                    message=result.get("error"),
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=error_code.value if hasattr(error_code, 'value') else int(error_code),
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating validation",
                    metadata={
                        "track_uuid": request_data.track_id,
                        "playlist_uuid": request_data.playlist_id,
                        "rating": request_data.rating,
                        "error": result.get("error"),
                        "response": result
                    },
                    operation="track_rating"
                )
                return JSONResponse(
                    status_code=error_code,
                    content=result
                )
                
        except ValueError as e:
            # Handle Pydantic validation errors
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="RATING",
                action="rate_track_validation_error",
                message=str(e),
                correlation_id=self.logging_service.generate_correlation_id(),
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                response_size=len(str(error_response)) if 'error_response' in locals() else None,
                duration_ms=duration_ms,
                context="Track rating input validation",
                metadata={
                    "error": str(e),
                    "validation_step": "input_validation"
                },
                operation="track_rating"
            )
            error_response = {
                "success": False,
                "error": f"Validation failed: {str(e)}"
            }
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response
            )
        except ValidationError as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="RATING",
                action="rate_track_validation_error",
                message=str(e),
                correlation_id=self.logging_service.generate_correlation_id(),
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                response_size=len(str(error_response)) if 'error_response' in locals() else None,
                duration_ms=duration_ms,
                context="Track rating validation error",
                metadata={
                    "error": str(e),
                    "validation_step": "service_validation"
                },
                operation="track_rating"
            )
            error_response = {
                "success": False,
                "error": f"Validation error: {str(e)}"
            }
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="rate_track_exception",
                error=e,
                context="rate_track_controller",
                duration_ms=duration_ms,
                correlation_id=correlation_id
            )
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_track_rating(self, db: AsyncSession, request: Request, track_id: str, user_id: Optional[str], playlist_id: str, current_user: Optional[User] = None) -> JSONResponse:
        """Get track rating endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            # Prioritize JWT user over query param user_id
            final_user_id = current_user.uuid if current_user else user_id
            
            result = await self.rating_service.get_track_rating(db, track_id, playlist_id, final_user_id)
            # Resolve integer IDs for logging
            track_obj = await self.playlist_service.track_repository.async_get_by_uuid(db, track_id)
            track_int_id = track_obj.id if track_obj else None
            playlist_obj = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist_obj.id if playlist_obj else None
            
            if result["success"]:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="get_track_rating_success",
                    message="Track rating retrieved",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating retrieval",
                    metadata={"rating": result.get("rating"), "response": result, "track_uuid": track_id, "playlist_uuid": playlist_id},
                    operation="get_track_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="get_track_rating_failed",
                    message=result.get("error"),
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating lookup",
                    metadata={"rating": result.get("rating"), "error": result.get("error"), "response": result, "track_uuid": track_id, "playlist_uuid": playlist_id},
                    operation="get_track_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="get_track_rating_exception",
                message="Unexpected error during track rating retrieval",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(error_response)) if 'error_response' in locals() else None,
                duration_ms=duration_ms,
                error=e,
                context="get_track_rating",
                metadata={"exception_type": type(e).__name__} if 'e' in locals() else None,
                operation="get_track_rating"
            )
            error_response = {
                "success": False,
                "error": "Internal server error occurred while retrieving the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def delete_track_rating(self, db: AsyncSession, request: Request, track_id: str, user_id: Optional[str], playlist_id: str, current_user: Optional[User] = None) -> JSONResponse:
        """Delete track rating endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            # Prioritize JWT user over query param user_id
            final_user_id = current_user.uuid if current_user else user_id
            
            result = await self.rating_service.delete_track_rating(db, track_id, playlist_id, final_user_id)
            # Resolve integer IDs for logging
            track_obj = await self.playlist_service.track_repository.async_get_by_uuid(db, track_id)
            track_int_id = track_obj.id if track_obj else None
            playlist_obj = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            playlist_int_id = playlist_obj.id if playlist_obj else None
            
            if result["success"]:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="delete_track_rating_success",
                    message="Track rating deleted",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating deletion",
                    metadata={"rating": result.get("rating"), "response": result, "track_uuid": track_id, "playlist_uuid": playlist_id},
                    operation="delete_track_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="delete_track_rating_failed",
                    message=result.get("error"),
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    track_id=track_int_id,
                    playlist_id=playlist_int_id,
                    context="Track rating deletion lookup",
                    metadata={"rating": result.get("rating"), "error": result.get("error"), "response": result, "track_uuid": track_id, "playlist_uuid": playlist_id},
                    operation="delete_track_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="delete_track_rating_exception",
                message="Unexpected error during track rating deletion",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                duration_ms=(time.time() - start_time) * 1000,
                error=e,
                context="delete_track_rating",
                operation="delete_track_rating"
            )
            error_response = {
                "success": False,
                "error": "Internal server error occurred while deleting the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_track_rating_stats(self, db: AsyncSession, request: Request, track_id: str) -> JSONResponse:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track UUID
            
        Returns:
            JSON response with rating statistics
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.rating_service.get_track_rating_stats(db, track_id)
            duration_ms = None
            try:
                duration_ms = (time.time() - start_time) * 1000  # start_time defined earlier in similar endpoints
            except Exception:
                pass
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="RATING",
                action="get_track_rating_stats_success",
                message="Track rating statistics retrieved successfully",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=200,
                response_size=len(str(result)),
                duration_ms=duration_ms,
                context="Track rating statistics retrieval",
                metadata={"statistics": result, "response": result, "track_uuid": track_id},
                operation="get_track_rating_stats"
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="get_track_rating_stats_exception",
                message="Unexpected error during track rating statistics retrieval",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                error=e,
                context="get_track_rating_stats",
                operation="get_track_rating_stats"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving rating statistics"
                )
            )
    
    # Playlist Rating Endpoints
    async def rate_playlist(self, db: AsyncSession, request: Request, request_data: PlaylistRatingRequest, current_user: Optional[User] = None) -> JSONResponse:
        """Rate a playlist endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, request_data.playlist_id)
        playlist_int_id = playlist.id if playlist else None
        
        try:
            # Prioritize JWT user over request body user_id
            user_id = current_user.uuid if current_user else request_data.user_id
            
            result = await self.rating_service.rate_playlist(
                db, 
                request_data.playlist_id,  # Now a string UUID
                request_data.rating,
                user_id,
                request_data.message
            )
            
            if result["success"]:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="rate_playlist_success",
                    message="Playlist rated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    context="Playlist rating submission",
                    metadata={
                        "playlist_uuid": request_data.playlist_id,
                        "rating": request_data.rating,
                        "user_id": request_data.user_id,
                        "message": request_data.message,
                        "result": result,
                        "response": result
                    },
                    operation="playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                error_code = status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_422_UNPROCESSABLE_ENTITY
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="rate_playlist_failed",
                    message=f"Playlist rating failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=error_code.value,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    context="Playlist rating validation",
                    metadata={
                        "playlist_uuid": request_data.playlist_id,
                        "rating": request_data.rating,
                        "user_id": request_data.user_id,
                        "message": request_data.message,
                        "error": result.get("error"),
                        "validation_step": "playlist_rating_processing",
                        "response": result
                    },
                    operation="playlist_rating"
                )
                return JSONResponse(
                    status_code=error_code,
                    content=result
                )
                
        except ValidationError as e:
            duration_ms = (time.time() - start_time) * 1000
            error_response = {
                "success": False,
                "error": f"Validation error: {str(e)}"
            }
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="RATING",
                action="rate_playlist_validation_error",
                message=f"Playlist rating validation error: {str(e)}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                context="Playlist rating input validation",
                metadata={
                    "playlist_uuid": request_data.playlist_id,
                    "rating": request_data.rating,
                    "user_id": request_data.user_id,
                    "message": request_data.message,
                    "error": str(e),
                    "validation_step": "input_validation",
                    "response": error_response
                },
                operation="playlist_rating"
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="rate_playlist_exception",
                message="Unexpected error during playlist rating",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(error_response)),
                duration_ms=duration_ms,
                playlist_id=playlist_int_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Playlist rating processing",
                metadata={
                    "playlist_uuid": request_data.playlist_id,
                    "rating": request_data.rating,
                    "user_id": request_data.user_id,
                    "message": request_data.message,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": error_response
                },
                operation="playlist_rating"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_playlist_rating(self, db: AsyncSession, request: Request, playlist_id: int, user_id: str = None, current_user: Optional[User] = None) -> JSONResponse:
        """
        Get user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional)
            
        Returns:
            JSON response with rating data
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            # Validate playlist_id
            if playlist_id <= 0:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="get_playlist_rating_validation_failed",
                    message="Invalid playlist_id provided for rating retrieval",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=422,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating retrieval validation",
                    metadata={
                        "error": "playlist_id must be a positive integer",
                        "provided_playlist_id": playlist_id,
                        "user_id": user_id,
                        "validation_step": "playlist_id_check",
                        "response": response_content
                    },
                    operation="get_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_content
                )
            
            # Prioritize JWT user over query param user_id
            final_user_id = current_user.uuid if current_user else user_id
            
            result = await self.rating_service.get_playlist_rating(db, playlist_id, final_user_id)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="get_playlist_rating_success",
                    message="Playlist rating retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating retrieval",
                    metadata={
                        "playlist_id": playlist_id,
                        "user_id": user_id,
                        "rating_data": result,
                        "response": result
                    },
                    operation="get_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="get_playlist_rating_not_found",
                    message=f"Playlist rating not found: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating lookup",
                    metadata={
                        "playlist_id": playlist_id,
                        "user_id": user_id,
                        "error": result.get("error"),
                        "lookup_step": "rating_search",
                        "response": result
                    },
                    operation="get_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            response_content = format_response(
                success=False,
                error="An internal server error occurred while retrieving the rating"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="get_playlist_rating_exception",
                message="Unexpected error during playlist rating retrieval",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                playlist_id=playlist_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Playlist rating retrieval processing",
                metadata={
                    "playlist_id": playlist_id,
                    "user_id": user_id,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": response_content
                },
                operation="get_playlist_rating"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content
            )
    
    async def delete_playlist_rating(self, db: AsyncSession, request: Request, playlist_id: int, user_id: str = None, current_user: Optional[User] = None) -> JSONResponse:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional)
            
        Returns:
            JSON response with operation result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            # Validate playlist_id
            if playlist_id <= 0:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="delete_playlist_rating_validation_failed",
                    message="Invalid playlist_id provided for rating deletion",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=422,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating deletion validation",
                    metadata={
                        "error": "playlist_id must be a positive integer",
                        "provided_playlist_id": playlist_id,
                        "user_id": user_id,
                        "validation_step": "playlist_id_check",
                        "response": response_content
                    },
                    operation="delete_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_content
                )
            
            # Prioritize JWT user over query param user_id
            final_user_id = current_user.uuid if current_user else user_id
            
            result = await self.rating_service.delete_playlist_rating(db, playlist_id, final_user_id)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="RATING",
                    action="delete_playlist_rating_success",
                    message="Playlist rating deleted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating deletion",
                    metadata={
                        "playlist_id": playlist_id,
                        "user_id": user_id,
                        "deletion_result": result,
                        "response": result
                    },
                    operation="delete_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="delete_playlist_rating_not_found",
                    message=f"Playlist rating deletion failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    response_size=len(str(result)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating deletion lookup",
                    metadata={
                        "playlist_id": playlist_id,
                        "user_id": user_id,
                        "error": result.get("error"),
                        "deletion_step": "rating_lookup",
                        "response": result
                    },
                    operation="delete_playlist_rating"
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            response_content = format_response(
                success=False,
                error="An internal server error occurred while deleting the rating"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="delete_playlist_rating_exception",
                message="Unexpected error during playlist rating deletion",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                playlist_id=playlist_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Playlist rating deletion processing",
                metadata={
                    "playlist_id": playlist_id,
                    "user_id": user_id,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": response_content
                },
                operation="delete_playlist_rating"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content
            )
    
    async def get_playlist_rating_stats(self, db: AsyncSession, request: Request, playlist_id: int) -> JSONResponse:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            JSON response with rating statistics
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            # Validate playlist_id
            if playlist_id <= 0:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="RATING",
                    action="get_playlist_rating_stats_validation_failed",
                    message="Invalid playlist_id provided for rating statistics",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=422,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_id,
                    context="Playlist rating statistics validation",
                    metadata={
                        "error": "playlist_id must be a positive integer",
                        "provided_playlist_id": playlist_id,
                        "validation_step": "playlist_id_check",
                        "response": response_content
                    },
                    operation="get_playlist_rating_stats"
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_content
                )
            
            result = await self.rating_service.get_playlist_rating_stats(db, playlist_id)
            
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="RATING",
                action="get_playlist_rating_stats_success",
                message="Playlist rating statistics retrieved successfully",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=200,
                response_size=len(str(result)),
                duration_ms=duration_ms,
                playlist_id=playlist_id,
                context="Playlist rating statistics retrieval",
                metadata={
                    "playlist_id": playlist_id,
                    "statistics": result,
                    "response": result
                },
                operation="get_playlist_rating_stats"
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            response_content = format_response(
                success=False,
                error="An internal server error occurred while retrieving rating statistics"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="RATING",
                action="get_playlist_rating_stats_exception",
                message="Unexpected error during playlist rating statistics retrieval",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                playlist_id=playlist_id,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Playlist rating statistics retrieval processing",
                metadata={
                    "playlist_id": playlist_id,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": response_content
                },
                operation="get_playlist_rating_stats"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content
            ) 

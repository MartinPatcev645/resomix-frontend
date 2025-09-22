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


class RatingController:
    """Controller for rating-related HTTP requests."""
    
    def __init__(self):
        """Initialize rating controller."""
        self.rating_service = RatingService()
        self.logging_service = LoggingService()
        self.playlist_service = PlaylistService()
    
    # Track Rating Endpoints
    async def rate_track(self, db: AsyncSession, request: Request, request_data: TrackRatingRequest) -> JSONResponse:
        """Rate a track endpoint handler."""
        start_time = time.time()
        try:
            correlation_id = self.logging_service.generate_correlation_id()
            
            result = await self.rating_service.rate_track(
                db, 
                request_data.track_id,  # Now a string UUID
                request_data.playlist_id,  # Playlist UUID
                request_data.rating, 
                request_data.user_id
            )
            
            if result["success"]:
                # log success
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="rate_track_success",
                    message="Track rated",
                    duration_ms=duration_ms,
                    correlation_id=correlation_id,
                    track_id=request_data.track_id,
                    playlist_id=request_data.playlist_id,
                    metadata={"rating": request_data.rating}
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="rate_track_failed",
                    message=result.get("error"),
                    duration_ms=duration_ms,
                    correlation_id=correlation_id,
                    track_id=request_data.track_id,
                    playlist_id=request_data.playlist_id,
                    metadata={"rating": request_data.rating}
                )
                error_code = status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_422_UNPROCESSABLE_ENTITY
                return JSONResponse(
                    status_code=error_code,
                    content=result
                )
                
        except ValueError as e:
            # Handle Pydantic validation errors
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_user_action(
                db=db,
                action="rate_track_validation_error",
                duration_ms=duration_ms,
                message=str(e),
                metadata={},
                correlation_id=self.logging_service.generate_correlation_id()
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
            self.logging_service.log_user_action(
                db=db,
                duration_ms=duration_ms,
                action="rate_track_validation_error",
                message=str(e),
                metadata={},
                correlation_id=self.logging_service.generate_correlation_id()
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
            self.logging_service.log_error(db=db, error=e, context="rate_track_controller", duration_ms=duration_ms)
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_track_rating(self, db: AsyncSession, request: Request, track_id: str, user_id: Optional[str], playlist_id: str) -> JSONResponse:
        """Get track rating endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            result = await self.rating_service.get_track_rating(db, track_id, playlist_id, user_id)
            
            if result["success"]:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="get_track_rating_success",
                    message="Track rating retrieved",
                    duration_ms=duration_ms,
                    status_code=200,
                    correlation_id=correlation_id,
                    track_id=track_id,
                    playlist_id=playlist_id,
                    metadata={"rating": result.get("rating")}
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="get_track_rating_failed",
                    message=result.get("error"),
                    duration_ms=duration_ms,
                    status_code=404,
                    correlation_id=correlation_id,
                    track_id=track_id,
                    playlist_id=playlist_id,
                    metadata={"rating": result.get("rating")}
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_error(db=db, error=e, context="get_track_rating", correlation_id=correlation_id, duration_ms=duration_ms)
            error_response = {
                "success": False,
                "error": "Internal server error occurred while retrieving the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def delete_track_rating(self, db: AsyncSession, request: Request, track_id: str, user_id: Optional[str], playlist_id: str) -> JSONResponse:
        """Delete track rating endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            result = await self.rating_service.delete_track_rating(db, track_id, playlist_id, user_id)
            
            if result["success"]:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="delete_track_rating_success",
                    message="Track rating deleted",
                    duration_ms=duration_ms,
                    status_code=200,
                    correlation_id=correlation_id,
                    track_id=track_id,
                    playlist_id=playlist_id,
                    metadata={"rating": result.get("rating")}
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_user_action(
                    db=db,
                    action="delete_track_rating_failed",
                    message=result.get("error"),
                    duration_ms=duration_ms,
                    status_code=404,
                    correlation_id=correlation_id,
                    track_id=track_id,
                    playlist_id=playlist_id,
                    metadata={"rating": result.get("rating")}
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=result
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="delete_track_rating", correlation_id=correlation_id)
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.rating_service.get_track_rating_stats(db, track_id)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="get_track_rating_stats", correlation_id=correlation_id)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving rating statistics"
                )
            )
    
    # Playlist Rating Endpoints
    async def rate_playlist(self, db: AsyncSession, request: Request, request_data: PlaylistRatingRequest) -> JSONResponse:
        """Rate a playlist endpoint handler."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, request_data.playlist_id)
        playlist_int_id = playlist.id if playlist else None
        
        try:
            result = await self.rating_service.rate_playlist(
                db, 
                request_data.playlist_id,  # Now a string UUID
                request_data.rating,
                request_data.user_id,
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
    
    async def get_playlist_rating(self, db: AsyncSession, request: Request, playlist_id: int, user_id: str = None) -> JSONResponse:
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
            
            result = await self.rating_service.get_playlist_rating(db, playlist_id, user_id)
            
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
    
    async def delete_playlist_rating(self, db: AsyncSession, request: Request, playlist_id: int, user_id: str = None) -> JSONResponse:
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
            
            result = await self.rating_service.delete_playlist_rating(db, playlist_id, user_id)
            
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

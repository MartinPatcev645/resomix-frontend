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


class RatingController:
    """Controller for rating-related HTTP requests."""
    
    def __init__(self):
        """Initialize rating controller."""
        self.rating_service = RatingService()
        self.logging_service = LoggingService()
    
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            result = await self.rating_service.rate_playlist(
                db, 
                request_data.playlist_id,  # Now a string UUID
                request_data.rating,
                request_data.user_id,
                request_data.message
            )
            
            if result["success"]:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=result
                )
            else:
                error_code = status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_422_UNPROCESSABLE_ENTITY
                return JSONResponse(
                    status_code=error_code,
                    content=result
                )
                
        except ValidationError as e:
            error_response = {
                "success": False,
                "error": f"Validation error: {str(e)}"
            }
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response
            )
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="rate_playlist", correlation_id=correlation_id)
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            # Validate playlist_id
            if playlist_id <= 0:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="playlist_id must be a positive integer"
                    )
                )
            
            result = await self.rating_service.get_playlist_rating(db, playlist_id, user_id)
            
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
            self.logging_service.log_error(db=db, error=e, context="get_playlist_rating", correlation_id=correlation_id)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving the rating"
                )
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            # Validate playlist_id
            if playlist_id <= 0:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="playlist_id must be a positive integer"
                    )
                )
            
            result = await self.rating_service.delete_playlist_rating(db, playlist_id, user_id)
            
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
            self.logging_service.log_error(db=db, error=e, context="delete_playlist_rating", correlation_id=correlation_id)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while deleting the rating"
                )
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            
            # Validate playlist_id
            if playlist_id <= 0:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="playlist_id must be a positive integer"
                    )
                )
            
            result = await self.rating_service.get_playlist_rating_stats(db, playlist_id)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="get_playlist_rating_stats", correlation_id=correlation_id)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving rating statistics"
                )
            ) 

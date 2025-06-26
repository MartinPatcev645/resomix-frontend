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

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.services.rating_service import RatingService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request
from app.schemas.rating import TrackRatingRequest, PlaylistRatingRequest
from app.core.exceptions import ValidationError


class RatingController:
    """Controller for rating-related HTTP requests."""
    
    def __init__(self):
        """Initialize rating controller."""
        self.rating_service = RatingService()
    
    # Track Rating Endpoints
    async def rate_track(self, db: AsyncSession, request_data: TrackRatingRequest) -> JSONResponse:
        """Rate a track endpoint handler."""
        try:
            log_request("rate_track", {
                "track_id": request_data.track_id,
                "playlist_id": request_data.playlist_id,
                "rating": request_data.rating,
                "has_user_id": bool(request_data.user_id)
            })
            
            result = await self.rating_service.rate_track(
                db, 
                request_data.track_id,  # Now a string UUID
                request_data.playlist_id,  # Playlist UUID
                request_data.rating, 
                request_data.user_id
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
            print(f"Error in rate_track controller: {e}")
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_track_rating(self, db: AsyncSession, track_id: str, playlist_id: str, user_id: Optional[str] = None) -> JSONResponse:
        """Get track rating endpoint handler."""
        try:
            log_request("get_track_rating", {
                "track_id": track_id,
                "playlist_id": playlist_id,
                "has_user_id": bool(user_id)
            })
            
            result = await self.rating_service.get_track_rating(db, track_id, playlist_id, user_id)
            
            if result["success"]:
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
            print(f"Error in get_track_rating controller: {e}")
            error_response = {
                "success": False,
                "error": "Internal server error occurred while retrieving the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def delete_track_rating(self, db: AsyncSession, track_id: str, playlist_id: str, user_id: Optional[str] = None) -> JSONResponse:
        """Delete track rating endpoint handler."""
        try:
            log_request("delete_track_rating", {
                "track_id": track_id,
                "playlist_id": playlist_id,
                "has_user_id": bool(user_id)
            })
            
            result = await self.rating_service.delete_track_rating(db, track_id, playlist_id, user_id)
            
            if result["success"]:
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
            print(f"Error in delete_track_rating controller: {e}")
            error_response = {
                "success": False,
                "error": "Internal server error occurred while deleting the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_track_rating_stats(self, db: AsyncSession, track_id: str) -> JSONResponse:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track UUID
            
        Returns:
            JSON response with rating statistics
        """
        log_request("get_track_rating_stats", "GET", {"track_id": track_id})
        
        try:
            result = await self.rating_service.get_track_rating_stats(db, track_id)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            print(f"Error in rating controller get_track_rating_stats: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving rating statistics"
                )
            )
    
    # Playlist Rating Endpoints
    async def rate_playlist(self, db: AsyncSession, request_data: PlaylistRatingRequest) -> JSONResponse:
        """Rate a playlist endpoint handler."""
        try:
            log_request("rate_playlist", {
                "playlist_id": request_data.playlist_id,
                "rating": request_data.rating,
                "has_message": bool(request_data.message),
                "has_user_id": bool(request_data.user_id)
            })
            
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
            print(f"Error in rate_playlist controller: {e}")
            error_response = {
                "success": False,
                "error": "Internal server error occurred while processing the rating"
            }
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )
    
    async def get_playlist_rating(self, db: AsyncSession, playlist_id: int, user_id: str = None) -> JSONResponse:
        """
        Get user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional)
            
        Returns:
            JSON response with rating data
        """
        log_request("get_playlist_rating", "GET", {"playlist_id": playlist_id, "user_id": user_id})
        
        # Validate playlist_id
        if playlist_id <= 0:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
            )
        
        try:
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
            print(f"Error in rating controller get_playlist_rating: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving the rating"
                )
            )
    
    async def delete_playlist_rating(self, db: AsyncSession, playlist_id: int, user_id: str = None) -> JSONResponse:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional)
            
        Returns:
            JSON response with operation result
        """
        log_request("delete_playlist_rating", "DELETE", {"playlist_id": playlist_id, "user_id": user_id})
        
        # Validate playlist_id
        if playlist_id <= 0:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
            )
        
        try:
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
            print(f"Error in rating controller delete_playlist_rating: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while deleting the rating"
                )
            )
    
    async def get_playlist_rating_stats(self, db: AsyncSession, playlist_id: int) -> JSONResponse:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            JSON response with rating statistics
        """
        log_request("get_playlist_rating_stats", "GET", {"playlist_id": playlist_id})
        
        # Validate playlist_id
        if playlist_id <= 0:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="playlist_id must be a positive integer"
                )
            )
        
        try:
            result = await self.rating_service.get_playlist_rating_stats(db, playlist_id)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
                
        except Exception as e:
            print(f"Error in rating controller get_playlist_rating_stats: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving rating statistics"
                )
            ) 
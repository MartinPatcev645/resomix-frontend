"""
Rating API Router
=================

This module defines the FastAPI router for rating management endpoints.
It handles HTTP requests for track and playlist rating operations including
create, read, update, delete and statistics retrieval with authentication and validation.

Provides RESTful API endpoints for rating functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.controllers.rating_controller import RatingController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.rating import (
    TrackRatingRequest,
    PlaylistRatingRequest,
    RatingOperationResponse,
    RatingStatsResponse,
    RatingErrorResponse
)

router = APIRouter(
    prefix="/ratings",
    tags=["ratings"],
    responses={
        404: {"model": RatingErrorResponse},
        422: {"model": RatingErrorResponse},
        500: {"model": RatingErrorResponse}
    }
)

# Initialize controller
rating_controller = RatingController()


# Track Rating Endpoints
@router.post(
    "/tracks/",
    response_model=RatingOperationResponse,
    summary="Rate Track",
    description="Rate a track with 0 (not similar) or 1 (similar). Always creates a new rating entry.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rated successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Track not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid rating data"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def rate_track_endpoint(
    request_data: TrackRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Rate a track with similarity feedback.
    
    - **track_id**: The UUID of the track to rate
    - **rating**: Rating value - 0 (not similar) or 1 (similar)
    - **user_id**: Optional user ID for the rating (UUID format)
    """
    return await rating_controller.rate_track(db, request_data)


@router.get(
    "/tracks/{track_id}",
    response_model=RatingOperationResponse,
    summary="Get Track Rating",
    description="Get user's rating for a specific track.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rating retrieved successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Rating not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid track ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_track_rating_endpoint(
    track_id: str,
    user_id: Optional[str] = Query(None, description="User ID (optional for anonymous ratings)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get user's rating for a specific track.
    
    - **track_id**: The UUID of the track
    - **user_id**: Optional user ID (query parameter)
    """
    return await rating_controller.get_track_rating(db, track_id, user_id)


@router.delete(
    "/tracks/{track_id}",
    response_model=RatingOperationResponse,
    summary="Delete Track Rating",
    description="Delete user's rating for a specific track.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rating deleted successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Rating not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid track ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def delete_track_rating_endpoint(
    track_id: str,
    user_id: Optional[str] = Query(None, description="User ID (optional for anonymous ratings)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Delete user's rating for a specific track.
    
    - **track_id**: The UUID of the track
    - **user_id**: Optional user ID (query parameter)
    """
    return await rating_controller.delete_track_rating(db, track_id, user_id)


@router.get(
    "/tracks/{track_id}/stats",
    response_model=RatingStatsResponse,
    summary="Get Track Rating Statistics",
    description="Get rating statistics for a specific track.",
    responses={
        200: {
            "model": RatingStatsResponse,
            "description": "Track rating statistics retrieved successfully"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid track ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_track_rating_stats_endpoint(
    track_id: str,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get rating statistics for a specific track.
    
    Returns the total count and distribution of ratings (similar/not similar).
    
    - **track_id**: The UUID of the track
    """
    return await rating_controller.get_track_rating_stats(db, track_id)


# Playlist Rating Endpoints
@router.post(
    "/playlists/",
    response_model=RatingOperationResponse,
    summary="Rate Playlist",
    description="Rate a playlist with 0-3 stars and optional message. Always creates a new rating entry.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rated successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid rating data"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def rate_playlist_endpoint(
    request_data: PlaylistRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Rate a playlist with star rating and optional message.
    
    - **playlist_id**: The ID of the playlist to rate (positive integer)
    - **rating**: Rating value from 0 to 3 stars
    - **message**: Optional message/feedback about the playlist (max 1000 characters)
    - **user_id**: Optional user ID for the rating (UUID format)
    """
    return await rating_controller.rate_playlist(db, request_data)


@router.get(
    "/playlists/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Get Playlist Rating",
    description="Get user's rating for a specific playlist.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rating retrieved successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Rating not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_playlist_rating_endpoint(
    playlist_id: int,
    user_id: Optional[str] = Query(None, description="User ID (optional for anonymous ratings)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get user's rating for a specific playlist.
    
    - **playlist_id**: The ID of the playlist
    - **user_id**: Optional user ID (query parameter)
    """
    return await rating_controller.get_playlist_rating(db, playlist_id, user_id)


@router.delete(
    "/playlists/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Delete Playlist Rating",
    description="Delete user's rating for a specific playlist.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rating deleted successfully"
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Rating not found"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def delete_playlist_rating_endpoint(
    playlist_id: int,
    user_id: Optional[str] = Query(None, description="User ID (optional for anonymous ratings)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Delete user's rating for a specific playlist.
    
    - **playlist_id**: The ID of the playlist
    - **user_id**: Optional user ID (query parameter)
    """
    return await rating_controller.delete_playlist_rating(db, playlist_id, user_id)


@router.get(
    "/playlists/{playlist_id}/stats",
    response_model=RatingStatsResponse,
    summary="Get Playlist Rating Statistics",
    description="Get rating statistics for a specific playlist.",
    responses={
        200: {
            "model": RatingStatsResponse,
            "description": "Playlist rating statistics retrieved successfully"
        },
        422: {
            "model": RatingErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": RatingErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_playlist_rating_stats_endpoint(
    playlist_id: int,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get rating statistics for a specific playlist.
    
    Returns the total count, average rating, and distribution of ratings (0-3 stars).
    
    - **playlist_id**: The ID of the playlist
    """
    return await rating_controller.get_playlist_rating_stats(db, playlist_id) 
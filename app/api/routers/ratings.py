"""
Rating API Router
=================

This module defines the FastAPI router for rating management endpoints.
It handles HTTP requests for track and playlist rating operations including
create, read, update, delete and statistics retrieval with authentication and validation.

Provides RESTful API endpoints for rating functionality
of the Resomix audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional

from fastapi import APIRouter, Security, Depends, Path, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.rating_controller import RatingController
from app.api.dependencies.auth import get_current_user, get_current_user_optional
from app.api.dependencies.partner import get_public_partner
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.schemas.rating import (
    TrackRatingRequest,
    PlaylistRatingRequest,
    RatingOperationResponse,
    RatingStatsResponse,
    RatingErrorResponse,
)

router = APIRouter(
    prefix="/ratings",
    tags=["ratings"],
    responses={
        404: {"model": RatingErrorResponse},
        422: {"model": RatingErrorResponse},
        500: {"model": RatingErrorResponse},
    },
)

# Initialize controller
rating_controller = RatingController()


# Track Rating Endpoints
@router.post(
    "/tracks/",
    response_model=RatingOperationResponse,
    summary="Rate Track",
    description="Rate a track with 0 (not similar) or 1 (similar) within a specific playlist context. Always creates a new rating entry.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rated successfully",
        },
        404: {
            "model": RatingErrorResponse,
            "description": "Track or playlist not found",
        },
        422: {"model": RatingErrorResponse, "description": "Invalid rating data"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def rate_track_endpoint(
    request: Request,
    request_data: TrackRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Rate a track with similarity feedback within a playlist context.

    - **track_id**: The UUID of the track to rate
    - **playlist_id**: The UUID of the playlist from which the rating is being submitted
    - **rating**: Rating value - 0 (not similar) or 1 (similar)
    - **user_id**: Optional user ID for the rating (UUID format) - overridden by JWT if present

    Note: If authenticated via JWT, the user_id from the token will be used automatically.
    """
    return await rating_controller.rate_track(db, request, request_data, current_user)


@router.get(
    "/tracks/{track_id}/playlist/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Get Track Rating",
    description="Get user's rating for a specific track within a specific playlist context.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rating retrieved successfully",
        },
        404: {"model": RatingErrorResponse, "description": "Track rating not found"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def get_track_rating_endpoint(
    request: Request,
    track_id: str = Path(..., description="Track UUID"),
    playlist_id: str = Path(..., description="Playlist UUID"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Get user's rating for a specific track within a playlist context.

    User ID is automatically extracted from JWT token if authenticated.

    - **track_id**: The UUID of the track
    - **playlist_id**: The UUID of the playlist
    """
    return await rating_controller.get_track_rating(
        db, request, track_id, None, playlist_id, current_user
    )


@router.delete(
    "/tracks/{track_id}/playlist/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Delete Track Rating",
    description="Delete user's rating for a specific track within a specific playlist context.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Track rating deleted successfully",
        },
        404: {"model": RatingErrorResponse, "description": "Track rating not found"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def delete_track_rating_endpoint(
    request: Request,
    track_id: str = Path(..., description="Track UUID"),
    playlist_id: str = Path(..., description="Playlist UUID"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Delete user's rating for a specific track within a playlist context.

    User ID is automatically extracted from JWT token if authenticated.

    - **track_id**: The UUID of the track
    - **playlist_id**: The UUID of the playlist
    """
    return await rating_controller.delete_track_rating(
        db, request, track_id, None, playlist_id, current_user
    )


@router.get(
    "/tracks/{track_id}/stats",
    response_model=RatingStatsResponse,
    summary="Get Track Rating Statistics",
    description="Get rating statistics for a specific track.",
    responses={
        200: {
            "model": RatingStatsResponse,
            "description": "Track rating statistics retrieved successfully",
        },
        422: {"model": RatingErrorResponse, "description": "Invalid track ID"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def get_track_rating_stats_endpoint(
    request: Request,
    track_id: str,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
) -> JSONResponse:
    """
    Get rating statistics for a specific track.

    Returns the total count and distribution of ratings (similar/not similar).

    - **track_id**: The UUID of the track
    """
    return await rating_controller.get_track_rating_stats(db, request, track_id)


# Playlist Rating Endpoints
@router.post(
    "/playlists/",
    response_model=RatingOperationResponse,
    summary="Rate Playlist",
    description="Rate a playlist with 0-3 stars and optional message. Always creates a new rating entry.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rated successfully",
        },
        404: {"model": RatingErrorResponse, "description": "Playlist not found"},
        422: {"model": RatingErrorResponse, "description": "Invalid rating data"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def rate_playlist_endpoint(
    request: Request,
    request_data: PlaylistRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    """
    Rate a playlist with star rating and optional message.

    - **playlist_id**: The ID of the playlist to rate (positive integer)
    - **rating**: Rating value from 0 to 3 stars
    - **message**: Optional message/feedback about the playlist (max 1000 characters)
    - **user_id**: Optional user ID for the rating (UUID format) - overridden by JWT if present
    """
    return await rating_controller.rate_playlist(
        db, request, request_data, current_user
    )


@router.get(
    "/playlists/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Get Playlist Rating",
    description="Get user's rating for a specific playlist.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rating retrieved successfully",
        },
        404: {"model": RatingErrorResponse, "description": "Rating not found"},
        422: {"model": RatingErrorResponse, "description": "Invalid playlist ID"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def get_playlist_rating_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Get user's rating for a specific playlist.

    User ID is automatically extracted from JWT token if authenticated.

    - **playlist_id**: The ID of the playlist
    """
    return await rating_controller.get_playlist_rating(
        db, request, playlist_id, None, current_user
    )


@router.delete(
    "/playlists/{playlist_id}",
    response_model=RatingOperationResponse,
    summary="Delete Playlist Rating",
    description="Delete user's rating for a specific playlist.",
    responses={
        200: {
            "model": RatingOperationResponse,
            "description": "Playlist rating deleted successfully",
        },
        404: {"model": RatingErrorResponse, "description": "Rating not found"},
        422: {"model": RatingErrorResponse, "description": "Invalid playlist ID"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def delete_playlist_rating_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Delete user's rating for a specific playlist.

    User ID is automatically extracted from JWT token if authenticated.

    - **playlist_id**: The ID of the playlist
    """
    return await rating_controller.delete_playlist_rating(
        db, request, playlist_id, None, current_user
    )


@router.get(
    "/playlists/{playlist_id}/stats",
    response_model=RatingStatsResponse,
    summary="Get Playlist Rating Statistics",
    description="Get rating statistics for a specific playlist.",
    responses={
        200: {
            "model": RatingStatsResponse,
            "description": "Playlist rating statistics retrieved successfully",
        },
        422: {"model": RatingErrorResponse, "description": "Invalid playlist ID"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def get_playlist_rating_stats_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
) -> JSONResponse:
    """
    Get rating statistics for a specific playlist.

    Returns the total count, average rating, and distribution of ratings (0-3 stars).

    - **playlist_id**: The ID of the playlist
    """
    return await rating_controller.get_playlist_rating_stats(db, request, playlist_id)


@router.get(
    "/playlists/{playlist_id}/mine",
    summary="Get My Ratings For Playlist",
    description="Return the current user's ratings for a whole playlist in one call: per-track "
    "thumbs ({track_uuid: 0|1}) plus their playlist star rating. Guests get an empty set.",
    responses={
        200: {"description": "The user's ratings for the playlist"},
        500: {"model": RatingErrorResponse, "description": "Internal server error"},
    },
)
async def get_my_playlist_ratings_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="Playlist UUID"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    """Hydrate the playlist screen with the user's existing thumbs + star rating."""
    return await rating_controller.get_my_playlist_ratings(db, request, playlist_id, current_user)

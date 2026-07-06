"""
Playlist Engagement API Router
==============================

This module defines the FastAPI router for playlist engagement endpoints.
It handles HTTP requests for playlist engagement operations including
favorites and follows with authentication and validation.

Provides RESTful API endpoints for playlist engagement functionality
of the Resomix audio similarity system.

Version: 3.2.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends, Path, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.partner import get_public_partner
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.controllers.playlist_engagement_controller import PlaylistEngagementController
from app.models.user import User

router = APIRouter(
    prefix="/playlist",
    tags=["playlist-engagement"],
    responses={
        401: {"description": "Unauthorized - Authentication required"},
        404: {"description": "Playlist not found"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"},
    },
)

playlist_engagement_controller = PlaylistEngagementController()


@router.post(
    "/add-favorite/{playlist_id}",
    summary="Add Playlist to Favorites",
    description="Add a playlist to the authenticated user's favorites.",
    responses={
        200: {"description": "Playlist added to favorites successfully"},
        401: {"description": "Unauthorized - Authentication required"},
        404: {"description": "Playlist not found"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"},
    },
)
async def add_favorite_playlist_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="The UUID of the playlist to add to favorites"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Add a playlist to the authenticated user's favorites.
    
    - **playlist_id**: The UUID of the playlist to add to favorites
    
    Requirements:
    - User must be authenticated (JWT token required)
    - Playlist must exist
    
    Returns success confirmation when the playlist is added to favorites.
    """
    return await playlist_engagement_controller.add_favorite(db, request, playlist_id, current_user)


@router.post(
    "/remove-favorite/{playlist_id}",
    summary="Remove Playlist from Favorites",
    description="Remove a playlist from the authenticated user's favorites.",
    responses={
        200: {"description": "Playlist removed from favorites successfully"},
        401: {"description": "Unauthorized - Authentication required"},
        404: {"description": "Playlist not found or not in favorites"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"},
    },
)
async def remove_favorite_playlist_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="The UUID of the playlist to remove from favorites"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Remove a playlist from the authenticated user's favorites.
    
    - **playlist_id**: The UUID of the playlist to remove from favorites
    
    Requirements:
    - User must be authenticated (JWT token required)
    - Playlist must exist and be in user's favorites
    
    Returns success confirmation when the playlist is removed from favorites.
    """
    return await playlist_engagement_controller.remove_favorite(db, request, playlist_id, current_user)


@router.post(
    "/follow/{playlist_id}",
    summary="Follow Playlist",
    description="Follow a playlist to receive updates when it changes.",
    responses={
        200: {"description": "Playlist followed successfully"},
        401: {"description": "Unauthorized - Authentication required"},
        404: {"description": "Playlist not found"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"},
    },
)
async def follow_playlist_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="The UUID of the playlist to follow"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Follow a playlist to receive updates when it changes.
    
    - **playlist_id**: The UUID of the playlist to follow
    
    Requirements:
    - User must be authenticated (JWT token required)
    - Playlist must exist
    
    Returns success confirmation when the playlist is followed.
    """
    return await playlist_engagement_controller.follow(db, request, playlist_id, current_user)


@router.post(
    "/unfollow/{playlist_id}",
    summary="Unfollow Playlist",
    description="Unfollow a playlist to stop receiving updates.",
    responses={
        200: {"description": "Playlist unfollowed successfully"},
        401: {"description": "Unauthorized - Authentication required"},
        404: {"description": "Playlist not found or not being followed"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"},
    },
)
async def unfollow_playlist_endpoint(
    request: Request,
    playlist_id: str = Path(..., description="The UUID of the playlist to unfollow"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),  # REQUIRED auth
) -> JSONResponse:
    """
    Unfollow a playlist to stop receiving updates.
    
    - **playlist_id**: The UUID of the playlist to unfollow
    
    Requirements:
    - User must be authenticated (JWT token required)
    - Playlist must exist and be followed by the user
    
    Returns success confirmation when the playlist is unfollowed.
    """
    return await playlist_engagement_controller.unfollow(db, request, playlist_id, current_user)

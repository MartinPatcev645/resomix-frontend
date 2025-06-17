"""
Playlist API Router
===================

This module defines the FastAPI router for playlist management endpoints.
It handles HTTP requests for playlist operations including rename, visibility changes,
and similarity data retrieval with authentication and validation.

Provides RESTful API endpoints for playlist management functionality
of the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from fastapi import APIRouter, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.playlist_controller import PlaylistController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.playlist import (
    PlaylistRenameRequest,
    PlaylistVisibilityRequest,
    PlaylistOperationResponse,
    PlaylistErrorResponse,
    PlaylistSimilarityResponse
)

router = APIRouter(
    prefix="/playlists",
    tags=["playlists"],
    responses={
        404: {"model": PlaylistErrorResponse},
        422: {"model": PlaylistErrorResponse},
        500: {"model": PlaylistErrorResponse}
    }
)

# Initialize controller
playlist_controller = PlaylistController()


@router.put(
    "/rename/",
    response_model=PlaylistOperationResponse,
    summary="Rename Playlist",
    description="Rename a playlist by its UUID.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist renamed successfully"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID or name"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def rename_playlist_endpoint(
    request_data: PlaylistRenameRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Rename a playlist by its UUID.
    
    - **playlist_id**: The UUID of the playlist to rename
    - **new_name**: The new name for the playlist (1-150 characters)
    """
    return await playlist_controller.rename_playlist(db, request_data.playlist_id, request_data.new_name)


@router.put(
    "/visibility/",
    response_model=PlaylistOperationResponse,
    summary="Change Playlist Visibility",
    description="Make a playlist public or private by its UUID.",
    responses={
        200: {
            "model": PlaylistOperationResponse,
            "description": "Playlist visibility changed successfully"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def change_playlist_visibility_endpoint(
    request_data: PlaylistVisibilityRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Change playlist visibility (public/private) by its UUID.
    
    - **playlist_id**: The UUID of the playlist to modify
    - **is_public**: Whether the playlist should be public (true) or private (false)
    """
    return await playlist_controller.change_playlist_visibility(db, request_data.playlist_id, request_data.is_public)


@router.get(
    "/similarity/{playlist_id}",
    response_model=PlaylistSimilarityResponse,
    summary="Get Playlist Similarity Data",
    description="Get playlist with similarity data formatted like similarity endpoints.",
    responses={
        200: {
            "model": PlaylistSimilarityResponse,
            "description": "Playlist similarity data retrieved successfully"
        },
        404: {
            "model": PlaylistErrorResponse,
            "description": "Playlist not found"
        },
        422: {
            "model": PlaylistErrorResponse,
            "description": "Invalid playlist ID"
        },
        500: {
            "model": PlaylistErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def get_playlist_similarity_endpoint(
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Get playlist with similarity data formatted like similarity endpoints.
    
    Returns the same format as similarity endpoints including queried track,
    similar tracks with scores, and playlist information.
    
    - **playlist_id**: The UUID of the playlist to retrieve
    """
    return await playlist_controller.get_playlist_similarity_data(db, playlist_id)

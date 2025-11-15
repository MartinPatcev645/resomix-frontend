"""
Admin Spotify App API Router
=============================

FastAPI router exposing admin endpoints for managing Spotify apps and user associations.

Version: 3.0.1
Init Date: November 14, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query, Request, Security
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.controllers.spotify_app_controller import SpotifyAppController
from app.schemas.spotify_app import (
    SpotifyAppListResponse,
    SpotifyAppDetailResponse,
    SpotifyAppCreateRequest,
    SpotifyAppUpdateRequest,
    SpotifyAppDeleteResponse,
    UserSpotifyAppResponse,
    UserSpotifyAppListResponse,
    UserSpotifyAppUpsertRequest,
    UserSpotifyAppDeleteResponse,
)
from app.schemas.common import ErrorResponse

router = APIRouter(
    prefix="/admin/spotify-apps",
    tags=["admin-spotify-apps"],
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

controller = SpotifyAppController()


# ============================================================================
# Spotify App CRUD Endpoints
# ============================================================================

@router.get(
    "/",
    response_model=SpotifyAppListResponse,
    status_code=200,
    summary="List Spotify apps",
    description="Get paginated list of Spotify apps with optional filters (is_active, search by name).",
)
async def list_spotify_apps(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by app name (case insensitive)"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.list_spotify_apps(
        db=db,
        request=request,
        page=page,
        page_size=page_size,
        is_active=is_active,
        search=search,
    )


@router.post(
    "/",
    response_model=SpotifyAppDetailResponse,
    status_code=201,
    summary="Create Spotify app",
    description="Create a new Spotify app with name, description, client_id, and client_secret.",
)
async def create_spotify_app(
    request: Request,
    payload: SpotifyAppCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.create_spotify_app(
        db=db,
        request=request,
        name=payload.name,
        description=payload.description,
        client_id=payload.client_id,
        client_secret=payload.client_secret,
        is_active=payload.is_active,
    )


# ============================================================================
# User Association Endpoints
# ============================================================================

@router.get(
    "/users",
    response_model=UserSpotifyAppListResponse,
    status_code=200,
    summary="List user associations",
    description="Get paginated list of user-Spotify app associations with optional filters.",
)
async def list_user_associations(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(30, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email, username, or UUID"),
    spotify_app_id: Optional[int] = Query(None, description="Filter by Spotify app ID", ge=1),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.list_user_associations(
        db=db,
        request=request,
        page=page,
        page_size=page_size,
        search=search,
        spotify_app_id=spotify_app_id,
    )


@router.get(
    "/users/{user_identifier}",
    response_model=UserSpotifyAppResponse,
    status_code=200,
    summary="Get user association",
    description="Get user's Spotify app association by user identifier (email, UUID, username, or ID).",
)
async def get_user_association(
    request: Request,
    user_identifier: str = Path(..., description="User email, UUID, username, or numeric ID"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.get_user_association(
        db=db,
        request=request,
        user_identifier=user_identifier,
    )


@router.put(
    "/users",
    response_model=UserSpotifyAppResponse,
    status_code=200,
    summary="Create or update user association",
    description="Associate a user with a Spotify app. Updates existing association if user already has one (one-to-one constraint).",
)
async def upsert_user_association(
    request: Request,
    payload: UserSpotifyAppUpsertRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    # TODO: Extract created_by from authenticated admin user if available
    return await controller.upsert_user_association(
        db=db,
        request=request,
        user_identifier=payload.user_identifier,
        spotify_app_id=payload.spotify_app_id,
        created_by=None,  # Could be extracted from JWT token if admin auth is added
    )


@router.delete(
    "/users/{user_identifier}",
    response_model=UserSpotifyAppDeleteResponse,
    status_code=200,
    summary="Delete user association",
    description="Remove user's association with Spotify app by user identifier.",
)
async def delete_user_association(
    request: Request,
    user_identifier: str = Path(..., description="User email, UUID, username, or numeric ID"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.delete_user_association(
        db=db,
        request=request,
        user_identifier=user_identifier,
    )


# ============================================================================
# Spotify App Detail Endpoints (must come after /users routes)
# ============================================================================

@router.get(
    "/{app_id}",
    response_model=SpotifyAppDetailResponse,
    status_code=200,
    summary="Get Spotify app",
    description="Get single Spotify app by ID. Includes client_secret for admin view.",
)
async def get_spotify_app(
    request: Request,
    app_id: int = Path(..., description="Spotify app ID", ge=1),
    include_secret: bool = Query(True, description="Include client_secret in response"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.get_spotify_app(
        db=db,
        request=request,
        app_id=app_id,
        include_secret=include_secret,
    )


@router.put(
    "/{app_id}",
    response_model=SpotifyAppDetailResponse,
    status_code=200,
    summary="Update Spotify app",
    description="Update Spotify app fields (name, description, client_id, client_secret, is_active). All fields optional.",
)
async def update_spotify_app(
    request: Request,
    app_id: int = Path(..., description="Spotify app ID", ge=1),
    payload: SpotifyAppUpdateRequest = ...,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.update_spotify_app(
        db=db,
        request=request,
        app_id=app_id,
        name=payload.name,
        description=payload.description,
        client_id=payload.client_id,
        client_secret=payload.client_secret,
        is_active=payload.is_active,
    )


@router.delete(
    "/{app_id}",
    response_model=SpotifyAppDeleteResponse,
    status_code=200,
    summary="Delete Spotify app",
    description="Delete a Spotify app. Use cascade=true to delete even if users are associated.",
)
async def delete_spotify_app(
    request: Request,
    app_id: int = Path(..., description="Spotify app ID", ge=1),
    cascade: bool = Query(False, description="Delete app even if users are associated"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),
) -> JSONResponse:
    return await controller.delete_spotify_app(
        db=db,
        request=request,
        app_id=app_id,
        cascade=cascade,
    )


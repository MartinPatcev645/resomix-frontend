"""
Search API Router
=================

This module defines the FastAPI router for track search endpoints.
It handles HTTP requests for text-based track searches with authentication
and query parameter validation.

Provides RESTful API endpoints for searching tracks by title, artist,
and other metadata fields in the Resomix system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Search endpoints 
from fastapi import APIRouter, Query, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Literal

from app.controllers.search_controller import SearchController
from app.api.dependencies.partner import get_public_partner
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.schemas.search import (
    SearchSuccessResponse,
    SearchErrorResponse
)

router = APIRouter(
    tags=["search"],
    responses={
        500: {"model": SearchErrorResponse},
        503: {"model": SearchErrorResponse}
    }
)

# Initialize controller
search_controller = SearchController()


@router.get(
    "/search_tracks/",
    response_model=SearchSuccessResponse,
    summary="Search Tracks",
    description="Search for tracks based on a query string across titles, artists, and metadata.",
    responses={
        200: {
            "model": SearchSuccessResponse,
            "description": "Search completed successfully"
        },
        500: {
            "model": SearchErrorResponse,
            "description": "Internal server error during search"
        }
    }
)
async def search_tracks_endpoint(
    query: str = Query(..., description="The search term to find matching tracks", min_length=1, max_length=200),
    mode: Optional[Literal["artist", "title", "auto"]] = Query("auto", description="Search mode: 'artist' (search only artists), 'title' (search only titles), 'auto' (search both)"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner)
) -> JSONResponse:
    """
    Search for tracks based on a query string.
    
    - **query**: Search term to find matching tracks across titles, artists, albums, and other metadata
    - **mode**: Search mode - 'artist' for artist-only search, 'title' for title-only search, 'auto' for both (default)
    """
    return await search_controller.search_tracks(db, query, mode, partner_id=partner.id)


@router.get(
    "/search_health/",
    summary="Search backend health",
    description="Reports whether the app can reach Elasticsearch and which backend (Elasticsearch or MariaDB) currently serves search. Use to verify the ES deploy.",
)
async def search_health_endpoint(
    partner: Partner = Depends(get_public_partner),
) -> JSONResponse:
    return await search_controller.es_health()

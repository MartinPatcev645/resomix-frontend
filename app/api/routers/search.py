"""
Search API Router
=================

This module defines the FastAPI router for track search endpoints.
It handles HTTP requests for text-based track searches with authentication
and query parameter validation.

Provides RESTful API endpoints for searching tracks by title, artist,
and other metadata fields in the ResomiX system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Search endpoints 
from fastapi import APIRouter, Query, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.search_controller import SearchController
from app.api.dependencies.auth import get_api_key
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
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Search for tracks based on a query string.
    
    - **query**: Search term to find matching tracks across titles, artists, albums, and other metadata
    """
    return await search_controller.search_tracks(db, query) 
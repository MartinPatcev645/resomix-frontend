"""
Search Controller
=================

This controller handles HTTP requests for track search functionality.
It processes search queries and coordinates with search service to perform
text-based searches across tracks, artists, and other metadata fields.

Manages query validation, search parameter processing, and response formatting
for search-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Search controller 
from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Literal

from app.services.search_service import SearchService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class SearchController:
    def __init__(self):
        self.search_service = SearchService()

    async def search_tracks(self, db: AsyncSession, query: str, mode: Optional[Literal["artist", "title", "auto"]] = "auto") -> JSONResponse:
        """
        Search for tracks based on a query string.
        """
        log_request("search_tracks", "GET", {"query": query, "mode": mode})
        
        try:
            # Call the search function with mode parameter
            search_results = await self.search_service.search_tracks(db, query, mode)
            
            # Return success response with the search results
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=search_results)
            )
            
        except Exception as e:
            # Log the exception for debugging
            print(f"An error occurred in search_tracks: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            )

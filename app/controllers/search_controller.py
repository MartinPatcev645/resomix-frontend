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
from app.core.config import settings
from typing import Optional, Literal

from app.services.search_service import SearchService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class SearchController:
    def __init__(self):
        self.search_service = SearchService()

    @staticmethod
    def _resolve_limit(partner_id: Optional[int], authenticated_limit: Optional[int]) -> Optional[int]:
        """How many rows this caller gets.

        Three cases, and the middle one is easy to miss:

        * **A B2B partner** — ``None``, meaning the operational ceiling. This endpoint is their API,
          they are not on a consumer plan, and quietly cutting them to the consumer default would be
          a silent regression in a product other companies have integrated against.
        * **The frontend with no bearer** — the default. Guests and free users, i.e. almost every
          search. No token was sent, so nothing was looked up and nothing needs to be.
        * **The frontend with a bearer** — whatever their plan says. A free user whose client sends
          a token still resolves to the free value, so the client cannot award itself more results
          by sending one.
        """
        if partner_id is not None and partner_id != settings.system_partner_id:
            return None
        return settings.search_results_default if authenticated_limit is None else authenticated_limit

    async def search_tracks(
        self,
        db: AsyncSession,
        query: str,
        mode: Optional[Literal["artist", "title", "auto"]] = "auto",
        partner_id: Optional[int] = None,
        authenticated_limit: Optional[int] = None,
    ) -> JSONResponse:
        """
        Search for tracks based on a query string.

        ``authenticated_limit`` is the caller's ``search_results_max`` when they sent a bearer
        token, else None. See ``_resolve_limit`` for how that becomes a row count.
        """
        limit = self._resolve_limit(partner_id, authenticated_limit)
        log_request("search_tracks", "GET", {"query": query, "mode": mode})
        
        try:
            # Call the search function with mode parameter
            search_results = await self.search_service.search_tracks(
                db, query, mode, partner_id=partner_id, limit=limit
            )
            
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

    async def es_health(self) -> JSONResponse:
        """Report whether the app can reach Elasticsearch and which backend serves search."""
        log_request("search_es_health", "GET", {})
        data = self.search_service.es_health()
        # Healthy = ES disabled (MariaDB path is fine) OR ES reachable with a populated alias.
        healthy = (not data["elasticsearch_enabled"]) or (data["reachable"] and data["alias_exists"])
        return JSONResponse(
            status_code=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
            content=format_response(success=healthy, data=data),
        )

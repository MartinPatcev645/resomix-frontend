# Search controller 
from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.search_service import SearchService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class SearchController:
    def __init__(self):
        self.search_service = SearchService()

    async def search_tracks(self, db: AsyncSession, query: str) -> JSONResponse:
        """
        Search for tracks based on a query string.
        """
        log_request("search_tracks", "GET", {"query": query})
        
        try:
            # Call the search function
            search_results = await self.search_service.search_tracks(db, query)
            
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
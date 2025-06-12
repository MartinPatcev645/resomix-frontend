# Search endpoints 
from fastapi import APIRouter, Query, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.search_controller import SearchController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session

router = APIRouter(tags=["search"])

# Initialize controller
search_controller = SearchController()


@router.get("/search_tracks/")
async def search_tracks_endpoint(
    query: str = Query(..., description="The search term"),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Search for tracks based on a query string.
    
    - **query**: Search term to find matching tracks
    """
    return await search_controller.search_tracks(db, query) 
from fastapi import APIRouter, Security, Depends, Request, status
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.utils.response_utils import format_response

router = APIRouter(
    prefix="/dummy",
    tags=["dummy"],
    responses={
        404: {"description": "File not found"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"}
    }
)


@router.get(
    "/dummy-hls/{playlist_id}.m3u8",
    summary="Get Dummy HLS M3U8",
    description="Return the static hls.m3u8 file content regardless of playlist ID.",
    responses={
        200: {
            "description": "M3U8 file returned successfully",
            "content": {
                "application/vnd.apple.mpegurl": {
                    "example": "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n..."
                }
            }
        },
        404: {"description": "File not found"},
        422: {"description": "Invalid playlist ID"},
        500: {"description": "Internal server error"}
    }
)
async def dummy_hls_endpoint(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),  # Unused but keeps schema consistent
    api_key: str = Security(get_api_key)
):
    """
    Return the content of the local **hls.m3u8** file.

    - **playlist_id**: UUID of the playlist (ignored)
    """
    try:
        file_path = os.path.join(os.getcwd(), "hls.m3u8")
        if not os.path.exists(file_path):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="hls.m3u8 not found")
            )

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        return Response(content=content, media_type="application/vnd.apple.mpegurl", status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error=str(e))
        )

"""
Similarity API Router
=====================

This module defines the FastAPI router for audio similarity endpoints.
It handles HTTP requests for similarity calculations including file uploads
and track ID-based similarity queries with authentication and validation.

Provides RESTful API endpoints for the core similarity functionality
of the Resomix audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Similarity endpoints 
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Query, Security, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.similarity_controller import SimilarityController
from app.api.dependencies.partner import get_current_partner, get_current_partner_scoped
from app.api.dependencies.auth import get_current_user_optional
from app.models.partner import Partner
from app.api.dependencies.database import get_database_session
from app.repositories.playlist_repository import PlaylistRepository
from app.models.user import User
from fastapi import HTTPException
from app.schemas.similarity import (
    SimilarityByIdRequest,
    SimilarityUploadSuccessResponse,
    SimilarityByIdSuccessResponse,
    SimilarityErrorResponse
)

router = APIRouter(
    tags=["similarity"],
    responses={
        403: {"model": SimilarityErrorResponse},
        415: {"model": SimilarityErrorResponse},
        422: {"model": SimilarityErrorResponse},
        500: {"model": SimilarityErrorResponse},
        503: {"model": SimilarityErrorResponse}
    }
)

# Initialize controller
similarity_controller = SimilarityController()
playlist_repository = PlaylistRepository()


@router.post(
    "/similarity/upload",
    response_model=SimilarityUploadSuccessResponse,
    summary="Upload Track and Calculate Similarity",
    description="Upload an audio file, store it in the database, and get similar tracks.",
    responses={
        200: {
            "model": SimilarityUploadSuccessResponse,
            "description": "Track uploaded and similarity calculation completed successfully"
        },
        415: {
            "model": SimilarityErrorResponse,
            "description": "Unsupported media type or invalid audio file"
        },
        422: {
            "model": SimilarityErrorResponse,
            "description": "File too large, empty, or validation error"
        },
        500: {
            "model": SimilarityErrorResponse,
            "description": "Database upload or internal server error"
        },
        503: {
            "model": SimilarityErrorResponse,
            "description": "Similarity service unavailable"
        }
    }
)
@router.post("/get_similarity/", include_in_schema=False) # Legacy
async def get_similarity_upload_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Audio file to analyze for similarity (max 100MB)"), 
    top_sk: Optional[int] = Query(None, description="Number of similar tracks to return (10, 20, 50, or 100)"),
    engine: Optional[str] = Query(None, description="Similarity engine (E1-E6)"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner_scoped("search:read", allow_anonymous=True)),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Upload an audio track and find similar tracks.
    
    This endpoint performs a two-step process:
    1. **Upload to Database**: Extracts metadata and stores the track with type="upload"
    2. **Similarity Analysis**: Finds similar tracks and returns results
    
    The response includes both the uploaded track information and similarity results.
    
    - **file**: The audio file to upload and analyze (max 100MB)
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    - **engine**: Similarity engine to use (E1-E6). Optional.
    
    Note: If authenticated via JWT, user context is automatically associated with the upload.
    """
    # NOTE: engine parameter is intentionally ignored (set to empty string)
    # The backend flow is preserved for potential future use when re-enabling engine selection
    return await similarity_controller.get_similarity_upload(
        db=db,
        request=request,
        file=file,
        current_user=current_user,
        top_sk=top_sk,
        engine="",  # Ignoring frontend value
        partner_id=partner.id
    )


@router.post(
    "/similarity/upload/async",
    status_code=202,
    summary="Upload a track and queue its similarity search (poll for the result)",
    description=(
        "Accepts the upload, returns a job id immediately, and processes the similarity search "
        "in the background. Poll `GET /similarity/upload/{job_id}/status` for the result.\n\n"
        "Prefer this over `POST /similarity/upload` for anything but small files: the blocking "
        "endpoint holds the request open for the whole pipeline, and Cloudflare closes an origin "
        "request at 100 seconds — large concurrent uploads complete on the server and are then "
        "discarded as 524s."
    ),
    responses={
        202: {"description": "Upload accepted; poll the status endpoint with the returned job_id"},
        415: {"model": SimilarityErrorResponse, "description": "Unsupported media type or invalid audio file"},
        422: {"model": SimilarityErrorResponse, "description": "File too large, empty, or validation error"},
        503: {"model": SimilarityErrorResponse, "description": "Job store unavailable — upload not accepted"},
    },
)
async def submit_similarity_upload_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Audio file to analyze for similarity (max 100MB)"),
    top_sk: Optional[int] = Query(None, description="Number of similar tracks to return (10, 20, 50, or 100)"),
    engine: Optional[str] = Query(None, description="Similarity engine (E1-E6)"),
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner_scoped("search:read", allow_anonymous=True)),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    """Submit an upload for background similarity processing.

    Applies exactly the same gates as the blocking endpoint — entitlement, per-IP burst brake,
    monthly upload allowance, antivirus, audio validity — so anything the caller needs to be told
    immediately is still answered immediately. Only the GPU work moves off the request.
    """
    return await similarity_controller.submit_similarity_upload(
        db=db,
        request=request,
        file=file,
        current_user=current_user,
        top_sk=top_sk,
        engine="",  # Ignored, as on the blocking endpoint
        partner_id=partner.id,
    )


@router.get(
    "/similarity/upload/{job_id}/status",
    summary="Poll a submitted similarity upload",
    description=(
        "Returns `{state}` — `queued`, `running`, `done` or `failed`. When `done`, `result` holds "
        "the same payload the blocking upload endpoint returns in `data`."
    ),
    responses={
        403: {"model": SimilarityErrorResponse, "description": "Not the owner of this upload"},
        404: {"model": SimilarityErrorResponse, "description": "Unknown or expired job"},
    },
)
async def similarity_upload_status_endpoint(
    job_id: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner_scoped("search:read", allow_anonymous=True)),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> JSONResponse:
    return await similarity_controller.get_upload_job(
        db=db, job_id=job_id, current_user=current_user, partner_id=partner.id
    )


@router.post(
    "/similarity/search",
    response_model=SimilarityByIdSuccessResponse,
    summary="Calculate Similarity by Track ID",
    description="Get similar tracks for a track identified by its database ID.",
    responses={
        200: {
            "model": SimilarityByIdSuccessResponse,
            "description": "Similarity calculation completed successfully"
        },
        404: {
            "model": SimilarityErrorResponse,
            "description": "Track not found or path missing"
        },
        422: {
            "model": SimilarityErrorResponse,
            "description": "Invalid track ID or validation error"
        },
        503: {
            "model": SimilarityErrorResponse,
            "description": "Similarity service unavailable"
        }
    }
)
@router.post("/get_selection_similarity/", include_in_schema=False) # Legacy
async def get_similarity_by_id_endpoint(
    request: Request,
    request_data: SimilarityByIdRequest,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner_scoped("search:read", allow_anonymous=True)),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> JSONResponse:
    """
    Get similar tracks for a track identified by its database ID.
    
    - **track_id**: The database ID of the track to find similar tracks for.
    - **top_sk**: Number of similar tracks to return (10, 20, 50, or 100). Defaults to 20 if not provided or invalid.
    - **engine**: Similarity engine to use (E1-E6). Optional.
    
    Note: If authenticated via JWT, user context is automatically associated.
    """
    # NOTE: engine parameter is intentionally ignored (set to empty string)
    # The backend flow is preserved for potential future use when re-enabling engine selection
    return await similarity_controller.get_similarity_by_id(
        db=db,
        request=request,
        track_id=request_data.track_id,
        current_user=current_user,
        top_sk=request_data.top_sk,
        engine="",  # Ignoring frontend value
        partner_id=partner.id
    )


# New endpoint to poll segment status

@router.get(
    "/similarity/segment-status/{playlist_uuid}",
    summary="Check if segment preview processing completed for a playlist",
    description="Returns segmentation_completed true/false based on playlist type. Enforces partner scoping.",
    response_model=dict,
)
@router.get("/segment_status/{playlist_uuid}", include_in_schema=False) # Legacy
async def segment_status_endpoint(
    playlist_uuid: str,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_current_partner)
) -> JSONResponse:
    playlist = await playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid, partner_id=partner.id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    completed = playlist.type != "waiting_segments"
    return JSONResponse(content={"segmentation_completed": completed})

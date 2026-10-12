"""
Bandcamp API Router
===================

Import a user's PUBLIC Bandcamp collection into Resomix. All routes require a logged-in user.
Bandcamp access happens server-side only, from public pages — no Bandcamp login or password.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_database_session
from app.api.dependencies.partner import get_public_partner
from app.controllers.bandcamp_controller import BandcampController
from app.models.partner import Partner
from app.models.user import User
from app.schemas.bandcamp import BandcampConnectRequest

router = APIRouter(prefix="/bandcamp", tags=["bandcamp"])

bandcamp_controller = BandcampController()


@router.post(
    "/connect",
    status_code=202,
    summary="Connect a public Bandcamp collection",
    description=(
        "Verify the public Bandcamp collection for `username`, save the connection and start an "
        "import job. Returns `{job_id}`. 404 unknown user, 403 private collection, 429 rate limited, "
        "503 when Bandcamp's bot check blocks the request."
    ),
)
async def connect_bandcamp_endpoint(
    request_data: BandcampConnectRequest,
    db: AsyncSession = Depends(get_database_session),
    partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    return await bandcamp_controller.connect(db, current_user, request_data.username, partner.id)


@router.get(
    "/sync/{job_id}",
    summary="Bandcamp import progress",
    description="`{status, processed, total, error}` for one of the current user's import jobs.",
)
async def get_bandcamp_sync_endpoint(
    job_id: str,
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    return await bandcamp_controller.get_sync_status(db, current_user, job_id)


@router.get(
    "/collection",
    summary="Imported Bandcamp collection",
    description=(
        "Paginated imported items, newest purchase first. `q` filters on artist, title or album. "
        "`matched=true` returns only items linked to a Resomix track. Albums are imported but not "
        "matched to catalogue tracks: matching one would mean fetching its page from Bandcamp."
    ),
)
async def get_bandcamp_collection_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, max_length=200),
    matched: bool = Query(False, description="When true, only items matched to a Resomix track"),
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    return await bandcamp_controller.get_collection(db, current_user, page, page_size, q, matched)


@router.get(
    "/connection",
    summary="Bandcamp connection state",
    description=(
        "`{connected, username, status, last_synced_at, active_job_id, item_count, matched_count, "
        "error_message}`. `status` is `none | pending | syncing | ready | partial | failed`. "
        "`error_message` is null when the last sync finished the collection. "
        "`partial` means the request cap stopped the import early; sync again to continue. "
        "Always 200: no connection is `connected=false`."
    ),
)
async def get_bandcamp_connection_endpoint(
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    return await bandcamp_controller.get_connection(db, current_user)


@router.delete(
    "/connection",
    summary="Disconnect Bandcamp",
    description="Remove the Bandcamp connection and every imported collection row for the current user.",
)
async def delete_bandcamp_connection_endpoint(
    db: AsyncSession = Depends(get_database_session),
    _partner: Partner = Depends(get_public_partner),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    return await bandcamp_controller.disconnect(db, current_user)

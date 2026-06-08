"""
Partner-facing API Endpoints
============================

Endpoints accessible to B2B Partners using their API keys.
Includes account info, usage statistics, and scoping verification.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.api.dependencies.partner import get_current_partner
from app.models.partner import Partner
from app.schemas.partner import PartnerBaseResponse
from app.services.hetzner_service import HetznerService
from app.utils.response_utils import format_response
from app.utils.edge_auth import generate_playback_token

router = APIRouter(prefix="/partner", tags=["B2B Partner"])
hetzner_service = HetznerService()


def _extract_client_ip(request: Request) -> str:
    """Resolve the originating client IP, honouring upstream proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


@router.post("/playback-token")
async def mint_playback_token(
    request: Request,
    partner: Partner = Depends(get_current_partner),
):
    """
    Mint a short-lived "valet" playback token for the authenticated partner.

    The partner authenticates once with their Bearer API key, and receives an
    HS256 JWT (signed with the shared ``EDGE_JWT_SECRET``) carrying
    ``{partner_id, scope: "playback", ip, exp}``. They then attach this token to
    Hetzner playback/serving requests for the duration of its TTL, and Hetzner
    resolves partner-scoped assets directly from the verified claim — no database
    access or per-request API-key validation required on the edge.
    """
    client_ip = _extract_client_ip(request)
    token_data = generate_playback_token(partner_id=partner.id, client_ip=client_ip)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=jsonable_encoder(format_response(
            success=True,
            data={
                "token": token_data["token"],
                "expires_in": token_data["expires_in"],
                "partner_id": partner.id,
                "scope": "playback",
            },
        )),
    )

@router.get("/me")
async def get_partner_info(
    request: Request,
    partner: Partner = Depends(get_current_partner)
):
    """
    Get information about the current authenticated partner.
    
    Verifies that the API key is working and request.state is populated.
    """
    # Standardize response using format_response helper
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=jsonable_encoder(format_response(
            success=True,
            data=PartnerBaseResponse.model_validate(partner).model_dump()
        ))
    )


@router.get("/deletion-log")
async def get_deletion_log(
    request: Request,
    partner: Partner = Depends(get_current_partner),
    from_date: Optional[str] = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(default=None, description="End date filter (YYYY-MM-DD)"),
):
    """
    Retrieve ECDSA-signed audit log of track deletions for the authenticated partner.
    Requires partner:read scope.
    """
    result = await hetzner_service.get_deletion_log(
        partner_id=partner.id,
        from_date=from_date,
        to_date=to_date,
    )
    if not result.get("success"):
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=format_response(success=False, error=result.get("error", "Failed to fetch audit log")),
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=jsonable_encoder(format_response(success=True, data=result["data"])),
    )

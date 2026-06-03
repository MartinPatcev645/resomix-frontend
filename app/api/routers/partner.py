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

router = APIRouter(prefix="/partner", tags=["B2B Partner"])
hetzner_service = HetznerService()

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

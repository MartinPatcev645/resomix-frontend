"""
Partner-facing API Endpoints
============================

Endpoints accessible to B2B Partners using their API keys.
Includes account info, usage statistics, and scoping verification.

Version: 1.0.0
Date: May 09, 2026
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.api.dependencies.partner import get_current_partner
from app.models.partner import Partner
from app.schemas.partner import PartnerBaseResponse
from app.utils.response_utils import format_response

router = APIRouter(prefix="/partner", tags=["B2B Partner"])

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

"""
Partner Authentication Dependencies
==================================

FastAPI dependencies for validating B2B Partner API keys.
Extracts 'Authorization: Bearer rmx_...' and validates against the database.

Version: 1.0.0
Date: May 09, 2026
"""

from fastapi import Depends, HTTPException, Security, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.services.partner_service import PartnerService
from app.models.partner import Partner, PartnerApiKey

# Use HTTPBearer for Authorization: Bearer <token>
# But we expect rmx_... format
security_scheme = HTTPBearer(auto_error=False)

async def get_current_partner(
    request: Request,
    auth: HTTPAuthorizationCredentials = Security(security_scheme),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """
    Dependency to get the current B2B partner from the API key.
    
    Populates request.state.partner_id and request.state.api_key_id.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key in Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    api_key_string = auth.credentials
    
    # Optional: Basic format check to fail fast
    if not api_key_string.startswith("rmx_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key format",
        )
        
    try:
        partner, api_key = await partner_service.validate_api_key(db, api_key_string)
        
        # Inject into request state for later use (scoping/logging)
        request.state.partner_id = partner.id
        request.state.api_key_id = api_key.id
        
        # Update last used info (background-ish)
        # Note: We update last_used_ip from the request
        client_ip = request.client.host if request.client else "unknown"
        await partner_service.api_key_repo.async_touch_last_used(db, api_key.id, client_ip)
        
        return partner
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

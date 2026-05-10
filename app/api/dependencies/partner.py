"""
Partner Authentication Dependencies
==================================

FastAPI dependencies for validating B2B Partner API keys.
Extracts 'Authorization: Bearer rmx_...' and validates against the database.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import Optional
from fastapi import Depends, HTTPException, Security, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user_optional
from app.services.partner_service import PartnerService
from app.models.partner import Partner, PartnerApiKey
from app.core.context import set_current_partner_id
import logging

logger = logging.getLogger(__name__)

# Use HTTPBearer for Authorization: Bearer <token>
# Supports both rmx_... (B2B) and legacy JWT
security_scheme = HTTPBearer(auto_error=False)

# Constants
SYSTEM_PARTNER_ID = 1  # Resomix System Partner

async def _get_partner_core(
    request: Request,
    auth: HTTPAuthorizationCredentials,
    db: AsyncSession,
    partner_service: PartnerService,
    required_scope: Optional[str] = None
) -> Partner:
    """Internal core logic for partner resolution."""
    # 1. Try Partner API Key (rmx_...)
    if auth and auth.credentials and auth.credentials.startswith("rmx_"):
        try:
            partner, api_key = await partner_service.validate_api_key(db, auth.credentials, required_scope=required_scope)
            request.state.partner_id = partner.id
            request.state.api_key_id = api_key.id
            
            # Update last used info
            client_ip = request.client.host if request.client else "unknown"
            await partner_service.api_key_repo.async_touch_last_used(db, api_key.id, client_ip)
            
            # Set the partner_id in the request context for global failsafe
            set_current_partner_id(partner.id)
            
            return partner
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    # 2. Standard Platform Access (Legacy JWT)
    # If it's a valid User JWT from the main Resomix frontend, bucket into System Partner context
    partner = None
    user = await get_current_user_optional(auth.credentials if auth else None, db)
    if user:
        # Default Platform Tenant for all B2C / Internal traffic
        partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
        request.state.partner_id = SYSTEM_PARTNER_ID

    # 3. Anonymous Public Traffic
    # All non-authenticated requests default to the System Partner (Tenant ID 1)
    if not partner:
        logger.debug("AUTH: Defaulting to System Partner (Tenant ID 1) for public/anonymous traffic")
        partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)

    if not partner:
        logger.error(f"FATAL: System Partner (ID {SYSTEM_PARTNER_ID}) is missing from the database!")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System configuration error: Default partner not found."
        )

    # Set the partner_id in the request context for global failsafe
    set_current_partner_id(partner.id)
    request.state.partner_id = partner.id
    
    return partner

async def get_current_partner(
    request: Request,
    auth: HTTPAuthorizationCredentials = Security(security_scheme),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """Default dependency for getting current partner (no scope check)."""
    return await _get_partner_core(request, auth, db, partner_service)

def get_current_partner_scoped(required_scope: str):
    """Factory for getting partner with a required scope."""
    async def scoped_dependency(
        request: Request,
        auth: HTTPAuthorizationCredentials = Security(security_scheme),
        db: AsyncSession = Depends(get_database_session),
        partner_service: PartnerService = Depends(PartnerService)
    ) -> Partner:
        return await _get_partner_core(request, auth, db, partner_service, required_scope=required_scope)
    return scoped_dependency

async def get_tenant_id(
    request: Request,
    partner: Partner = Depends(get_current_partner)
) -> int:
    """
    Ultra-lightweight dependency that just returns the resolved partner_id.
    Ensures request.state.partner_id is populated.
    """
    return partner.id

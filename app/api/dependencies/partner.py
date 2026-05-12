"""
Partner Authentication Dependencies
==================================

FastAPI dependencies for validating B2B Partner API keys.
Extracts 'Authorization: Bearer rmx_...' and validates against the database.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import Optional
from fastapi import Depends, HTTPException, Security, Request, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user_optional, api_key_query
from app.services.partner_service import PartnerService
from app.services.rate_limit_service import RateLimitService
from app.models.partner import Partner, PartnerApiKey
from app.core.context import set_current_partner_id
import logging

logger = logging.getLogger(__name__)

# Initialize rate limit service
rate_limit_service = RateLimitService()

# Use HTTPBearer for Authorization: Bearer <token>
# Supports both rmx_... (B2B) and legacy JWT
security_scheme = HTTPBearer(auto_error=False)

# Constants
SYSTEM_PARTNER_ID = 1  # Resomix System Partner

import sys

async def _get_partner_core(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials],
    db: AsyncSession,
    partner_service: PartnerService,
    background_tasks: BackgroundTasks,
    api_key_token: Optional[str] = None,
    required_scope: Optional[str] = None,
    allow_anonymous: bool = False
) -> Partner:
    """Internal core logic for partner resolution."""
    # Extract token from Bearer auth or query param
    token = auth.credentials if auth else api_key_token
    
    # 1. Try Partner API Key (rmx_...)
    if token and token.startswith("rmx_"):
        try:
            partner, api_key = await partner_service.validate_api_key(db, token, required_scope=required_scope)
            
            # Capture metadata in request state
            request.state.partner_id = partner.id
            request.state.api_key_id = api_key.id
            
            # Update last used metadata in background
            client_ip = request.client.host if request.client else "unknown"
            background_tasks.add_task(partner_service.update_api_key_usage, api_key.id, client_ip)
            
            # Layer 1 & 2 Rate Limiting (W1-7, W1-8)
            allowed, error_code, retry_after = await rate_limit_service.check_rate_limits(
                db=db,
                api_key_id=api_key.id,
                partner_id=partner.id,
                rps_limit=api_key.rate_limit_rps or 10,
                monthly_limit=api_key.rate_limit_monthly or 100000
            )
            
            if not allowed:
                headers = {}
                if retry_after:
                    headers["Retry-After"] = str(int(retry_after))
                
                detail = "Rate limit exceeded" if error_code == "RATE_LIMIT_EXCEEDED" else "Monthly quota exceeded"
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=detail,
                    headers=headers
                )

            # Set the partner_id in the request context for global failsafe
            set_current_partner_id(partner.id)
            request.state.partner_id = partner.id
            request.state.api_key_id = api_key.id
            
            # Update last used metadata in background (W1-8)
            client_ip = request.client.host if request.client else "unknown"
            background_tasks.add_task(partner_service.update_api_key_usage, api_key.id, client_ip)
            
            return partner
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    # 2. Standard Platform Access (Legacy JWT or Admin Key)
    # If it matches the system API key or is a valid User JWT, bucket into System Partner context
    partner = None
    
    # Check for Admin/Frontend System Key
    from app.core.config import settings
    from app.core.context import set_admin_context
    if token == settings.api_key:
        partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
        set_admin_context(True)
        request.state.partner_id = SYSTEM_PARTNER_ID
    else:
        # Check for User JWT or Anonymous fallback
        if token:
            user = await get_current_user_optional(token, db)
            if user:
                # Default Platform Tenant for all B2C / Internal traffic
                partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
                request.state.partner_id = SYSTEM_PARTNER_ID
        elif allow_anonymous and not required_scope:
            # 3. Anonymous Public Access (Default to Partner 1)
            # This allows the frontend search and public endpoints to function without a key.
            partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
            request.state.partner_id = SYSTEM_PARTNER_ID

    # 3. Deny Anonymous Public Traffic
    # Unauthenticated requests to scoped endpoints MUST fail with 401.
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Partner API key or user session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Finalize Context
    # Set the partner_id in the request context for global failsafe
    set_current_partner_id(partner.id)
    request.state.partner_id = partner.id
    
    return partner

async def get_current_partner(
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    api_key_token: Optional[str] = Security(api_key_query),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """Default dependency for getting current partner (REQUIRES token)."""
    return await _get_partner_core(request, auth, db, partner_service, background_tasks, api_key_token=api_key_token, allow_anonymous=False)

async def get_public_partner(
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    api_key_token: Optional[str] = Security(api_key_query),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """Dependency that allows anonymous fallback to Partner 1 (Public Access)."""
    return await _get_partner_core(request, auth, db, partner_service, background_tasks, api_key_token=api_key_token, allow_anonymous=True)

def get_current_partner_scoped(required_scope: str):
    """Factory for getting partner with a required scope."""
    async def scoped_dependency(
        request: Request,
        background_tasks: BackgroundTasks,
        auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
        api_key_token: Optional[str] = Security(api_key_query),
        db: AsyncSession = Depends(get_database_session),
        partner_service: PartnerService = Depends(PartnerService)
    ) -> Partner:
        return await _get_partner_core(
            request, auth, db, partner_service, background_tasks, 
            api_key_token=api_key_token, required_scope=required_scope
        )
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


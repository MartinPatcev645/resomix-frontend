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
from app.api.dependencies.auth import get_current_user_optional, api_key_header
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
    """Internal core logic for partner resolution.

    Credential priority (do NOT confuse the partner key with the admin/system key):
      1. Partner API key (``rmx_…``) — scopes the request to THAT partner. Wins over
         everything, from whichever source it arrives (Bearer header, ``X-Api-Key``
         header, or ``?api_key=`` query param). So a request carrying BOTH a user
         JWT and a partner key is scoped to the partner.
      2. Admin/frontend system key (``settings.api_key``) — System Partner 1 + admin.
      3. User JWT — System Partner 1 (the global open-tracks catalog).
      4. Anonymous — System Partner 1, only when ``allow_anonymous`` and no scope.
    """
    # Gather every place a credential can arrive, then split partner key vs.
    # platform (JWT/admin) token so an rmx_ key always takes priority regardless of
    # which header carried the JWT.
    bearer_token = auth.credentials if auth else None
    candidates = [
        t for t in (bearer_token, api_key_token, request.query_params.get("api_key")) if t
    ]
    partner_key = next((t for t in candidates if t.startswith("rmx_")), None)
    platform_token = next((t for t in candidates if not t.startswith("rmx_")), None)

    # 1. Try Partner API Key (rmx_...) — highest priority
    if partner_key:
        try:
            partner, api_key = await partner_service.validate_api_key(db, partner_key, required_scope=required_scope)
            
            # Set the partner_id in the request context for global failsafe (W1-6)
            set_current_partner_id(partner.id)
            request.state.partner_id = partner.id
            request.state.api_key_id = api_key.id

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
                if retry_after is not None:
                    headers["Retry-After"] = str(max(1, int(retry_after + 0.99)))
                
                detail = "Rate limit exceeded" if error_code == "RATE_LIMIT_EXCEEDED" else "Monthly quota exceeded"
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=detail,
                    headers=headers
                )

            # Update metadata in background (W1-8)
            client_ip = request.client.host if request.client else "unknown"
            background_tasks.add_task(partner_service.update_api_key_usage, api_key.id, client_ip)
            
            return partner
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    # 2. Standard Platform Access (Legacy JWT or Admin Key) — only reached when no
    #    partner key was supplied, so an authenticated user always lands on the
    #    global System Partner 1 catalog.
    partner = None

    # Check for Admin/Frontend System Key
    from app.core.config import settings
    from app.core.context import set_admin_context
    if platform_token and platform_token == settings.api_key:
        partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
        set_admin_context(True)
        request.state.partner_id = SYSTEM_PARTNER_ID
    else:
        # Check for User JWT or Anonymous fallback
        if platform_token:
            user = await get_current_user_optional(platform_token, db)
            if user:
                partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
                request.state.partner_id = SYSTEM_PARTNER_ID
        elif allow_anonymous and not required_scope:
            partner = await partner_service.partner_repo.async_get_by_id(db, SYSTEM_PARTNER_ID)
            request.state.partner_id = SYSTEM_PARTNER_ID

    if not partner:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Partner API key or user session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    set_current_partner_id(partner.id)
    request.state.partner_id = partner.id
    
    return partner

async def get_current_partner(
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    api_key_header: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """Default dependency for getting current partner (REQUIRES token)."""
    # Pass the raw X-Api-Key separately (the Bearer header is forwarded via `auth`)
    # so _get_partner_core can prioritise an rmx_ partner key over a JWT.
    return await _get_partner_core(request, auth, db, partner_service, background_tasks, api_key_token=api_key_header, allow_anonymous=False)

async def get_public_partner(
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    api_key_header: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_database_session),
    partner_service: PartnerService = Depends(PartnerService)
) -> Partner:
    """Dependency that allows anonymous fallback to Partner 1 (Public Access)."""
    return await _get_partner_core(request, auth, db, partner_service, background_tasks, api_key_token=api_key_header, allow_anonymous=True)

def get_current_partner_scoped(required_scope: str):
    """Factory for getting partner with a required scope."""
    async def scoped_dependency(
        request: Request,
        background_tasks: BackgroundTasks,
        auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
        api_key_header: Optional[str] = Security(api_key_header),
        db: AsyncSession = Depends(get_database_session),
        partner_service: PartnerService = Depends(PartnerService)
    ) -> Partner:
        return await _get_partner_core(
            request, auth, db, partner_service, background_tasks,
            api_key_token=api_key_header, required_scope=required_scope
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


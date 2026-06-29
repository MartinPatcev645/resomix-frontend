"""
Idempotency Middleware
======================

This middleware enforces request idempotency for POST and PUT requests that
include an 'Idempotency-Key' header.

Workflow:
1. Extract 'Idempotency-Key' from headers.
2. If present, check Redis for a previously stored response for this partner/key.
3. If found, return the cached response immediately (short-circuiting logic).
4. If not found, execute the request, capture the response, and store it in Redis.

Dependencies:
- Requires 'request.state.partner_id' to be set (run after auth middleware).
"""

import json
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import Message
import logging

from app.services.idempotency_service import IdempotencyService
from app.services.partner_service import PartnerService
from app.api.dependencies.database import AsyncSessionLocal
from app.api.dependencies.auth import get_current_user_optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle idempotency using Redis.
    """
    
    def __init__(self, app, ttl: int = 86400):
        super().__init__(app)
        self.service = IdempotencyService(ttl=ttl)
        # Only these methods are typically idempotency-eligible
        self.idempotent_methods = {"POST", "PUT", "PATCH"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Quick check: method and header
        idempotency_key = request.headers.get("Idempotency-Key")
        if request.method not in self.idempotent_methods or not idempotency_key:
            return await call_next(request)

        # 2. Get partner context
        # We try to get it from request.state (if another middleware set it)
        # or extract it from headers ourselves to allow early short-circuiting.
        partner_id = getattr(request.state, "partner_id", None)
        
        if not partner_id:
            # Try to resolve partner from Authorization header (rmx_...)
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer rmx_"):
                token = auth_header.replace("Bearer ", "")
                try:
                    async with AsyncSessionLocal() as db:
                        service = PartnerService()
                        partner, _ = await service.validate_api_key(db, token)
                        partner_id = partner.id
                        # Store it so subsequent middlewares/dependencies can reuse it
                        request.state.partner_id = partner_id
                except Exception:
                    # If auth fails here, we let the router dependencies handle it (401/403)
                    pass
            elif auth_header and auth_header.startswith("Bearer "):
                # Frontend JWT Access
                token = auth_header.replace("Bearer ", "")
                try:
                    async with AsyncSessionLocal() as db:
                        user = await get_current_user_optional(token, db)
                        if user:
                            # Frontend users are mapped to the System Partner
                            # (env SYSTEM_PARTNER_ID, default 1) as the tenant scope for idempotency
                            partner_id = settings.system_partner_id
                            request.state.partner_id = partner_id
                except Exception:
                    pass

        if not partner_id:
            # If no partner context can be resolved yet, we can't safely short-circuit.
            # We call next and hope we can at least SAVE the response later.
            response = await call_next(request)
            return response

        # 3. Check for cached response
        cached = await self.service.get_stored_response(partner_id, idempotency_key)
        if cached:
            status_code, body, headers = cached
            logger.info(f"Idempotency hit: partner={partner_id}, key={idempotency_key}")
            # Add a header to indicate this was a cached response
            headers["X-Idempotency-Hit"] = "true"
            return JSONResponse(content=body, status_code=status_code, headers=headers)

        # 4. Execute request and capture response
        # We need to read the response body to cache it.
        # BaseHTTPMiddleware doesn't make this easy without affecting the response stream.
        # We'll use a trick to capture the body.
        
        response = await call_next(request)
        
        # Only cache successful responses (2xx) or client errors (4xx) 
        # Server errors (5xx) should NOT be cached as they might be transient.
        if 200 <= response.status_code < 500:
            # We need to capture the response body. 
            # Since BaseHTTPMiddleware can't easily read the response after it's sent,
            # we'll consume it and rebuild the response.
            
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk
            
            try:
                body_json = json.loads(response_body)
                
                # Save to Redis
                await self.service.save_response(
                    partner_id=partner_id,
                    idempotency_key=idempotency_key,
                    status_code=response.status_code,
                    body=body_json,
                    headers=dict(response.headers)
                )
                
                # Reconstruct response
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
            except Exception as e:
                # If body is not JSON or saving fails, just return original content
                logger.warning(f"Could not cache idempotent response: {e}")
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )

        return response

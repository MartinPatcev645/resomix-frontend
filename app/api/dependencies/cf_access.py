"""
Cloudflare Access dependency
============================

FastAPI dependency that enforces a valid Cloudflare Access (Zero Trust) assertion on the routes it
guards — currently the admin surface. It is the network-perimeter half of admin's defence in depth;
the app's own admin JWT (``require_admin``) remains the second, independent layer.

Behaviour:
  * ``cf_access_enabled = False`` (default) → NO-OP. Keeps local/dev and any origin that isn't yet
    reached through the Access-protected hostname fully working.
  * ``cf_access_enabled = True``  → the request must carry a valid ``Cf-Access-Jwt-Assertion``
    header (Cloudflare injects it after the user passes Access). Anything else → 403.

⚠️ Only enable once the admin API is reached THROUGH the Access-protected origin (same-origin as the
admin SPA). If the admin app calls a host without an Access application in front of it, Cloudflare
won't inject the header and every admin call will 403.
"""

import asyncio
import logging

from fastapi import HTTPException, Request
from starlette.status import HTTP_403_FORBIDDEN

from app.core.config import settings
from app.utils.cf_access import verify_access_jwt, CfAccessError

logger = logging.getLogger(__name__)

# Cloudflare injects the assertion as this header; it also sets a `CF_Authorization` cookie we
# accept as a fallback (e.g. same-origin navigations that don't carry the header).
_HEADER = "Cf-Access-Jwt-Assertion"
_COOKIE = "CF_Authorization"


async def require_cf_access(request: Request) -> None:
    """Reject requests that didn't pass Cloudflare Access (when enforcement is enabled)."""
    if not settings.cf_access_enabled:
        return

    token = request.headers.get(_HEADER) or request.cookies.get(_COOKIE)
    try:
        # verify_access_jwt may do a one-off JWKS fetch (cached); keep it off the event loop.
        claims = await asyncio.to_thread(verify_access_jwt, token or "")
    except CfAccessError as e:
        logger.warning("Cloudflare Access denied for %s: %s", request.url.path, e)
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Access denied. This area requires sign-in through the secure gateway.",
        )

    # Expose the verified identity for downstream logging/auditing.
    request.state.cf_access_claims = claims
    request.state.cf_access_email = claims.get("email")

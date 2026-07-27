"""
Cloudflare Access (Zero Trust) token verification
=================================================

Verifies the ``Cf-Access-Jwt-Assertion`` JWT that Cloudflare injects into every request it proxies
to an Access-protected origin. This is the edge identity gate: a request that did NOT pass through
Cloudflare Access (e.g. one that reached the origin directly by IP) carries no valid assertion and
is rejected.

Verification steps (per Cloudflare's spec):
  1. Read the token's ``kid`` and match it to a key in the team JWKS
     (``https://<team-domain>/cdn-cgi/access/certs``).
  2. Verify the RS256 signature, the ``aud`` (the Access application's AUD tag), the ``iss``
     (``https://<team-domain>``), and expiry — all enforced by ``jwt.decode``.

The JWKS is cached in-process with a short TTL and refreshed on a cache miss (Cloudflare rotates
signing keys), so steady-state verification does no network I/O. Mirrors the jose-based approach in
``app/utils/edge_auth.py``.

Version: 1.0.0
Date: 2026-07-27
"""

import time
import logging
import threading
from typing import Any, Dict, List, Optional

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import settings

logger = logging.getLogger(__name__)


class CfAccessError(Exception):
    """Raised when a Cloudflare Access assertion is missing or fails verification."""


# --- JWKS cache -------------------------------------------------------------------------------
_JWKS_TTL_SECONDS = 900  # 15 min; also refreshed on demand when a kid isn't found
_jwks_cache: Dict[str, Any] = {"keys": [], "fetched_at": 0.0, "url": ""}
_jwks_lock = threading.Lock()


def _certs_url() -> str:
    domain = (settings.cf_access_team_domain or "").strip().rstrip("/")
    if not domain:
        raise CfAccessError("cf_access_team_domain is not configured")
    # Accept either 'veggera' or the full 'veggera.cloudflareaccess.com'.
    if "." not in domain:
        domain = f"{domain}.cloudflareaccess.com"
    return f"https://{domain}/cdn-cgi/access/certs"


def _issuer() -> str:
    return _certs_url().rsplit("/cdn-cgi/", 1)[0]


def _fetch_jwks(url: str) -> List[Dict[str, Any]]:
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    data = resp.json()
    keys = data.get("keys") or []
    if not keys:
        raise CfAccessError("Cloudflare Access JWKS returned no keys")
    return keys


def _get_key_for_kid(kid: str, *, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
    """Return the JWK matching ``kid``, refreshing the cache if stale or on an unknown kid."""
    url = _certs_url()
    with _jwks_lock:
        stale = (
            force_refresh
            or _jwks_cache["url"] != url
            or (time.time() - _jwks_cache["fetched_at"]) > _JWKS_TTL_SECONDS
            or not _jwks_cache["keys"]
        )
        if stale:
            _jwks_cache["keys"] = _fetch_jwks(url)
            _jwks_cache["fetched_at"] = time.time()
            _jwks_cache["url"] = url
        key = next((k for k in _jwks_cache["keys"] if k.get("kid") == kid), None)

    # Unknown kid on a warm cache → keys may have just rotated; refresh once and retry.
    if key is None and not force_refresh:
        return _get_key_for_kid(kid, force_refresh=True)
    return key


def verify_access_jwt(token: str) -> Dict[str, Any]:
    """Verify a Cloudflare Access assertion and return its claims.

    Raises :class:`CfAccessError` if the token is missing/invalid, or if the verifier is not
    configured (``cf_access_team_domain`` / ``cf_access_aud``).
    """
    if not token:
        raise CfAccessError("missing Cloudflare Access assertion")
    aud = (settings.cf_access_aud or "").strip()
    if not aud:
        raise CfAccessError("cf_access_aud is not configured")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise CfAccessError(f"malformed Access token: {e}") from e

    kid = header.get("kid")
    if not kid:
        raise CfAccessError("Access token has no 'kid'")

    key = _get_key_for_kid(kid)
    if not key:
        raise CfAccessError("no signing key matches the Access token")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=aud,
            issuer=_issuer(),
        )
    except JWTError as e:
        raise CfAccessError(f"Access token verification failed: {e}") from e

    return claims

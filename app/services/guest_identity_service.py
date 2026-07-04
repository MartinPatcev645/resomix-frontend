"""
Guest Identity Service
======================

Server-authoritative identity for anonymous **frontend** visitors (System Partner 1). Two
layers, fused into one ``visitor_id`` that enforcement keys off:

  1. **Signed guest cookie** — an httpOnly, HMAC-signed random ``guest_id`` (tamper-evident;
     survives normal browsing, cleared by incognito/cookie-wipe → the fast path only).
  2. **Device fingerprint** — the ThumbmarkJS hash the frontend sends in ``X-Device-Hash``
     (survives incognito + cookie clearing), fused with the client IP /24 (or IPv6 /48) and
     ``Accept-Language`` into a stable, non-reversible ``visitor_id``.

**The server never trusts a client-supplied visitor_id** — the client provides only raw
signals (device hash header, and the server-signed cookie); the server derives + hashes.

The ``visitor_id`` source is swappable for a paid Pro fingerprint later with zero schema
change (everything downstream only sees a ``visitor_id`` string).

Version: 1.0.0
Init Date: July 4, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import base64
import hashlib
import hmac
import ipaddress
import uuid
from typing import Optional

from fastapi import Request

from app.core.config import settings

# Namespaced material tags so different signal sources can't collide.
_TAG_DEVICE = "dh"
_TAG_COOKIE = "gid"
_TAG_DEGRADED = "ipua"


class GuestIdentityService:
    """Issue/verify the guest cookie and derive a server-side ``visitor_id``."""

    # ------------------------------------------------------------------ #
    # Signed guest cookie
    # ------------------------------------------------------------------ #

    def _secret(self) -> bytes:
        return settings.guest_cookie_secret.encode("utf-8")

    def _sign(self, guest_id: str) -> str:
        """token = b64url(guest_id).hmac_hex  (tamper-evident)."""
        payload = base64.urlsafe_b64encode(guest_id.encode("utf-8")).decode("ascii").rstrip("=")
        sig = hmac.new(self._secret(), payload.encode("ascii"), hashlib.sha256).hexdigest()
        return f"{payload}.{sig}"

    def new_guest_id(self) -> str:
        return uuid.uuid4().hex

    def new_guest_cookie(self) -> tuple[str, str]:
        """Return (guest_id, signed_cookie_value) for a brand-new guest."""
        gid = self.new_guest_id()
        return gid, self._sign(gid)

    def verify_guest_cookie(self, token: Optional[str]) -> Optional[str]:
        """Return the guest_id if the signed cookie is valid, else None (tampered/missing)."""
        if not token or "." not in token:
            return None
        payload, _, sig = token.partition(".")
        expected = hmac.new(self._secret(), payload.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        try:
            pad = "=" * (-len(payload) % 4)
            return base64.urlsafe_b64decode(payload + pad).decode("utf-8")
        except Exception:
            return None

    # ------------------------------------------------------------------ #
    # Client IP → coarse network prefix
    # ------------------------------------------------------------------ #

    @staticmethod
    def client_ip(request: Request) -> str:
        """Best-effort real client IP, honoring the proxy/CDN in front of us."""
        headers = request.headers
        cf = headers.get("cf-connecting-ip")
        if cf:
            return cf.strip()
        xff = headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()  # first hop = the client
        xr = headers.get("x-real-ip")
        if xr:
            return xr.strip()
        return request.client.host if request.client else "0.0.0.0"

    @staticmethod
    def ip_to_prefix(ip: str) -> str:
        """Reduce an IP to a coarse network: IPv4 /24, IPv6 /48. Weak, corroborating signal."""
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return "0.0.0.0/24"
        bits = 24 if addr.version == 4 else 48
        net = ipaddress.ip_network(f"{ip}/{bits}", strict=False)
        return str(net)

    # ------------------------------------------------------------------ #
    # visitor_id derivation (server-side, non-reversible)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _hash(material: str) -> str:
        return hashlib.sha256(material.encode("utf-8")).hexdigest()  # 64 chars → fits varchar(64)

    def derive_visitor_id_from(
        self,
        *,
        device_hash: Optional[str],
        ip_prefix: str,
        accept_language: str,
        cookie_gid: Optional[str] = None,
        user_agent: str = "",
    ) -> str:
        """Pure derivation (testable). Priority: device fingerprint → signed cookie → degraded.

        With a device hash present, the id is stable across incognito/cookie-clear (fingerprint
        survives those). IP/lang are folded in as corroboration; a network change yields a new
        id (accepted tradeoff — see the design doc). ``cookie_gid`` is only a fast path when no
        device hash is available."""
        lang = (accept_language or "")[:64]
        if device_hash:
            return self._hash(f"{_TAG_DEVICE}:{device_hash}|ip:{ip_prefix}|lang:{lang}")
        if cookie_gid:
            return self._hash(f"{_TAG_COOKIE}:{cookie_gid}")
        # Degraded fallback (ThumbmarkJS blocked AND no cookie): coarse + spoofable, but soft-gated.
        return self._hash(f"{_TAG_DEGRADED}:{ip_prefix}|lang:{lang}|ua:{(user_agent or '')[:128]}")

    def derive_visitor_id(self, request: Request, cookie_gid: Optional[str] = None) -> str:
        """Derive the visitor_id from a request. A client-sent visitor_id is ignored entirely."""
        return self.derive_visitor_id_from(
            device_hash=(request.headers.get("x-device-hash") or None),
            ip_prefix=self.ip_to_prefix(self.client_ip(request)),
            accept_language=request.headers.get("accept-language", ""),
            cookie_gid=cookie_gid,
            user_agent=request.headers.get("user-agent", ""),
        )

"""
Phase 3 — Guest identity tests
==============================

Verifies the signed guest cookie (tamper-evident), client-IP extraction behind a proxy/CDN,
network-prefix reduction, deterministic + spoof-resistant visitor_id derivation, the fallback
chain, and the get_guest_context dependency (guest vs logged-in, cookie issue/reuse).

Pure/unit — no DB needed.
"""

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.api.dependencies.guest import get_guest_context
from app.core.config import settings
from app.services.guest_identity_service import GuestIdentityService

svc = GuestIdentityService()


def _make_request(headers=None, cookies=None, client_ip="198.51.100.10") -> Request:
    raw = []
    for k, v in (headers or {}).items():
        raw.append((k.lower().encode(), v.encode()))
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        raw.append((b"cookie", cookie_str.encode()))
    scope = {
        "type": "http", "method": "GET", "path": "/", "query_string": b"",
        "headers": raw, "client": (client_ip, 12345), "scheme": "http", "server": ("test", 80),
    }
    return Request(scope)


# --------------------------------------------------------------------------- #
# Signed cookie
# --------------------------------------------------------------------------- #


def test_cookie_roundtrip_and_tamper():
    gid, token = svc.new_guest_cookie()
    assert svc.verify_guest_cookie(token) == gid
    # tamper the signature
    bad = token[:-1] + ("0" if token[-1] != "0" else "1")
    assert svc.verify_guest_cookie(bad) is None
    # tamper the payload
    payload, _, sig = token.partition(".")
    assert svc.verify_guest_cookie(f"{payload}x.{sig}") is None
    # junk
    assert svc.verify_guest_cookie(None) is None
    assert svc.verify_guest_cookie("no-dot") is None
    assert svc.verify_guest_cookie("") is None


# --------------------------------------------------------------------------- #
# IP extraction + prefix
# --------------------------------------------------------------------------- #


def test_client_ip_precedence():
    # cf-connecting-ip wins
    r = _make_request(headers={"cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2"}, client_ip="9.9.9.9")
    assert svc.client_ip(r) == "1.1.1.1"
    # then first hop of x-forwarded-for
    r = _make_request(headers={"x-forwarded-for": "2.2.2.2, 3.3.3.3"}, client_ip="9.9.9.9")
    assert svc.client_ip(r) == "2.2.2.2"
    # then x-real-ip
    r = _make_request(headers={"x-real-ip": "4.4.4.4"}, client_ip="9.9.9.9")
    assert svc.client_ip(r) == "4.4.4.4"
    # else socket peer
    r = _make_request(client_ip="9.9.9.9")
    assert svc.client_ip(r) == "9.9.9.9"


def test_ip_to_prefix():
    assert svc.ip_to_prefix("203.0.113.55") == "203.0.113.0/24"
    assert svc.ip_to_prefix("2001:db8:abcd:1234::1") == "2001:db8:abcd::/48"
    assert svc.ip_to_prefix("not-an-ip") == "0.0.0.0/24"


# --------------------------------------------------------------------------- #
# visitor_id derivation
# --------------------------------------------------------------------------- #


def test_visitor_id_deterministic_and_device_driven():
    a = svc.derive_visitor_id_from(device_hash="DEV1", ip_prefix="1.2.3.0/24", accept_language="en")
    b = svc.derive_visitor_id_from(device_hash="DEV1", ip_prefix="1.2.3.0/24", accept_language="en")
    assert a == b  # deterministic
    c = svc.derive_visitor_id_from(device_hash="DEV2", ip_prefix="1.2.3.0/24", accept_language="en")
    assert a != c  # different device → different id
    assert len(a) == 64  # fits varchar(64)


def test_visitor_id_ignores_client_supplied_id():
    """A client cannot set its own visitor_id: two requests with different X-Visitor-Id but the
    same real signals resolve to the SAME server-derived id."""
    r1 = _make_request(headers={"x-device-hash": "DEVX", "accept-language": "en", "x-visitor-id": "attacker-choice-1"},
                       client_ip="203.0.113.5")
    r2 = _make_request(headers={"x-device-hash": "DEVX", "accept-language": "en", "x-visitor-id": "attacker-choice-2"},
                       client_ip="203.0.113.5")
    assert svc.derive_visitor_id(r1) == svc.derive_visitor_id(r2)


def test_visitor_id_fallback_chain():
    # no device hash → uses signed cookie gid
    only_cookie = svc.derive_visitor_id_from(device_hash=None, ip_prefix="1.2.3.0/24",
                                              accept_language="en", cookie_gid="GID1")
    assert only_cookie == svc._hash("gid:GID1")
    # no device, no cookie → degraded (ip+lang+ua)
    degraded = svc.derive_visitor_id_from(device_hash=None, ip_prefix="1.2.3.0/24",
                                          accept_language="en", cookie_gid=None, user_agent="UA")
    assert degraded == svc._hash("ipua:1.2.3.0/24|lang:en|ua:UA")
    # device hash takes priority over cookie
    dev = svc.derive_visitor_id_from(device_hash="DEV", ip_prefix="1.2.3.0/24",
                                     accept_language="en", cookie_gid="GID1")
    assert dev != only_cookie


# --------------------------------------------------------------------------- #
# get_guest_context dependency
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_logged_in_user_is_not_guest():
    class _U:  # minimal stand-in
        id = 1
    ctx = await get_guest_context(_make_request(), Response(), current_user=_U())
    assert ctx.is_guest is False and ctx.visitor_id is None and ctx.user is not None


@pytest.mark.asyncio
async def test_anonymous_gets_visitor_id_and_new_cookie():
    resp = Response()
    req = _make_request(headers={"x-device-hash": "DEVQ", "accept-language": "en"})
    ctx = await get_guest_context(req, resp, current_user=None)
    assert ctx.is_guest is True and ctx.user is None and ctx.visitor_id
    # a fresh signed cookie was issued
    set_cookie = resp.headers.get("set-cookie", "")
    assert settings.guest_cookie_name in set_cookie and "httponly" in set_cookie.lower()


@pytest.mark.asyncio
async def test_anonymous_with_valid_cookie_is_not_reissued():
    gid, token = svc.new_guest_cookie()
    resp = Response()
    req = _make_request(headers={"accept-language": "en"}, cookies={settings.guest_cookie_name: token})
    ctx = await get_guest_context(req, resp, current_user=None)
    assert ctx.is_guest is True and ctx.visitor_id
    assert resp.headers.get("set-cookie") is None  # valid cookie reused, not reissued


@pytest.mark.asyncio
async def test_anonymous_with_tampered_cookie_gets_new_cookie():
    _, token = svc.new_guest_cookie()
    resp = Response()
    req = _make_request(cookies={settings.guest_cookie_name: token[:-1] + "z"})
    ctx = await get_guest_context(req, resp, current_user=None)
    assert ctx.is_guest is True
    assert settings.guest_cookie_name in (resp.headers.get("set-cookie") or "")  # reissued

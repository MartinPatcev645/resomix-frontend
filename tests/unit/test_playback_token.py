"""
Unit tests for the valet/playback Edge token (Gap 1).

Covers:
- generate_playback_token() mints an HS256 JWT carrying partner_id + scope="playback"
- generate_edge_token() embeds partner_id + scope when supplied (and omits them otherwise)
- Tokens verify against the shared EDGE_JWT_SECRET that Hetzner uses.
"""

import time

import pytest
from jose import jwt

from app.core.config import settings
from app.utils.edge_auth import generate_playback_token, generate_edge_token


def _decode(token: str) -> dict:
    return jwt.decode(token, settings.edge_jwt_secret, algorithms=["HS256"])


def test_generate_playback_token_claims():
    out = generate_playback_token(partner_id=42, client_ip="203.0.113.7")
    assert set(out.keys()) == {"token", "expires_in"}
    assert out["expires_in"] == settings.edge_token_ttl_seconds

    payload = _decode(out["token"])
    assert payload["partner_id"] == 42
    assert payload["scope"] == "playback"
    assert payload["ip"] == "203.0.113.7"
    # exp is in the future, roughly now + ttl
    assert payload["exp"] > int(time.time())
    assert payload["exp"] <= int(time.time()) + settings.edge_token_ttl_seconds + 5


def test_generate_edge_token_embeds_partner_id_and_scope():
    token = generate_edge_token("playlist-123", "10.0.0.1", partner_id=7, scope="playback")
    payload = _decode(token)
    assert payload["playlist"] == "playlist-123"
    assert payload["partner_id"] == 7
    assert payload["scope"] == "playback"


def test_generate_edge_token_backwards_compatible_without_partner():
    """Legacy callers that don't pass partner_id must not get the claim injected."""
    token = generate_edge_token("playlist-xyz", "10.0.0.2")
    payload = _decode(token)
    assert payload["playlist"] == "playlist-xyz"
    assert "partner_id" not in payload
    assert "scope" not in payload


def test_playback_token_partner_isolation():
    """Two partners get tokens with distinct partner_id claims."""
    a = _decode(generate_playback_token(1, "1.1.1.1")["token"])
    b = _decode(generate_playback_token(2, "1.1.1.1")["token"])
    assert a["partner_id"] == 1
    assert b["partner_id"] == 2
    assert a["partner_id"] != b["partner_id"]

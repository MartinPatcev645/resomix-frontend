"""
API test for the partner valet/playback-token endpoint (Gap 1).

POST /api/v1/partner/playback-token authenticates the partner via their API key
(here mocked through a dependency override) and returns a short-lived HS256 JWT
carrying {partner_id, scope:"playback"} that Hetzner verifies with the shared
EDGE_JWT_SECRET — no DB access required on the edge.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt

from app.main import app
from app.core.config import settings
from app.api.dependencies.partner import get_current_partner


class _FakePartner:
    id = 99
    service_mode = "similarity_playback"   # playback-enabled


class _SearchOnlyPartner:
    id = 99
    service_mode = "similarity_only"       # search only → must be refused the token


@pytest.fixture
def override_partner():
    app.dependency_overrides[get_current_partner] = lambda: _FakePartner()
    yield
    app.dependency_overrides.pop(get_current_partner, None)


@pytest.fixture
def override_partner_search_only():
    app.dependency_overrides[get_current_partner] = lambda: _SearchOnlyPartner()
    yield
    app.dependency_overrides.pop(get_current_partner, None)


@pytest.mark.asyncio
async def test_mint_playback_token_returns_valid_jwt(override_partner):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/partner/playback-token")

    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True
    data = body["data"]
    assert data["partner_id"] == 99
    assert data["scope"] == "playback"
    assert data["expires_in"] == settings.edge_token_ttl_seconds

    # The token must verify against the shared secret and carry the partner claim.
    payload = jwt.decode(data["token"], settings.edge_jwt_secret, algorithms=["HS256"])
    assert payload["partner_id"] == 99
    assert payload["scope"] == "playback"
    assert "exp" in payload


@pytest.mark.asyncio
async def test_playback_token_403_for_similarity_only(override_partner_search_only):
    """§9.2 gate: a similarity_only (search-only) partner must NOT be able to mint a
    playback token — 403, so it can never fetch playback assets from the edge."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/partner/playback-token")
    assert resp.status_code == 403
    body = resp.json()
    assert body.get("success") is False
    assert "playback" in (body.get("error") or "").lower()


@pytest.mark.asyncio
async def test_playback_token_requires_auth():
    """Without an overridden partner / valid key, the endpoint must reject (401)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v1/partner/playback-token")
    assert resp.status_code in (401, 403)

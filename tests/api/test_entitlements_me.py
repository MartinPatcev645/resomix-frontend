"""
Consumer entitlements endpoint — GET /entitlements/me
=====================================================

The single call the frontend uses to drive its UI. Verifies:
  * guest (no JWT) → guest plan + guest entitlement values;
  * logged-in free user → free plan + free values;
  * a per-user override is overlaid on the resolved map;
  * the server-derived visitor_id is never leaked in the payload.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.models.plan import EntitlementOverride, Feature
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

ME = "/api/v1/entitlements/me"


async def _client() -> AsyncClient:
    from app.main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_guest_entitlements():
    async with await _client() as ac:
        res = await ac.get(ME, headers={"X-API-KEY": settings.api_key, "X-Device-Hash": "dev-" + uuid.uuid4().hex})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["is_frontend"] is True and data["is_guest"] is True
    assert data["plan"]["code"] == "guest"
    assert data["entitlements"][FeatureKey.SEARCH_PLAYLISTS_PER_MONTH] == 3   # guest seed (pricing v2.1: DAILY)
    assert data["entitlements"][FeatureKey.DROPDOWN_MAX_TRACKS] == 20
    # Never leak the server-derived identity.
    assert "visitor_id" not in data


@pytest.mark.asyncio
async def test_logged_in_free_user_entitlements():
    user = await create_user()
    async with await _client() as ac:
        res = await ac.get(ME, headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["is_guest"] is False
    assert data["plan"]["code"] == "free"
    assert data["entitlements"][FeatureKey.SEARCH_PLAYLISTS_PER_MONTH] == 3   # free seed (pricing v2.1: DAILY)


@pytest.mark.asyncio
async def test_override_is_overlaid():
    user = await create_user()
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.SEARCH_PLAYLISTS_PER_MONTH))).scalar_one()
        db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id),
                                   feature_id=feat.id, int_value=99, reason="test"))
        await db.commit()

    async with await _client() as ac:
        res = await ac.get(ME, headers={**auth_headers(user), "X-API-KEY": settings.api_key})
    assert res.status_code == 200
    assert res.json()["data"]["entitlements"][FeatureKey.SEARCH_PLAYLISTS_PER_MONTH] == 99

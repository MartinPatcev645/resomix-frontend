"""
Phase 7.1 — Admin entitlement API tests
=======================================

Covers the admin plan/entitlement editor:
  * reads: list plans (+entitlements), list features, get one plan, user effective-plan;
  * writes: set an entitlement (typed-validated), toggle plan flags, single-default invariant;
  * authz: non-admin is rejected;
  * the money test: an edit **busts the Redis cache** so enforcement reads the new value at once.

Safety: mutation tests operate on throwaway temp plans (swept by the conftest high-water
cleanup) — never on seeded rows. The one is_default test saves/restores the real default.

Admin auth uses the static super-key header (X-API-KEY = settings.api_key), which resolves to a
system admin holding every permission.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.models.plan import Plan
from app.models.user import User
from app.services.entitlement_service import EntitlementService
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user, create_admin_user, admin_auth_headers

# Admin auth is an admin-role JWT (the static super-key was retired). This dict is repopulated
# before every test by the autouse fixture below, so all the `headers=ADMIN` call sites are unchanged.
ADMIN: dict = {}
BASE = "/api/v1/admin"


@pytest.fixture(autouse=True)
async def _admin_auth():
    ADMIN.clear()
    ADMIN.update(admin_auth_headers(await create_admin_user()))
    yield


async def _client() -> AsyncClient:
    from app.main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _make_temp_plan(**overrides) -> tuple[str, int]:
    """Insert a throwaway plan (id > cleanup snapshot → swept afterwards)."""
    code = "tmp_" + uuid.uuid4().hex[:10]
    async with AsyncSessionLocal() as db:
        plan = Plan(
            code=code, name="Temp Plan", is_active=False, is_default=False,
            is_assignable=True, sort_order=99, **overrides,
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)
        return plan.code, plan.id


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_list_plans_and_features():
    async with await _client() as ac:
        plans = await ac.get(f"{BASE}/plans", headers=ADMIN)
        feats = await ac.get(f"{BASE}/features", headers=ADMIN)

    assert plans.status_code == 200, plans.text
    codes = {p["code"] for p in plans.json()["data"]["plans"]}
    assert {"guest", "free"} <= codes
    a_plan = next(p for p in plans.json()["data"]["plans"] if p["code"] == "free")
    assert FeatureKey.SEARCH_PLAYLISTS_PER_MONTH in a_plan["entitlements"]

    assert feats.status_code == 200
    fkeys = {f["key"] for f in feats.json()["data"]["features"]}
    assert FeatureKey.SEARCH_PLAYLISTS_PER_MONTH in fkeys and FeatureKey.CAN_EXPORT in fkeys


@pytest.mark.asyncio
async def test_get_plan_detail_and_404():
    async with await _client() as ac:
        ok = await ac.get(f"{BASE}/plans/free", headers=ADMIN)
        missing = await ac.get(f"{BASE}/plans/does_not_exist", headers=ADMIN)
    assert ok.status_code == 200 and ok.json()["data"]["code"] == "free"
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_user_effective_plan_and_404():
    user = await create_user()
    async with await _client() as ac:
        ok = await ac.get(f"{BASE}/users/{user.uuid}/effective-plan", headers=ADMIN)
        missing = await ac.get(f"{BASE}/users/{uuid.uuid4()}/effective-plan", headers=ADMIN)
    assert ok.status_code == 200, ok.text
    body = ok.json()["data"]
    assert body["user_uuid"] == user.uuid
    assert FeatureKey.SEARCH_PLAYLISTS_PER_MONTH in body["entitlements"]
    assert missing.status_code == 404


# --------------------------------------------------------------------------- #
# Writes + validation
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_set_entitlement_typed_validation():
    code, _ = await _make_temp_plan()
    async with await _client() as ac:
        # int OK
        good = await ac.put(f"{BASE}/plans/{code}/entitlements/{FeatureKey.SEARCH_PLAYLISTS_PER_MONTH}",
                            headers=ADMIN, json={"value": 7})
        # bool OK on a boolean feature
        good_bool = await ac.put(f"{BASE}/plans/{code}/entitlements/{FeatureKey.CAN_EXPORT}",
                                 headers=ADMIN, json={"value": True})
        # int feature given a non-numeric string → 400
        bad_type = await ac.put(f"{BASE}/plans/{code}/entitlements/{FeatureKey.SEARCH_PLAYLISTS_PER_MONTH}",
                                headers=ADMIN, json={"value": "abc"})
        # unknown feature → 404
        bad_feature = await ac.put(f"{BASE}/plans/{code}/entitlements/not_a_feature",
                                   headers=ADMIN, json={"value": 1})
        # unknown plan → 404
        bad_plan = await ac.put(f"{BASE}/plans/nope/entitlements/{FeatureKey.SEARCH_PLAYLISTS_PER_MONTH}",
                                headers=ADMIN, json={"value": 1})

    assert good.status_code == 200 and good.json()["data"]["value"] == 7
    assert good_bool.status_code == 200 and good_bool.json()["data"]["value"] is True
    assert bad_type.status_code == 400
    assert bad_feature.status_code == 404
    assert bad_plan.status_code == 404

    # The int edit persisted + is visible on read-back.
    async with await _client() as ac:
        detail = await ac.get(f"{BASE}/plans/{code}", headers=ADMIN)
    assert detail.json()["data"]["entitlements"][FeatureKey.SEARCH_PLAYLISTS_PER_MONTH] == 7


@pytest.mark.asyncio
async def test_edit_busts_cache_and_changes_enforcement():
    """Editing an entitlement must take effect immediately (version bump → Redis cache drop)."""
    code, plan_id = await _make_temp_plan()
    user = await create_user()
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        u.plan_id = plan_id
        await db.commit()

    es = EntitlementService()
    # Baseline: temp plan has no entitlement row → feature default (search_playlists_per_month default = 0).
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        before = await es.get_int(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=u)  # warms the v1 cache

    async with await _client() as ac:
        res = await ac.put(f"{BASE}/plans/{code}/entitlements/{FeatureKey.SEARCH_PLAYLISTS_PER_MONTH}",
                           headers=ADMIN, json={"value": 9})
    assert res.status_code == 200

    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        after = await es.get_int(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=u)

    assert before == 0
    assert after == 9, "Entitlement edit did not bust the cache / take effect."


@pytest.mark.asyncio
async def test_update_plan_flags():
    code, _ = await _make_temp_plan()  # starts inactive
    async with await _client() as ac:
        res = await ac.patch(f"{BASE}/plans/{code}", headers=ADMIN,
                             json={"name": "Renamed", "is_active": True})
        detail = await ac.get(f"{BASE}/plans/{code}", headers=ADMIN)
    assert res.status_code == 200
    d = detail.json()["data"]
    assert d["name"] == "Renamed" and d["is_active"] is True


@pytest.mark.asyncio
async def test_single_default_invariant():
    """Setting a plan default clears every other default. Restores the real default afterwards."""
    code, _ = await _make_temp_plan()
    async with await _client() as ac:
        try:
            promote = await ac.patch(f"{BASE}/plans/{code}", headers=ADMIN, json={"is_default": True})
            assert promote.status_code == 200
            free = await ac.get(f"{BASE}/plans/free", headers=ADMIN)
            temp = await ac.get(f"{BASE}/plans/{code}", headers=ADMIN)
            assert temp.json()["data"]["is_default"] is True
            assert free.json()["data"]["is_default"] is False  # invariant: only one default
        finally:
            # Restore the real default so the shared baseline is never left broken.
            await ac.patch(f"{BASE}/plans/free", headers=ADMIN, json={"is_default": True})
            await ac.patch(f"{BASE}/plans/{code}", headers=ADMIN, json={"is_default": False})
        free_after = await ac.get(f"{BASE}/plans/free", headers=ADMIN)
    assert free_after.json()["data"]["is_default"] is True


# --------------------------------------------------------------------------- #
# Authz
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_non_admin_is_rejected():
    user = await create_user()
    from tests.api.library_helpers import auth_headers
    async with await _client() as ac:
        # A plain user JWT (no admin permission) must not read or write the admin API.
        r_read = await ac.get(f"{BASE}/plans", headers=auth_headers(user))
        r_write = await ac.put(f"{BASE}/plans/free/entitlements/{FeatureKey.SEARCH_PLAYLISTS_PER_MONTH}",
                               headers=auth_headers(user), json={"value": 999})
    assert r_read.status_code in (401, 403)
    assert r_write.status_code in (401, 403)


@pytest.mark.asyncio
async def test_entitlement_metrics_endpoint():
    """Observability: a guest denial bumps a gate counter that the admin metrics endpoint exposes."""
    from app.services.entitlement_gate import EntitlementGate
    async with AsyncSessionLocal() as db:
        # guest can't export → a login_required denial (increments gate.deny.login_required).
        await EntitlementGate().check_boolean(db, FeatureKey.CAN_EXPORT, visitor_id="vid_metrics_" + uuid.uuid4().hex)
    async with await _client() as ac:
        res = await ac.get(f"{BASE}/entitlements/metrics", headers=ADMIN)
    assert res.status_code == 200, res.text
    metrics = res.json()["data"]["metrics"]
    assert isinstance(metrics, dict)
    assert metrics.get("gate.deny.login_required", 0) >= 1

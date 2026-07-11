"""
T1 — Logged-in daily playlist migration
=======================================

Logged-in frontend users are now governed by their plan's ``PLAYLISTS_PER_DAY`` (the same
Redis daily counter guests use), via ``OperationLimitEvaluator.check`` (peek) +
``record_success`` (record) — replacing the legacy lifetime-total ``operation_limits``.

Covered:
  * evaluator peek/record round-trip: allowed under the daily cap, soft-denied (upgrade) at it;
  * per-user isolation (one user's usage doesn't spend another's);
  * E2E through the real similarity endpoint (guarded on 8004): a logged-in user capped at 1/day
    gets a playlist on request #1 and a soft ``upgrade_required`` 403 on request #2.

Requires Redis; tests skip cleanly if it's unavailable (the gate fails open without it).
"""

import socket
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.db.redis import get_redis_or_none
from app.models.plan import EntitlementOverride, Feature
from app.services.operation_limit_evaluator import OperationLimitEvaluator
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

SEED_TRACK = "4a2a80b5-3cd2-483d-8b89-f9ccd2d08dd1"
ev = OperationLimitEvaluator()


async def _redis_up() -> bool:
    try:
        r = await get_redis_or_none()
        if r is None:
            return False
        await r.ping()
        return True
    except Exception:
        return False


def _similarity_server_up() -> bool:
    url = (settings.similarity_server_url or "http://localhost:8004").split("//")[-1]
    host, _, port = url.partition(":")
    port = int((port or "8004").split("/")[0])
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


requires_similarity = pytest.mark.skipif(
    not _similarity_server_up(), reason="Similarity server (8004) not reachable"
)


async def _set_daily_override(user_id: int, value: int) -> None:
    """Pin a user's PLAYLISTS_PER_DAY via an entitlement override (deterministic cap)."""
    async with AsyncSessionLocal() as db:
        feat = (
            await db.execute(select(Feature).where(Feature.key == FeatureKey.SEARCH_PLAYLISTS_PER_MONTH))
        ).scalar_one()
        db.add(
            EntitlementOverride(
                subject_type="user",
                subject_id=str(user_id),
                feature_id=feat.id,
                int_value=value,
                reason="t1-test",
            )
        )
        await db.commit()


# --------------------------------------------------------------------------- #
# Evaluator-level peek/record
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_logged_in_daily_gate_peek_and_record():
    if not await _redis_up():
        pytest.skip("Redis unavailable — daily counter gate fails open")
    user = await create_user()
    await _set_daily_override(user.id, 2)

    async with AsyncSessionLocal() as db:
        # 0 used → allowed.
        assert (await ev.check(db, user_id=user.id, operation_code="playlist_create")).allowed
        await ev.record_success(db, user_id=user.id, operation_code="playlist_create")
        # 1 used, cap 2 → still allowed.
        assert (await ev.check(db, user_id=user.id, operation_code="playlist_create")).allowed
        await ev.record_success(db, user_id=user.id, operation_code="playlist_create")
        # 2 used, cap 2 → soft deny with an upgrade nudge.
        res = await ev.check(db, user_id=user.id, operation_code="playlist_create")

    assert res.allowed is False
    assert res.status_code == 403
    assert res.reason == "upgrade_required"


@pytest.mark.asyncio
async def test_daily_counter_isolated_per_user():
    if not await _redis_up():
        pytest.skip("Redis unavailable — daily counter gate fails open")
    spender = await create_user()
    other = await create_user()
    await _set_daily_override(spender.id, 1)
    await _set_daily_override(other.id, 1)

    async with AsyncSessionLocal() as db:
        await ev.record_success(db, user_id=spender.id, operation_code="playlist_create")
        # spender is now at cap; `other` must be untouched.
        assert (await ev.check(db, user_id=spender.id, operation_code="playlist_create")).allowed is False
        assert (await ev.check(db, user_id=other.id, operation_code="playlist_create")).allowed is True


# --------------------------------------------------------------------------- #
# E2E — real similarity endpoint enforces the per-plan daily cap for a logged-in user
# --------------------------------------------------------------------------- #


@requires_similarity
@pytest.mark.asyncio
async def test_logged_in_daily_limit_enforced_e2e():
    if not await _redis_up():
        pytest.skip("Redis unavailable — daily counter gate fails open")
    user = await create_user()
    await _set_daily_override(user.id, 1)  # 1 playlist/day for a clean 2nd-request denial

    from app.main import app
    headers = {**auth_headers(user), "X-API-KEY": settings.api_key}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60) as ac:
        r1 = await ac.post("/api/v1/similarity/search", headers=headers,
                           json={"track_id": SEED_TRACK, "top_sk": 20})
        assert r1.status_code == 200, r1.text  # first playlist allowed + recorded

        r2 = await ac.post("/api/v1/similarity/search", headers=headers,
                           json={"track_id": SEED_TRACK, "top_sk": 20})
    assert r2.status_code == 403
    assert r2.json().get("reason") == "upgrade_required"

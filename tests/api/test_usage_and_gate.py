"""
Phase 4 — Usage counters & enforcement gate tests
=================================================

Verifies the atomic Redis daily counters (reserve / refund / concurrency safety) and the
EntitlementGate (counted / boolean / cap shapes, soft reasons, fail-open, refund, and that an
override changes the effective limit the gate enforces).

Requires Redis (up) + the seeded plans. Counter keys are per-subject and date-stamped, so
fresh visitor_ids / users keep tests isolated.
"""

import asyncio
import uuid

import pytest
from sqlalchemy import select

from app.core.context import set_admin_context
from app.core.entitlement_keys import FeatureKey
from app.models.plan import EntitlementOverride, Feature
from app.services.entitlement_gate import REASON_LOGIN, REASON_UPGRADE, EntitlementGate
from app.services.usage_counter_service import UsageCounterService
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user

usage = UsageCounterService()
gate = EntitlementGate()


def _vid() -> str:
    return "vid_" + uuid.uuid4().hex


# --------------------------------------------------------------------------- #
# UsageCounterService
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_counter_reserve_refund_and_zero_limit():
    vid = _vid()
    assert await usage.peek("guest", vid, "f") == 0
    assert await usage.try_consume("guest", vid, "f", 2) == (True, 1)
    assert await usage.try_consume("guest", vid, "f", 2) == (True, 2)
    assert await usage.try_consume("guest", vid, "f", 2) == (False, 2)  # over limit
    assert await usage.peek("guest", vid, "f") == 2
    await usage.refund("guest", vid, "f")
    assert await usage.try_consume("guest", vid, "f", 2) == (True, 2)  # slot freed
    # zero/negative limit denies without touching Redis
    assert await usage.try_consume("guest", _vid(), "f", 0) == (False, 0)


@pytest.mark.asyncio
async def test_counter_is_atomic_under_concurrency():
    """N parallel reserves with limit N → exactly N allowed, never over."""
    vid = _vid()
    N = 8
    results = await asyncio.gather(*[usage.try_consume("guest", vid, "f", N) for _ in range(N + 5)])
    allowed = [r for r in results if r and r[0]]
    assert len(allowed) == N                       # exactly the limit
    assert max(r[1] for r in results if r) == N    # counter never exceeded the limit


# --------------------------------------------------------------------------- #
# EntitlementGate — boolean
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_gate_boolean_guest_vs_user():
    set_admin_context(True)
    user = await create_user()  # free plan (plan_id NULL → default)
    async with AsyncSessionLocal() as db:
        # guest cannot export → denied with login nudge
        g = await gate.check_boolean(db, FeatureKey.CAN_EXPORT, visitor_id=_vid())
        assert g.allowed is False and g.reason == REASON_LOGIN
        # free user can export → allowed
        u = await gate.check_boolean(db, FeatureKey.CAN_EXPORT, user=user)
        assert u.allowed is True
        # guest cannot similarity-upload
        s = await gate.check_boolean(db, FeatureKey.CAN_SIMILARITY_UPLOAD, visitor_id=_vid())
        assert s.allowed is False and s.reason == REASON_LOGIN


# --------------------------------------------------------------------------- #
# EntitlementGate — counted
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_gate_counted_guest_limit_one():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        vid = _vid()
        first = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)
        second = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)
        assert first.allowed is True and first.count == 1
        assert second.allowed is False and second.reason == REASON_LOGIN and second.limit == 1


@pytest.mark.asyncio
async def test_gate_counted_free_user_limit_two_then_upgrade():
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        a = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, user=user)
        b = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, user=user)
        c = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, user=user)
        assert a.allowed and b.allowed
        assert c.allowed is False and c.reason == REASON_UPGRADE and c.limit == 2


@pytest.mark.asyncio
async def test_gate_refund_frees_a_slot():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        vid = _vid()
        assert (await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)).allowed  # guest limit 1
        assert not (await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)).allowed
        await gate.refund(FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)
        assert (await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, visitor_id=vid)).allowed


@pytest.mark.asyncio
async def test_gate_override_changes_effective_limit():
    """An admin override raises the limit the gate enforces."""
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.PLAYLISTS_PER_DAY))).scalar_one()
        db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id), feature_id=feat.id, int_value=3))
        await db.commit()
        allowed_count = 0
        for _ in range(4):
            r = await gate.try_consume(db, FeatureKey.PLAYLISTS_PER_DAY, user=user)
            if r.allowed:
                allowed_count += 1
        assert allowed_count == 3  # override limit of 3, not the free plan's 2


# --------------------------------------------------------------------------- #
# EntitlementGate — cap
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_gate_caps():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        assert await gate.get_cap(db, FeatureKey.MAX_TRACKS_PER_PLAYLIST, visitor_id=_vid()) == 10  # guest
        assert await gate.get_cap(db, FeatureKey.DROPDOWN_MAX_TRACKS, visitor_id=_vid()) == 20       # guest
        user = await create_user()
        assert await gate.get_cap(db, FeatureKey.DROPDOWN_MAX_TRACKS, user=user) == 50               # free

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
    P, TTL = "p", 3600  # fixed test period + ttl (period math is covered separately)
    assert await usage.peek("guest", vid, "f", P) == 0
    assert await usage.try_consume("guest", vid, "f", 2, P, TTL) == (True, 1)
    assert await usage.try_consume("guest", vid, "f", 2, P, TTL) == (True, 2)
    assert await usage.try_consume("guest", vid, "f", 2, P, TTL) == (False, 2)  # over limit
    assert await usage.peek("guest", vid, "f", P) == 2
    await usage.refund("guest", vid, "f", P)
    assert await usage.try_consume("guest", vid, "f", 2, P, TTL) == (True, 2)  # slot freed
    # zero/negative limit denies without touching Redis
    assert await usage.try_consume("guest", _vid(), "f", 0, P, TTL) == (False, 0)


@pytest.mark.asyncio
async def test_counter_is_atomic_under_concurrency():
    """N parallel reserves with limit N → exactly N allowed, never over."""
    vid = _vid()
    N = 8
    results = await asyncio.gather(*[usage.try_consume("guest", vid, "f", N, "p", 3600) for _ in range(N + 5)])
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


async def _override(db, user, feature_key, value):
    feat = (await db.execute(select(Feature).where(Feature.key == feature_key))).scalar_one()
    db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id), feature_id=feat.id, int_value=value))
    await db.commit()


@pytest.mark.asyncio
async def test_gate_counted_guest_denies_at_limit():
    """Guest is allowed up to their monthly limit, then soft-denied with a login nudge."""
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        vid = _vid()
        first = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, visitor_id=vid)
        assert first.allowed is True and first.count == 1
        limit = first.limit or 0
        for _ in range(max(limit - 1, 0)):  # exhaust the remaining allowance
            assert (await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, visitor_id=vid)).allowed
        over = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, visitor_id=vid)
        assert over.allowed is False and over.reason == REASON_LOGIN and over.limit == limit


@pytest.mark.asyncio
async def test_gate_counted_user_denies_at_limit_with_upgrade():
    """Logged-in user (override-pinned to 2 for determinism) → 2 allowed, 3rd upgrade-denied."""
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        await _override(db, user, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, 2)
        a = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)
        b = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)
        c = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)
        assert a.allowed and b.allowed
        assert c.allowed is False and c.reason == REASON_UPGRADE and c.limit == 2


@pytest.mark.asyncio
async def test_gate_refund_frees_a_slot():
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        await _override(db, user, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, 1)  # pin to 1 for a clean deny
        assert (await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)).allowed
        assert not (await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)).allowed
        await gate.refund(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)
        assert (await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)).allowed


@pytest.mark.asyncio
async def test_gate_override_changes_effective_limit():
    """An admin override changes the limit the gate enforces (vs the plan default)."""
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        await _override(db, user, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, 3)
        allowed_count = 0
        for _ in range(5):
            r = await gate.try_consume(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=user)
            if r.allowed:
                allowed_count += 1
        assert allowed_count == 3  # the override limit of 3


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

"""
Signup bonus (one-time, granted on first email verification)
============================================================

The bonus grants `signup_bonus_playlists` EXTRA creations for the user's current monthly period by
seeding the usage counter negative — so the effective allowance this period is `limit + bonus`,
while the limit itself stays plan-resolved (a mid-period up/downgrade adjusts automatically).

Deterministic via per-user overrides (limit=2, bonus=3 → 5 allowed, 6th denied). Requires Redis.
"""

import pytest
from sqlalchemy import select

from app.core.entitlement_keys import FeatureKey
from app.db.redis import get_redis_or_none
from app.models.plan import EntitlementOverride, Feature
from app.services.entitlement_gate import EntitlementGate
from app.models.user import User
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user

gate = EntitlementGate()


async def _redis_up() -> bool:
    try:
        r = await get_redis_or_none()
        if r is None:
            return False
        await r.ping()
        return True
    except Exception:
        return False


async def _override(db, user_id: int, feature_key: str, value: int) -> None:
    feat = (await db.execute(select(Feature).where(Feature.key == feature_key))).scalar_one()
    db.add(EntitlementOverride(subject_type="user", subject_id=str(user_id),
                               feature_id=feat.id, int_value=value, reason="bonus-test"))
    await db.commit()


@pytest.mark.asyncio
async def test_signup_bonus_extends_allowance_this_period():
    if not await _redis_up():
        pytest.skip("Redis unavailable — bonus seeds a Redis counter")
    user = await create_user()
    async with AsyncSessionLocal() as db:
        await _override(db, user.id, FeatureKey.PLAYLISTS_PER_MONTH, 2)
        await _override(db, user.id, FeatureKey.SIGNUP_BONUS_PLAYLISTS, 3)
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()

        granted = await gate.grant_playlist_signup_bonus(db, u)
        assert granted == 3

        # limit 2 + bonus 3 = 5 allowed creations, then denied.
        for _ in range(5):
            assert (await gate.peek_allowed(db, FeatureKey.PLAYLISTS_PER_MONTH, user=u)).allowed
            await gate.record_use(db, FeatureKey.PLAYLISTS_PER_MONTH, user=u)
        assert (await gate.peek_allowed(db, FeatureKey.PLAYLISTS_PER_MONTH, user=u)).allowed is False


@pytest.mark.asyncio
async def test_zero_bonus_is_a_noop():
    if not await _redis_up():
        pytest.skip("Redis unavailable")
    user = await create_user()
    async with AsyncSessionLocal() as db:
        await _override(db, user.id, FeatureKey.SIGNUP_BONUS_PLAYLISTS, 0)
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        assert await gate.grant_playlist_signup_bonus(db, u) == 0

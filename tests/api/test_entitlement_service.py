"""
Phase 2 — EntitlementService tests
==================================

Verifies plan resolution (guest / free / subscription / fallback), the entitlement value
resolution precedence (override → plan → default), typed accessors, and Redis cache
invalidation via the plan version bump.

Runs against the live dev DB (seeded plans/features from Phase 1) + Redis (best-effort).
Test-created plans/features/overrides are swept by the conftest high-water cleanup.
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import set_admin_context
from app.core.entitlement_keys import FeatureKey, PlanCode
from app.models.plan import EntitlementOverride, Feature, Plan, PlanEntitlement
from app.models.purchase import UserSubscription
from app.models.user import User
from app.services.entitlement_service import EntitlementService
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user

svc = EntitlementService()


async def _plan(db: AsyncSession, code: str) -> Plan:
    return (await db.execute(select(Plan).where(Plan.code == code))).scalar_one()


async def _reload_user(db: AsyncSession, user_id: int) -> User:
    return (await db.execute(select(User).where(User.id == user_id))).scalar_one()


# --------------------------------------------------------------------------- #
# Step 2.1 — effective plan resolution
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_guest_resolves_to_guest_plan():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        plan = await svc.get_effective_plan(db, user=None)
        assert plan.code == PlanCode.GUEST


@pytest.mark.asyncio
async def test_user_with_null_plan_resolves_to_default_free():
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        u = await _reload_user(db, user.id)
        assert u.plan_id is None
        plan = await svc.get_effective_plan(db, user=u)
        assert plan.code == PlanCode.FREE  # default


@pytest.mark.asyncio
async def test_active_subscription_wins_over_plan_id_and_past_due_falls_back():
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        free = await _plan(db, PlanCode.FREE)
        basic = await _plan(db, PlanCode.BASIC)
        pro = await _plan(db, PlanCode.PRO)
        u = await _reload_user(db, user.id)
        u.plan_id = free.id  # baseline free

        # active subscription to pro → effective = pro
        db.add(UserSubscription(user_id=u.id, plan_id=pro.id, status="active",
                                stripe_subscription_id=f"sub_{uuid.uuid4().hex[:12]}"))
        await db.commit()
        assert (await svc.get_effective_plan(db, await _reload_user(db, u.id))).code == PlanCode.PRO

        # flip to past_due → not honored → falls back to user's plan_id (free)
        sub = (await db.execute(select(UserSubscription).where(UserSubscription.user_id == u.id))).scalar_one()
        sub.status = "past_due"
        await db.commit()
        assert (await svc.get_effective_plan(db, await _reload_user(db, u.id))).code == PlanCode.FREE


# --------------------------------------------------------------------------- #
# Step 2.2 — entitlement values, precedence, typed accessors
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_seeded_entitlement_values_typed():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        guest = await create_user()  # placeholder, guest uses user=None
        # guest plan (monthly)
        assert await svc.get_int(db, FeatureKey.PLAYLISTS_PER_MONTH, user=None) == 5
        assert await svc.get_bool(db, FeatureKey.CAN_EXPORT, user=None) is False
        # free plan (user with NULL plan_id → free)
        u = await _reload_user(db, guest.id)
        assert await svc.get_int(db, FeatureKey.PLAYLISTS_PER_MONTH, user=u) == 15
        assert await svc.get_bool(db, FeatureKey.CAN_SIMILARITY_UPLOAD, user=u) is True
        assert "private" == await svc.get_str(db, FeatureKey.DEFAULT_PLAYLIST_VISIBILITY, user=u)


@pytest.mark.asyncio
async def test_override_beats_plan():
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.PLAYLISTS_PER_MONTH))).scalar_one()
        db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id),
                                   feature_id=feat.id, int_value=99, reason="test comp"))
        await db.commit()
        u = await _reload_user(db, user.id)
        # plan (free) says 15, override says 99 → override wins
        assert await svc.get_int(db, FeatureKey.PLAYLISTS_PER_MONTH, user=u) == 99


@pytest.mark.asyncio
async def test_feature_without_plan_entitlement_falls_back_to_default():
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        # a brand-new feature with NO plan_entitlement rows → resolves to its default
        new_feat = Feature(key=f"test_feat_{uuid.uuid4().hex[:8]}", name="T",
                           value_type="int", window="none", default_value="7")
        db.add(new_feat)
        await db.commit()
        u = await _reload_user(db, user.id)
        assert await svc.get_int(db, new_feat.key, user=u) == 7


@pytest.mark.asyncio
async def test_unknown_feature_key_raises():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        with pytest.raises(KeyError):
            await svc.get_entitlement(db, "definitely_not_a_feature", user=None)


# --------------------------------------------------------------------------- #
# Step 2.2 — Redis cache invalidation via version bump
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_cache_serves_until_version_bumped():
    """Reading caches the plan map; a raw DB edit is NOT seen until the plan version is bumped."""
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        # dedicated test plan + feature + entitlement (value 3), user on that plan
        feat = Feature(key=f"cap_{uuid.uuid4().hex[:8]}", name="cap", value_type="int",
                       window="none", default_value="0")
        plan = Plan(code=f"tplan_{uuid.uuid4().hex[:8]}", name="TPlan", is_active=True, is_assignable=True)
        db.add_all([feat, plan])
        await db.flush()
        db.add(PlanEntitlement(plan_id=plan.id, feature_id=feat.id, int_value=3))
        u = await _reload_user(db, user.id)
        u.plan_id = plan.id
        await db.commit()

        # 1. first read → 3 (populates cache)
        assert await svc.get_int(db, feat.key, user=await _reload_user(db, u.id)) == 3

        # 2. raw DB edit to 9 WITHOUT bump → cache still serves 3
        ent = (await db.execute(select(PlanEntitlement).where(PlanEntitlement.plan_id == plan.id))).scalar_one()
        ent.int_value = 9
        await db.commit()
        assert await svc.get_int(db, feat.key, user=await _reload_user(db, u.id)) == 3  # cached

        # 3. bump version → cache invalidated → new value 9
        await svc.bump_plan_version(db, plan.id)
        await db.commit()
        assert await svc.get_int(db, feat.key, user=await _reload_user(db, u.id)) == 9


# --------------------------------------------------------------------------- #
# Step 2.3 — evaluator seam
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_evaluator_seam_resolves_from_entitlements():
    from app.services.operation_limit_evaluator import OperationLimitEvaluator
    ev = OperationLimitEvaluator()
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        u = await _reload_user(db, user.id)
        # free user → playlist_create maps to playlists_per_month = 15
        assert await ev.resolve_effective_limit(db, u, "playlist_create") == 15
        # unmapped operation → None (no behavior change)
        assert await ev.resolve_effective_limit(db, u, "some_unmapped_op") is None

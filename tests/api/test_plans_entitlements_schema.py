"""
Phase 1 — Plans / Features / Entitlements schema tests
======================================================

Verifies the entitlement backbone: the seed is idempotent and typed correctly, the DB
constraints hold, the default (free) plan exists, and the new ``users.plan_id`` /
``playlists.guest_visitor_id`` columns work.

Runs against the live dev DB. The seeded plan/feature rows persist (they are config, not in
the conftest high-water cleanup), so these tests read the already-seeded baseline.
"""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.context import set_admin_context
from app.models.plan import Feature, Plan, PlanEntitlement
from app.models.playlist import Playlist
from app.services.entitlement_seed import (
    FEATURE_CATALOG,
    PLAN_CATALOG,
    seed_entitlements,
)
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar()


@pytest.mark.asyncio
async def test_seed_present_and_idempotent():
    """The seeded baseline exists and a re-run creates nothing (create-if-missing).

    Asserts membership (not exact totals) so it's robust to other tests that create their
    own plans/features within the same session.
    """
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        feature_keys = {k for k, *_ in FEATURE_CATALOG}
        plan_codes = {c for c, *_ in PLAN_CATALOG}
        actual_feature_keys = {f.key for f in (await db.execute(select(Feature))).scalars().all()}
        actual_plan_codes = {p.code for p in (await db.execute(select(Plan))).scalars().all()}
        assert feature_keys <= actual_feature_keys
        assert plan_codes <= actual_plan_codes

        # Re-running the seed is a no-op (never clobbers / duplicates).
        created = await seed_entitlements(db)
        await db.rollback()
        assert created == {"features": 0, "plans": 0, "entitlements": 0}


@pytest.mark.asyncio
async def test_default_plan_is_free_and_unique():
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        defaults = (await db.execute(select(Plan).where(Plan.is_default.is_(True)))).scalars().all()
        assert len(defaults) == 1
        assert defaults[0].code == "free"
        # Guest is a real plan but NOT user-assignable; paid tiers seeded inactive (drafts).
        guest = (await db.execute(select(Plan).where(Plan.code == "guest"))).scalar_one()
        assert guest.is_assignable is False
        basic = (await db.execute(select(Plan).where(Plan.code == "basic"))).scalar_one()
        assert basic.is_active is False


@pytest.mark.asyncio
async def test_entitlements_are_typed_correctly():
    """int→int_value, bool→bool_value, csv/enum→string_value, per feature.value_type."""
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        async def val(plan_code, feature_key):
            row = (await db.execute(
                select(PlanEntitlement, Feature)
                .join(Feature, PlanEntitlement.feature_id == Feature.id)
                .join(Plan, PlanEntitlement.plan_id == Plan.id)
                .where(Plan.code == plan_code, Feature.key == feature_key)
            )).first()
            return row[0], row[1]

        ent, feat = await val("free", "search_playlists_per_month")
        assert feat.value_type == "int" and ent.int_value == 15 and ent.bool_value is None

        ent, feat = await val("guest", "can_export")
        assert feat.value_type == "bool" and ent.bool_value is False and ent.int_value is None

        ent, feat = await val("max", "export_targets")
        assert feat.value_type == "csv" and "serato" in (ent.string_value or "")

        ent, feat = await val("free", "default_playlist_visibility")
        assert feat.value_type == "enum" and ent.string_value == "private"


@pytest.mark.asyncio
async def test_unique_constraints_hold():
    set_admin_context(True)
    # duplicate feature key
    async with AsyncSessionLocal() as db:
        db.add(Feature(key="search_playlists_per_month", name="dup", value_type="int",
                       window="monthly", default_value="0"))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()

    # duplicate (plan_id, feature_id) entitlement
    async with AsyncSessionLocal() as db:
        free = (await db.execute(select(Plan).where(Plan.code == "free"))).scalar_one()
        feat = (await db.execute(select(Feature).where(Feature.key == "search_playlists_per_month"))).scalar_one()
        db.add(PlanEntitlement(plan_id=free.id, feature_id=feat.id, int_value=99))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()


@pytest.mark.asyncio
async def test_user_plan_id_and_playlist_guest_visitor_id_columns_work():
    """New columns are usable end-to-end: a user can be put on the free plan, and a playlist
    can carry a guest_visitor_id."""
    set_admin_context(True)
    user = await create_user()
    async with AsyncSessionLocal() as db:
        free = (await db.execute(select(Plan).where(Plan.code == "free"))).scalar_one()

        # assign plan_id
        from app.models.user import User
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        u.plan_id = free.id

        # guest-created playlist with a visitor id
        vid = uuid.uuid4().hex
        pl = Playlist(uuid=str(uuid.uuid4()), user_id=None, partner_id=1, name="Guest PL",
                      is_public=True, type="similarity", guest_visitor_id=vid)
        db.add(pl)
        await db.commit()

        u2 = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        assert u2.plan_id == free.id
        pl2 = (await db.execute(select(Playlist).where(Playlist.uuid == pl.uuid))).scalar_one()
        assert pl2.guest_visitor_id == vid and pl2.user_id is None

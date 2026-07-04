"""
Soft-Deleted Track Visibility Tests
===================================

A soft-deleted / deactivated track (``is_active = False``) must never be returned to a
user-facing caller — not by direct UUID fetch, not in hydrated result lists (similarity /
search / playlist tracks), and not for playback. Admin / internal callers can still reach it
via ``include_inactive=True``.

These are repository-level tests (deterministic, no external services). They set a partner
context so the multi-tenancy failsafe allows the partner-scoped Track query to run.
"""

import pytest

from app.core.context import set_current_partner_id
from app.repositories.track_repository import TrackRepository
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_track, create_user

repo = TrackRepository()


@pytest.mark.asyncio
async def test_get_by_uuid_hides_soft_deleted_but_admin_can_see():
    user = await create_user()
    dead = await create_track(user_id=user.id, is_active=False, track_type="electrobuzz")
    live = await create_track(user_id=user.id, is_active=True, track_type="electrobuzz")

    set_current_partner_id(1)
    async with AsyncSessionLocal() as db:
        # User-facing: soft-deleted is invisible, active is visible.
        assert await repo.async_get_by_uuid(db, dead.uuid, partner_id=1) is None
        assert (await repo.async_get_by_uuid(db, live.uuid, partner_id=1)).uuid == live.uuid
        # Admin/internal escape hatch still reaches the soft-deleted track.
        got = await repo.async_get_by_uuid(db, dead.uuid, partner_id=1, include_inactive=True)
        assert got is not None and got.uuid == dead.uuid


@pytest.mark.asyncio
async def test_get_with_relationships_hides_soft_deleted():
    user = await create_user()
    dead = await create_track(user_id=user.id, is_active=False, track_type="electrobuzz")

    set_current_partner_id(1)
    async with AsyncSessionLocal() as db:
        assert await repo.async_get_with_relationships(db, dead.uuid, partner_id=1) is None
        assert (
            await repo.async_get_with_relationships(db, dead.uuid, partner_id=1, include_inactive=True)
        ).uuid == dead.uuid


@pytest.mark.asyncio
async def test_get_tracks_by_uuids_excludes_soft_deleted_from_lists():
    """Covers similarity-result / search-result / playlist-track hydration."""
    user = await create_user()
    live = await create_track(user_id=user.id, is_active=True, track_type="electrobuzz")
    dead = await create_track(user_id=user.id, is_active=False, track_type="electrobuzz")

    set_current_partner_id(1)
    async with AsyncSessionLocal() as db:
        got = await repo.async_get_tracks_by_uuids(db, [live.uuid, dead.uuid], partner_id=1)
        uuids = {t.uuid for t in got}
        assert live.uuid in uuids
        assert dead.uuid not in uuids  # soft-deleted never appears in a result list

        # Admin/internal can still hydrate the soft-deleted one.
        got_all = await repo.async_get_tracks_by_uuids(
            db, [live.uuid, dead.uuid], partner_id=1, include_inactive=True
        )
        assert {t.uuid for t in got_all} == {live.uuid, dead.uuid}

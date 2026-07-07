"""
Phase 6 — Guest → account association
=====================================

Covers:
  * 6.1 Reparent guest-created playlists onto the user on register/login, scoped to
        THIS device's visitor_id, under the frontend system partner only.
  * 6.2 New users are placed on the default (free) plan explicitly.

Authz / leak assertions baked in:
  * A different visitor's playlists are never claimed.
  * An already-owned playlist (even if tagged) is never re-claimed (WHERE user_id IS NULL).
  * Reparent is idempotent (a re-run matches nothing) and a no-op without a visitor_id.

The reparent logic is exercised directly at the service layer (deterministic, no network);
one endpoint-level test proves the controller derives + threads the visitor_id on login.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.core.config import settings
from app.models.plan import Plan
from app.models.playlist import Playlist
from app.services.auth_service import AuthService
from app.services.guest_identity_service import GuestIdentityService
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import _seed_ctx, create_user


async def _seed_guest_playlist(visitor_id, *, user_id=None, name="Guest Mix") -> str:
    """Insert a system-partner playlist tagged with ``visitor_id`` (as the guest path does)."""
    async with AsyncSessionLocal() as db:
        with _seed_ctx():
            pl = Playlist(
                uuid=str(uuid.uuid4()),
                user_id=user_id,
                partner_id=settings.system_partner_id,
                name=name,
                is_public=True,
                type="similarity",
                guest_visitor_id=visitor_id,
            )
            db.add(pl)
            await db.commit()
            await db.refresh(pl)
            return pl.uuid


async def _playlist_row(pl_uuid: str):
    async with AsyncSessionLocal() as db:
        return (
            await db.execute(
                text("SELECT user_id, guest_visitor_id FROM playlists WHERE uuid = :u"),
                {"u": pl_uuid},
            )
        ).first()


async def _default_plan_id() -> int:
    async with AsyncSessionLocal() as db:
        with _seed_ctx():
            return (await db.execute(select(Plan).where(Plan.is_default.is_(True)))).scalar_one().id


# --------------------------------------------------------------------------- #
# 6.1 + 6.2 — register: default plan + reparent own, leave others
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_register_assigns_default_plan_and_reparents_own_only():
    vid = "vid_" + uuid.uuid4().hex
    other_vid = "vid_" + uuid.uuid4().hex
    pl1 = await _seed_guest_playlist(vid)
    pl2 = await _seed_guest_playlist(vid)
    pl_other = await _seed_guest_playlist(other_vid)

    svc = AuthService()
    suffix = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        user, _token = await svc.register_user(
            db=db,
            email=f"p6_{suffix}@example.com",
            username=f"p6_{suffix}",
            password="StrongPass123!",
            guest_visitor_id=vid,
        )
        uid, assigned_plan = user.id, user.plan_id

    # 6.2 — new user is on the default plan.
    assert assigned_plan == await _default_plan_id()

    # 6.1 — this device's playlists are now owned + un-tagged.
    r1, r2 = await _playlist_row(pl1), await _playlist_row(pl2)
    assert r1.user_id == uid and r1.guest_visitor_id is None
    assert r2.user_id == uid and r2.guest_visitor_id is None

    # Leak check — a different visitor's playlist is untouched.
    ro = await _playlist_row(pl_other)
    assert ro.user_id is None and ro.guest_visitor_id == other_vid


# --------------------------------------------------------------------------- #
# Idempotency + no-op guards
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_reparent_idempotent_and_noop_without_visitor():
    vid = "vid_" + uuid.uuid4().hex
    pl = await _seed_guest_playlist(vid)
    user = await create_user()
    svc = AuthService()

    async with AsyncSessionLocal() as db:
        first = await svc._reparent_guest_playlists(db, user.id, vid)
        second = await svc._reparent_guest_playlists(db, user.id, vid)  # already claimed
        none_run = await svc._reparent_guest_playlists(db, user.id, None)
        empty_run = await svc._reparent_guest_playlists(db, user.id, "")

    assert first == 1
    assert second == 0 and none_run == 0 and empty_run == 0
    row = await _playlist_row(pl)
    assert row.user_id == user.id and row.guest_visitor_id is None


@pytest.mark.asyncio
async def test_reparent_never_claims_already_owned_playlist():
    owner = await create_user()
    claimer = await create_user()
    vid = "vid_" + uuid.uuid4().hex
    # Owned by `owner` but (defensively) still carrying a tag — must NOT be reclaimed.
    pl = await _seed_guest_playlist(vid, user_id=owner.id)

    svc = AuthService()
    async with AsyncSessionLocal() as db:
        claimed = await svc._reparent_guest_playlists(db, claimer.id, vid)

    assert claimed == 0
    row = await _playlist_row(pl)
    assert row.user_id == owner.id  # unchanged


@pytest.mark.asyncio
async def test_reparent_skips_when_account_already_has_playlists():
    """Anti-abuse: reparenting is a one-time onboarding convenience — it only claims guest work
    onto an account that has NONE of its own. A user who already owns a playlist (existing account)
    logging in from a fresh incognito guest session does NOT harvest those guest playlists, which
    would otherwise let them farm free guest playlists past their monthly cap."""
    user = await create_user()
    svc = AuthService()

    # The account already owns a playlist from before.
    await _seed_guest_playlist(None, user_id=user.id, name="Already Owned")
    # A guest created a playlist in this browser (tagged with a visitor_id).
    vid = "vid_" + uuid.uuid4().hex
    guest_pl = await _seed_guest_playlist(vid, name="Fresh Guest Work")

    async with AsyncSessionLocal() as db:
        claimed = await svc._reparent_guest_playlists(db, user.id, vid)

    assert claimed == 0  # skipped because the account is not empty
    row = await _playlist_row(guest_pl)
    assert row.user_id is None and row.guest_visitor_id == vid  # guest playlist left untouched


# --------------------------------------------------------------------------- #
# Endpoint-level — login derives + threads the visitor_id (controller wiring)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_login_reparents_guest_playlist_e2e():
    # Fix the IP prefix via CF-Connecting-IP so the derived id is deterministic in-process.
    gi = GuestIdentityService()
    device = "dev-" + uuid.uuid4().hex
    expected_vid = gi.derive_visitor_id_from(
        device_hash=device, ip_prefix="203.0.113.0/24", accept_language="en"
    )
    pl = await _seed_guest_playlist(expected_vid)
    user = await create_user()  # verified, password StrongPass123!

    from app.main import app
    headers = {
        "X-Device-Hash": device,
        "CF-Connecting-IP": "203.0.113.9",
        "Accept-Language": "en",
        "X-API-KEY": settings.api_key,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/auth/login",
            headers=headers,
            json={"email_or_username": user.email, "password": "StrongPass123!"},
        )
    assert res.status_code == 200, res.text

    row = await _playlist_row(pl)
    assert row.user_id == user.id and row.guest_visitor_id is None

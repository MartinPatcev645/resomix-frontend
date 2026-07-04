"""
Phase 5 — Endpoint enforcement tests (increment 1)
==================================================

Covers the enforcement wired this increment:
  * Similarity-by-upload: a **guest** (System Partner 1, no JWT) is denied; B2B is exempt.
  * Rating: a logged-in user whose plan disables rating is denied (free users unaffected).
  * Export gate (check_export): guest / free denied external targets; a basic-tier user allowed.

Guest-deny paths are fully testable in-process (the gate fires before any external call).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.context import set_admin_context
from app.core.entitlement_keys import FeatureKey, PlanCode
from app.core.config import settings
from app.models.plan import EntitlementOverride, Feature, Plan
from app.models.user import User
from app.services.entitlement_gate import EntitlementGate
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

gate = EntitlementGate()


def _rating_headers(user) -> dict:
    # Ratings require BOTH the frontend API key and a user JWT.
    return {**auth_headers(user), "X-API-KEY": settings.api_key}


async def _reload_user(db, uid) -> User:
    return (await db.execute(select(User).where(User.id == uid))).scalar_one()


# --------------------------------------------------------------------------- #
# Similarity by upload — guest denied (before any external call)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_guest_similarity_upload_is_denied():
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # System Partner 1 (public/system API key) + NO JWT = guest.
        res = await ac.post(
            "/api/v1/similarity/upload",
            headers={"X-API-KEY": settings.api_key},
            files={"file": ("t.mp3", b"dummy-bytes", "audio/mpeg")},
        )
    assert res.status_code == 403
    body = res.json()
    assert body["success"] is False and body.get("reason") == "login_required"


# --------------------------------------------------------------------------- #
# Rating — plan can disable it (free users unaffected)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_rating_denied_when_plan_disables_it():
    user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.CAN_RATE_TRACKS))).scalar_one()
        db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id),
                                   feature_id=feat.id, bool_value=False, reason="test"))
        await db.commit()

    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/ratings/tracks/",
            headers=_rating_headers(user),
            json={"track_id": str(uuid.uuid4()), "playlist_id": str(uuid.uuid4()), "rating": 1},
        )
    # gate fires before track validation → 403 upgrade, not a 404/422 for the dummy ids
    assert res.status_code == 403
    assert res.json().get("reason") == "upgrade_required"


@pytest.mark.asyncio
async def test_rating_not_gate_blocked_for_free_user():
    """A free user is NOT blocked by the rating gate (they may still 4xx for bad ids, but not 403-gate)."""
    user = await create_user()
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/ratings/tracks/",
            headers=_rating_headers(user),
            json={"track_id": str(uuid.uuid4()), "playlist_id": str(uuid.uuid4()), "rating": 1},
        )
    # Free plan allows rating → the gate does not produce an upgrade_required 403.
    assert not (res.status_code == 403 and res.json().get("reason") == "upgrade_required")


# --------------------------------------------------------------------------- #
# Export gate (check_export) — targets per plan
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_check_export_by_plan():
    # Create users first (committed) so a later session's snapshot sees them.
    free_user = await create_user()
    basic_user = await create_user()
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        basic = (await db.execute(select(Plan).where(Plan.code == PlanCode.BASIC))).scalar_one()
        u = await _reload_user(db, basic_user.id)
        u.plan_id = basic.id
        await db.commit()  # ends the txn → subsequent queries get a fresh snapshot

        # guest: can_export = false → denied (login nudge)
        g = await gate.check_export(db, "spotify", visitor_id="vid_" + uuid.uuid4().hex)
        assert g.allowed is False and g.reason == "login_required"

        # free user: can_export true but export_targets empty → external target denied (upgrade)
        f = await gate.check_export(db, "spotify", user=free_user)
        assert f.allowed is False and f.reason == "upgrade_required"

        # basic-tier user: targets = spotify,apple → spotify allowed, tidal denied
        u = await _reload_user(db, basic_user.id)  # now carries plan_id
        assert (await gate.check_export(db, "spotify", user=u)).allowed is True
        assert (await gate.check_export(db, "tidal", user=u)).allowed is False

"""
Phase 5 — Endpoint enforcement tests (increment 1)
==================================================

Covers the enforcement wired this increment:
  * Similarity-by-upload: a **guest** (System Partner 1, no JWT) is denied; B2B is exempt.
  * Rating: a logged-in user whose plan disables rating is denied (free users unaffected).
  * Export gate (check_export): guest / free denied external targets; a basic-tier user allowed.

Guest-deny paths are fully testable in-process (the gate fires before any external call).
"""

import socket
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.core.context import set_admin_context
from app.core.entitlement_keys import FeatureKey, PlanCode
from app.core.config import settings
from app.models.plan import EntitlementOverride, Feature, Plan
from app.models.user import User
from app.services.entitlement_gate import EntitlementGate
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

gate = EntitlementGate()

# An indexed catalog seed track (active electrobuzz) for real similarity results.
SEED_TRACK = "4a2a80b5-3cd2-483d-8b89-f9ccd2d08dd1"


def _similarity_server_up() -> bool:
    """The similarity search calls the media server (settings.similarity_server_url, e.g. :8004)."""
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

        # basic-tier user: targets = spotify,apple → spotify + apple allowed, tidal denied
        u = await _reload_user(db, basic_user.id)  # now carries plan_id
        assert (await gate.check_export(db, "spotify", user=u)).allowed is True
        assert (await gate.check_export(db, "apple", user=u)).allowed is True
        assert (await gate.check_export(db, "tidal", user=u)).allowed is False


@pytest.mark.asyncio
async def test_spotify_transfer_denied_for_free_user_endpoint():
    """A free user hitting the Spotify transfer endpoint is denied (before any Spotify call)."""
    from app.main import app
    user = await create_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/spotify/transfer-playlist/",
            headers={**auth_headers(user), "X-API-KEY": settings.api_key},
            json={"playlist_id": str(uuid.uuid4()), "access_token": "dummy-token"},
        )
    assert res.status_code == 403
    assert res.json().get("reason") == "upgrade_required"


@pytest.mark.asyncio
async def test_apple_transfer_denied_for_free_user_endpoint():
    """A free user hitting the Apple Music transfer endpoint is denied (before any Apple call)."""
    from app.main import app
    user = await create_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/apple-music/transfer-playlist/",
            headers={**auth_headers(user), "X-API-KEY": settings.api_key},
            json={"playlist_id": str(uuid.uuid4()), "music_user_token": "dummy-token-123"},
        )
    assert res.status_code == 403
    assert res.json().get("reason") == "upgrade_required"


# --------------------------------------------------------------------------- #
# 5.1 / 5.2 — Guest monthly playlist limit + track clamp + tagging (E2E via 8004)
# --------------------------------------------------------------------------- #


@requires_similarity
@pytest.mark.asyncio
async def test_guest_similarity_monthly_limit_clamp_and_tagging():
    from app.main import app
    from sqlalchemy import select
    from app.services.guest_identity_service import GuestIdentityService

    # Pin THIS guest device to a monthly limit of 1 via a visitor override (deterministic: the
    # default is 5/month, which would need 6 real searches). We fix the IP via CF-Connecting-IP so
    # the server-derived visitor_id is reproducible, then override that exact visitor.
    device = "e2e-" + uuid.uuid4().hex
    visitor_id = GuestIdentityService().derive_visitor_id_from(
        device_hash=device, ip_prefix="203.0.113.0/24", accept_language="en"
    )
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.PLAYLISTS_PER_MONTH))).scalar_one()
        db.add(EntitlementOverride(subject_type="visitor", subject_id=visitor_id,
                                   feature_id=feat.id, int_value=1, reason="e2e-test"))
        await db.commit()

    headers = {"X-API-KEY": settings.api_key, "X-Device-Hash": device,
               "accept-language": "en", "CF-Connecting-IP": "203.0.113.9"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60) as ac:
        # 1st guest search: allowed. top_sk=100 must be clamped to the guest cap (20). Public playlist.
        r1 = await ac.post("/api/v1/similarity/search", headers=headers,
                           json={"track_id": SEED_TRACK, "top_sk": 100})
        assert r1.status_code == 200, r1.text
        data = r1.json()["data"]
        assert len(data["similar_tracks"]) <= 20            # clamped from 100
        pl = data["playlist"]
        assert pl["is_public"] is True                       # guest playlists are public
        playlist_uuid = pl["id"]

        # 2nd guest search (same device) → monthly limit (1) reached → soft login nudge.
        r2 = await ac.post("/api/v1/similarity/search", headers=headers,
                           json={"track_id": SEED_TRACK, "top_sk": 20})
        assert r2.status_code == 403
        assert r2.json().get("reason") == "login_required"

    # The created playlist is tagged with the guest visitor_id (for reparent-on-login).
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            text("SELECT user_id, guest_visitor_id FROM playlists WHERE uuid = :u"),
            {"u": playlist_uuid},
        )).first()
        assert row is not None
        assert row.user_id is None and row.guest_visitor_id  # tagged, unowned


@requires_similarity
@pytest.mark.asyncio
async def test_logged_in_user_not_blocked_by_guest_gate():
    """A logged-in (free) user's similarity search is not blocked by the guest daily gate."""
    from app.main import app
    user = await create_user()
    headers = {**auth_headers(user), "X-API-KEY": settings.api_key}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60) as ac:
        r = await ac.post("/api/v1/similarity/search", headers=headers,
                          json={"track_id": SEED_TRACK, "top_sk": 100})
    assert r.status_code == 200, r.text
    # Free dropdown cap is 50 → clamped below the requested 100.
    assert len(r.json()["data"]["similar_tracks"]) <= 50

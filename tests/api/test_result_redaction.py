"""
Server-authoritative result teasing (design 5.2)
================================================

The similarity result list is redacted (scrambled) beyond the caller's `max_tracks_per_playlist`
entitlement, for the whole frontend surface — not just anonymous callers. This makes the
"unlock N, tease the rest" UI non-bypassable: a logged-in free user can't read tracks 21+ from
the network response. B2B partners are never redacted.

Tested directly against `SimilarityController._apply_frontend_unlock_redaction` (deterministic,
no similarity server needed). `request` is only read for guests (to derive a visitor_id), so the
logged-in / B2B cases pass `request=None`.
"""

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.controllers.similarity_controller import SimilarityController
from app.models.user import User
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user

ctrl = SimilarityController()


def _payload(n: int) -> dict:
    """A results payload shaped like what the controller redacts (top-level similar_tracks)."""
    return {
        "similar_tracks": [
            {
                "id": f"real-{i:04d}-aaaa-bbbb-cccc-dddddddddddd",
                "title": "Real Title",
                "artist": "Real Artist",
                "label": "Real Label",
                "year": 1999,
                "rank": i + 1,
                "score": 0.9,
            }
            for i in range(n)
        ]
    }


def _is_masked(track: dict) -> bool:
    # The redactor sets year=2025 and rewrites id/title/artist to pattern text (no hyphens in id).
    return track["year"] == 2025 and track["title"] != "Real Title" and "-" not in track["id"]


@pytest.mark.asyncio
async def test_free_user_teased_beyond_max_tracks():
    user = await create_user()  # default plan → free → max_tracks_per_playlist = 20
    payload = _payload(30)
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        await ctrl._apply_frontend_unlock_redaction(
            db, payload, request=None, current_user=u, partner_id=settings.system_partner_id
        )
    tracks = payload["similar_tracks"]
    # First 20 are real, everything from rank 21 on is scrambled.
    assert tracks[0]["title"] == "Real Title" and tracks[0]["year"] == 1999
    assert tracks[19]["title"] == "Real Title"
    assert _is_masked(tracks[20])
    assert _is_masked(tracks[29])


@pytest.mark.asyncio
async def test_b2b_partner_never_redacted():
    payload = _payload(30)
    async with AsyncSessionLocal() as db:
        # A non-system partner (B2B) with no user → helper returns early, nothing masked.
        await ctrl._apply_frontend_unlock_redaction(
            db, payload, request=None, current_user=None, partner_id=settings.system_partner_id + 999
        )
    assert all(t["title"] == "Real Title" for t in payload["similar_tracks"])


@pytest.mark.asyncio
async def test_masked_tracks_do_not_leak_apple_preview():
    """Locked catalogue tracks must not expose their Apple preview/artwork/deep-link — playback is
    login-gated. Visible tracks keep their Apple fields; masked tracks have them nulled."""
    user = await create_user()  # free → 20 visible
    payload = {
        "similar_tracks": [
            {
                "id": f"real-{i:04d}-aaaa-bbbb-cccc-dddddddddddd",
                "title": "Real Title", "artist": "Real Artist", "label": "Real Label",
                "year": 1999, "rank": i + 1, "score": 0.9,
                "playback": "preview",
                "preview_url": f"https://apple/preview/{i}.m4a",
                "artwork_url": f"https://apple/art/{i}.jpg",
                "deep_link_url": f"https://music.apple.com/{i}",
                "apple_song_id": str(1000 + i),
            }
            for i in range(30)
        ]
    }
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        await ctrl._apply_frontend_unlock_redaction(
            db, payload, request=None, current_user=u, partner_id=settings.system_partner_id
        )
    tracks = payload["similar_tracks"]
    # Visible track keeps its real Apple preview.
    assert tracks[0]["preview_url"] == "https://apple/preview/0.m4a"
    assert tracks[19]["artwork_url"] == "https://apple/art/19.jpg"
    # Masked tracks have every Apple playback field stripped.
    for masked in (tracks[20], tracks[29]):
        for key in ("preview_url", "artwork_url", "deep_link_url", "apple_song_id"):
            assert masked[key] is None


@pytest.mark.asyncio
async def test_override_widens_unlock():
    """A per-user override on max_tracks_per_playlist changes how many tracks stay unlocked."""
    from app.core.entitlement_keys import FeatureKey
    from app.models.plan import EntitlementOverride, Feature

    user = await create_user()
    async with AsyncSessionLocal() as db:
        feat = (await db.execute(select(Feature).where(Feature.key == FeatureKey.MAX_TRACKS_PER_PLAYLIST))).scalar_one()
        db.add(EntitlementOverride(subject_type="user", subject_id=str(user.id),
                                   feature_id=feat.id, int_value=25, reason="test"))
        await db.commit()

    payload = _payload(30)
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        await ctrl._apply_frontend_unlock_redaction(
            db, payload, request=None, current_user=u, partner_id=settings.system_partner_id
        )
    tracks = payload["similar_tracks"]
    assert tracks[24]["title"] == "Real Title"   # unlocked up to 25 now
    assert _is_masked(tracks[25])

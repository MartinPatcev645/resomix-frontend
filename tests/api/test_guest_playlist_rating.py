"""
Guest playlist rating / feedback (open) vs track rating (login-only)
====================================================================

Playlist overall rating + feedback are open to everyone: a logged-in rating carries the user_id;
a guest rating is tagged with the server-derived visitor_id (a client-sent user_id is not trusted).
Per-track rating stays login-only (the frontend intercepts guests before calling it).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.context import admin_context
from app.models.playlist import Playlist
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

RATE_PLAYLIST = "/api/v1/ratings/playlists/"
RATE_TRACK = "/api/v1/ratings/tracks/"


async def _client() -> AsyncClient:
    from app.main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_playlist() -> str:
    async with AsyncSessionLocal() as db:
        token = admin_context.set(True)
        try:
            pl = Playlist(uuid=str(uuid.uuid4()), user_id=None, partner_id=settings.system_partner_id,
                          name="Rateable", is_public=True, type="similarity")
            db.add(pl)
            await db.commit()
            await db.refresh(pl)
            return pl.uuid
        finally:
            admin_context.reset(token)


async def _latest_rating(playlist_uuid: str):
    async with AsyncSessionLocal() as db:
        return (await db.execute(
            text("SELECT pr.user_id, pr.visitor_id, pr.rating FROM playlist_ratings pr "
                 "JOIN playlists p ON p.id = pr.playlist_id WHERE p.uuid = :u ORDER BY pr.id DESC LIMIT 1"),
            {"u": playlist_uuid},
        )).first()


@pytest.mark.asyncio
async def test_guest_can_rate_playlist_tagged_with_visitor_id():
    playlist_uuid = await _seed_playlist()
    async with await _client() as ac:
        res = await ac.post(RATE_PLAYLIST,
                            headers={"X-API-KEY": settings.api_key, "X-Device-Hash": "dev-" + uuid.uuid4().hex},
                            json={"playlist_id": playlist_uuid, "rating": 3, "message": "great set"})
    assert res.status_code == 200, res.text
    row = await _latest_rating(playlist_uuid)
    assert row is not None
    assert row.user_id is None and row.visitor_id  # tagged as a guest
    assert row.rating == 3


@pytest.mark.asyncio
async def test_logged_in_playlist_rating_uses_user_id():
    playlist_uuid = await _seed_playlist()
    user = await create_user()
    async with await _client() as ac:
        res = await ac.post(RATE_PLAYLIST,
                            headers={**auth_headers(user), "X-API-KEY": settings.api_key},
                            json={"playlist_id": playlist_uuid, "rating": 2})
    assert res.status_code == 200, res.text
    row = await _latest_rating(playlist_uuid)
    assert row.user_id == user.id and row.visitor_id is None


@pytest.mark.asyncio
async def test_guest_cannot_rate_a_track():
    """Per-track rating requires a logged-in user — a guest (no JWT) is rejected by auth."""
    async with await _client() as ac:
        res = await ac.post(RATE_TRACK,
                            headers={"X-API-KEY": settings.api_key},
                            json={"track_id": str(uuid.uuid4()), "playlist_id": str(uuid.uuid4()), "rating": 1})
    assert res.status_code in (401, 403)

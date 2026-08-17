"""A shared PUBLIC playlist must open for a visitor whose own session has expired.

The bug this pins
-----------------
`get_current_user_optional` returns 401 when a token is PRESENT but invalid or expired. On the
shared-playlist endpoint that meant:

    someone shares a public link
      → the recipient's browser still holds an expired access token, so it is sent
      → the endpoint 401s instead of serving the public playlist to a guest
      → the frontend cannot refresh (the refresh cookie is dead too) and renders
        "Playlist is Private" — for a playlist that is public, to a visitor who needed no account

Seen in production on 2026-08-16: `/api/v1/playlists/similarity/ac779c6b-…`, two devices, one IP,
twenty minutes apart, both `401 Could not validate credentials`.

Why the existing tests missed it
--------------------------------
The suite covered the AUTHORIZATION matrix thoroughly — owner sees private, stranger does not,
guest sees public — but every one of those cases used either a VALID token or NO token. Nothing
exercised the third credential state: a token that is present and bad. Authorization and
authentication were each tested; their interaction was not, and that is where the bug lived.

So these tests are organised by credential state, not by authorization outcome.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.context import admin_context
from app.core.security import create_access_token
from app.main import app
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

pytestmark = pytest.mark.asyncio


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _public_playlist(owner) -> str:
    """A public playlist owned by `owner`; returns its uuid."""
    from app.models.playlist import Playlist

    token = admin_context.set(True)
    try:
        async with AsyncSessionLocal() as db:
            pl = Playlist(
                uuid=str(uuid.uuid4()),
                name="Shared playlist",
                user_id=owner.id,
                partner_id=settings.system_partner_id,
                is_public=True,
                type="similarity",
            )
            db.add(pl)
            await db.commit()
            await db.refresh(pl)
            return pl.uuid
    finally:
        admin_context.reset(token)


def _expired_token(user) -> dict:
    """A structurally valid token for `user` that expired an hour ago."""
    from datetime import timedelta

    token = create_access_token(data={"sub": user.uuid}, expires_delta=timedelta(hours=-1))
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# credential state: NONE  (a true first-time visitor)
# --------------------------------------------------------------------------- #
async def test_public_playlist_opens_for_a_visitor_with_no_token() -> None:
    owner = await create_user()
    pid = await _public_playlist(owner)
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/playlists/similarity/{pid}")
    assert res.status_code == 200, res.text


# --------------------------------------------------------------------------- #
# credential state: VALID
# --------------------------------------------------------------------------- #
async def test_public_playlist_opens_for_a_logged_in_visitor() -> None:
    owner = await create_user()
    visitor = await create_user()
    pid = await _public_playlist(owner)
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/playlists/similarity/{pid}", headers=auth_headers(visitor))
    assert res.status_code == 200, res.text


# --------------------------------------------------------------------------- #
# credential state: PRESENT BUT BAD — the case nothing covered
# --------------------------------------------------------------------------- #
async def test_public_playlist_opens_for_a_visitor_with_an_EXPIRED_token() -> None:
    """The reported bug. An expired session must degrade to guest, not refuse the playlist."""
    owner = await create_user()
    stale = await create_user()
    pid = await _public_playlist(owner)
    async with await _client() as ac:
        res = await ac.get(f"/api/v1/playlists/similarity/{pid}", headers=_expired_token(stale))
    assert res.status_code != 401, "an expired token must not refuse a PUBLIC playlist"
    assert res.status_code == 200, res.text


async def test_public_playlist_opens_for_a_visitor_with_a_GARBAGE_token() -> None:
    """Same reasoning for a malformed/forged token: on a public resource it is simply not a login."""
    owner = await create_user()
    pid = await _public_playlist(owner)
    async with await _client() as ac:
        res = await ac.get(
            f"/api/v1/playlists/similarity/{pid}",
            headers={"Authorization": "Bearer not.a.real.jwt"},
        )
    assert res.status_code != 401
    assert res.status_code == 200, res.text


# --------------------------------------------------------------------------- #
# the degrade must not become a bypass
# --------------------------------------------------------------------------- #
async def test_a_private_playlist_is_still_refused_to_an_expired_token() -> None:
    """Degrading to anonymous must not hand out private playlists.

    The visitor is treated as a guest — and a guest cannot read someone's private playlist. If
    this ever returns 200 the fix has become a hole.
    """
    from app.models.playlist import Playlist

    owner = await create_user()
    stale = await create_user()

    token = admin_context.set(True)
    try:
        async with AsyncSessionLocal() as db:
            pl = Playlist(
                uuid=str(uuid.uuid4()),
                name="Private playlist",
                user_id=owner.id,
                partner_id=settings.system_partner_id,
                is_public=False,
                type="similarity",
            )
            db.add(pl)
            await db.commit()
            await db.refresh(pl)
            private_id = pl.uuid
    finally:
        admin_context.reset(token)

    async with await _client() as ac:
        res = await ac.get(
            f"/api/v1/playlists/similarity/{private_id}", headers=_expired_token(stale)
        )
    assert res.status_code != 200, "a private playlist must never open for a non-owner"

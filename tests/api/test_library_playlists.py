"""
Library Playlist-Summary Tests
=============================

Covers the existing user playlists listing that the library page reuses:

    GET /api/v1/playlists/get-all-playlists/

Verifies:
  * it is a USER route (reachable by a logged-in frontend user → partner 1) and
    declines when the caller is not logged in (401),
  * it returns only the caller's own playlists,
  * the response is the lightweight summary (no embedded track list),
  * the internal integer PK ('pk') is never exposed on this user-facing response,
  * the new ``seed_track_type`` field reflects whether the seed/query track is a
    user upload ('upload') or a catalog track ('internal').

Runs the real app in-process via httpx ASGITransport against a live database.
Requires the stack to be up (MariaDB + Redis).
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.api.library_helpers import (
    auth_headers,
    create_playlist,
    create_track,
    create_user,
)

PLAYLISTS_URL = "/api/v1/playlists/get-all-playlists/"

# Summary-only keys we expect; the presence of a full track list would show up as
# one of these forbidden keys.
_FORBIDDEN_HEAVY_KEYS = {"tracks", "playlist_tracks", "similar_tracks", "pk"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_get_all_playlists_requires_authentication():
    """Not logged in → 401. The library playlists list is behind the user gate."""
    async with _client() as ac:
        res = await ac.get(PLAYLISTS_URL)
    assert res.status_code == 401
    assert res.json()["success"] is False


@pytest.mark.asyncio
async def test_logged_in_frontend_user_reaches_endpoint():
    """A logged-in frontend user (partner 1, JWT only, no API key) reaches it (200)."""
    user = await create_user()
    async with _client() as ac:
        res = await ac.get(PLAYLISTS_URL, headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["success"] is True


@pytest.mark.asyncio
async def test_returns_only_callers_own_playlists():
    """The list is scoped to the caller's own playlists."""
    owner = await create_user()
    other = await create_user()
    mine = await create_playlist(user_id=owner.id, name="Mine")
    await create_playlist(user_id=other.id, name="Theirs")

    async with _client() as ac:
        res = await ac.get(PLAYLISTS_URL, headers=auth_headers(owner))

    uuids = {p["uuid"] for p in res.json()["data"]}
    assert mine.uuid in uuids
    assert len(uuids) == 1


@pytest.mark.asyncio
async def test_summary_is_lightweight_and_has_no_pk():
    """The response is a summary (no track list) and never leaks the internal 'pk'."""
    user = await create_user()
    seed = await create_track(user_id=user.id)
    await create_playlist(user_id=user.id, seed_track_id=seed.id)

    async with _client() as ac:
        res = await ac.get(PLAYLISTS_URL, headers=auth_headers(user))

    items = res.json()["data"]
    assert items, "expected at least one playlist"
    for item in items:
        assert _FORBIDDEN_HEAVY_KEYS.isdisjoint(item.keys()), f"unexpected heavy key in {item.keys()}"
        # Expected lightweight summary fields are present.
        for key in ("uuid", "name", "is_public", "num_tracks", "play_time", "created_at", "seed_track_type"):
            assert key in item


@pytest.mark.asyncio
async def test_seed_track_type_reflects_upload_vs_internal():
    """seed_track_type is 'upload' for an uploaded seed and 'internal' for a catalog seed."""
    user = await create_user()
    upload_seed = await create_track(user_id=user.id, track_type="upload")
    catalog_seed = await create_track(user_id=None, track_type="electrobuzz")

    pl_upload = await create_playlist(user_id=user.id, seed_track_id=upload_seed.id, name="From upload")
    pl_internal = await create_playlist(user_id=user.id, seed_track_id=catalog_seed.id, name="From catalog")

    async with _client() as ac:
        res = await ac.get(PLAYLISTS_URL, headers=auth_headers(user))

    by_uuid = {p["uuid"]: p for p in res.json()["data"]}
    assert by_uuid[pl_upload.uuid]["seed_track_type"] == "upload"
    assert by_uuid[pl_internal.uuid]["seed_track_type"] == "internal"

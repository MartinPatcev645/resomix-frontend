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

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.api.library_helpers import (
    auth_headers,
    create_playlist,
    create_track,
    create_user,
    get_playlist_state,
)

PLAYLISTS_URL = "/api/v1/playlists/get-all-playlists/"
VISIBILITY_URL = "/api/v1/playlists/visibility/"
RENAME_URL = "/api/v1/playlists/rename/"


def _delete_url(playlist_uuid: str) -> str:
    return f"/api/v1/playlists/{playlist_uuid}"


async def _list_uuids(ac, user):
    res = await ac.get(PLAYLISTS_URL, headers=auth_headers(user))
    return {p["uuid"] for p in res.json()["data"]}

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


# --------------------------------------------------------------------------- #
# Share / make public (PUT /playlists/visibility/) — login + ownership gated
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_share_requires_login():
    """Changing visibility while logged out is rejected (401)."""
    owner = await create_playlist(user_id=(await create_user()).id, is_public=False)
    async with _client() as ac:
        res = await ac.put(VISIBILITY_URL, json={"playlist_id": owner.uuid, "is_public": True})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_owner_can_make_playlist_public():
    """The owner can share (make public) their own playlist."""
    user = await create_user()
    pl = await create_playlist(user_id=user.id, is_public=False)

    async with _client() as ac:
        res = await ac.put(
            VISIBILITY_URL,
            json={"playlist_id": pl.uuid, "is_public": True},
            headers=auth_headers(user),
        )
    assert res.status_code == 200
    assert res.json()["success"] is True
    is_public, _ = await get_playlist_state(pl.uuid)
    assert is_public in (True, 1)


@pytest.mark.asyncio
async def test_non_owner_cannot_change_visibility():
    """A logged-in non-owner gets 404 and the playlist is unchanged (no IDOR)."""
    owner = await create_user()
    attacker = await create_user()
    pl = await create_playlist(user_id=owner.id, is_public=False)

    async with _client() as ac:
        res = await ac.put(
            VISIBILITY_URL,
            json={"playlist_id": pl.uuid, "is_public": True},
            headers=auth_headers(attacker),
        )
    assert res.status_code == 404
    is_public, _ = await get_playlist_state(pl.uuid)
    assert is_public in (False, 0)  # untouched


# --------------------------------------------------------------------------- #
# Rename (PUT /playlists/rename/) — login + ownership gated
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_rename_requires_login():
    """Renaming while logged out is rejected (401)."""
    pl = await create_playlist(user_id=(await create_user()).id, name="Original")
    async with _client() as ac:
        res = await ac.put(RENAME_URL, json={"playlist_id": pl.uuid, "new_name": "Hacked"})
    assert res.status_code == 401
    _, name = await get_playlist_state(pl.uuid)
    assert name == "Original"


@pytest.mark.asyncio
async def test_owner_can_rename_playlist():
    """The owner can rename their own playlist."""
    user = await create_user()
    pl = await create_playlist(user_id=user.id, name="Original")

    async with _client() as ac:
        res = await ac.put(
            RENAME_URL,
            json={"playlist_id": pl.uuid, "new_name": "My New Name"},
            headers=auth_headers(user),
        )
    assert res.status_code == 200
    _, name = await get_playlist_state(pl.uuid)
    assert name == "My New Name"


@pytest.mark.asyncio
async def test_non_owner_cannot_rename():
    """A logged-in non-owner gets 404 and the name is unchanged (no IDOR)."""
    owner = await create_user()
    attacker = await create_user()
    pl = await create_playlist(user_id=owner.id, name="Original")

    async with _client() as ac:
        res = await ac.put(
            RENAME_URL,
            json={"playlist_id": pl.uuid, "new_name": "Hacked"},
            headers=auth_headers(attacker),
        )
    assert res.status_code == 404
    _, name = await get_playlist_state(pl.uuid)
    assert name == "Original"


# --------------------------------------------------------------------------- #
# Delete playlist (DELETE /playlists/{uuid}) — login + ownership, soft delete
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_delete_playlist_requires_login():
    """Deleting a playlist while logged out is rejected (401)."""
    pl = await create_playlist(user_id=(await create_user()).id)
    async with _client() as ac:
        res = await ac.delete(_delete_url(pl.uuid))
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_owner_can_delete_playlist_and_it_disappears():
    """The owner soft-deletes their playlist; it vanishes from the list."""
    user = await create_user()
    keep = await create_playlist(user_id=user.id, name="Keep")
    drop = await create_playlist(user_id=user.id, name="Drop")

    async with _client() as ac:
        assert {keep.uuid, drop.uuid} <= await _list_uuids(ac, user)
        res = await ac.delete(_delete_url(drop.uuid), headers=auth_headers(user))
        assert res.status_code == 200
        assert res.json()["success"] is True

        remaining = await _list_uuids(ac, user)
        assert drop.uuid not in remaining
        assert keep.uuid in remaining


@pytest.mark.asyncio
async def test_non_owner_cannot_delete_playlist():
    """A logged-in non-owner gets 404 and the playlist survives."""
    owner = await create_user()
    attacker = await create_user()
    pl = await create_playlist(user_id=owner.id)

    async with _client() as ac:
        res = await ac.delete(_delete_url(pl.uuid), headers=auth_headers(attacker))
        assert res.status_code == 404
        assert pl.uuid in await _list_uuids(ac, owner)  # still there for the owner


@pytest.mark.asyncio
async def test_delete_playlist_is_idempotent():
    """Deleting the same playlist twice: first 200, second 404."""
    user = await create_user()
    pl = await create_playlist(user_id=user.id)
    async with _client() as ac:
        first = await ac.delete(_delete_url(pl.uuid), headers=auth_headers(user))
        second = await ac.delete(_delete_url(pl.uuid), headers=auth_headers(user))
    assert first.status_code == 200
    assert second.status_code == 404


# --------------------------------------------------------------------------- #
# Soft-deleted / nonexistent → "not found" (distinct from private → "not public")
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_similarity_data_messages_distinguish_deleted_vs_private():
    from app.core.context import set_current_partner_id
    from app.services.playlist_service import PlaylistService
    from database.connection import AsyncSessionLocal

    owner = await create_user()
    other = await create_user()
    deleted_pl = await create_playlist(user_id=owner.id, is_public=False)
    private_pl = await create_playlist(user_id=owner.id, is_public=False)

    async with _client() as ac:  # soft-delete one playlist via the real endpoint
        assert (await ac.delete(_delete_url(deleted_pl.uuid), headers=auth_headers(owner))).status_code == 200

    svc = PlaylistService()
    set_current_partner_id(1)
    async with AsyncSessionLocal() as db:
        # Deleted → "not found" even for the OWNER (must not leak as private / show data).
        deleted = await svc.get_playlist_similarity_data(db, deleted_pl.uuid, user_id=owner.id, partner_id=1)
        assert deleted["success"] is False and deleted["error"] == "Playlist not found"

        # Nonexistent id → "not found".
        missing = await svc.get_playlist_similarity_data(db, str(uuid.uuid4()), user_id=owner.id, partner_id=1)
        assert missing["success"] is False and missing["error"] == "Playlist not found"

        # Existing private playlist, non-owner → distinct "not public" message.
        private = await svc.get_playlist_similarity_data(db, private_pl.uuid, user_id=other.id, partner_id=1)
        assert private["success"] is False and "not public" in private["error"].lower()

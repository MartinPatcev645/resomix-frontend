"""
Library Track Endpoint Tests
============================

Integration tests for the user "library" endpoints — the authenticated user's own
uploaded tracks:

    GET    /api/v1/tracks/my-tracks/            (paginated list)
    GET    /api/v1/tracks/my-tracks/{uuid}      (single-track view)
    DELETE /api/v1/tracks/my-tracks/{uuid}      (soft delete)

Runs the real app in-process via httpx ASGITransport against a live database.
Covers: the auth gate (logged-in vs not / invalid token), ownership + tenant
scoping, the upload-only + soft-delete filters, pagination (incl. the 20/page cap),
and the full CRUD-ish behaviour of view and delete including edge cases.

Requires the stack to be up (MariaDB + Redis). Run with:  pytest tests/api/test_library_tracks.py
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
    get_track_is_active,
)

LIST_URL = "/api/v1/tracks/my-tracks/"


def _detail_url(track_uuid: str) -> str:
    return f"/api/v1/tracks/my-tracks/{track_uuid}"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# --------------------------------------------------------------------------- #
# Auth gate (logged-in vs not)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_list_requires_authentication():
    """Listing without a token is rejected (401) — endpoint is behind the user gate."""
    async with _client() as ac:
        res = await ac.get(LIST_URL)
    assert res.status_code == 401
    assert res.json()["success"] is False


@pytest.mark.asyncio
async def test_list_rejects_invalid_token():
    """A malformed / bogus bearer token is rejected (401), not treated as anonymous."""
    async with _client() as ac:
        res = await ac.get(LIST_URL, headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_view_requires_authentication():
    async with _client() as ac:
        res = await ac.get(_detail_url(str(uuid.uuid4())))
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_delete_requires_authentication():
    async with _client() as ac:
        res = await ac.delete(_detail_url(str(uuid.uuid4())))
    assert res.status_code == 401


# --------------------------------------------------------------------------- #
# List: scoping + filters
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_list_returns_only_own_uploaded_tracks():
    """A user sees only their own uploads — not other users', not catalog tracks."""
    user_a = await create_user()
    user_b = await create_user()

    t1 = await create_track(user_id=user_a.id, title="A one")
    t2 = await create_track(user_id=user_a.id, title="A two")
    await create_track(user_id=user_b.id, title="B one")  # other user
    await create_track(user_id=None, track_type="electrobuzz", title="Catalog")  # catalog
    # Edge case: a non-upload track that DOES reference user A must still be excluded.
    await create_track(user_id=user_a.id, track_type="electrobuzz", title="A catalog")

    async with _client() as ac:
        res = await ac.get(LIST_URL, headers=auth_headers(user_a))

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    returned_uuids = {item["uuid"] for item in body["data"]}
    assert returned_uuids == {t1.uuid, t2.uuid}
    assert body["total"] == 2
    # Every returned track is an upload and carries the expected meta.
    for item in body["data"]:
        assert item["track_type"] == "upload"
        assert item["bpm"] == 128
        assert item["duration"] == pytest.approx(200.0)
        assert "title" in item and "musical_key" in item


@pytest.mark.asyncio
async def test_list_excludes_soft_deleted():
    """Soft-deleted (is_active=False) tracks never appear in the library list."""
    user = await create_user()
    await create_track(user_id=user.id, title="active 1")
    await create_track(user_id=user.id, title="active 2")
    await create_track(user_id=user.id, title="deleted", is_active=False)

    async with _client() as ac:
        res = await ac.get(LIST_URL, headers=auth_headers(user))

    body = res.json()
    assert body["total"] == 2
    assert all(item["title"] != "deleted" for item in body["data"])


@pytest.mark.asyncio
async def test_list_newest_first():
    """Tracks are returned newest-first."""
    user = await create_user()
    older = await create_track(user_id=user.id, title="older")
    newer = await create_track(user_id=user.id, title="newer")

    async with _client() as ac:
        res = await ac.get(LIST_URL, headers=auth_headers(user))

    data = res.json()["data"]
    assert data[0]["uuid"] == newer.uuid
    assert data[1]["uuid"] == older.uuid


# --------------------------------------------------------------------------- #
# List: pagination
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_list_pagination_metadata_and_paging():
    """Pagination returns correct page slices and metadata."""
    user = await create_user()
    for i in range(3):
        await create_track(user_id=user.id, title=f"t{i}")

    async with _client() as ac:
        page1 = (await ac.get(LIST_URL, params={"page": 1, "page_size": 2}, headers=auth_headers(user))).json()
        page2 = (await ac.get(LIST_URL, params={"page": 2, "page_size": 2}, headers=auth_headers(user))).json()

    assert page1["total"] == 3
    assert page1["page"] == 1
    assert page1["page_size"] == 2
    assert page1["total_pages"] == 2
    assert len(page1["data"]) == 2
    assert len(page2["data"]) == 1
    # No overlap between pages.
    assert not ({i["uuid"] for i in page1["data"]} & {i["uuid"] for i in page2["data"]})


@pytest.mark.asyncio
async def test_list_page_size_capped_at_20():
    """Requesting a page_size above the 20 cap is rejected by validation (422)."""
    user = await create_user()
    async with _client() as ac:
        res = await ac.get(LIST_URL, params={"page_size": 50}, headers=auth_headers(user))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_empty_for_new_user():
    """A user with no uploads gets an empty, well-formed page."""
    user = await create_user()
    async with _client() as ac:
        res = await ac.get(LIST_URL, headers=auth_headers(user))
    body = res.json()
    assert res.status_code == 200
    assert body["data"] == []
    assert body["total"] == 0
    assert body["total_pages"] == 0


# --------------------------------------------------------------------------- #
# View
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_view_own_track_returns_full_meta():
    """Viewing an owned track returns full metadata incl. nested audio/contributor lists."""
    user = await create_user()
    track = await create_track(user_id=user.id, title="Detailed", key_signature="Am")

    async with _client() as ac:
        res = await ac.get(_detail_url(track.uuid), headers=auth_headers(user))

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["uuid"] == track.uuid
    assert data["title"] == "Detailed"
    assert data["key_signature"] == "Am"
    # Detail-only structural fields present.
    assert isinstance(data["audio_files"], list)
    assert isinstance(data["contributors"], list)
    # Internal storage path must never be exposed.
    assert "stored_path" not in str(data.get("audio_files"))


@pytest.mark.asyncio
async def test_view_other_users_track_is_404():
    """A user cannot view another user's track (404, existence not leaked)."""
    owner = await create_user()
    other = await create_user()
    track = await create_track(user_id=owner.id)

    async with _client() as ac:
        res = await ac.get(_detail_url(track.uuid), headers=auth_headers(other))

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_view_nonexistent_track_is_404():
    user = await create_user()
    async with _client() as ac:
        res = await ac.get(_detail_url(str(uuid.uuid4())), headers=auth_headers(user))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_view_soft_deleted_track_is_404():
    user = await create_user()
    track = await create_track(user_id=user.id, is_active=False)
    async with _client() as ac:
        res = await ac.get(_detail_url(track.uuid), headers=auth_headers(user))
    assert res.status_code == 404


# --------------------------------------------------------------------------- #
# Delete (soft)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_delete_soft_deletes_own_track():
    """Deleting flips is_active=False, and the track then vanishes from list + view."""
    user = await create_user()
    track = await create_track(user_id=user.id)

    async with _client() as ac:
        res = await ac.delete(_detail_url(track.uuid), headers=auth_headers(user))
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["data"]["is_active"] is False

        # Soft-deleted in the DB (row still exists).
        assert (await get_track_is_active(track.uuid)) in (False, 0)

        # Gone from the list.
        listing = (await ac.get(LIST_URL, headers=auth_headers(user))).json()
        assert track.uuid not in {i["uuid"] for i in listing["data"]}

        # View now 404s.
        view = await ac.get(_detail_url(track.uuid), headers=auth_headers(user))
        assert view.status_code == 404


@pytest.mark.asyncio
async def test_delete_other_users_track_is_404_and_noop():
    """Deleting someone else's track 404s and leaves it untouched."""
    owner = await create_user()
    attacker = await create_user()
    track = await create_track(user_id=owner.id)

    async with _client() as ac:
        res = await ac.delete(_detail_url(track.uuid), headers=auth_headers(attacker))

    assert res.status_code == 404
    # Owner's track is still active.
    assert (await get_track_is_active(track.uuid)) in (True, 1)


@pytest.mark.asyncio
async def test_delete_nonexistent_track_is_404():
    user = await create_user()
    async with _client() as ac:
        res = await ac.delete(_detail_url(str(uuid.uuid4())), headers=auth_headers(user))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_is_idempotent_second_delete_404():
    """Deleting the same track twice: first 200, second 404 (already inactive)."""
    user = await create_user()
    track = await create_track(user_id=user.id)

    async with _client() as ac:
        first = await ac.delete(_detail_url(track.uuid), headers=auth_headers(user))
        second = await ac.delete(_detail_url(track.uuid), headers=auth_headers(user))

    assert first.status_code == 200
    assert second.status_code == 404


# --------------------------------------------------------------------------- #
# Dropdown state: playlist_uuid / has_similarity / has_analysis
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_list_reports_playlist_and_analysis_state():
    """Each track reports whether a similarity playlist exists, its uuid, and has_analysis."""
    user = await create_user()
    with_pl = await create_track(user_id=user.id, title="has playlist")
    without_pl = await create_track(user_id=user.id, title="no playlist")
    # A similarity playlist seeded from the first track.
    pl = await create_playlist(user_id=user.id, seed_track_id=with_pl.id)

    async with _client() as ac:
        res = await ac.get(LIST_URL, headers=auth_headers(user))

    by_uuid = {t["uuid"]: t for t in res.json()["data"]}

    a = by_uuid[with_pl.uuid]
    assert a["playlist_uuid"] == pl.uuid
    assert a["has_similarity"] is True
    assert a["has_analysis"] is False  # not implemented yet — always false

    b = by_uuid[without_pl.uuid]
    assert b["playlist_uuid"] is None
    assert b["has_similarity"] is False
    assert b["has_analysis"] is False


@pytest.mark.asyncio
async def test_detail_reports_playlist_state():
    """The single-track view also carries playlist_uuid / has_similarity / has_analysis."""
    user = await create_user()
    track = await create_track(user_id=user.id)
    pl = await create_playlist(user_id=user.id, seed_track_id=track.id)

    async with _client() as ac:
        res = await ac.get(_detail_url(track.uuid), headers=auth_headers(user))

    data = res.json()["data"]
    assert data["playlist_uuid"] == pl.uuid
    assert data["has_similarity"] is True
    assert data["has_analysis"] is False

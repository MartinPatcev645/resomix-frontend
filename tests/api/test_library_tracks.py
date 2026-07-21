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
from datetime import datetime
from unittest.mock import patch

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

PLAYLISTS_URL = "/api/v1/playlists/get-all-playlists/"

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
    # Every returned track is an upload and carries the reshaped (2026-07-22) meta:
    # display fields + artifact uuids; the shop/internal flags and the never-populated
    # track-level bpm/key are gone (analysis-derived metrics live under "analysis").
    for item in body["data"]:
        assert item["track_type"] == "upload"
        assert item["duration_ms"] == 200000
        assert "title" in item and "artist" in item and "album" in item and "label" in item
        assert "genre" in item and "analysis" in item
        for removed in ("bpm", "musical_key", "duration", "sub_genre", "price_cents",
                        "is_explicit", "is_instrumental", "is_active",
                        "has_similarity", "has_analysis", "display_artist"):
            assert removed not in item, f"{removed} must not be in the library list item"


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
    """The artifact uuids themselves signal existence (no has_* booleans): a non-null
    playlist_uuid/analysis_uuid means the artifact exists, null means it doesn't."""
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
    assert a["analysis_uuid"] is None       # no analysis row for this track
    assert a["analysis"] is None            # analysis block only present with an analysis

    b = by_uuid[without_pl.uuid]
    assert b["playlist_uuid"] is None
    assert b["analysis_uuid"] is None


@pytest.mark.asyncio
async def test_detail_reports_playlist_state():
    """The single-track view carries the same artifact uuids (and keeps is_active)."""
    user = await create_user()
    track = await create_track(user_id=user.id)
    pl = await create_playlist(user_id=user.id, seed_track_id=track.id)

    async with _client() as ac:
        res = await ac.get(_detail_url(track.uuid), headers=auth_headers(user))

    data = res.json()["data"]
    assert data["playlist_uuid"] == pl.uuid
    assert data["analysis_uuid"] is None
    assert data["is_active"] is True  # detail (unlike the list) still exposes is_active


# --------------------------------------------------------------------------- #
# Delete cascade: seed playlist soft-deleted + media assets purged
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_delete_track_soft_deletes_seed_playlist_and_purges_assets():
    """Deleting an uploaded track soft-deletes its similarity playlist AND enqueues the
    media-server asset purge (peaks/segments/embeddings/etc.)."""
    user = await create_user()
    track = await create_track(user_id=user.id)
    seed_pl = await create_playlist(user_id=user.id, seed_track_id=track.id)

    with patch("app.tasks.track_tasks.purge_uploaded_track_assets.delay") as mock_purge:
        async with _client() as ac:
            res = await ac.delete(_detail_url(track.uuid), headers=auth_headers(user))
            assert res.status_code == 200
            body = res.json()
            assert body["success"] is True
            assert body["data"]["playlists_deleted"] >= 1

            # The seed playlist is gone from the user's playlists list.
            pls = await ac.get(PLAYLISTS_URL, headers=auth_headers(user))
            assert seed_pl.uuid not in {p["uuid"] for p in pls.json()["data"]}

    # Asset purge was enqueued for this track (System Partner 1 for a frontend user).
    mock_purge.assert_called_once()
    args = mock_purge.call_args.args
    assert args[0] == 1  # partner_id
    assert args[1] == track.uuid


@pytest.mark.asyncio
async def test_delete_track_without_playlist_still_purges():
    """Deleting a track with no similarity playlist reports 0 cascaded and still purges."""
    user = await create_user()
    track = await create_track(user_id=user.id)

    with patch("app.tasks.track_tasks.purge_uploaded_track_assets.delay") as mock_purge:
        async with _client() as ac:
            res = await ac.delete(_detail_url(track.uuid), headers=auth_headers(user))
    assert res.status_code == 200
    assert res.json()["data"]["playlists_deleted"] == 0
    mock_purge.assert_called_once_with(1, track.uuid)


# --------------------------------------------------------------------------- #
# List: filters (search + upload-date range)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_search_matches_title():
    """search matches on track title (case-insensitive, partial)."""
    user = await create_user()
    hit = await create_track(user_id=user.id, title="Midnight Drive")
    await create_track(user_id=user.id, title="Sunrise")

    async with _client() as ac:
        res = await ac.get(LIST_URL, params={"search": "midnight"}, headers=auth_headers(user))

    uuids = {t["uuid"] for t in res.json()["data"]}
    assert uuids == {hit.uuid}


@pytest.mark.asyncio
async def test_search_matches_uuid():
    """search matches on a fragment of the track uuid."""
    user = await create_user()
    hit = await create_track(user_id=user.id, title="Anything")
    await create_track(user_id=user.id, title="Other")

    frag = hit.uuid[:8]
    async with _client() as ac:
        res = await ac.get(LIST_URL, params={"search": frag}, headers=auth_headers(user))

    uuids = {t["uuid"] for t in res.json()["data"]}
    assert hit.uuid in uuids


@pytest.mark.asyncio
async def test_search_matches_artist():
    """search matches on the track's display_artist."""
    user = await create_user()
    hit = await create_track(user_id=user.id, title="A", display_artist="Aphex Twin")
    await create_track(user_id=user.id, title="B", display_artist="Someone Else")

    async with _client() as ac:
        res = await ac.get(LIST_URL, params={"search": "aphex"}, headers=auth_headers(user))

    uuids = {t["uuid"] for t in res.json()["data"]}
    assert uuids == {hit.uuid}


@pytest.mark.asyncio
async def test_date_range_filters_by_upload_date():
    """start_date/end_date bound the list by created_at; either bound may be omitted."""
    user = await create_user()
    old = await create_track(user_id=user.id, title="Old", created_at=datetime(2020, 1, 1, 12, 0, 0))
    new = await create_track(user_id=user.id, title="New", created_at=datetime(2026, 6, 15, 12, 0, 0))

    async with _client() as ac:
        # Only-start bound: on/after 2026-01-01 → just the new one.
        after = await ac.get(LIST_URL, params={"start_date": "2026-01-01"}, headers=auth_headers(user))
        # Only-end bound: on/before 2020-12-31 → just the old one.
        before = await ac.get(LIST_URL, params={"end_date": "2020-12-31"}, headers=auth_headers(user))

    assert {t["uuid"] for t in after.json()["data"]} == {new.uuid}
    assert {t["uuid"] for t in before.json()["data"]} == {old.uuid}


@pytest.mark.asyncio
async def test_blank_search_is_ignored():
    """A blank/whitespace search returns everything (no filter applied)."""
    user = await create_user()
    await create_track(user_id=user.id, title="One")
    await create_track(user_id=user.id, title="Two")

    async with _client() as ac:
        res = await ac.get(LIST_URL, params={"search": "   "}, headers=auth_headers(user))

    assert res.json()["total"] == 2

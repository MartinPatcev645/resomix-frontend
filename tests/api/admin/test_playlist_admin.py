"""
Admin Playlist API tests (real controller/service path — no controller mocks).

These hit the endpoints end-to-end so they catch runtime bugs the mocked workflow tests
cannot — e.g. the `get_playlist_detail_by_uuid_admin` NameError that made the "expand
playlist" page 500 instead of resolving the playlist.
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def admin_auth_headers():
    from tests.api.library_helpers import create_admin_user, admin_auth_headers as _hdrs
    return _hdrs(await create_admin_user())


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_get_playlist_detail_missing_returns_404_not_500(admin_auth_headers):
    """A non-existent playlist UUID must resolve to a clean 404, never a 500.

    Regression guard: the handler previously referenced an undefined `playlist_uuid`
    and raised NameError -> 500 for every request, before it could even look the
    playlist up.
    """
    async with _client() as ac:
        res = await ac.get(f"/api/v1/admin/playlist/{uuid.uuid4()}", headers=admin_auth_headers)
    assert res.status_code == 404, res.text
    body = res.json()
    assert body["success"] is False


@pytest.mark.asyncio
async def test_get_playlist_list_admin(admin_auth_headers):
    """The admin playlist list resolves (real service path)."""
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/playlist/", params={"page": 1, "page_size": 5}, headers=admin_auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)

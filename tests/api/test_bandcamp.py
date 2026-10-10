"""
Bandcamp collection import endpoints
====================================

In-process (ASGITransport) against the real database with real JWTs, like the other consumer
endpoint tests. Bandcamp itself is never contacted: the controller's client is swapped for a fake,
and the Celery enqueue is replaced so the sync can be driven directly with ``run_bandcamp_sync``.

Needs the ``b7e2c4a9d1f6`` migration applied (``alembic upgrade head``).
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.api.routers import bandcamp as bandcamp_router
from app.models.music_collection import SyncJob, UserMusicCollectionItem
from app.services.bandcamp_client import (
    BandcampCollectionPrivate,
    BandcampFan,
    BandcampItem,
    BandcampRateLimited,
    BandcampUserNotFound,
)
from app.services.bandcamp_service import run_bandcamp_sync
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import auth_headers, create_user

CONNECT = "/api/v1/bandcamp/connect"
COLLECTION = "/api/v1/bandcamp/collection"
CONNECTION = "/api/v1/bandcamp/connection"


def _items(n: int, prefix: str = "a") -> list:
    return [
        BandcampItem(
            external_id=f"{prefix}{i}",
            item_type="album",
            artist=f"Artist {i}",
            title=f"Record {i}",
            album=f"Record {i}",
            artwork_url=None,
            source_url=f"https://artist{i}.bandcamp.com/album/record-{i}",
            duration_ms=None,
        )
        for i in range(n)
    ]


class FakeClient:
    """Stands in for BandcampClient. ``error`` is raised by get_fan; ``pages`` are yielded in order."""

    error = None
    pages: list = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return None

    async def get_fan(self, username):
        if self.error is not None:
            raise self.error
        return BandcampFan(username=username, fan_id=1, name=None, item_count=sum(len(p) for p in self.pages))

    async def iter_collection(self, fan):
        for page in self.pages:
            yield page


@pytest.fixture
def fake_bandcamp(monkeypatch):
    enqueued = []
    FakeClient.error = None
    FakeClient.pages = [_items(3)]
    controller = bandcamp_router.bandcamp_controller
    monkeypatch.setattr(controller, "client_factory", FakeClient)
    monkeypatch.setattr(controller, "_enqueue", lambda job_id, partner_id: enqueued.append(job_id))
    return enqueued


def _client() -> AsyncClient:
    from app.main import app

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _count_items(user_id: int) -> int:
    async with AsyncSessionLocal() as db:
        return (
            await db.execute(
                select(func.count()).select_from(UserMusicCollectionItem).where(UserMusicCollectionItem.user_id == user_id)
            )
        ).scalar_one()


async def test_endpoints_require_auth():
    async with _client() as ac:
        assert (await ac.post(CONNECT, json={"username": "x"})).status_code == 401
        assert (await ac.get("/api/v1/bandcamp/sync/abc")).status_code == 401
        assert (await ac.get(COLLECTION)).status_code == 401
        assert (await ac.get(CONNECTION)).status_code == 401
        assert (await ac.delete(CONNECTION)).status_code == 401


async def test_connection_state_without_connection_is_200(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        res = await ac.get(CONNECTION, headers=headers)
        assert res.status_code == 200
        assert res.json()["data"] == {
            "connected": False,
            "username": None,
            "status": "none",
            "last_synced_at": None,
            "active_job_id": None,
            "item_count": 0,
        }
        # Contract check: no connection is an empty 200 on the collection too, not a 404.
        res = await ac.get(COLLECTION, headers=headers)
        assert res.status_code == 200 and res.json()["data"]["total"] == 0


async def test_connection_state_follows_the_sync(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
        assert data["connected"] is True and data["username"] == "martin"
        assert data["status"] == "pending" and data["active_job_id"] == job_id and data["item_count"] == 0

        await run_bandcamp_sync(job_id, client_factory=FakeClient)
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
        assert data["status"] == "ready" and data["active_job_id"] is None
        assert data["item_count"] == 3 and data["last_synced_at"] is not None

        await ac.delete(CONNECTION, headers=headers)
        assert (await ac.get(CONNECTION, headers=headers)).json()["data"]["connected"] is False


async def test_connection_state_after_failed_sync(fake_bandcamp):
    class FailingClient(FakeClient):
        async def iter_collection(self, fan):
            raise BandcampRateLimited("Bandcamp is rate limiting requests.")
            yield  # pragma: no cover

    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FailingClient)
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
    assert data["status"] == "failed" and data["active_job_id"] is None and data["connected"] is True


async def test_connect_enqueues_sync_and_import_is_visible(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        res = await ac.post(CONNECT, json={"username": " https://bandcamp.com/Martin "}, headers=headers)
        assert res.status_code == 202, res.text
        job_id = res.json()["data"]["job_id"]
        assert fake_bandcamp == [job_id]

        res = await ac.get(f"/api/v1/bandcamp/sync/{job_id}", headers=headers)
        assert res.json()["data"]["status"] == "queued"

        await run_bandcamp_sync(job_id, client_factory=FakeClient)

        res = await ac.get(f"/api/v1/bandcamp/sync/{job_id}", headers=headers)
        assert res.json()["data"] == {"status": "done", "processed": 3, "total": 3, "error": None}

        res = await ac.get(COLLECTION, params={"page": 1, "page_size": 2}, headers=headers)
        data = res.json()["data"]
        assert data["total"] == 3 and len(data["items"]) == 2 and data["page_size"] == 2

        res = await ac.get(COLLECTION, params={"q": "Artist 1"}, headers=headers)
        assert [i["external_id"] for i in res.json()["data"]["items"]] == ["a1"]


async def test_resync_is_idempotent(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        first = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(first, client_factory=FakeClient)
        FakeClient.pages = [_items(4)]
        second = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        assert second != first
        await run_bandcamp_sync(second, client_factory=FakeClient)
    assert await _count_items(user.id) == 4


async def test_double_connect_reuses_active_job(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        a = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        b = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
    assert a == b and fake_bandcamp == [a]


@pytest.mark.parametrize(
    "error,status_code",
    [
        (BandcampUserNotFound("missing"), 404),
        (BandcampCollectionPrivate("private"), 403),
        (BandcampRateLimited("slow down"), 429),
    ],
)
async def test_connect_maps_bandcamp_errors(fake_bandcamp, error, status_code):
    FakeClient.error = error
    user = await create_user()
    async with _client() as ac:
        res = await ac.post(CONNECT, json={"username": "martin"}, headers=auth_headers(user))
    assert res.status_code == status_code
    assert fake_bandcamp == []


async def test_connect_rejects_invalid_username(fake_bandcamp):
    user = await create_user()
    async with _client() as ac:
        res = await ac.post(CONNECT, json={"username": "artist.bandcamp.com"}, headers=auth_headers(user))
    assert res.status_code == 422


async def test_sync_failure_keeps_imported_rows(fake_bandcamp):
    class FailingClient(FakeClient):
        async def iter_collection(self, fan):
            yield _items(2)
            raise BandcampRateLimited("Bandcamp is rate limiting requests.")

    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FailingClient)
        data = (await ac.get(f"/api/v1/bandcamp/sync/{job_id}", headers=headers)).json()["data"]
    assert data["status"] == "failed" and "rate limiting" in data["error"]
    assert await _count_items(user.id) == 2


async def test_sync_status_is_scoped_to_owner(fake_bandcamp):
    owner, other = await create_user(), await create_user()
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=auth_headers(owner))).json()["data"]["job_id"]
        res = await ac.get(f"/api/v1/bandcamp/sync/{job_id}", headers=auth_headers(other))
    assert res.status_code == 404


async def test_delete_removes_connection_and_collection(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FakeClient)
        assert await _count_items(user.id) == 3

        res = await ac.delete(CONNECTION, headers=headers)
        assert res.status_code == 200 and res.json()["data"]["removed_items"] == 3
        assert (await ac.delete(CONNECTION, headers=headers)).status_code == 404

    assert await _count_items(user.id) == 0
    async with AsyncSessionLocal() as db:
        assert (await db.execute(select(SyncJob).where(SyncJob.user_id == user.id))).first() is None

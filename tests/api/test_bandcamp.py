"""
Bandcamp collection import endpoints
====================================

In-process (ASGITransport) against the real database with real JWTs, like the other consumer
endpoint tests. Bandcamp itself is never contacted: the controller's client is swapped for a fake,
and the Celery enqueue is replaced so the sync can be driven directly with ``run_bandcamp_sync``.

Needs the ``b7e2c4a9d1f6`` migration applied (``alembic upgrade head``).
"""

import uuid
from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, update

from app.api.routers import bandcamp as bandcamp_router
from app.core.context import admin_context
from app.models.music_collection import SyncJob, UserMusicCollectionItem
from app.models.track_store_link import TrackStoreLink
from app.services.bandcamp_client import (
    BandcampCollectionPrivate,
    BandcampFan,
    BandcampItem,
    BandcampRateLimited,
    BandcampRequestCapReached,
    BandcampUnavailable,
    BandcampUserNotFound,
)
from app.services.bandcamp_service import run_bandcamp_sync
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import _seed_ctx, auth_headers, create_track, create_user

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
    collection_requests = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return None

    async def get_fan(self, username):
        if self.error is not None:
            raise self.error
        return BandcampFan(username=username, fan_id=1, name=None, item_count=sum(len(p) for p in self.pages))

    async def iter_collection(self, fan, *, older_than_token=None):
        for page in self.pages:
            FakeClient.collection_requests += 1
            yield page


@pytest.fixture
def fake_bandcamp(monkeypatch):
    enqueued = []
    FakeClient.error = None
    FakeClient.pages = [_items(3)]
    FakeClient.collection_requests = 0
    controller = bandcamp_router.bandcamp_controller
    monkeypatch.setattr(controller.service, "client_factory", FakeClient)
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
            "matched_count": 0,
            "error_message": None,
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
        assert data["item_count"] == 3 and data["matched_count"] == 0 and data["last_synced_at"] is not None
        assert data["error_message"] is None

        await ac.delete(CONNECTION, headers=headers)
        assert (await ac.get(CONNECTION, headers=headers)).json()["data"]["connected"] is False


async def test_connection_state_after_failed_sync(fake_bandcamp):
    class FailingClient(FakeClient):
        async def iter_collection(self, fan, *, older_than_token=None):
            raise BandcampRateLimited("Bandcamp is rate limiting requests.")
            yield  # pragma: no cover

    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FailingClient)
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
    assert data["status"] == "failed" and data["active_job_id"] is None and data["connected"] is True
    assert "rate limiting" in data["error_message"]


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
        (BandcampUnavailable("Bandcamp is temporarily unavailable."), 503),
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
        async def iter_collection(self, fan, *, older_than_token=None):
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


def _track_item(external_id: str, url: str, *, artist: str, title: str, added_at: datetime) -> BandcampItem:
    return BandcampItem(
        external_id=external_id,
        item_type="track",
        artist=artist,
        title=title,
        album=None,
        artwork_url=None,
        source_url=url,
        duration_ms=200_000,
        added_at=added_at,
    )


async def test_resync_after_completed_sync_is_incremental(fake_bandcamp):
    FakeClient.pages = [_items(2), _items(2, prefix="b")]
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        first = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(first, client_factory=FakeClient)
        assert FakeClient.collection_requests == 2

        FakeClient.collection_requests = 0
        second = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        async with AsyncSessionLocal() as db:
            job = await db.get(SyncJob, second)
            assert job.incremental and job.resume_token is None
        await run_bandcamp_sync(second, client_factory=FakeClient)
    # The first page adds nothing, so the second page is not requested.
    assert FakeClient.collection_requests == 1


async def test_request_cap_resumes_instead_of_restarting(fake_bandcamp):
    class CappedClient(FakeClient):
        seen = []

        async def iter_collection(self, fan, *, older_than_token=None):
            CappedClient.seen.append(older_than_token)
            if older_than_token is None:
                yield _items(2)
                raise BandcampRequestCapReached(
                    "Stopped early to stay within the Bandcamp request limit. Sync again later to continue.",
                    resume_token="1700000000::a::",
                )
            yield _items(1, prefix="b")

    CappedClient.seen = []
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        first = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(first, client_factory=CappedClient)
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
        assert data["status"] == "partial" and data["item_count"] == 2
        assert "Sync again later" in data["error_message"]
        progress = (await ac.get(f"/api/v1/bandcamp/sync/{first}", headers=headers)).json()["data"]
        assert progress["status"] == "partial"

        second = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(second, client_factory=CappedClient)
        data = (await ac.get(CONNECTION, headers=headers)).json()["data"]
    assert CappedClient.seen == [None, "1700000000::a::"]
    assert data["status"] == "ready" and data["error_message"] is None and data["item_count"] == 3


async def test_collection_is_newest_purchase_first(fake_bandcamp):
    FakeClient.pages = [[
        _track_item("t-new", "https://label.bandcamp.com/track/new", artist="A", title="New", added_at=datetime(2024, 6, 1)),
        _track_item("t-old", "https://label.bandcamp.com/track/old", artist="A", title="Old", added_at=datetime(2019, 1, 1)),
    ]]
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FakeClient)
        items = (await ac.get(COLLECTION, headers=headers)).json()["data"]["items"]
    assert [item["external_id"] for item in items] == ["t-new", "t-old"]


async def test_reimport_moves_updated_at(fake_bandcamp):
    user = await create_user()
    headers = auth_headers(user)
    async with _client() as ac:
        job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(job_id, client_factory=FakeClient)
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(UserMusicCollectionItem)
                .where(UserMusicCollectionItem.user_id == user.id)
                .values(updated_at=datetime(2020, 1, 1))
            )
            await db.commit()
        FakeClient.pages = [_items(3)]
        again = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
        await run_bandcamp_sync(again, client_factory=FakeClient)
        async with AsyncSessionLocal() as db:
            stamps = (
                await db.execute(
                    select(UserMusicCollectionItem.updated_at).where(UserMusicCollectionItem.user_id == user.id)
                )
            ).scalars().all()
    assert stamps and all(stamp > datetime(2020, 1, 1) for stamp in stamps)


async def test_store_link_matches_before_metadata_and_albums_stay_unmatched(fake_bandcamp):
    slug = uuid.uuid4().hex[:12]
    meta_title = f"Known Song {slug}"
    user = await create_user()
    linked = await create_track(
        user_id=user.id, track_type="electrobuzz", title=f"Something Else {slug}", display_artist="Not The Artist"
    )
    by_title = await create_track(
        user_id=user.id, track_type="electrobuzz", title=meta_title, display_artist="Known Artist"
    )
    with _seed_ctx():
        async with AsyncSessionLocal() as db:
            db.add(TrackStoreLink(track_id=linked.id, bandcamp_url=f"https://Label.com/track/{slug}/"))
            await db.commit()

    album = BandcampItem(
        external_id="a1",
        item_type="album",
        artist="Label",
        title="The Album",
        album="The Album",
        artwork_url=None,
        source_url=f"https://Label.com/track/{slug}/",
        duration_ms=None,
    )
    FakeClient.pages = [[
        album,
        _track_item(
            "t-link",
            f"http://label.com/track/{slug}",
            artist="The Label",
            title="Artist - Title (Mix)",
            added_at=datetime(2024, 1, 1),
        ),
        _track_item(
            "t-meta",
            f"https://other.example/track/{slug}",
            artist="Known Artist",
            title=meta_title,
            added_at=datetime(2023, 1, 1),
        ),
    ]]
    headers = auth_headers(user)
    token = admin_context.set(True)
    try:
        async with _client() as ac:
            job_id = (await ac.post(CONNECT, json={"username": "martin"}, headers=headers)).json()["data"]["job_id"]
            await run_bandcamp_sync(job_id, client_factory=FakeClient)
            rows = (await ac.get(COLLECTION, headers=headers)).json()["data"]["items"]
            matched = (await ac.get(COLLECTION, params={"matched": "true"}, headers=headers)).json()["data"]
            state = (await ac.get(CONNECTION, headers=headers)).json()["data"]
    finally:
        admin_context.reset(token)

    by_external = {row["external_id"]: row for row in rows}
    assert by_external["a1"]["resomix_track_id"] is None
    assert by_external["t-link"]["resomix_track_id"] == linked.id
    assert by_external["t-meta"]["resomix_track_id"] == by_title.id
    assert {row["external_id"] for row in matched["items"]} == {"t-link", "t-meta"}
    assert matched["total"] == 2
    assert state["matched_count"] == 2 and state["item_count"] == 3

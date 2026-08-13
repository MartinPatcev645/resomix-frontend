"""Job records behind the poll-based similarity upload.

The upload endpoint stopped holding its request open because Cloudflare closes an origin
request at 100 s and 20 concurrent 40 MB uploads were finishing at 93 s — completed results
were being discarded as 524s. The job record is how the client collects a result it is no
longer waiting on, so the properties that matter are: an accepted upload is always trackable,
a job never gets stuck mid-flight, and a job that has expired is reported as gone rather than
half-resurrected.

Stubbed Redis, no database — safe to run at any time.
"""
import asyncio

import pytest

from app.services import similarity_upload_job_service as mod
from app.services.similarity_upload_job_service import (
    STATE_DONE,
    STATE_FAILED,
    STATE_QUEUED,
    STATE_RUNNING,
    SimilarityUploadJobService,
)


class _FakeRedis:
    """Hash semantics only, with `decode_responses=True` behaviour (everything is a str)."""

    def __init__(self, store, ttls):
        self.store = store
        self.ttls = ttls
        self.closed = False

    async def hset(self, key, mapping=None):
        self.store.setdefault(key, {}).update({k: str(v) for k, v in (mapping or {}).items()})

    async def hgetall(self, key):
        return dict(self.store.get(key, {}))

    async def expire(self, key, ttl):
        self.ttls[key] = ttl

    async def exists(self, key):
        return 1 if key in self.store else 0

    async def close(self):
        self.closed = True


@pytest.fixture
def redis_backed(monkeypatch):
    store, ttls = {}, {}

    async def _factory():
        return _FakeRedis(store, ttls)

    monkeypatch.setattr(mod, "get_redis_or_none", _factory)
    return store, ttls


@pytest.fixture
def redis_down(monkeypatch):
    async def _factory():
        return None

    monkeypatch.setattr(mod, "get_redis_or_none", _factory)


def test_create_then_read_round_trips_types(redis_backed):
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()

    assert asyncio.run(
        svc.create(
            job_id=job_id, user_id=7, partner_id=1, track_id=42,
            track_uuid="uuid-abc", visible_count=20,
        )
    ) is True

    job = asyncio.run(svc.get(job_id))
    assert job["state"] == STATE_QUEUED
    # Redis gives everything back as a string; the caller authorizes on these, so they must be
    # ints again or `current_user.id != owner` compares 7 to "7" and rejects the owner.
    assert job["user_id"] == 7
    assert job["partner_id"] == 1
    assert job["track_id"] == 42
    assert job["visible_count"] == 20
    assert job["track_uuid"] == "uuid-abc"


def test_anonymous_job_has_no_owner(redis_backed):
    """`None` must survive as `None`, not become 0 — 0 would be a user id nobody can match."""
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=None, partner_id=1, track_id=None,
                           track_uuid="u", visible_count=None))

    job = asyncio.run(svc.get(job_id))
    assert job["user_id"] is None
    assert job["track_id"] is None
    assert job["visible_count"] is None


def test_lifecycle_running_then_done_carries_the_payload(redis_backed):
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=1, partner_id=1, track_id=1,
                           track_uuid="u", visible_count=None))

    asyncio.run(svc.mark_running(job_id))
    assert asyncio.run(svc.get(job_id))["state"] == STATE_RUNNING

    payload = {"playlist": {"id": 9}, "tracks": [{"uuid": "t1"}]}
    asyncio.run(svc.mark_done(job_id, payload))

    job = asyncio.run(svc.get(job_id))
    assert job["state"] == STATE_DONE
    assert job["result"] == payload
    assert job["finished_at"] is not None


def test_failed_job_carries_a_reason(redis_backed):
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=1, partner_id=1, track_id=1,
                           track_uuid="u", visible_count=None))
    asyncio.run(svc.mark_failed(job_id, "nope", reason="similarity_failed"))

    job = asyncio.run(svc.get(job_id))
    assert job["state"] == STATE_FAILED
    assert job["error"] == "nope"
    assert job["reason"] == "similarity_failed"


def test_completion_restarts_the_ttl_clock(redis_backed):
    """The window that matters is how long the client has to COLLECT, not how long it queued."""
    store, ttls = redis_backed
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=1, partner_id=1, track_id=1,
                           track_uuid="u", visible_count=None))
    ttls.clear()

    asyncio.run(svc.mark_done(job_id, {"ok": True}))
    assert ttls[svc._key(job_id)] == svc.ttl


def test_update_never_resurrects_an_expired_job(redis_backed):
    """A worker finishing after expiry must not recreate a partial, ownerless record.

    hset would happily write `{state: done, result: ...}` with no user_id — which the poll
    endpoint would then treat as an anonymous job and serve to whoever asked.
    """
    store, _ = redis_backed
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=7, partner_id=1, track_id=1,
                           track_uuid="u", visible_count=None))

    store.clear()  # TTL elapsed
    asyncio.run(svc.mark_done(job_id, {"leaked": True}))

    assert asyncio.run(svc.get(job_id)) is None


def test_unknown_job_reads_as_none(redis_backed):
    assert asyncio.run(SimilarityUploadJobService().get("does-not-exist")) is None


def test_corrupt_result_reads_as_failed_not_an_exception(redis_backed):
    """A bad payload must not turn a poll into a 500 the client cannot act on."""
    store, _ = redis_backed
    svc = SimilarityUploadJobService()
    job_id = svc.new_job_id()
    asyncio.run(svc.create(job_id=job_id, user_id=1, partner_id=1, track_id=1,
                           track_uuid="u", visible_count=None))
    store[svc._key(job_id)]["state"] = STATE_DONE
    store[svc._key(job_id)]["result"] = "{not json"

    job = asyncio.run(svc.get(job_id))
    assert job["state"] == STATE_FAILED
    assert job["reason"] == "corrupt_result"


def test_create_refuses_when_redis_is_down(redis_down):
    """The caller turns False into a 503. Accepting an untrackable upload is worse than
    refusing it: the work would run and the client could never collect the result."""
    svc = SimilarityUploadJobService()
    assert asyncio.run(
        svc.create(job_id="j", user_id=1, partner_id=1, track_id=1,
                   track_uuid="u", visible_count=None)
    ) is False


def test_reads_and_updates_degrade_quietly_when_redis_is_down(redis_down):
    svc = SimilarityUploadJobService()
    assert asyncio.run(svc.get("j")) is None
    asyncio.run(svc.mark_done("j", {"a": 1}))  # must not raise
    asyncio.run(svc.mark_failed("j", "x"))


def test_job_ids_are_unguessable_and_unique():
    svc = SimilarityUploadJobService()
    ids = {svc.new_job_id() for _ in range(200)}
    assert len(ids) == 200
    # The id is the capability for an anonymous job, so it must not be short or sequential.
    assert all(len(i) == 32 for i in ids)

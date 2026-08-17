"""The watchdog: notice a spike, tell somebody once, and never break a request doing it.

Everything needed to investigate an incident already existed — system_logs, correlation ids,
stack traces. Nothing NOTICED one, which is why both August 2026 outages were found by a person
days late. These tests pin the properties that make an alert worth having:

* it fires when a threshold is crossed,
* it fires ONCE for an ongoing incident (an alert that spams gets muted, and a muted alert is
  worth nothing),
* it re-arms as soon as the system recovers,
* only one worker alerts even with several running,
* and none of it can raise into a request.

Stubbed Redis, no database, no network — safe to run at any time.
"""
import asyncio

import pytest

from app.services import watchdog_service as wd


class _FakeRedis:
    def __init__(self, store):
        self.store = store

    async def incr(self, key):
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True

    async def mget(self, keys):
        return [self.store.get(k) for k in keys]

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def exists(self, key):
        return 1 if key in self.store else 0

    async def delete(self, key):
        self.store.pop(key, None)

    async def close(self):
        pass


@pytest.fixture
def redis(monkeypatch):
    store = {}

    async def _factory():
        return _FakeRedis(store)

    monkeypatch.setattr(wd, "get_redis_or_none", _factory)
    return store


@pytest.fixture
def captured(monkeypatch):
    """Capture incidents instead of writing to the DB / sending mail."""
    seen = []

    async def _fake(kind, count, threshold, window):
        seen.append({"kind": kind, "count": count, "threshold": threshold})

    monkeypatch.setattr(wd, "_raise_incident", _fake)
    return seen


def _flood(store, kind, n):
    """Put n events into the current minute's bucket."""
    store[f"{wd._PREFIX}:{kind}:{wd._bucket()}"] = n


def test_counts_only_failures(redis):
    asyncio.run(wd.record_error_status(200))
    asyncio.run(wd.record_error_status(302))
    assert redis == {}, "success responses must not be counted"

    asyncio.run(wd.record_error_status(500))
    asyncio.run(wd.record_error_status(429))
    assert redis[f"{wd._PREFIX}:5xx:{wd._bucket()}"] == 1
    assert redis[f"{wd._PREFIX}:4xx:{wd._bucket()}"] == 1


def test_no_incident_below_threshold(redis, captured, monkeypatch):
    monkeypatch.setattr(wd.settings, "watchdog_5xx_threshold", 25, raising=False)
    _flood(redis, "5xx", 24)
    result = asyncio.run(wd.evaluate())
    assert result["evaluated"] is True
    assert captured == []


def test_incident_at_threshold(redis, captured, monkeypatch):
    monkeypatch.setattr(wd.settings, "watchdog_5xx_threshold", 25, raising=False)
    _flood(redis, "5xx", 25)
    asyncio.run(wd.evaluate())
    assert len(captured) == 1
    assert captured[0]["kind"] == "5xx" and captured[0]["count"] == 25


def test_ongoing_incident_alerts_once(redis, captured, monkeypatch):
    """The property that decides whether the alert survives contact with a real outage."""
    monkeypatch.setattr(wd.settings, "watchdog_5xx_threshold", 10, raising=False)
    _flood(redis, "5xx", 50)

    for _ in range(4):
        redis.pop(wd._LOCK_KEY, None)   # a fresh tick each time
        asyncio.run(wd.evaluate())

    assert len(captured) == 1, "an ongoing incident must not email every interval"


def test_cooldown_clears_on_recovery_so_the_next_spike_alerts(redis, captured, monkeypatch):
    monkeypatch.setattr(wd.settings, "watchdog_5xx_threshold", 10, raising=False)

    _flood(redis, "5xx", 50)
    asyncio.run(wd.evaluate())
    assert len(captured) == 1

    # Recovered: the bucket empties, so the cooldown must be released rather than waiting out
    # a timer against a system that is already healthy again.
    redis.pop(f"{wd._PREFIX}:5xx:{wd._bucket()}", None)
    redis.pop(wd._LOCK_KEY, None)
    asyncio.run(wd.evaluate())
    assert not any(k.startswith("watchdog:cooldown") for k in redis)

    # Second spike → alerts again.
    _flood(redis, "5xx", 50)
    redis.pop(wd._LOCK_KEY, None)
    asyncio.run(wd.evaluate())
    assert len(captured) == 2


def test_only_one_worker_evaluates_a_tick(redis, captured, monkeypatch):
    """Four uvicorn workers must not send four emails for one incident."""
    monkeypatch.setattr(wd.settings, "watchdog_5xx_threshold", 10, raising=False)
    _flood(redis, "5xx", 50)

    results = [asyncio.run(wd.evaluate()) for _ in range(4)]   # lock NOT cleared between

    assert sum(1 for r in results if r["evaluated"]) == 1
    assert [r["reason"] for r in results if not r["evaluated"]] == ["another_worker_evaluating"] * 3
    assert len(captured) == 1


def test_job_failures_are_watched_too(redis, captured, monkeypatch):
    """A background job failing has no status code and no access-log line — nothing else sees it."""
    monkeypatch.setattr(wd.settings, "watchdog_job_failure_threshold", 3, raising=False)
    for _ in range(3):
        asyncio.run(wd.record_job_failure("similarity_upload"))
    asyncio.run(wd.evaluate())
    assert [c["kind"] for c in captured] == ["job_similarity_upload"]


def test_nothing_raises_when_redis_is_down(monkeypatch, captured):
    async def _none():
        return None

    monkeypatch.setattr(wd, "get_redis_or_none", _none)

    asyncio.run(wd.record_error_status(500))          # must not raise
    asyncio.run(wd.record_job_failure())              # must not raise
    result = asyncio.run(wd.evaluate())
    assert result == {"evaluated": False, "reason": "redis_unavailable"}
    assert captured == []


def test_counting_never_propagates_an_error(monkeypatch):
    """The middleware calls this on a response that is already going out; it must be inert."""
    class _Broken(_FakeRedis):
        async def incr(self, key):
            raise RuntimeError("redis exploded")

    async def _factory():
        return _Broken({})

    monkeypatch.setattr(wd, "get_redis_or_none", _factory)
    asyncio.run(wd.record_error_status(503))   # no exception escapes

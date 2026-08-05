"""
Counter rehydrate on a Redis miss (pricing v2.1, B4)
====================================================

Redis is authoritative for enforcement, but its keys can vanish — eviction under memory pressure, a
flush, a restart without persistence. An absent key reads as **0**, which silently hands the subject
a brand-new allowance: a free user who has spent all 3 searches gets 3 more, and nothing anywhere
reports it.

So when the key is genuinely absent, the counter is restored from the durable audit row before the
limit is evaluated.

The direction of failure is the important part. Every uncertain case must fail **open**, never
closed — a cache problem must not be presented to a paying user as "you've reached your limit".
That is why "could not read the durable store" and "Redis is down" both leave the request allowed.

Fakes throughout: no Redis, no database.
"""

import pytest

from app.services.entitlement_gate import EntitlementGate


class _Usage:
    def __init__(self, present, seeded=True):
        self.present = present          # True | False | None (None = Redis down)
        self.seed_calls = []
        self._seeded = seeded

    async def exists(self, *a):
        return self.present

    async def seed_if_absent(self, subject_type, subject_id, feature_key, value, period_key, ttl):
        self.seed_calls.append(value)
        return self._seeded


class _History:
    def __init__(self, used):
        self.used = used                # int | None (None = could not read)
        self.calls = 0

    async def get_used_count(self, db, subject_type, subject_id, feature_key, period_start):
        self.calls += 1
        return self.used


def _gate(*, present, used=0, seeded=True):
    g = EntitlementGate()
    g._usage = _Usage(present, seeded)
    g._history = _History(used)
    return g


SUBJECT = ("user", "7")


@pytest.mark.asyncio
class TestRestoresAnEvictedCounter:
    async def test_seeds_from_the_durable_count(self):
        g = _gate(present=False, used=3)
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == [3], "an evicted counter must come back at its real value"

    async def test_a_present_key_is_left_alone(self):
        """The common case. Rehydrating a live counter would cost a DB read on every request."""
        g = _gate(present=True, used=3)
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == []
        assert g._history.calls == 0, "must not touch the database when the key is there"

    async def test_zero_durable_usage_seeds_nothing(self):
        """Genuinely a first use this period — there is nothing to restore."""
        g = _gate(present=False, used=0)
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == []


@pytest.mark.asyncio
class TestFailsOpenNeverClosed:
    async def test_redis_down_does_not_attempt_a_rebuild(self):
        """`exists` returning None means Redis is unreachable — there is nowhere to seed into, and
        the gate's own fail-open path will allow the request."""
        g = _gate(present=None, used=3)
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == []
        assert g._history.calls == 0

    async def test_unreadable_durable_store_invents_no_count(self):
        """`None` from the audit row means "could not tell", which is NOT "0" and is not a licence
        to guess. Leaving the counter empty errs generous; guessing high would deny a user who
        may have used nothing."""
        g = _gate(present=False, used=None)
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == []

    async def test_an_exception_is_swallowed(self):
        """This runs on the hot path of every counted request. A rehydrate failure must degrade to
        "enforce from whatever Redis says", never to a 500."""
        g = _gate(present=False, used=3)

        async def _boom(*a, **kw):
            raise RuntimeError("redis exploded")

        g._usage.seed_if_absent = _boom
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        # no exception escaped


@pytest.mark.asyncio
class TestConcurrencySafety:
    async def test_seed_is_conditional_on_absence(self):
        """Two concurrent requests can both observe the key missing. The write is SET NX, so the
        loser cannot clobber the count the winner just established."""
        g = _gate(present=False, used=3, seeded=False)   # False = another request won the race
        await g._rehydrate_if_evicted(None, SUBJECT, "search_playlists_per_month", None, "k", 60)
        assert g._usage.seed_calls == [3], "still attempted — Redis decides, not us"


@pytest.mark.asyncio
class TestWiredIntoBothCountedPaths:
    async def test_consume_and_peek_both_rehydrate(self):
        """The meter shown in the UI comes from peek and enforcement from consume. If only one
        rehydrated, the chip and the 402 would disagree after an eviction."""
        import inspect

        src = inspect.getsource(EntitlementGate)
        assert src.count("await self._rehydrate_if_evicted(") == 2

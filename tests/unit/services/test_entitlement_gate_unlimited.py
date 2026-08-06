"""
Gate semantics for unlimited limits and per-feature windows (pricing v2.1)
=========================================================================

Two changes to the enforcement primitive, both of which fail silently in the worst direction if
they regress:

  * ``-1`` means UNLIMITED — *never denied*, but still **counted**. Before this there was no way to
    express "no ceiling": ``limit <= 0`` denied, and ``0`` is a legitimate seeded value on several
    plans, so it could not be reused. If ``-1`` ever falls through to the old branch, **every Pro
    user is denied every search**. If it stops counting, Pro consumption becomes invisible — and a
    plan whose usage we cannot see is a plan we cannot price (fair use has nothing to stand on).
  * The window is chosen by the FEATURE's registry value, not by the call site. If that dispatch
    regresses, the daily search meter silently reverts to a monthly one and a free user gets 3
    searches a month instead of 3 a day.

Collaborators are faked — this exercises the gate's decision logic, not Redis or MariaDB.
"""

import pytest

from app.services.entitlement_gate import UNLIMITED, EntitlementGate


class _FakeEntitlements:
    def __init__(self, limit: int, window: str = "monthly"):
        self._limit = limit
        self._window = window

    async def get_int(self, db, feature_key, *, user=None, visitor_id=None):
        return self._limit

    async def get_window(self, db, feature_key):
        return self._window


class _RecordingUsage:
    """Records whether the counter was touched at all."""

    def __init__(self, result=(True, 1), count=0):
        self.consume_calls = 0
        self.peek_calls = 0
        self.increment_calls = 0
        self._result = result
        self._count = count

    async def try_consume(self, *a, **kw):
        self.consume_calls += 1
        return self._result

    async def peek(self, *a, **kw):
        self.peek_calls += 1
        return self._count

    async def increment(self, *a, **kw):
        self.increment_calls += 1
        self._count += 1
        return self._count

    async def exists(self, *a, **kw):
        return True


class _FakeUser:
    id = 42


def _gate(limit, *, window="monthly", usage=None):
    gate = EntitlementGate()
    gate._entitlements = _FakeEntitlements(limit, window)
    gate._usage = usage or _RecordingUsage()
    return gate


@pytest.mark.asyncio
class TestUnlimitedSentinel:
    async def test_minus_one_allows(self):
        result = await _gate(UNLIMITED, window="daily").try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is True

    async def test_minus_one_is_counted_anyway(self):
        """Unlimited means never DENIED, not never MEASURED.

        The original shortcut skipped Redis entirely to save an INCR on Pro's hot path. That made
        Pro consumption invisible, which is the one thing a fair-use position cannot do without —
        one Redis op per action is the right price for being able to see it."""
        usage = _RecordingUsage()
        await _gate(UNLIMITED, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert usage.increment_calls == 1

    async def test_minus_one_is_never_compared_against_a_limit(self):
        """Counted, but through `increment` — not `try_consume`, which would compare against -1
        and deny everything."""
        usage = _RecordingUsage()
        await _gate(UNLIMITED, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert usage.consume_calls == 0

    async def test_minus_one_reports_the_running_count(self):
        """The number that reaches /entitlements/me. Without it the chip has nothing to show for
        a Pro user."""
        usage = _RecordingUsage(count=11)
        result = await _gate(UNLIMITED, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.count == 12

    async def test_a_counter_failure_still_allows_an_unlimited_feature(self):
        """There is no ceiling here, so nothing a counter failure could legitimately deny."""
        usage = _RecordingUsage()

        async def _boom(*a, **kw):
            return None

        usage.increment = _boom
        result = await _gate(UNLIMITED, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is True

    async def test_zero_still_denies(self):
        """`0` is seeded on real plans (guest uploads, guest exports). It must keep denying —
        this is why the unlimited sentinel could not be `0`."""
        result = await _gate(0).try_consume(None, "uploads_per_month", user=_FakeUser())
        assert result.allowed is False

    async def test_positive_limit_still_counts(self):
        # window="daily" so the window resolves without a DB — this test is about the COUNTING
        # decision, not about which window was picked (that is covered in TestWindowDispatch).
        usage = _RecordingUsage(result=(True, 1))
        result = await _gate(3, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is True
        assert usage.consume_calls == 1

    async def test_over_a_positive_limit_denies_and_reports_the_reset_time(self):
        usage = _RecordingUsage(result=(False, 3))
        result = await _gate(3, window="daily", usage=usage).try_consume(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is False
        assert result.metric == "search_playlists_per_month"
        assert result.resets_at is not None, "the 402 body needs resets_at from the gate"

    async def test_peek_reads_the_count_but_never_denies_on_it(self):
        usage = _RecordingUsage(count=99)
        result = await _gate(UNLIMITED, window="daily", usage=usage).peek_allowed(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is True, "no count may ever deny an unlimited feature"
        assert result.count == 99
        assert usage.peek_calls == 1


@pytest.mark.asyncio
class TestWindowDispatch:
    async def test_daily_feature_uses_the_shared_utc_day(self):
        gate = _gate(3, window="daily")
        key, _ttl = await gate._period(None, _FakeUser(), None, "search_playlists_per_month")
        expected, _ = gate._periods.resolve_daily()
        assert key == expected

    async def test_monthly_feature_is_unaffected(self):
        """Uploads must keep resetting on the subject's own anchor — Stripe owns that boundary."""
        gate = _gate(50, window="monthly")
        key, _ttl = await gate._period(None, None, "visitor-abc", "uploads_per_month")
        expected, _ = gate._periods.resolve_for_guest()
        assert key == expected

    async def test_no_feature_key_falls_back_to_monthly(self):
        """Back-compat: any caller that predates per-feature windows keeps its old behaviour."""
        gate = _gate(50, window="daily")
        key, _ttl = await gate._period(None, None, "visitor-abc", None)
        expected, _ = gate._periods.resolve_for_guest()
        assert key == expected

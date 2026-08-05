"""
Gate semantics for unlimited limits and per-feature windows (pricing v2.1)
=========================================================================

Two changes to the enforcement primitive, both of which fail silently in the worst direction if
they regress:

  * ``-1`` means UNLIMITED. Before this there was no way to express "no ceiling": ``limit <= 0``
    denied, and ``0`` is a legitimate seeded value on several plans, so it could not be reused.
    If ``-1`` ever falls through to the old branch, **every Pro user is denied every search**.
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

    def __init__(self, result=(True, 1)):
        self.consume_calls = 0
        self.peek_calls = 0
        self._result = result

    async def try_consume(self, *a, **kw):
        self.consume_calls += 1
        return self._result

    async def peek(self, *a, **kw):
        self.peek_calls += 1
        return 0


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
        result = await _gate(UNLIMITED).try_consume(None, "search_playlists_per_month", user=_FakeUser())
        assert result.allowed is True

    async def test_minus_one_never_touches_the_counter(self):
        """Short-circuiting before Redis is the point: it also removes a pointless INCR from
        Pro's hot path, on every single search."""
        usage = _RecordingUsage()
        await _gate(UNLIMITED, usage=usage).try_consume(None, "search_playlists_per_month", user=_FakeUser())
        assert usage.consume_calls == 0

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

    async def test_unlimited_also_short_circuits_peek(self):
        usage = _RecordingUsage()
        result = await _gate(UNLIMITED, usage=usage).peek_allowed(
            None, "search_playlists_per_month", user=_FakeUser()
        )
        assert result.allowed is True
        assert usage.peek_calls == 0


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

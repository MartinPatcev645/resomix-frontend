"""
Usage snapshot — reporting, not enforcing (pricing v2.1, D1)
============================================================

``usage_snapshot`` answers *"how much has been used"*. ``peek_allowed`` answers *"may this proceed"*.
They are deliberately separate methods, and the case that shows why is a subject sitting exactly at
their limit: to ``peek_allowed`` that is a **denial**, to this it is simply ``used == limit``. A
reporting endpoint should not have to unpick a denial to find a number.

Two rules run through all of it:

  * **``None`` is never zero.** A Redis read can fail, and a caller can have no identity to count
    against. Reporting ``0`` for either would put a fabricated number in front of a user and make
    it look like data.
  * **Unlimited is not unmeasured.** ``limit`` goes ``null`` for an unlimited feature; ``used``
    reports a real number. A plan whose consumption we cannot see is a plan we cannot price.

Fakes throughout: no Redis, no DB.
"""

from datetime import datetime

import pytest

from app.services.entitlement_gate import EntitlementGate, UsageSnapshot


class _Entitlements:
    def __init__(self, limit):
        self.limit = limit

    async def get_int(self, db, key, *, user=None, visitor_id=None):
        return self.limit

    async def get_window(self, db, feature_key):
        return "daily"


class _Usage:
    def __init__(self, count):
        self.count = count
        self.peeked = False

    async def exists(self, *a):
        return True

    async def peek(self, *a):
        self.peeked = True
        return self.count


class _Periods:
    def resolve_window_daily(self):
        return (datetime(2026, 8, 6), datetime(2026, 8, 7), "20260806", 172800)


class _User:
    id = 7


def _gate(limit, count=0):
    g = EntitlementGate()
    g._entitlements = _Entitlements(limit)
    g._usage = _Usage(count)
    g._periods = _Periods()
    return g


FEATURE = "exports_per_day"


@pytest.mark.asyncio
class TestCountedFeatures:
    async def test_reports_limit_used_and_reset(self):
        snap = await _gate(3, 2).usage_snapshot(None, FEATURE, user=_User())
        assert (snap.limit, snap.used) == (3, 2)
        assert snap.resets_at == datetime(2026, 8, 7)

    async def test_zero_used_is_zero(self):
        assert (await _gate(3, 0).usage_snapshot(None, FEATURE, user=_User())).used == 0

    async def test_a_spent_allowance_is_reported_not_denied(self):
        """The case that justifies a separate method: `peek_allowed` returns a DENIAL here, and a
        reporting endpoint would have to unpick it to find the number."""
        snap = await _gate(3, 3).usage_snapshot(None, FEATURE, user=_User())
        assert (snap.limit, snap.used) == (3, 3)

    async def test_usage_over_the_limit_is_reported_honestly(self):
        """Reachable after a downgrade or an admin lowering a plan. Clamping `used` to the limit
        would hide that the subject is over it."""
        assert (await _gate(3, 7).usage_snapshot(None, FEATURE, user=_User())).used == 7


@pytest.mark.asyncio
class TestUnlimited:
    async def test_limit_is_none(self):
        assert (await _gate(-1).usage_snapshot(None, FEATURE, user=_User())).limit is None

    async def test_usage_is_still_reported(self):
        """Unlimited means never DENIED, not never MEASURED. Pro consumption is exactly the number
        the fair-use position rests on — reporting `null` would make it invisible."""
        assert (await _gate(-1, 12).usage_snapshot(None, FEATURE, user=_User())).used == 12

    async def test_the_counter_is_read(self):
        g = _gate(-1, 12)
        await g.usage_snapshot(None, FEATURE, user=_User())
        assert g._usage.peeked is True

    async def test_the_period_is_reported(self):
        """`used` is scoped to a window, so without the reset time the number means nothing —
        "12 searches" over what, exactly?"""
        assert (await _gate(-1, 12).usage_snapshot(None, FEATURE, user=_User())).resets_at == datetime(
            2026, 8, 7
        )

    async def test_zero_usage_on_an_unlimited_plan_is_zero(self):
        """Not null. A Pro user who has done nothing today has done nothing today — that is data,
        not an absence of it."""
        assert (await _gate(-1, 0).usage_snapshot(None, FEATURE, user=_User())).used == 0


@pytest.mark.asyncio
class TestUnknownUsage:
    async def test_a_failed_read_is_none_not_zero(self):
        """`peek` returns None when Redis is unreachable. Reporting 0 would show a full allowance
        to someone who has spent it."""
        assert (await _gate(3, None).usage_snapshot(None, FEATURE, user=_User())).used is None

    async def test_the_limit_still_reports(self):
        """The limit comes from the database, so an unreadable counter must not hide it too."""
        assert (await _gate(3, None).usage_snapshot(None, FEATURE, user=_User())).limit == 3

    async def test_no_identity_reports_the_limit_only(self):
        """No user and no visitor id — nothing to count against, but the plan's limit is still a
        fact worth returning."""
        snap = await _gate(3, 2).usage_snapshot(None, FEATURE)
        assert snap.limit == 3
        assert snap.used is None


class TestRemaining:
    def test_counts_down(self):
        assert UsageSnapshot("f", limit=3, used=1).remaining == 2

    def test_floors_at_zero(self):
        """A limit can drop below existing usage — a downgrade, or an admin lowering a plan.
        "-3 left" is not something to put in front of a user."""
        assert UsageSnapshot("f", limit=3, used=7).remaining == 0

    def test_unlimited_has_no_remaining(self):
        assert UsageSnapshot("f", limit=None, used=2).remaining is None

    def test_unknown_usage_has_no_remaining(self):
        """Deriving one from an unknown would invent the number the snapshot refused to invent."""
        assert UsageSnapshot("f", limit=3, used=None).remaining is None

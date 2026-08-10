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
    """Stands in for `UsageCounterService`.

    `bonus` is what `peek_bonus` reports. `None` models Redis being unable to answer — a distinct
    case from `0`, and the one the gate's fallback exists for.
    """

    def __init__(self, count, bonus=0):
        self.count = count
        self.bonus = bonus
        self.peeked = False

    async def exists(self, *a):
        return True

    async def peek(self, *a):
        self.peeked = True
        return self.count

    async def peek_bonus(self, *a):
        return self.bonus


class _Periods:
    def resolve_window_daily(self):
        return (datetime(2026, 8, 6), datetime(2026, 8, 7), "20260806", 172800)


class _User:
    id = 7


def _gate(limit, count=0, bonus=0):
    g = EntitlementGate()
    g._entitlements = _Entitlements(limit)
    g._usage = _Usage(count, bonus)
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


# --------------------------------------------------------------------------- #
# The signup bonus
#
# A one-time grant is applied by seeding the counter NEGATIVE, so the raw value is `uses - bonus`.
# Enforcement is unaffected — it only compares against the limit — but *reporting* it verbatim put
# a literal "-2/3" on the usage chip.
#
# The fix adds the grant back to BOTH sides. That arithmetic shipped with no test at all: the
# double had no `peek_bonus`, so every test here failed on an AttributeError and the behaviour it
# was meant to exercise was never reached. These are the cases that were missing.
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_an_unspent_bonus_reads_as_zero_used_not_a_negative() -> None:
    """The bug as the user saw it. A fresh account with a 2-use grant on a limit of 3 had used
    nothing, and the chip said **-2/3**."""
    gate = _gate(limit=3, count=-2, bonus=2)

    snap = await gate.usage_snapshot(None, FEATURE, user=_User())

    assert snap.used == 0
    assert snap.limit == 5


@pytest.mark.asyncio
async def test_the_denominator_does_not_move_as_the_bonus_is_spent() -> None:
    """Adding the grant to BOTH sides is the point.

    Reconstructing it from `-used` alone would work while the bonus was unspent and then show the
    denominator shrinking 5 → 4 → 3 as it was used — a limit that falls while you use it is worse
    than the negative it replaced.
    """
    seen = []
    for count in (-2, -1, 0, 1):
        snap = await _gate(limit=3, count=count, bonus=2).usage_snapshot(None, FEATURE, user=_User())
        seen.append((snap.used, snap.limit))

    assert seen == [(0, 5), (1, 5), (2, 5), (3, 5)]


@pytest.mark.asyncio
async def test_no_bonus_leaves_the_numbers_exactly_as_they_are() -> None:
    """The overwhelmingly common case. An account with no grant must not have its numbers touched."""
    snap = await _gate(limit=3, count=2, bonus=0).usage_snapshot(None, FEATURE, user=_User())

    assert (snap.used, snap.limit) == (2, 3)


@pytest.mark.asyncio
async def test_a_lost_bonus_record_is_reconstructed_from_the_negative() -> None:
    """The fallback. If the bonus key was evicted — or predates the key existing — the negative
    counter is still evidence of a grant, and `max(0, -used)` at worst restates what today's number
    already implies. What it must never do is leave a minus sign on screen.
    """
    snap = await _gate(limit=3, count=-2, bonus=None).usage_snapshot(None, FEATURE, user=_User())

    assert snap.used == 0
    assert snap.limit == 5


@pytest.mark.asyncio
async def test_the_fallback_does_not_invent_a_bonus_for_a_positive_count() -> None:
    """`max(0, -used)` must stay at zero for an ordinary account, or a missing Redis key would
    silently inflate everyone's limit."""
    snap = await _gate(limit=3, count=2, bonus=None).usage_snapshot(None, FEATURE, user=_User())

    assert (snap.used, snap.limit) == (2, 3)


@pytest.mark.asyncio
async def test_a_bonus_on_an_unlimited_feature_reports_a_number_and_no_limit() -> None:
    """`limit` stays None — there is nothing to add a bonus to — but `used` is still corrected, or
    an unlimited feature would be the one place the negative survived."""
    snap = await _gate(limit=-1, count=-2, bonus=2).usage_snapshot(None, FEATURE, user=_User())

    assert snap.limit is None
    assert snap.used == 0

"""
Daily usage window (pricing v2.1)
=================================

The search meter moved from a per-subject monthly window to a shared daily one. Two properties are
worth pinning down, because getting either wrong silently locks people out or silently gives away
the product:

  * the day boundary is **UTC and fixed-length** — no DST, so a "day" is never 23 or 25 hours;
  * the window is **not anchored per subject** — everyone's day turns over together, unlike the
    monthly window which follows each user's Stripe cycle or signup anniversary.

Pure unit tests: no database, no Redis, no event loop.
"""

from datetime import datetime, timedelta

import pytest

from app.services.billing_period_service import (
    BillingPeriodService,
    calendar_month_period,
    daily_period,
)


class TestDailyPeriodBoundaries:
    @pytest.mark.parametrize(
        "now",
        [
            datetime(2026, 8, 5, 0, 0, 0),        # exactly midnight
            datetime(2026, 8, 5, 13, 47, 11),     # mid-afternoon
            datetime(2026, 8, 5, 23, 59, 59),     # one second before rollover
        ],
    )
    def test_all_times_in_a_day_resolve_to_the_same_window(self, now):
        """Two searches at 00:05 and 23:55 must count against the SAME allowance."""
        start, end = daily_period(now)
        assert start == datetime(2026, 8, 5, 0, 0, 0)
        assert end == datetime(2026, 8, 6, 0, 0, 0)

    def test_a_day_is_always_exactly_24_hours(self):
        """The reason for UTC over Europe/Athens.

        Athens shifts on the last Sunday of March and October; a local-time window would make one
        day 23 hours and another 25. Someone would lose an hour of allowance once a year and
        nobody would be able to reproduce it.
        """
        # 29 Mar 2026 and 25 Oct 2026 are the European DST switch dates.
        for day in (datetime(2026, 3, 29, 12), datetime(2026, 10, 25, 12), datetime(2026, 8, 5, 12)):
            start, end = daily_period(day)
            assert end - start == timedelta(hours=24)

    def test_midnight_starts_a_new_window(self):
        _, end_of_day = daily_period(datetime(2026, 8, 5, 23, 59, 59))
        next_start, _ = daily_period(datetime(2026, 8, 6, 0, 0, 0))
        assert end_of_day == next_start, "no gap and no overlap across the boundary"

    def test_period_key_differs_between_consecutive_days(self):
        """The Redis key embeds the period; identical keys would merge two days into one."""
        svc = BillingPeriodService()
        key_today = svc._key_and_ttl(*daily_period(datetime(2026, 8, 5, 10)), datetime(2026, 8, 5, 10))[0]
        key_tomorrow = svc._key_and_ttl(*daily_period(datetime(2026, 8, 6, 10)), datetime(2026, 8, 6, 10))[0]
        assert key_today != key_tomorrow


class TestDailyTtl:
    def test_ttl_expires_with_the_window(self):
        svc = BillingPeriodService()
        now = datetime(2026, 8, 5, 13, 47, 11)
        _, ttl = svc._key_and_ttl(*daily_period(now), now)
        # 10h12m49s remain; the fixture buffer keeps the key just past the boundary.
        assert 36_700 < ttl < 36_900

    def test_ttl_never_drops_to_zero_at_the_boundary(self):
        """A key that expires a moment before the window ends would reset the counter early —
        a free user would get extra searches in the last second of the day."""
        svc = BillingPeriodService()
        now = datetime(2026, 8, 5, 23, 59, 59)
        _, ttl = svc._key_and_ttl(*daily_period(now), now)
        assert ttl > 0


class TestDailyIsNotAnchoredPerSubject:
    def test_every_subject_shares_one_window(self):
        """Unlike monthly, a daily allowance must not follow signup time.

        If it did, two users would hit the same limit at different hours and neither support nor
        the user could explain why.
        """
        svc = BillingPeriodService()
        assert svc.resolve_daily() == svc.resolve_daily()

    def test_monthly_is_still_anchored_and_unaffected(self):
        """Uploads stay monthly on the subject's own anchor — this change must not leak into it."""
        jan_signup = calendar_month_period(datetime(2026, 1, 15, 9))
        assert jan_signup[0] == datetime(2026, 1, 1, 0, 0, 0)
        assert jan_signup[1] == datetime(2026, 2, 1, 0, 0, 0)

"""
Founding-offer window (pricing v2.1, E4 / Q1)
=============================================

``BETA_END_DATE`` is the instant founding checkout closes. Resolved to **2027-02-01T00:00:00Z** —
George's v2 value (`2027-02-01T00:00:00+02:00`), same calendar date expressed in UTC so every
deadline in the system sits on one clock, matching the TZ_RESET=UTC decision. It cross-checks
against v1's rule (`start + 6 months`) for a ~1 August 2026 beta start.

**The server owns the answer.** `founding_active` is computed here and shipped to the client, which
only formats the remaining days. A browser clock can be wrong by hours or deliberately set back,
and a page that advertises a price checkout will refuse — or that hides one we would still honour —
is worse than no badge at all.

**A malformed value fails OPEN.** An unparseable env var keeps the founding window open rather than
withdrawing an offer that is still being advertised elsewhere. The alternative silently starts
charging list price for something the marketing site is promising at the founding rate.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.services.billing_service import BillingService


@pytest.fixture
def restore_setting():
    original = settings.beta_end_date
    yield
    settings.beta_end_date = original


class TestTheConfiguredValue:
    def test_defaults_to_the_agreed_instant(self):
        assert settings.beta_end_date == "2027-02-01T00:00:00Z"

    def test_it_is_utc(self):
        """Not Athens. George's doc writes +02:00; this is the same date on the clock everything
        else in the system already uses."""
        assert settings.beta_end_date.endswith("Z")

    def test_it_is_six_months_after_the_beta_start(self):
        """Cross-check against v1's rule (`start + 6 months`) for a ~1 Aug 2026 start. If someone
        edits one without the other, this is what notices."""
        end = datetime.fromisoformat(settings.beta_end_date.replace("Z", "+00:00"))
        assert (end.year, end.month, end.day) == (2027, 2, 1)


class TestTheWindow:
    def test_an_open_window_is_active(self, restore_setting):
        settings.beta_end_date = (
            datetime.now(timezone.utc) + timedelta(days=30)
        ).isoformat().replace("+00:00", "Z")
        assert BillingService.beta_window()["founding_active"] is True

    def test_a_closed_window_is_not_active(self, restore_setting):
        settings.beta_end_date = "2020-01-01T00:00:00Z"
        assert BillingService.beta_window()["founding_active"] is False

    def test_the_end_date_is_returned_for_the_countdown(self, restore_setting):
        settings.beta_end_date = "2027-02-01T00:00:00Z"
        assert BillingService.beta_window()["end_date"] == "2027-02-01T00:00:00Z"

    def test_a_closed_window_still_returns_its_date(self, restore_setting):
        """The client needs it to explain that the offer ended, not just that it is gone."""
        settings.beta_end_date = "2020-01-01T00:00:00Z"
        assert BillingService.beta_window()["end_date"] == "2020-01-01T00:00:00Z"

    def test_the_real_configured_date_is_open_today(self):
        """A guard against shipping with a date already in the past — which would close founding
        checkout on deploy, silently."""
        assert BillingService.beta_window()["founding_active"] is True


class TestMalformedConfiguration:
    @pytest.mark.parametrize("bad", ["", "not-a-date", "2027-13-45", "soon"])
    def test_it_does_not_raise(self, restore_setting, bad):
        """The pricing page is public and unauthenticated. A typo in an env var must not 500 it."""
        settings.beta_end_date = bad
        assert BillingService.beta_window() is not None

    def test_it_fails_open(self, restore_setting):
        """Open, not closed: withdrawing an offer the marketing site is still advertising is worse
        than honouring one an hour too long."""
        settings.beta_end_date = "not-a-date"
        assert BillingService.beta_window()["founding_active"] is True

    def test_it_reports_no_date_rather_than_a_broken_one(self, restore_setting):
        """`None` makes the countdown render nothing. Passing the junk through would print
        "NaN days left"."""
        settings.beta_end_date = "not-a-date"
        assert BillingService.beta_window()["end_date"] is None


class TestNaiveTimestamps:
    def test_a_value_without_an_offset_is_read_as_utc(self, restore_setting):
        """Someone will eventually set `BETA_END_DATE=2027-02-01T00:00:00`. Guessing server-local
        would move the deadline by however the box is configured."""
        settings.beta_end_date = "2027-02-01T00:00:00"
        assert BillingService.beta_window()["founding_active"] is True

    def test_a_naive_past_value_still_closes(self, restore_setting):
        settings.beta_end_date = "2020-01-01T00:00:00"
        assert BillingService.beta_window()["founding_active"] is False

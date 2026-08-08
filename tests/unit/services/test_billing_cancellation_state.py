"""
Cancellation state — every way Stripe can say "this is cancelling"
==================================================================

REGRESSION NET FOR A LIVE BUG. The profile screen used to decide "cancelled vs renewing" from
``cancel_at_period_end`` alone, and told paying customers their subscription would **renew** after
they had cancelled it. Stripe sets that boolean only for a plain cancel on an *unmanaged*
subscription; every founding subscriber has a subscription schedule attached, and cancelling one of
those records the fact somewhere else entirely.

These tests pin ``BillingService.cancellation_state`` against all four mechanisms. Each one must
report ``pending=True``. If a future change makes any of them fall through to "no cancellation",
that is the same customer-visible defect returning, and one of these will fail.

Pure: no database, no Stripe, no HTTP. ``cancellation_state`` is a static function over a row, and
a lightweight stand-in for that row is enough to exercise every branch.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.services.billing_service import BillingService

NOW = datetime(2026, 8, 8, 12, 0, 0)
PERIOD_END = NOW + timedelta(days=23)
SCHEDULE_END = NOW + timedelta(days=400)


class Row:
    """Stand-in for a ``UserSubscription`` row.

    Deliberately not the SQLAlchemy model: constructing one drags in the mapper and a table
    definition to test a function that only ever reads attributes. Defaults are a healthy,
    renewing subscription, so each test states only what it is changing.
    """

    def __init__(self, **overrides):
        self.status = "active"
        self.current_period_end = PERIOD_END
        self.cancel_at_period_end = False
        self.cancel_at = None
        self.canceled_at = None
        self.ended_at = None
        self.cancellation_reason = None
        for key, value in overrides.items():
            setattr(self, key, value)


def state(**overrides):
    return BillingService.cancellation_state(Row(**overrides))


# --------------------------------------------------------------------------- #
# Nothing to report
# --------------------------------------------------------------------------- #

def test_no_row_returns_none() -> None:
    assert BillingService.cancellation_state(None) is None


def test_healthy_subscription_returns_none() -> None:
    """A renewing subscription must report NOTHING, or every profile shows a cancellation notice."""
    assert state() is None


def test_trialing_subscription_returns_none() -> None:
    assert state(status="trialing") is None


# --------------------------------------------------------------------------- #
# Mechanism 1 — the plain boolean (unmanaged subscription)
# --------------------------------------------------------------------------- #

def test_cancel_at_period_end_is_pending() -> None:
    result = state(cancel_at_period_end=True, canceled_at=NOW,
                   cancellation_reason="cancellation_requested")
    assert result == {
        "pending": True,
        "ended": False,
        "effective_at": PERIOD_END.isoformat(),
        "reason": "cancellation_requested",
    }


# --------------------------------------------------------------------------- #
# Mechanism 2 — `cancel_at` only (schedule-managed subscription)
# --------------------------------------------------------------------------- #

def test_cancel_at_without_the_boolean_is_pending() -> None:
    """The founding-lock path. `cancel_at_period_end` stays FALSE here — that is the whole bug."""
    result = state(cancel_at=SCHEDULE_END, cancellation_reason="cancellation_requested")
    assert result["pending"] is True
    assert result["ended"] is False


def test_cancel_at_beats_current_period_end() -> None:
    """For a schedule-managed subscription the 'current period' is a PHASE.

    Reporting the phase boundary would tell a customer their access ends months early.
    """
    result = state(cancel_at=SCHEDULE_END)
    assert result["effective_at"] == SCHEDULE_END.isoformat()
    assert result["effective_at"] != PERIOD_END.isoformat()


# --------------------------------------------------------------------------- #
# Mechanism 3 — `canceled_at` only
# --------------------------------------------------------------------------- #

def test_canceled_at_alone_is_pending() -> None:
    """Stripe stamps `canceled_at` when cancellation is REQUESTED, not when it takes effect.

    A row can legitimately carry only this — and the old code rendered it as "Renews on".
    """
    result = state(canceled_at=NOW)
    assert result["pending"] is True
    assert result["effective_at"] == PERIOD_END.isoformat()


# --------------------------------------------------------------------------- #
# Mechanism 4 — already over
# --------------------------------------------------------------------------- #

def test_ended_at_reports_ended_not_pending() -> None:
    ended = NOW - timedelta(days=1)
    result = state(status="canceled", canceled_at=NOW - timedelta(days=30), ended_at=ended)
    assert result["pending"] is False
    assert result["ended"] is True
    assert result["effective_at"] == ended.isoformat()


def test_canceled_status_without_ended_at_still_reports_ended() -> None:
    """Rows synced before `ended_at` existed have only the status. They must not read as pending."""
    result = state(status="canceled", canceled_at=NOW)
    assert result["ended"] is True
    assert result["pending"] is False


def test_ended_falls_back_through_boundaries_for_a_date() -> None:
    """No `ended_at`: fall back to `cancel_at`, then the period end, rather than showing nothing."""
    result = state(status="canceled", cancel_at=SCHEDULE_END)
    assert result["effective_at"] == SCHEDULE_END.isoformat()


# --------------------------------------------------------------------------- #
# Edge cases
# --------------------------------------------------------------------------- #

def test_pending_with_no_known_boundary_still_reports_pending() -> None:
    """A missing date must not suppress the cancellation itself.

    Saying nothing is worse than saying "cancelled, date unknown": the customer would be told
    their plan renews.
    """
    result = state(cancel_at_period_end=True, current_period_end=None)
    assert result["pending"] is True
    assert result["effective_at"] is None


def test_resumed_subscription_reports_nothing() -> None:
    """Resuming in the portal clears all three fields on Stripe's side.

    The sync assigns them unconditionally, so the row clears too — and this must go back to None,
    or a resumed customer keeps seeing a cancellation notice forever.
    """
    assert state(cancel_at_period_end=False, cancel_at=None, canceled_at=None) is None


def test_past_due_is_not_a_cancellation() -> None:
    """Dunning revokes access via the plan resolver, but nothing was cancelled.

    Reporting it here would put "Cancelled" on the screen of someone whose card merely expired.
    """
    assert state(status="past_due") is None


def test_reason_is_passed_through_untouched() -> None:
    for reason in ("cancellation_requested", "payment_failed", "payment_disputed",
                   "refunded", "disputed", "admin"):
        assert state(cancel_at_period_end=True, cancellation_reason=reason)["reason"] == reason


def test_cancelled_spelling_variant_is_treated_as_ended() -> None:
    """Guard against a British-spelling status reaching the column and reading as still-running."""
    assert state(status="cancelled")["ended"] is True

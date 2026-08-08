"""
Webhook → email dispatch: which notice, and when to stay quiet
==============================================================

``WebhookService._notify_subscription_state`` runs **after** the commit and decides, from the
committed row alone, whether the customer hears anything. Two properties matter:

* **It re-reads the row rather than trusting the handler.** One cancellation reaches us through
  several events, and for a founding subscriber it may arrive only on the *schedule*. Deriving the
  message from `cancellation_state` is what makes every path produce the same wording and the same
  dedupe key.

* **It cannot raise.** It runs inside the handler's `try`, so an exception here would return 500
  and make Stripe replay an event we have already applied.

The suppression list is the other half: several reasons already have their own, more specific
email, and `payment_failed` should send nothing at all (decision Q5 — Stripe's dunning mail
already covers it, and a second message lands on someone whose card merely expired).
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.webhook_service import WebhookService

SUB_ID = "sub_test_1"
PERIOD_END = datetime(2027, 3, 14)
SCHEDULE_END = datetime(2028, 1, 1)


class Row:
    def __init__(self, **overrides):
        self.user_id = 42
        self.plan_id = 7
        self.status = "active"
        self.stripe_subscription_id = SUB_ID
        self.current_period_end = PERIOD_END
        self.cancel_at_period_end = False
        self.cancel_at = None
        self.canceled_at = None
        self.ended_at = None
        self.cancellation_reason = None
        self.stripe_price_id = None
        self.currency = "EUR"
        self.is_founding = False
        self.founding_lock_ends_at = None
        for key, value in overrides.items():
            setattr(self, key, value)


def _result(value, kind="scalar"):
    r = MagicMock()
    if kind == "scalar":
        r.scalar_one_or_none.return_value = value
    else:
        r.first.return_value = value
    return r


def _service_and_db(row, *, plan_name="Pro"):
    """Wire a service whose db returns: the subscription row, the user, then the plan.

    This is the ordering of the CANCELLATION paths. The `created` path inserts a PlanPrice
    look-up before the plan — see `_service_and_db_created`.
    """
    svc = WebhookService()
    svc.billing_email.subscription_cancelled = AsyncMock(return_value=True)
    svc.billing_email.subscription_ended = AsyncMock(return_value=True)
    svc.billing_email.subscription_resumed = AsyncMock(return_value=True)
    svc.billing_email.subscription_started = AsyncMock(return_value=True)

    user = MagicMock()
    user.id = 42
    plan = MagicMock()
    plan.name = plan_name

    db = MagicMock()
    db.execute = AsyncMock(side_effect=[_result(row), _result(user), _result(plan)])
    return svc, db


# --------------------------------------------------------------------------- #
# Welcome — on `created` only
# --------------------------------------------------------------------------- #

def _price(cents=799, currency="EUR", interval="month"):
    p = MagicMock()
    p.unit_amount_cents, p.currency, p.interval = cents, currency, interval
    return p


def _service_and_db_created(row, price=None, *, plan_name="Pro"):
    """The `created` path queries in this order: subscription row → user → PlanPrice → Plan.

    A separate builder because the welcome look-up sits BETWEEN the user and the plan, so the
    generic helper's fixed row/user/plan ordering hands a Plan back where a PlanPrice is expected.
    """
    svc, _ = _service_and_db(row, plan_name=plan_name)
    plan = MagicMock()
    plan.name = plan_name
    user = MagicMock()
    user.id = 42
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[_result(row), _result(user), _result(price), _result(plan)]
    )
    return svc, db


@pytest.mark.asyncio
async def test_a_new_subscription_is_welcomed() -> None:
    row = Row(stripe_price_id="price_founding_eur")
    svc, db = _service_and_db_created(row, _price())

    await svc._notify_subscription_state(db, SUB_ID, "evt_1", event_type="customer.subscription.created")

    svc.billing_email.subscription_started.assert_awaited_once()
    kwargs = svc.billing_email.subscription_started.call_args.kwargs
    assert kwargs["amount_cents"] == 799
    assert kwargs["interval"] == "month"
    assert kwargs["renews_at"] == PERIOD_END


@pytest.mark.parametrize("event_type", [
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "subscription_schedule.updated",
    None,
])
@pytest.mark.asyncio
async def test_only_created_triggers_the_welcome(event_type) -> None:
    """THE REGRESSION GUARD FOR A DEPLOY HAZARD.

    The dedupe key alone would make this send once per subscription however it were triggered —
    but "once" is not "once, at the right moment". Firing on any event for a healthy subscription
    would greet every existing subscriber the first time a webhook touched them after deploy.
    """
    svc, db = _service_and_db_created(Row(), _price())
    await svc._notify_subscription_state(db, SUB_ID, "evt_1", event_type=event_type)
    svc.billing_email.subscription_started.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_founding_subscriber_is_told_when_their_rate_is_locked_until() -> None:
    """The locked rate is the offer they bought; omitting it undersells what they paid for."""
    locked_until = datetime(2028, 6, 8)
    row = Row(stripe_price_id="price_founding_eur", is_founding=True,
              founding_lock_ends_at=locked_until)
    svc, db = _service_and_db_created(row, _price())

    await svc._notify_subscription_state(db, SUB_ID, "evt_1", event_type="customer.subscription.created")
    assert svc.billing_email.subscription_started.call_args.kwargs["founding_until"] == locked_until


@pytest.mark.asyncio
async def test_a_list_price_subscriber_gets_no_founding_claim() -> None:
    row = Row(stripe_price_id="price_list_eur", is_founding=False,
              founding_lock_ends_at=datetime(2028, 6, 8))
    svc, db = _service_and_db_created(row, _price())

    await svc._notify_subscription_state(db, SUB_ID, "evt_1", event_type="customer.subscription.created")
    assert svc.billing_email.subscription_started.call_args.kwargs["founding_until"] is None


@pytest.mark.asyncio
async def test_a_missing_price_row_still_sends_a_welcome() -> None:
    """No figures beats no email — the customer just paid us."""
    row = Row(stripe_price_id="price_unknown")
    svc, db = _service_and_db_created(row, None)

    await svc._notify_subscription_state(db, SUB_ID, "evt_1", event_type="customer.subscription.created")
    svc.billing_email.subscription_started.assert_awaited_once()
    assert svc.billing_email.subscription_started.call_args.kwargs["amount_cents"] is None


# --------------------------------------------------------------------------- #
# Nothing to say
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_healthy_subscription_sends_no_cancellation_notice() -> None:
    svc, db = _service_and_db(Row())
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_cancelled.assert_not_awaited()
    svc.billing_email.subscription_ended.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_healthy_subscription_offers_the_resume_notice_to_its_own_guard() -> None:
    """The dispatcher always asks; `subscription_resumed` is what decides.

    That guard lives in the email service because it needs the notification history — and it is
    what stops a renewal being announced as "your subscription is back on". The test below proves
    the guard itself works.
    """
    svc, db = _service_and_db(Row())
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_resumed.assert_awaited_once()
    assert svc.billing_email.subscription_resumed.call_args.kwargs["renews_at"] == PERIOD_END


@pytest.mark.asyncio
async def test_a_cancelling_subscription_is_never_offered_the_resume_notice() -> None:
    svc, db = _service_and_db(Row(cancel_at_period_end=True))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_resumed.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_row_sends_nothing_and_does_not_raise() -> None:
    svc = WebhookService()
    svc.billing_email.subscription_cancelled = AsyncMock()
    db = MagicMock()
    db.execute = AsyncMock(return_value=_result(None))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_cancelled.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_database_error_is_swallowed() -> None:
    """Raising here would return 500 and replay an event we already applied."""
    svc = WebhookService()
    db = MagicMock()
    db.execute = AsyncMock(side_effect=RuntimeError("connection lost"))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")  # must not raise


# --------------------------------------------------------------------------- #
# Pending cancellation
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_plain_cancel_sends_the_cancelled_notice() -> None:
    svc, db = _service_and_db(Row(cancel_at_period_end=True, canceled_at=datetime(2026, 8, 8)))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")

    svc.billing_email.subscription_cancelled.assert_awaited_once()
    kwargs = svc.billing_email.subscription_cancelled.call_args.kwargs
    assert kwargs["effective_at"] == PERIOD_END
    assert kwargs["plan_name"] == "Pro"


@pytest.mark.asyncio
async def test_schedule_managed_cancel_sends_the_same_notice() -> None:
    """The founding-lock path: `cancel_at_period_end` is FALSE and only `cancel_at` is set."""
    svc, db = _service_and_db(Row(cancel_at=SCHEDULE_END))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")

    svc.billing_email.subscription_cancelled.assert_awaited_once()
    assert svc.billing_email.subscription_cancelled.call_args.kwargs["effective_at"] == SCHEDULE_END


@pytest.mark.asyncio
async def test_cancel_at_beats_the_period_end_in_the_notice() -> None:
    """For a schedule-managed subscription the current period is a PHASE; quoting it would tell
    the customer their access ends months early."""
    svc, db = _service_and_db(Row(cancel_at=SCHEDULE_END, current_period_end=PERIOD_END))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    assert svc.billing_email.subscription_cancelled.call_args.kwargs["effective_at"] == SCHEDULE_END


@pytest.mark.asyncio
async def test_the_plans_real_name_is_used() -> None:
    svc, db = _service_and_db(Row(cancel_at_period_end=True), plan_name="Pro Annual")
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    assert svc.billing_email.subscription_cancelled.call_args.kwargs["plan_name"] == "Pro Annual"


# --------------------------------------------------------------------------- #
# Ended
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_ended_subscription_sends_the_ended_notice() -> None:
    ended = datetime(2027, 3, 14)
    svc, db = _service_and_db(Row(status="canceled", ended_at=ended))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")

    svc.billing_email.subscription_ended.assert_awaited_once()
    assert svc.billing_email.subscription_ended.call_args.kwargs["effective_at"] == ended
    svc.billing_email.subscription_cancelled.assert_not_awaited()


@pytest.mark.parametrize("reason", ["payment_failed", "refunded", "disputed", "payment_disputed"])
@pytest.mark.asyncio
async def test_reasons_with_their_own_email_suppress_the_generic_ended_notice(reason) -> None:
    """A refund sends "refunded"; a dispute sends "suspended"; a failed card sends nothing at all.

    Without this the customer gets two emails about one event — and in the payment_failed case, a
    cancellation notice for something they never cancelled.
    """
    svc, db = _service_and_db(
        Row(status="canceled", ended_at=datetime(2027, 3, 14), cancellation_reason=reason)
    )
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_ended.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_normal_cancellation_reason_still_sends_the_ended_notice() -> None:
    """Guard against the suppression list swallowing the ordinary case."""
    svc, db = _service_and_db(
        Row(status="canceled", ended_at=datetime(2027, 3, 14),
            cancellation_reason="cancellation_requested")
    )
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    svc.billing_email.subscription_ended.assert_awaited_once()


@pytest.mark.asyncio
async def test_ended_without_a_date_falls_back_rather_than_sending_nothing() -> None:
    svc, db = _service_and_db(Row(status="canceled", ended_at=None, cancel_at=SCHEDULE_END))
    await svc._notify_subscription_state(db, SUB_ID, "evt_1")
    assert svc.billing_email.subscription_ended.call_args.kwargs["effective_at"] == SCHEDULE_END

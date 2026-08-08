"""
Refunds and chargebacks
=======================

The defect this covers: **Stripe does not cancel a subscription when its invoice is refunded.**
The two are unrelated objects to Stripe, so before this service an admin could return someone's
€9.99 in full and leave them with a live Pro plan that would renew on schedule.

Four boundaries are pinned here:

* **full vs partial** decided on amounts, never intent — a €3 goodwill refund must not end a
  subscription;
* **Stripe is cancelled too**, not just our row, or Stripe keeps billing a plan we revoked;
* **a chargeback suspends reversibly** through ``access_suspended_at`` rather than ``status``,
  because Stripe keeps a disputed subscription `active` and would mirror any status straight back;
* **a won dispute restores**, a lost one does not.

Stripe and the database are mocked; nothing here makes a network call.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.billing_refund_service import BillingRefundService

SUB_ID = "sub_test_1"
CHARGE_ID = "ch_test_1"
INVOICE_ID = "in_test_1"
DISPUTE_ID = "dp_test_1"


class Row:
    def __init__(self, **overrides):
        self.user_id = 42
        self.plan_id = 7
        self.status = "active"
        self.stripe_subscription_id = SUB_ID
        self.canceled_at = None
        self.ended_at = None
        self.cancellation_reason = None
        self.is_founding = True
        self.stripe_schedule_id = "sub_sched_1"
        self.access_suspended_at = None
        self.access_suspended_reason = None
        for key, value in overrides.items():
            setattr(self, key, value)


def _charge(amount=999, refunded=999, invoice=INVOICE_ID):
    return {"id": CHARGE_ID, "amount": amount, "amount_refunded": refunded,
            "currency": "eur", "invoice": invoice}


def _db(subscription_row=None, invoice_row=None):
    """Session returning the invoice mapping first, then the subscription row."""
    db = MagicMock()
    inv, sub = MagicMock(), MagicMock()
    inv.scalar_one_or_none.return_value = invoice_row
    sub.scalar_one_or_none.return_value = subscription_row
    db.execute = AsyncMock(side_effect=[inv, sub])
    db.flush = AsyncMock()
    return db


def _invoice_row(subscription_id=SUB_ID):
    row = MagicMock()
    row.stripe_subscription_id = subscription_id
    return row


# --------------------------------------------------------------------------- #
# full vs partial
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("amount,refunded,expected", [
    (999, 999, True),    # exact
    (999, 1200, True),   # over-refund (shouldn't happen, must not read as partial)
    (999, 300, False),   # partial
    (999, 998, False),   # one cent short is still partial
    (999, 0, False),     # nothing refunded
    (0, 0, True),        # zero-amount charge (refunded trial) counts as full
])
def test_full_refund_is_decided_on_amounts(amount, refunded, expected) -> None:
    assert BillingRefundService.is_full_refund(
        {"amount": amount, "amount_refunded": refunded}
    ) is expected


# --------------------------------------------------------------------------- #
# charge.refunded
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_full_refund_ends_the_subscription() -> None:
    row = Row()
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    svc = BillingRefundService()

    with patch.object(svc, "cancel_in_stripe", return_value=True) as cancel:
        outcome = await svc.handle_refund(db, _charge())

    assert outcome[0] == "full"
    assert row.status == "canceled"
    assert isinstance(row.ended_at, datetime)
    assert row.cancellation_reason == "refunded"
    cancel.assert_called_once_with(SUB_ID)


@pytest.mark.asyncio
async def test_full_refund_clears_the_founding_lock() -> None:
    """Otherwise the profile promises a founding rate on an account with no subscription at all."""
    row = Row(is_founding=True, stripe_schedule_id="sub_sched_1")
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    svc = BillingRefundService()

    with patch.object(svc, "cancel_in_stripe", return_value=True):
        await svc.handle_refund(db, _charge())

    assert row.is_founding is False
    assert row.stripe_schedule_id is None


@pytest.mark.asyncio
async def test_partial_refund_changes_nothing() -> None:
    """THE IMPORTANT NEGATIVE. A goodwill refund must not cancel anyone's plan."""
    row = Row()
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    svc = BillingRefundService()

    with patch.object(svc, "cancel_in_stripe") as cancel:
        outcome = await svc.handle_refund(db, _charge(refunded=300))

    assert outcome[0] == "partial"
    assert row.status == "active"
    assert row.ended_at is None
    assert row.cancellation_reason is None
    cancel.assert_not_called()


@pytest.mark.asyncio
async def test_a_charge_with_no_invoice_is_not_ours() -> None:
    """One-time cart charges reach the same webhook; returning None hands them back."""
    svc = BillingRefundService()
    assert await svc.handle_refund(MagicMock(), _charge(invoice=None)) is None


@pytest.mark.asyncio
async def test_an_unknown_subscription_does_nothing() -> None:
    svc = BillingRefundService()
    db = _db(subscription_row=None, invoice_row=_invoice_row())
    assert await svc.handle_refund(db, _charge()) is None


@pytest.mark.asyncio
async def test_a_stripe_cancel_failure_still_ends_it_locally() -> None:
    """Access must stop even if Stripe rejects the cancel — the log is what flags the mismatch."""
    row = Row()
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    svc = BillingRefundService()

    with patch.object(svc, "cancel_in_stripe", return_value=False):
        outcome = await svc.handle_refund(db, _charge())

    assert outcome[0] == "full"
    assert row.status == "canceled"


@pytest.mark.asyncio
async def test_an_existing_ended_at_is_not_overwritten() -> None:
    """A replayed refund must not move the moment access stopped."""
    original = datetime(2026, 1, 1)
    row = Row(ended_at=original, status="canceled")
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    svc = BillingRefundService()

    with patch.object(svc, "cancel_in_stripe", return_value=True):
        await svc.handle_refund(db, _charge())

    assert row.ended_at == original


# --------------------------------------------------------------------------- #
# cancel_in_stripe — the schedule has to be released first
# --------------------------------------------------------------------------- #

def test_cancel_releases_an_attached_schedule_first() -> None:
    """Stripe refuses to cancel a subscription a schedule owns — every founding subscriber."""
    subscription = MagicMock()
    subscription.schedule = "sub_sched_1"

    with patch("stripe.Subscription.retrieve", return_value=subscription), \
         patch("stripe.SubscriptionSchedule.release") as release, \
         patch("stripe.Subscription.cancel") as cancel:
        assert BillingRefundService.cancel_in_stripe(SUB_ID) is True

    release.assert_called_once_with("sub_sched_1")
    cancel.assert_called_once_with(SUB_ID)


def test_cancel_skips_the_release_when_there_is_no_schedule() -> None:
    subscription = MagicMock()
    subscription.schedule = None

    with patch("stripe.Subscription.retrieve", return_value=subscription), \
         patch("stripe.SubscriptionSchedule.release") as release, \
         patch("stripe.Subscription.cancel") as cancel:
        assert BillingRefundService.cancel_in_stripe(SUB_ID) is True

    release.assert_not_called()
    cancel.assert_called_once()


def test_a_failed_release_still_attempts_the_cancel() -> None:
    """An already-released schedule raises; the cancel can still succeed."""
    subscription = MagicMock()
    subscription.schedule = "sub_sched_1"

    with patch("stripe.Subscription.retrieve", return_value=subscription), \
         patch("stripe.SubscriptionSchedule.release", side_effect=Exception("already released")), \
         patch("stripe.Subscription.cancel") as cancel:
        assert BillingRefundService.cancel_in_stripe(SUB_ID) is True

    cancel.assert_called_once()


def test_cancel_reports_failure_rather_than_raising() -> None:
    with patch("stripe.Subscription.retrieve", side_effect=Exception("network")):
        assert BillingRefundService.cancel_in_stripe(SUB_ID) is False


# --------------------------------------------------------------------------- #
# disputes
# --------------------------------------------------------------------------- #

def _dispute(status="needs_response", charge=None):
    return {"id": DISPUTE_ID, "status": status, "amount": 999, "currency": "eur",
            "charge": charge if charge is not None else {"id": CHARGE_ID, "invoice": INVOICE_ID}}


@pytest.mark.asyncio
async def test_dispute_opened_suspends_without_touching_status() -> None:
    """Writing `status` would be undone by the next sync — Stripe keeps a disputed sub ACTIVE."""
    row = Row()
    db = _db(subscription_row=row, invoice_row=_invoice_row())

    result = await BillingRefundService().handle_dispute_opened(db, _dispute())

    assert result is row
    assert isinstance(row.access_suspended_at, datetime)
    assert row.access_suspended_reason == "disputed"
    assert row.status == "active"      # untouched, and correct — Stripe still says active


@pytest.mark.asyncio
async def test_a_repeated_dispute_event_announces_nothing_new() -> None:
    row = Row(access_suspended_at=datetime(2026, 8, 1), access_suspended_reason="disputed")
    db = _db(subscription_row=row, invoice_row=_invoice_row())
    assert await BillingRefundService().handle_dispute_opened(db, _dispute()) is None


@pytest.mark.asyncio
async def test_dispute_won_restores_access() -> None:
    row = Row(access_suspended_at=datetime(2026, 8, 1), access_suspended_reason="disputed")
    db = _db(subscription_row=row, invoice_row=_invoice_row())

    kind, restored = await BillingRefundService().handle_dispute_closed(db, _dispute(status="won"))

    assert kind == "won"
    assert restored.access_suspended_at is None
    assert restored.access_suspended_reason is None


@pytest.mark.asyncio
async def test_dispute_lost_leaves_access_suspended() -> None:
    row = Row(access_suspended_at=datetime(2026, 8, 1), access_suspended_reason="disputed")
    db = _db(subscription_row=row, invoice_row=_invoice_row())

    kind, kept = await BillingRefundService().handle_dispute_closed(db, _dispute(status="lost"))

    assert kind == "lost"
    assert kept.access_suspended_at is not None


@pytest.mark.parametrize("status", ["warning_needs_response", "warning_under_review",
                                    "warning_closed", "needs_response", "under_review"])
@pytest.mark.asyncio
async def test_a_non_final_dispute_status_does_nothing(status) -> None:
    """`warning_*` is an early notice from the network — no funds have moved."""
    assert await BillingRefundService().handle_dispute_closed(MagicMock(), _dispute(status)) is None


@pytest.mark.asyncio
async def test_a_win_does_not_lift_a_suspension_it_did_not_cause() -> None:
    """Access suspended for another reason must not be handed back by an unrelated dispute win."""
    row = Row(access_suspended_at=datetime(2026, 8, 1), access_suspended_reason="abuse")
    db = _db(subscription_row=row, invoice_row=_invoice_row())

    assert await BillingRefundService().handle_dispute_closed(db, _dispute(status="won")) is None
    assert row.access_suspended_at is not None


@pytest.mark.asyncio
async def test_a_dispute_on_a_non_subscription_charge_is_not_ours() -> None:
    """Cart disputes reach the same webhook and belong to PurchaseService."""
    svc = BillingRefundService()
    dispute = _dispute(charge={"id": CHARGE_ID, "invoice": None})
    assert await svc.handle_dispute_opened(MagicMock(), dispute) is None

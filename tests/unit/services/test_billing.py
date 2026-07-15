"""
Consumer Billing Tests
======================

Unit-level (DB + Stripe mocked, no live server). Covers the critical Stripe → DB write-back
(``BillingSyncService.sync_subscription``) and the currency resolver. See
docs/CONSUMER_BILLING_PLAN.md.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.billing_sync_service import BillingSyncService, _ts
from app.services.billing_service import BillingService


def _scalar(val):
    r = MagicMock()
    r.scalar_one_or_none.return_value = val
    return r


def _first(val):
    r = MagicMock()
    r.first.return_value = val
    return r


def _mock_db(execute_results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=execute_results)
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


def _subscription_payload(status="active", deleted_price=False, cancel_at_period_end=False):
    return {
        "id": "sub_test_1",
        "customer": "cus_test_1",
        "status": status,
        "cancel_at_period_end": cancel_at_period_end,
        "current_period_start": 1780000000,
        "current_period_end": 1782600000,
        "canceled_at": None,
        "trial_end": None,
        "items": {"data": [{"price": {"id": "price_pro_eur", "currency": "eur"}}]},
        "metadata": {"user_id": "42", "plan_code": "pro"},
    }


# ── currency resolver ────────────────────────────────────────────────────────

def test_resolve_currency_defaults_to_eur():
    svc = BillingService()
    assert svc.resolve_currency(None) == "EUR"
    assert svc.resolve_currency("GB") == "EUR"
    assert svc.resolve_currency("de") == "EUR"


def test_resolve_currency_us_is_usd():
    svc = BillingService()
    assert svc.resolve_currency("US") == "USD"
    assert svc.resolve_currency("us") == "USD"


# ── epoch → datetime ─────────────────────────────────────────────────────────

def test_ts_converts_epoch_and_handles_none():
    assert _ts(None) is None
    assert _ts(0) is None
    dt = _ts(1780000000)
    assert isinstance(dt, datetime)


# ── subscription webhook write-back ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_subscription_created_writes_active_row_and_event():
    user = MagicMock()
    user.id = 42
    # execute order: user lookup → price→plan map → existing subscription row (none)
    db = _mock_db([_scalar(user), _first((7,)), _scalar(None)])

    await BillingSyncService().sync_subscription(
        db, _subscription_payload(status="active"), "customer.subscription.created", "evt_1"
    )

    added = [c.args[0] for c in db.add.call_args_list]
    sub_row = next(o for o in added if o.__class__.__name__ == "UserSubscription")
    event = next(o for o in added if o.__class__.__name__ == "SubscriptionEvent")

    assert sub_row.status == "active"
    assert sub_row.plan_id == 7          # mapped from the price
    assert sub_row.currency == "EUR"
    assert sub_row.stripe_price_id == "price_pro_eur"
    assert sub_row.current_period_start is not None
    assert sub_row.cancel_at_period_end is False

    assert event.type == "created"
    assert event.to_plan_id == 7


@pytest.mark.asyncio
async def test_sync_subscription_deleted_marks_canceled():
    user = MagicMock()
    user.id = 42
    db = _mock_db([_scalar(user), _first((7,)), _scalar(None)])

    await BillingSyncService().sync_subscription(
        db, _subscription_payload(status="active"), "customer.subscription.deleted", "evt_2"
    )

    added = [c.args[0] for c in db.add.call_args_list]
    sub_row = next(o for o in added if o.__class__.__name__ == "UserSubscription")
    event = next(o for o in added if o.__class__.__name__ == "SubscriptionEvent")

    assert sub_row.status == "canceled"   # deleted → no longer grants the plan (resolves to free)
    assert event.type == "canceled"
    assert event.to_plan_id is None


@pytest.mark.asyncio
async def test_sync_subscription_unknown_user_is_noop():
    # user_id lookup → None, then customer lookup → None → returns without writing.
    db = _mock_db([_scalar(None), _scalar(None)])
    await BillingSyncService().sync_subscription(
        db, _subscription_payload(), "customer.subscription.updated", "evt_3"
    )
    db.add.assert_not_called()

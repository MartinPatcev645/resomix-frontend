"""
Cancellation write-back — what the webhook handlers actually store
=================================================================

Companion to ``test_billing_cancellation_state.py``. That file proves the *reader*
(``BillingService.cancellation_state``) understands every shape a cancellation can take; this one
proves the *writers* (``BillingSyncService.sync_subscription`` and ``.sync_schedule``) put those
shapes in the row in the first place. A correct reader over an empty column still shows the
customer the wrong thing.

Two paths, because Stripe uses two:

* an **unmanaged** subscription cancels on the subscription object (`cancel_at_period_end`);
* a **schedule-managed** one — which is every founding subscriber — cancels on the schedule
  (`end_behavior="cancel"`), leaving the boolean false.

DB and Stripe are mocked; these are pure unit tests. Mocking style matches ``test_billing.py``.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.billing_sync_service import BillingSyncService, _ts

# 2026-08-08 and 2027-06-01 as epoch seconds — readable dates make a failure diagnosable.
CANCEL_EPOCH = 1786968000
PHASE1_END_EPOCH = 1786968000
PHASE2_END_EPOCH = 1818504000


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


def _subscription_payload(**overrides):
    payload = {
        "id": "sub_test_1",
        "customer": "cus_test_1",
        "status": "active",
        "cancel_at_period_end": False,
        "cancel_at": None,
        "canceled_at": None,
        "ended_at": None,
        "cancellation_details": None,
        "trial_end": None,
        "items": {"data": [{
            "price": {"id": "price_pro_eur", "currency": "eur"},
            "current_period_start": 1780000000,
            "current_period_end": 1782600000,
        }]},
        "metadata": {"user_id": "42", "plan_code": "pro"},
    }
    payload.update(overrides)
    return payload


async def _sync(payload, event_type="customer.subscription.updated"):
    """Run sync_subscription against a fresh row and hand the row back."""
    user = MagicMock()
    user.id = 42
    db = _mock_db([_scalar(user), _first((7,)), _scalar(None)])
    await BillingSyncService().sync_subscription(db, payload, event_type, "evt_x")
    added = [c.args[0] for c in db.add.call_args_list]
    return next(o for o in added if o.__class__.__name__ == "UserSubscription")


class Row:
    """Stand-in for an existing ``UserSubscription`` row.

    Carries every attribute the two sync methods READ; the ones they only write appear via
    ``setattr``. Using the real model would drag in the mapper and a table definition to test code
    that just moves fields around.
    """

    def __init__(self, **overrides):
        self.user_id = 42
        self.plan_id = 7
        self.status = "active"
        self.stripe_subscription_id = "sub_test_1"
        self.stripe_schedule_id = None
        self.currency = "EUR"
        self.is_founding = False
        self.founding_lock_ends_at = None
        self.cancel_at_period_end = False
        self.cancel_at = None
        self.canceled_at = None
        self.ended_at = None
        self.cancellation_reason = None
        for key, value in overrides.items():
            setattr(self, key, value)


# --------------------------------------------------------------------------- #
# sync_subscription — the unmanaged path
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_plain_cancel_stores_all_three_fields() -> None:
    row = await _sync(_subscription_payload(
        cancel_at_period_end=True,
        cancel_at=CANCEL_EPOCH,
        canceled_at=CANCEL_EPOCH,
        cancellation_details={"reason": "cancellation_requested"},
    ))
    assert row.cancel_at_period_end is True
    assert isinstance(row.cancel_at, datetime)
    assert isinstance(row.canceled_at, datetime)
    assert row.cancellation_reason == "cancellation_requested"


@pytest.mark.asyncio
async def test_cancel_at_is_stored_when_the_boolean_is_false() -> None:
    """The schedule-managed shape arriving on the subscription object.

    Before this, `cancel_at` was read off the payload and thrown away — there was no column.
    """
    row = await _sync(_subscription_payload(cancel_at=CANCEL_EPOCH))
    assert row.cancel_at_period_end is False
    assert isinstance(row.cancel_at, datetime)


@pytest.mark.asyncio
async def test_deleted_event_sets_ended_at_even_when_stripe_omits_it() -> None:
    """A deleted subscription must never be left looking open."""
    row = await _sync(_subscription_payload(ended_at=None), "customer.subscription.deleted")
    assert row.status == "canceled"
    assert isinstance(row.ended_at, datetime)


@pytest.mark.asyncio
async def test_deleted_event_prefers_stripes_own_ended_at() -> None:
    """Stripe's value, not "now" — the two differ by however long the webhook took to arrive."""
    row = await _sync(_subscription_payload(ended_at=CANCEL_EPOCH), "customer.subscription.deleted")
    assert row.ended_at == _ts(CANCEL_EPOCH)


@pytest.mark.asyncio
async def test_active_subscription_leaves_ended_at_null() -> None:
    row = await _sync(_subscription_payload())
    assert row.ended_at is None


@pytest.mark.asyncio
async def test_resume_clears_every_cancellation_field() -> None:
    """The portal's "renew" button clears these on Stripe's side; the row must follow.

    A conditional write would leave a resumed customer permanently displayed as cancelling.
    """
    row = await _sync(_subscription_payload(
        cancel_at_period_end=False, cancel_at=None, canceled_at=None, cancellation_details=None,
    ))
    assert row.cancel_at_period_end is False
    assert row.cancel_at is None
    assert row.canceled_at is None
    assert row.cancellation_reason is None


@pytest.mark.asyncio
async def test_our_reason_survives_stripes_generic_one() -> None:
    """THE DOUBLE-EMAIL BUG.

    A refund cancels the subscription through the API, and Stripe reports that back as
    `cancellation_details.reason = "cancellation_requested"` — true, but less specific than the
    `refunded` we already recorded. Letting it win sent the customer a second, generic "your
    subscription has ended" email on top of the refund notice, because the suppression list keys
    off exactly this field.
    """
    user = MagicMock()
    user.id = 42
    existing = Row(cancellation_reason="refunded")
    db = _mock_db([_scalar(user), _first((7,)), _scalar(existing)])

    await BillingSyncService().sync_subscription(
        db,
        _subscription_payload(
            canceled_at=CANCEL_EPOCH,
            ended_at=CANCEL_EPOCH,
            cancellation_details={"reason": "cancellation_requested"},
        ),
        "customer.subscription.deleted",
        "evt_z",
    )
    assert existing.cancellation_reason == "refunded"


@pytest.mark.asyncio
async def test_a_dispute_reason_also_survives() -> None:
    user = MagicMock()
    user.id = 42
    existing = Row(cancellation_reason="disputed")
    db = _mock_db([_scalar(user), _first((7,)), _scalar(existing)])

    await BillingSyncService().sync_subscription(
        db,
        _subscription_payload(cancellation_details={"reason": "cancellation_requested"}),
        "customer.subscription.updated",
        "evt_z2",
    )
    assert existing.cancellation_reason == "disputed"


@pytest.mark.asyncio
async def test_stripes_reason_is_used_when_we_have_none_of_our_own() -> None:
    """The ordinary case: a cancellation we did not originate."""
    row = await _sync(_subscription_payload(
        cancel_at_period_end=True,
        cancellation_details={"reason": "payment_failed"},
    ))
    assert row.cancellation_reason == "payment_failed"


@pytest.mark.asyncio
async def test_plain_update_does_not_erase_an_existing_reason() -> None:
    """A refund handler records `reason='refunded'`; the `.updated` event that follows carries no
    cancellation_details and must not wipe it."""
    user = MagicMock()
    user.id = 42
    existing = Row(cancellation_reason="refunded")
    db = _mock_db([_scalar(user), _first((7,)), _scalar(existing)])

    await BillingSyncService().sync_subscription(
        db, _subscription_payload(cancel_at=CANCEL_EPOCH), "customer.subscription.updated", "evt_y"
    )
    assert existing.cancellation_reason == "refunded"


# --------------------------------------------------------------------------- #
# sync_schedule — the founding-lock path
# --------------------------------------------------------------------------- #

def _schedule(end_behavior="release", phases=2, status="active"):
    all_phases = [
        {"start_date": 1780000000, "end_date": PHASE1_END_EPOCH},
        {"start_date": PHASE1_END_EPOCH, "end_date": PHASE2_END_EPOCH},
    ]
    return {
        "id": "sub_sched_1",
        "subscription": "sub_test_1",
        "status": status,
        "end_behavior": end_behavior,
        "phases": all_phases[:phases],
    }


@pytest.mark.asyncio
async def test_schedule_set_to_cancel_records_the_cancellation() -> None:
    """THE FOUNDING-LOCK CANCELLATION. Nothing on the subscription object says this happened."""
    row = Row()
    db = _mock_db([_scalar(row)])

    await BillingSyncService().sync_schedule(db, _schedule(end_behavior="cancel"),
                                             "subscription_schedule.updated")

    assert row.cancel_at == _ts(PHASE2_END_EPOCH)
    assert row.cancellation_reason == "cancellation_requested"


@pytest.mark.asyncio
async def test_cancelled_schedule_truncated_to_one_phase_is_still_seen() -> None:
    """Stripe usually truncates a cancelled schedule to the phase in progress.

    The two-phase founding-lock guard would return early on that, discarding the only notice of
    the cancellation we get — so the end_behavior check has to run first.
    """
    row = Row()
    db = _mock_db([_scalar(row)])

    await BillingSyncService().sync_schedule(db, _schedule(end_behavior="cancel", phases=1),
                                             "subscription_schedule.updated")

    assert row.cancel_at == _ts(PHASE1_END_EPOCH)


@pytest.mark.asyncio
async def test_release_behaviour_records_no_cancellation() -> None:
    """`end_behavior="release"` is the NORMAL founding lock. It is not a cancellation."""
    row = Row()
    db = _mock_db([_scalar(row)])

    await BillingSyncService().sync_schedule(db, _schedule(end_behavior="release"),
                                             "subscription_schedule.updated")

    assert row.cancel_at is None
    assert row.cancellation_reason is None
    assert row.is_founding is True          # the lock itself still registers


@pytest.mark.asyncio
async def test_cancel_behaviour_does_not_overwrite_a_specific_reason() -> None:
    row = Row(cancellation_reason="refunded")
    db = _mock_db([_scalar(row)])

    await BillingSyncService().sync_schedule(db, _schedule(end_behavior="cancel"),
                                             "subscription_schedule.updated")

    assert row.cancellation_reason == "refunded"


@pytest.mark.asyncio
async def test_released_schedule_still_clears_the_founding_flag() -> None:
    """Existing behaviour must survive this change — released means the lock is over."""
    row = Row(is_founding=True, stripe_schedule_id="sub_sched_1")
    schedule = _schedule(status="released")
    schedule["subscription"] = None
    schedule["released_subscription"] = "sub_test_1"
    db = _mock_db([_scalar(row)])

    await BillingSyncService().sync_schedule(db, schedule, "subscription_schedule.released")

    assert row.is_founding is False
    assert row.stripe_schedule_id is None


@pytest.mark.asyncio
async def test_final_phase_end_prefers_the_last_phase() -> None:
    """Someone who cancels mid-lock keeps what they paid for, to the end of the whole schedule.

    Reporting phase 1's end would cut them off early on the profile screen.
    """
    assert BillingSyncService._final_phase_end(_schedule()) == _ts(PHASE2_END_EPOCH)
    assert BillingSyncService._final_phase_end({"phases": []}) is None

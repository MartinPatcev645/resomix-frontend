"""
Billing emails — dedupe, formatting, and never breaking a webhook
=================================================================

Three things are worth pinning here, and the copy is not one of them:

1. **Exactly one email per real change.** Stripe emits several distinct events for a single
   cancellation, each with its own id, each passing the event-level dedupe in ``WebhookService``.
   The state-keyed guard in ``BillingNotification`` is the only thing standing between a customer
   and three identical emails.

2. **A mail failure must never raise.** These run inside a Stripe webhook, which returns 500 on
   any exception and makes Stripe replay the whole event. An SMTP timeout must not replay a
   subscription sync.

3. **Money and dates render as a human would recognise them.** ``€9.99``, not ``999``.

SMTP and the database are mocked; nothing here touches either.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.services.billing_email_service import BillingEmailService, fmt_date, fmt_money

SUB_ID = "sub_test_1"
CHARGE_ID = "ch_test_1"
EFFECTIVE = datetime(2027, 3, 14)


def _user(email="buyer@example.com", name="Alex"):
    u = MagicMock()
    u.id = 42
    u.email = email
    u.name = name
    u.username = "alex"
    return u


def _db(existing=None, commit_raises=False):
    """Session stub. `existing` is what the dedupe lookup finds — None means "not sent yet"."""
    db = MagicMock()
    result = MagicMock()
    result.first.return_value = existing
    result.scalar_one_or_none.return_value = existing
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.commit = AsyncMock(
        side_effect=IntegrityError("dup", None, Exception()) if commit_raises else None
    )
    db.rollback = AsyncMock()
    return db


def _service(sent=True):
    """Service with delivery stubbed. Returns (service, send_mock)."""
    svc = BillingEmailService()
    svc.email_service.send_templated = AsyncMock(return_value=sent)
    svc.logging_service.log = MagicMock()
    return svc, svc.email_service.send_templated


# --------------------------------------------------------------------------- #
# Formatting
# --------------------------------------------------------------------------- #

def test_money_renders_with_a_symbol_customers_recognise() -> None:
    assert fmt_money(999, "eur") == "€9.99"
    assert fmt_money(1250, "usd") == "$12.50"
    assert fmt_money(500, "gbp") == "£5.00"


def test_money_falls_back_to_the_code_for_unknown_currencies() -> None:
    assert fmt_money(700, "sek") == "7.00 SEK"


def test_money_is_none_when_there_is_no_amount() -> None:
    """None lets the template drop the phrase entirely rather than print "we refunded €0.00"."""
    assert fmt_money(None, "eur") is None


def test_money_defaults_to_eur_when_currency_is_missing() -> None:
    assert fmt_money(999, None) == "€9.99"


def test_date_renders_without_a_time() -> None:
    """No minute, no timezone — printing either invites an argument we would lose."""
    assert fmt_date(EFFECTIVE) == "14 March 2027"
    assert fmt_date(None) is None


# --------------------------------------------------------------------------- #
# Dedupe
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_first_send_goes_out_and_claims_the_key() -> None:
    svc, send = _service()
    db = _db(existing=None)

    assert await svc.subscription_cancelled(
        db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is True

    send.assert_awaited_once()
    claimed = db.add.call_args_list[0].args[0]
    assert claimed.dedupe_key == f"cancelled:{SUB_ID}:{EFFECTIVE.isoformat()}"
    assert claimed.template == "subscription_cancelled"
    assert claimed.recipient_email == "buyer@example.com"


@pytest.mark.asyncio
async def test_second_event_for_the_same_change_sends_nothing() -> None:
    """Stripe emits two or three `customer.subscription.updated` per cancellation."""
    svc, send = _service()
    db = _db(existing=MagicMock())  # the key is already claimed

    assert await svc.subscription_cancelled(
        db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_losing_the_claim_race_sends_nothing() -> None:
    """Two workers can pass the read check together; the unique index is what serialises them."""
    svc, send = _service()
    db = _db(existing=None, commit_raises=True)

    assert await svc.subscription_cancelled(
        db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False
    send.assert_not_awaited()
    db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_a_new_cancellation_date_is_a_new_message() -> None:
    """Cancel, resume, cancel again for a different date — that is a new fact, tell them again."""
    svc, _ = _service()
    keys = []
    for effective in (EFFECTIVE, datetime(2027, 9, 1)):
        db = _db(existing=None)
        await svc.subscription_cancelled(db, _user(), subscription_id=SUB_ID, effective_at=effective)
        keys.append(db.add.call_args_list[0].args[0].dedupe_key)
    assert keys[0] != keys[1]


@pytest.mark.asyncio
async def test_a_missing_date_still_produces_a_stable_key() -> None:
    """Otherwise a cancellation with no known boundary would re-send on every webhook."""
    svc, _ = _service()
    db = _db(existing=None)
    await svc.subscription_cancelled(db, _user(), subscription_id=SUB_ID, effective_at=None)
    assert db.add.call_args_list[0].args[0].dedupe_key == f"cancelled:{SUB_ID}:unknown"


@pytest.mark.asyncio
async def test_each_message_type_has_its_own_key_space() -> None:
    """"Cancelled" and "ended" both fire for one subscription over its life, and must not
    suppress each other."""
    svc, _ = _service()
    seen = set()

    db = _db(existing=None)
    await svc.subscription_cancelled(db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE)
    seen.add(db.add.call_args_list[0].args[0].dedupe_key)

    db = _db(existing=None)
    await svc.subscription_ended(db, _user(), subscription_id=SUB_ID)
    seen.add(db.add.call_args_list[0].args[0].dedupe_key)

    assert len(seen) == 2


@pytest.mark.asyncio
async def test_a_second_partial_refund_is_a_new_message() -> None:
    """Two partial refunds on one charge are two facts; a repeated webhook is one."""
    svc, _ = _service()
    keys = []
    for cents in (300, 500):
        db = _db(existing=None)
        await svc.subscription_partial_refund(
            db, _user(), charge_id=CHARGE_ID, amount_cents=cents, currency="eur"
        )
        keys.append(db.add.call_args_list[0].args[0].dedupe_key)
    assert keys[0] != keys[1]


# --------------------------------------------------------------------------- #
# Resume — the guard that stops every renewal being announced
# --------------------------------------------------------------------------- #

def _db_with_history(cancelled_row, already_resumed=False):
    """Session stub for the resume path: the history lookup, then the dedupe check."""
    db = MagicMock()
    history, dedupe = MagicMock(), MagicMock()
    history.scalar_one_or_none.return_value = cancelled_row
    dedupe.first.return_value = MagicMock() if already_resumed else None
    db.execute = AsyncMock(side_effect=[history, dedupe])
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_resume_sends_nothing_when_no_cancellation_was_ever_announced() -> None:
    """THE IMPORTANT ONE. "Not cancelling" is the normal state of a healthy subscription, so
    without this guard every renewal would be announced as "your subscription is back on"."""
    svc, send = _service()
    db = _db_with_history(cancelled_row=None)

    assert await svc.subscription_resumed(db, _user(), subscription_id=SUB_ID) is False
    send.assert_not_awaited()
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_resume_sends_when_a_cancellation_was_announced() -> None:
    svc, send = _service()
    cancelled = MagicMock()
    cancelled.id = 17
    db = _db_with_history(cancelled_row=cancelled)

    assert await svc.subscription_resumed(
        db, _user(), subscription_id=SUB_ID, renews_at=EFFECTIVE
    ) is True

    send.assert_awaited_once()
    assert send.call_args.kwargs["template_name"] == "subscription_resumed.html"
    assert send.call_args.kwargs["context"]["renews_at"] == "14 March 2027"


@pytest.mark.asyncio
async def test_resume_is_keyed_to_the_cancellation_it_answers() -> None:
    """Cancel → resume → cancel → resume must send TWO confirmations, not one.

    Keying on the subscription alone would swallow the second; keying on the cancellation row's id
    gives each cycle its own key.
    """
    svc, _ = _service()
    keys = []
    for cancellation_id in (17, 31):
        cancelled = MagicMock()
        cancelled.id = cancellation_id
        db = _db_with_history(cancelled_row=cancelled)
        await svc.subscription_resumed(db, _user(), subscription_id=SUB_ID)
        keys.append(db.add.call_args_list[0].args[0].dedupe_key)

    assert keys == [f"resumed:{SUB_ID}:17", f"resumed:{SUB_ID}:31"]
    assert len(set(keys)) == 2


@pytest.mark.asyncio
async def test_repeated_events_for_one_resume_send_once() -> None:
    svc, send = _service()
    cancelled = MagicMock()
    cancelled.id = 17
    db = _db_with_history(cancelled_row=cancelled, already_resumed=True)

    assert await svc.subscription_resumed(db, _user(), subscription_id=SUB_ID) is False
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_resume_records_the_subscription_it_relates_to() -> None:
    """`stripe_object_id` is what the history lookup keys on — an unset one breaks the next cycle."""
    svc, _ = _service()
    cancelled = MagicMock()
    cancelled.id = 17
    db = _db_with_history(cancelled_row=cancelled)
    await svc.subscription_resumed(db, _user(), subscription_id=SUB_ID)
    assert db.add.call_args_list[0].args[0].stripe_object_id == SUB_ID


@pytest.mark.asyncio
async def test_cancellation_records_the_subscription_it_relates_to() -> None:
    svc, _ = _service()
    db = _db(existing=None)
    await svc.subscription_cancelled(db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE)
    assert db.add.call_args_list[0].args[0].stripe_object_id == SUB_ID


# --------------------------------------------------------------------------- #
# Failure isolation — the webhook must survive anything here
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_smtp_failure_returns_false_and_does_not_raise() -> None:
    svc, _ = _service(sent=False)
    db = _db(existing=None)
    assert await svc.subscription_cancelled(
        db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False


@pytest.mark.asyncio
async def test_an_exception_from_the_mailer_is_swallowed_and_logged() -> None:
    svc, send = _service()
    send.side_effect = RuntimeError("connection reset")
    db = _db(existing=None)

    assert await svc.subscription_cancelled(
        db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False
    svc.logging_service.log.assert_called_once()
    assert svc.logging_service.log.call_args.kwargs["level"] == "ERROR"


@pytest.mark.asyncio
async def test_a_failed_send_is_recorded_as_failed_not_deleted() -> None:
    """The row stays so a bouncing address does not retry on every later webhook; the status is
    what tells support the customer was never actually told."""
    svc, _ = _service(sent=False)
    row = MagicMock()
    db = _db(existing=None)
    # First execute() is the dedupe check, the second is _mark_failed's lookup.
    result_missing, result_row = MagicMock(), MagicMock()
    result_missing.first.return_value = None
    result_row.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(side_effect=[result_missing, result_row])

    await svc.subscription_cancelled(db, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE)
    assert row.status == "failed"


@pytest.mark.asyncio
async def test_no_user_sends_nothing_and_does_not_raise() -> None:
    svc, send = _service()
    assert await svc.subscription_cancelled(
        _db(), None, subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_user_without_an_email_sends_nothing() -> None:
    svc, send = _service()
    assert await svc.subscription_cancelled(
        _db(), _user(email=""), subscription_id=SUB_ID, effective_at=EFFECTIVE
    ) is False
    send.assert_not_awaited()


# --------------------------------------------------------------------------- #
# Context handed to the template
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_greeting_falls_back_rather_than_addressing_someone_as_none() -> None:
    svc, send = _service()
    user = _user(name=None)
    user.username = None
    await svc.subscription_cancelled(_db(), user, subscription_id=SUB_ID, effective_at=EFFECTIVE)
    assert send.call_args.kwargs["context"]["name"] == "there"


@pytest.mark.asyncio
async def test_username_is_used_when_there_is_no_display_name() -> None:
    svc, send = _service()
    await svc.subscription_cancelled(
        _db(), _user(name=None), subscription_id=SUB_ID, effective_at=EFFECTIVE
    )
    assert send.call_args.kwargs["context"]["name"] == "alex"


@pytest.mark.asyncio
async def test_refund_passes_a_formatted_amount_and_the_right_template() -> None:
    svc, send = _service()
    await svc.subscription_refunded(
        _db(), _user(), charge_id=CHARGE_ID, amount_cents=999, currency="eur"
    )
    assert send.call_args.kwargs["template_name"] == "subscription_refunded.html"
    assert send.call_args.kwargs["context"]["amount"] == "€9.99"


@pytest.mark.asyncio
async def test_every_message_type_resolves_a_subject() -> None:
    """A missing subject would ship an email titled "Resomix billing update" to a paying customer."""
    svc, send = _service()
    calls = [
        ("subscription_cancelled", lambda d: svc.subscription_cancelled(
            d, _user(), subscription_id=SUB_ID, effective_at=EFFECTIVE)),
        ("subscription_ended", lambda d: svc.subscription_ended(
            d, _user(), subscription_id=SUB_ID)),
        ("subscription_refunded", lambda d: svc.subscription_refunded(
            d, _user(), charge_id=CHARGE_ID, amount_cents=999, currency="eur")),
        ("subscription_partial_refund", lambda d: svc.subscription_partial_refund(
            d, _user(), charge_id=CHARGE_ID, amount_cents=300, currency="eur")),
        ("subscription_disputed", lambda d: svc.subscription_disputed(
            d, _user(), dispute_id="dp_1")),
        ("subscription_restored", lambda d: svc.subscription_restored(
            d, _user(), dispute_id="dp_1")),
    ]
    for stem, run in calls:
        await run(_db(existing=None))
        assert send.call_args.kwargs["template_name"] == f"{stem}.html"
        assert send.call_args.kwargs["subject"] != "Resomix billing update"

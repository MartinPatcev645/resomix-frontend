"""
Account lifecycle — deactivation that actually deactivates, and soft deletion
============================================================================

Two defects are pinned here, both of which shipped and neither of which was visible from the admin
screen that claimed to control them.

**Deactivation did nothing.** `is_active` was read in exactly two places — inside
`require_permission` (admin routes only) and in the Google login path. The password login never
checked it, `get_current_user` never checked it, and sessions were never revoked. So an admin could
"deactivate" someone who then carried on using the whole webapp and could log back in with their
password.

**Deletion could not succeed.** `DELETE /users/me` issued a hard `DELETE FROM users` relying on a
cascade that does not exist: `orders.user_id`, `admin_operation_logs.admin_user_id` and
`tracks.uploaded_by` are all RESTRICT, so it raised IntegrityError for anyone who had uploaded a
track or placed an order. It also called `verify_password` unconditionally, which raises for a
Google-only account whose `password_hash` is NULL.

No database and no SMTP; these exercise the service transitions directly.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.user_service import UserService


def _user(password_hash="hash", is_active=True):
    u = MagicMock()
    u.id = 42
    u.email = "buyer@example.com"
    u.name = "Alex"
    u.username = "alex"
    u.password_hash = password_hash
    u.is_active = is_active
    u.deactivated_at = None
    u.deactivation_reason = None
    u.deletion_requested_at = None
    u.purge_due_at = None
    return u


def _subscription(sub_id="sub_test_1"):
    s = MagicMock()
    s.stripe_subscription_id = sub_id
    s.status = "active"
    s.ended_at = None
    s.canceled_at = None
    s.cancellation_reason = None
    s.is_founding = True
    s.stripe_schedule_id = "sub_sched_1"
    return s


def _service(user=None, revoked=3):
    svc = UserService()
    svc.user_repo.async_get_by_id = AsyncMock(return_value=user)
    svc.session_repo.async_revoke_all_user_sessions = AsyncMock(return_value=revoked)
    return svc


def _db(subscription=None):
    """Session whose one SELECT (the live subscription look-up) returns `subscription`."""
    db = MagicMock()
    db.commit = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = subscription
    db.execute = AsyncMock(return_value=result)
    return db


# --------------------------------------------------------------------------- #
# deactivate — the three facts that must move together
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_deactivate_sets_the_flag_and_records_why() -> None:
    user = _user()
    await _service().deactivate(_db(), user, reason="admin")

    assert user.is_active is False
    assert isinstance(user.deactivated_at, datetime)
    assert user.deactivation_reason == "admin"


@pytest.mark.asyncio
async def test_deactivate_revokes_every_session() -> None:
    """THE PART THAT WAS MISSING.

    Without this the user keeps working until their access token expires — 30 minutes by default,
    on every device that already holds one. `is_active` alone is a label; this is what makes it a
    control.
    """
    svc = _service()
    await svc.deactivate(_db(), _user(), reason="admin")
    svc.session_repo.async_revoke_all_user_sessions.assert_awaited_once()


@pytest.mark.asyncio
async def test_deactivate_can_defer_its_commit() -> None:
    """Deletion composes deactivation into one transaction; a commit here would split it."""
    db = _db()
    await _service().deactivate(db, _user(), reason="user_requested", commit=False)
    db.commit.assert_not_awaited()


# --------------------------------------------------------------------------- #
# reactivate
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_reactivate_clears_the_pending_purge() -> None:
    """An account reinstated on Monday must not still be on the admin's purge list on Tuesday."""
    user = _user(is_active=False)
    user.deactivated_at = datetime(2026, 8, 8)
    user.deactivation_reason = "user_requested"
    user.deletion_requested_at = datetime(2026, 8, 8)
    user.purge_due_at = datetime(2026, 9, 7)

    await _service().reactivate(_db(), user)

    assert user.is_active is True
    assert user.deactivated_at is None
    assert user.deactivation_reason is None
    assert user.deletion_requested_at is None
    assert user.purge_due_at is None


# --------------------------------------------------------------------------- #
# request_account_deletion
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_deletion_deactivates_and_schedules_thirty_days_out() -> None:
    user = _user()
    svc = _service(user)

    with patch("app.services.user_service.verify_password", return_value=True):
        result = await svc.request_account_deletion(_db(), 42, "correct-password")

    assert user.is_active is False
    assert user.deactivation_reason == "user_requested"
    assert (result["purge_due_at"] - result["deletion_requested_at"]).days == 30
    assert result["grace_days"] == 30


@pytest.mark.asyncio
async def test_deletion_deletes_nothing() -> None:
    """SOFT. The old hard delete raised IntegrityError against three RESTRICT foreign keys, and a
    30-day change of mind is impossible once rows are gone."""
    user = _user()
    svc = _service(user)
    svc.user_repo.async_delete = AsyncMock()

    with patch("app.services.user_service.verify_password", return_value=True):
        await svc.request_account_deletion(_db(), 42, "correct-password")

    svc.user_repo.async_delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_google_only_account_can_delete_itself() -> None:
    """`password_hash` is NULL for these. The old code fed that to `verify_password`, which raises,
    so social-login users could not delete their account at all."""
    user = _user(password_hash=None)
    result = await _service(user).request_account_deletion(_db(), 42, None)

    assert user.is_active is False
    assert result["grace_days"] == 30


@pytest.mark.asyncio
async def test_a_password_account_must_supply_its_password() -> None:
    svc = _service(_user(password_hash="hash"))
    with pytest.raises(HTTPException) as exc:
        await svc.request_account_deletion(_db(), 42, None)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_a_wrong_password_is_refused_and_changes_nothing() -> None:
    user = _user()
    svc = _service(user)

    with patch("app.services.user_service.verify_password", return_value=False):
        with pytest.raises(HTTPException) as exc:
            await svc.request_account_deletion(_db(), 42, "wrong")

    assert exc.value.status_code == 401
    assert user.is_active is True
    assert user.purge_due_at is None


@pytest.mark.asyncio
async def test_deleting_a_missing_user_is_a_404_not_a_crash() -> None:
    svc = _service(None)
    with pytest.raises(HTTPException) as exc:
        await svc.request_account_deletion(_db(), 999, "pw")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_deletion_revokes_sessions_so_it_takes_effect_now() -> None:
    svc = _service(_user(password_hash=None))
    await svc.request_account_deletion(_db(), 42, None)
    svc.session_repo.async_revoke_all_user_sessions.assert_awaited_once()


# --------------------------------------------------------------------------- #
# The admin toggle routes through the same transitions
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_admin_deactivation_revokes_sessions_too() -> None:
    """The toggle used to flip the flag directly, which left every session alive."""
    user = _user(is_active=True)
    user.uuid = "u-1"
    svc = _service(user)
    svc.user_repo.async_get_by_uuid = AsyncMock(return_value=user)
    svc.admin_log_service.log_operation = AsyncMock()

    db = _db()
    db.refresh = AsyncMock()
    admin = MagicMock()
    admin.id = 1

    await svc.admin_toggle_user_status(db, "u-1", admin, ip_address="127.0.0.1")

    assert user.is_active is False
    assert user.deactivation_reason == "admin"
    svc.session_repo.async_revoke_all_user_sessions.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_reactivation_clears_the_purge_date() -> None:
    user = _user(is_active=False)
    user.uuid = "u-1"
    user.purge_due_at = datetime(2026, 9, 7)
    svc = _service(user)
    svc.user_repo.async_get_by_uuid = AsyncMock(return_value=user)
    svc.admin_log_service.log_operation = AsyncMock()

    db = _db()
    db.refresh = AsyncMock()
    admin = MagicMock()
    admin.id = 1

    await svc.admin_toggle_user_status(db, "u-1", admin, ip_address="127.0.0.1")

    assert user.is_active is True
    assert user.purge_due_at is None


@pytest.mark.asyncio
async def test_an_admin_still_cannot_deactivate_themselves() -> None:
    """Existing guard — must survive the rewrite."""
    user = _user()
    user.uuid = "u-1"
    svc = _service(user)
    svc.user_repo.async_get_by_uuid = AsyncMock(return_value=user)

    admin = MagicMock()
    admin.id = 42          # same id as the target

    with pytest.raises(HTTPException) as exc:
        await svc.admin_toggle_user_status(_db(), "u-1", admin)
    assert exc.value.status_code == 400


# --------------------------------------------------------------------------- #
# A live subscription must stop billing
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_deletion_ends_a_live_subscription() -> None:
    """The email tells the user their subscription is cancelled — so it has to be true."""
    subscription = _subscription()
    svc = _service(_user(password_hash=None))

    result = await svc.request_account_deletion(_db(subscription), 42, None)

    assert subscription.status == "canceled"
    assert subscription.cancellation_reason == "account_deleted"
    assert isinstance(subscription.ended_at, datetime)
    assert result["had_subscription"] is True
    assert result["stripe_subscription_id"] == "sub_test_1"


@pytest.mark.asyncio
async def test_deletion_clears_the_founding_lock_with_the_subscription() -> None:
    subscription = _subscription()
    await _service(_user(password_hash=None)).request_account_deletion(_db(subscription), 42, None)
    assert subscription.is_founding is False
    assert subscription.stripe_schedule_id is None


@pytest.mark.asyncio
async def test_a_free_user_reports_no_subscription() -> None:
    """`had_subscription` drives a paragraph in the email; a free user must not be told their
    subscription was cancelled."""
    result = await _service(_user(password_hash=None)).request_account_deletion(_db(None), 42, None)
    assert result["had_subscription"] is False
    assert result["stripe_subscription_id"] is None


@pytest.mark.asyncio
async def test_deletion_does_not_call_stripe_itself() -> None:
    """The caller cancels AFTER the commit. Doing it here would provoke subscription webhooks that
    race this transaction — the same failure the refund path hit."""
    subscription = _subscription()
    with patch("app.services.billing_refund_service.BillingRefundService.cancel_in_stripe") as cancel:
        await _service(_user(password_hash=None)).request_account_deletion(_db(subscription), 42, None)
    cancel.assert_not_called()

"""
Complimentary plan grants
=========================

An admin gives a user a plan for a fixed period, free. The properties that matter are about
*boundaries* — when it starts applying, when it stops, and what happens when it collides with a
real subscription.

Three that would each be a customer-visible bug:

* **A lapsed grant must stop applying immediately.** Expiry is read-time (`ends_at` compared on
  every lookup) precisely so there is no sweep job to fall behind and no window where the row says
  one thing and enforcement does another.
* **A paid subscription outranks a grant.** Someone actually paying has a founding lock, a renewal
  date and invoices hanging off that subscription; a comp shadowing it would make every billing
  screen describe the wrong thing.
* **Granting again replaces, never stacks.** Two live grants would make the effective end date
  depend on which row sorted first.

No database: the queries are exercised through a stub that records what was asked for.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.plan_grant import GrantReason
from app.services.plan_grant_service import GRANT_DURATIONS, PlanGrantService

NOW = datetime.utcnow()


def _plan(code="pro", name="Pro", plan_id=2):
    """The REAL Plan model, not a MagicMock.

    A MagicMock invents any attribute you ask for, so a fixture with `is_free` on it made the
    controller's `plan.is_free` check pass in tests and raise AttributeError in production —
    `Plan` has no such column (that field belongs to the BillingPlanDisplay DTO). The real model
    is what makes a typo or a DTO/model mix-up fail here instead of at runtime.
    """
    from app.models.plan import Plan

    p = Plan()
    p.id, p.code, p.name = plan_id, code, name
    p.price_cents = 0 if code in ("free", "guest") else 799
    p.is_active = True
    p.is_assignable = True
    return p


def _user(user_id=42):
    u = MagicMock()
    u.id = user_id
    return u


def _grant(days_left=10, revoked=False, plan_id=2):
    g = MagicMock()
    g.id = 7
    g.user_id = 42
    g.plan_id = plan_id
    g.reason = GrantReason.TRIAL
    g.note = None
    g.starts_at = NOW - timedelta(days=1)
    g.ends_at = NOW + timedelta(days=days_left)
    g.revoked_at = NOW if revoked else None
    g.revoked_by = None
    return g


def _db(existing_grant=None):
    db = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = existing_grant
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


# --------------------------------------------------------------------------- #
# Durations
# --------------------------------------------------------------------------- #

def test_the_offered_durations_are_the_ones_asked_for() -> None:
    assert set(GRANT_DURATIONS) == {"3d", "7d", "14d", "1m", "3m"}
    assert [GRANT_DURATIONS[k]["days"] for k in ("3d", "7d", "14d", "1m", "3m")] == [3, 7, 14, 30, 90]


@pytest.mark.asyncio
async def test_an_unknown_duration_is_refused() -> None:
    """A fixed set, not a free-text number of days — "997" must not be one mis-key away."""
    with pytest.raises(ValueError, match="Unknown duration"):
        await PlanGrantService().grant(
            _db(), user=_user(), plan=_plan(), duration_code="99y", granted_by=1
        )


@pytest.mark.asyncio
async def test_an_unknown_reason_is_refused() -> None:
    with pytest.raises(ValueError, match="Unknown reason"):
        await PlanGrantService().grant(
            _db(), user=_user(), plan=_plan(), duration_code="7d", granted_by=1, reason="because"
        )


# --------------------------------------------------------------------------- #
# Granting
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_granting_sets_the_end_date_from_the_duration() -> None:
    db = _db()
    row = await PlanGrantService().grant(
        db, user=_user(), plan=_plan(), duration_code="14d", granted_by=9, reason=GrantReason.TRIAL
    )
    assert (row.ends_at - row.starts_at).days == 14
    assert row.granted_by == 9
    assert row.plan_id == 2
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_granting_records_who_and_why() -> None:
    row = await PlanGrantService().grant(
        _db(), user=_user(), plan=_plan(), duration_code="7d", granted_by=9,
        reason=GrantReason.GOODWILL, note="Apology for the outage",
    )
    assert row.reason == GrantReason.GOODWILL
    assert row.note == "Apology for the outage"


@pytest.mark.asyncio
async def test_granting_again_supersedes_the_live_one() -> None:
    """"Give them another month" means REPLACE. Two live grants would make the effective end date
    depend on which row happened to sort first."""
    existing = _grant(days_left=5)
    db = _db(existing_grant=existing)

    await PlanGrantService().grant(
        db, user=_user(), plan=_plan(), duration_code="1m", granted_by=9
    )

    assert existing.revoked_at is not None
    assert existing.revoked_by == 9


# --------------------------------------------------------------------------- #
# Revoking
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_revoking_stamps_the_row_rather_than_deleting_it() -> None:
    """"Comped for a week, taken away early" is exactly the history support needs."""
    existing = _grant()
    db = _db(existing_grant=existing)

    revoked = await PlanGrantService().revoke(db, user_id=42, revoked_by=9)

    assert revoked is existing
    assert existing.revoked_at is not None
    assert existing.revoked_by == 9
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_revoking_when_there_is_nothing_to_revoke_is_not_an_error() -> None:
    assert await PlanGrantService().revoke(_db(None), user_id=42, revoked_by=9) is None


# --------------------------------------------------------------------------- #
# Liveness — the boundaries
# --------------------------------------------------------------------------- #

def test_a_grant_inside_its_window_is_live() -> None:
    assert _grant_model(starts=-1, ends=+5).is_live() is True


def test_a_lapsed_grant_is_not_live() -> None:
    """Read-time expiry: no sweep job, so a grant stops applying the instant it lapses."""
    assert _grant_model(starts=-30, ends=-1).is_live() is False


def test_a_revoked_grant_is_not_live_even_inside_its_window() -> None:
    assert _grant_model(starts=-1, ends=+5, revoked=True).is_live() is False


def test_a_future_grant_is_not_yet_live() -> None:
    assert _grant_model(starts=+1, ends=+5).is_live() is False


def _grant_model(starts: int, ends: int, revoked: bool = False):
    from app.models.plan_grant import UserPlanGrant

    g = UserPlanGrant()
    g.starts_at = NOW + timedelta(days=starts)
    g.ends_at = NOW + timedelta(days=ends)
    g.revoked_at = NOW if revoked else None
    return g


# --------------------------------------------------------------------------- #
# What the API and both UIs read
# --------------------------------------------------------------------------- #

def test_describe_reports_the_plan_and_the_deadline() -> None:
    out = PlanGrantService.describe(_grant(days_left=10), _plan())
    assert out["plan_code"] == "pro"
    assert out["plan_name"] == "Pro"
    assert out["reason"] == GrantReason.TRIAL
    assert out["days_remaining"] >= 9


def test_describe_rounds_the_last_day_up() -> None:
    """With half a day left, "1 day remaining" is a better answer to a customer than "0" on
    something they demonstrably still have."""
    g = _grant()
    g.ends_at = NOW + timedelta(hours=12)
    assert PlanGrantService.describe(g, _plan())["days_remaining"] == 1


def test_describe_of_nothing_is_nothing() -> None:
    assert PlanGrantService.describe(None, _plan()) is None


# --------------------------------------------------------------------------- #
# The model is the contract
# --------------------------------------------------------------------------- #

def test_plan_has_no_is_free_column() -> None:
    """THE REGRESSION FOR A LIVE 500.

    The grant endpoint read `plan.is_free` to reject granting a free plan. `Plan` has no such
    column — `is_free` belongs to `BillingPlanDisplay`, the DTO the pricing page consumes. The
    AttributeError was swallowed by a broad `except`, so the admin saw only "Failed to grant plan"
    and nothing was logged with a stack trace.

    If `is_free` is ever added to the model this fails, which is the prompt to simplify the
    controller back — not a reason to delete the test.
    """
    from app.models.plan import Plan

    columns = {c.name for c in Plan.__table__.columns}
    assert "is_free" not in columns
    # What the check uses instead must all genuinely exist.
    assert {"code", "price_cents", "is_active", "is_assignable"} <= columns


def test_the_real_plan_model_rejects_invented_attributes() -> None:
    """Guards the fixture itself: if `_plan()` ever goes back to a MagicMock, this stops being
    true and the DTO/model confusion can silently return."""
    p = _plan()
    assert not hasattr(p, "is_free")

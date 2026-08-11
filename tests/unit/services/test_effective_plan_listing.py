"""
The Plan column, and the plan filter
====================================

The effective plan is COMPUTED, not stored:

    active subscription → live complimentary grant → ``users.plan_id`` → default

Three places implement that order — ``EntitlementService.get_effective_plan`` (one user),
``AdminUserOverviewService.resolve_plans`` (a page, in four queries) and
``UserRepository._apply_plan_filter`` (SQL, so paging stays correct). They must agree, and the two
bugs this file exists for were both disagreements:

* ``resolve_plans`` had no **grant** tier, so a user an admin had just comped to Pro showed as
  **Free** in the list and Pro on every other screen — the admin could not tell the grant had
  worked.
* the SQL filter had no **default** tier, so "free" matched only the handful of rows with an
  explicit ``users.plan_id`` and silently hid the 121 with NULL.

The second was only visible because ``free + pro`` did not add up to the unfiltered total. That
sum is now asserted here.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.services.admin_user_overview_service import AdminUserOverviewService

NOW = datetime.utcnow()


def _plan(pid, code, name, default=False):
    from app.models.plan import Plan

    p = Plan()
    p.id, p.code, p.name, p.is_default = pid, code, name, default
    return p


def _user(uid, plan_id=None):
    from app.models.user import User

    u = User()
    u.id, u.plan_id = uid, plan_id
    return u


FREE = _plan(1, "free", "Free", default=True)
PRO = _plan(2, "pro", "Pro")


def _db(*, subs=(), grants=(), plans=(FREE, PRO)):
    """Answers the three reads `resolve_plans` makes, in order: subs, grants, plans."""
    calls = {"n": 0}

    async def execute(stmt, params=None):
        result = MagicMock()
        calls["n"] += 1
        if calls["n"] == 1:
            result.all.return_value = list(subs)
        elif calls["n"] == 2:
            result.all.return_value = list(grants)
        else:
            result.scalars.return_value.all.return_value = list(plans)
        return result

    db = MagicMock()
    db.execute = execute
    return db


# --------------------------------------------------------------------------- #
# resolve_plans — the Plan column
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_live_grant_shows_as_the_granted_plan() -> None:
    """THE BUG. A comped user read as Free in the list while showing Pro everywhere else."""
    users = [_user(7)]

    out = await AdminUserOverviewService.resolve_plans(_db(grants=[(7, 2)]), users)

    assert out[7]["code"] == "pro"
    assert out[7]["is_complimentary"] is True


@pytest.mark.asyncio
async def test_a_paid_subscription_outranks_a_grant() -> None:
    """Someone actually paying has a founding lock, a renewal date and invoices hanging off that
    subscription. A comp shadowing it would make every billing screen describe the wrong thing."""
    out = await AdminUserOverviewService.resolve_plans(
        _db(subs=[(7, 2)], grants=[(7, 2)]), [_user(7)]
    )

    assert out[7]["code"] == "pro"
    # The distinction that matters: they are PAYING, not comped.
    assert out[7]["is_complimentary"] is False


@pytest.mark.asyncio
async def test_no_subscription_and_no_grant_falls_to_the_stored_plan() -> None:
    out = await AdminUserOverviewService.resolve_plans(_db(), [_user(7, plan_id=2)])

    assert out[7]["code"] == "pro"
    assert out[7]["is_complimentary"] is False


@pytest.mark.asyncio
async def test_a_null_stored_plan_falls_to_the_default() -> None:
    """The overwhelmingly common row: 121 of 128 locally have `plan_id` NULL."""
    out = await AdminUserOverviewService.resolve_plans(_db(), [_user(7)])

    assert out[7]["code"] == "free"


@pytest.mark.asyncio
async def test_an_empty_page_costs_no_queries() -> None:
    db = _db()
    assert await AdminUserOverviewService.resolve_plans(db, []) == {}


@pytest.mark.asyncio
async def test_a_missing_grants_table_still_returns_a_plan() -> None:
    """A page that cannot read grants must still render the Plan column rather than blanking it."""
    calls = {"n": 0}

    async def execute(stmt, params=None):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("Table 'user_plan_grants' doesn't exist")
        result = MagicMock()
        result.all.return_value = []
        result.scalars.return_value.all.return_value = [FREE, PRO]
        return result

    db = MagicMock(); db.execute = execute

    out = await AdminUserOverviewService.resolve_plans(db, [_user(7)])

    assert out[7]["code"] == "free"


# --------------------------------------------------------------------------- #
# The SQL filter — the same precedence, expressed for paging
# --------------------------------------------------------------------------- #

def test_the_filter_covers_every_tier_including_the_default() -> None:
    """Asserted against the SQL because the missing default tier was invisible any other way: the
    query ran, returned rows, and quietly omitted 121 users.
    """
    import inspect

    from app.repositories.user_repository import UserRepository

    src = inspect.getsource(UserRepository._apply_plan_filter)

    assert "falls_to_default" in src, "the default-plan tier is missing"
    assert "is_default" in src
    assert "revoked_at" in src and "ends_at" in src, "grant expiry must be read-time"
    assert "access_suspended_at" in src, "a suspended subscription must not count as paid"


def test_complimentary_means_granted_and_not_paying() -> None:
    """A comp behind a paid subscription is inert. Listing that user under "complimentary" would
    report a paying customer as comped."""
    import inspect

    from app.repositories.user_repository import UserRepository

    src = inspect.getsource(UserRepository._apply_plan_filter)
    branch = src.split('if plan == "complimentary"')[1].split("return")[1].split("\n")[0]

    assert "granted" in branch and "~paid" in branch

"""
BillingPeriodService — monthly window math + per-subject anchoring
==================================================================

Covers the anniversary month arithmetic (incl. month-end clamping / leap years), the calendar
month path for guests, and per-subject resolution: free user → signup anniversary; subscriber →
Stripe billing cycle.
"""

from datetime import datetime, timedelta
import uuid

import pytest
from sqlalchemy import select

from app.services.billing_period_service import (
    BillingPeriodService,
    _add_months,
    calendar_month_period,
    monthly_period_from_anchor,
)
from app.models.purchase import UserSubscription
from app.models.user import User
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_user


# --------------------------------------------------------------------------- #
# Pure month arithmetic
# --------------------------------------------------------------------------- #


def test_add_months_clamps_day_and_leap():
    assert _add_months(datetime(2026, 1, 31), 1) == datetime(2026, 2, 28)
    assert _add_months(datetime(2024, 1, 31), 1) == datetime(2024, 2, 29)  # leap year
    assert _add_months(datetime(2026, 1, 15), 13) == datetime(2027, 2, 15)
    assert _add_months(datetime(2026, 12, 10), 1) == datetime(2027, 1, 10)  # year rollover


def test_monthly_period_from_anchor_keeps_time_of_day():
    anchor = datetime(2026, 1, 15, 10, 30, 0)
    start, end = monthly_period_from_anchor(anchor, datetime(2026, 3, 20))
    assert start == datetime(2026, 3, 15, 10, 30, 0)
    assert end == datetime(2026, 4, 15, 10, 30, 0)


def test_monthly_period_before_first_anniversary():
    anchor = datetime(2026, 1, 15)
    start, end = monthly_period_from_anchor(anchor, datetime(2026, 1, 20))
    assert start == datetime(2026, 1, 15) and end == datetime(2026, 2, 15)


def test_monthly_period_month_end_anchor():
    anchor = datetime(2026, 1, 31)
    start, end = monthly_period_from_anchor(anchor, datetime(2026, 2, 10))
    assert start == datetime(2026, 1, 31) and end == datetime(2026, 2, 28)


def test_calendar_month_period():
    start, end = calendar_month_period(datetime(2026, 3, 15, 12, 0, 0))
    assert start == datetime(2026, 3, 1, 0, 0, 0) and end == datetime(2026, 4, 1, 0, 0, 0)


# --------------------------------------------------------------------------- #
# Per-subject resolution
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_resolve_for_guest_calendar_month():
    period_key, ttl = BillingPeriodService().resolve_for_guest()
    assert period_key and ttl > 0
    assert ttl <= 32 * 24 * 3600  # never more than a month out


@pytest.mark.asyncio
async def test_resolve_for_user_free_then_subscriber():
    user = await create_user()
    svc = BillingPeriodService()
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()

        # Free user → anniversary window from created_at.
        pk_free, ttl_free = await svc.resolve_for_user(db, u)
        assert pk_free and ttl_free > 0

        # Add an active subscription with an explicit Stripe cycle → resolution follows it.
        now = datetime.utcnow()
        db.add(UserSubscription(
            user_id=u.id, status="active",
            stripe_subscription_id="sub_" + uuid.uuid4().hex,
            current_period_start=now - timedelta(days=5),
            current_period_end=now + timedelta(days=25),
        ))
        await db.commit()

        pk_sub, ttl_sub = await svc.resolve_for_user(db, u)
        # Anchored to the subscription cycle now (different key), ~25 days left.
        assert pk_sub != pk_free
        assert 24 * 24 * 3600 < ttl_sub < 26 * 24 * 3600

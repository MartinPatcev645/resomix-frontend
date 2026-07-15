"""
Billing Period Service
======================

Resolves the current **monthly** usage window (a stable period key + a TTL to its end) for a
subject, so per-month counters reset on the right boundary per user type:

  * **Subscriber** → the Stripe billing cycle (``subscription.current_period_start/end``).
  * **Free user**  → monthly, anchored to signup date (anniversary reset — "resets when you join").
  * **Guest**      → calendar month (no persistent join date).

All datetimes are treated as **naive UTC** to match the DB columns (``users.created_at``,
``user_subscriptions.current_period_*`` are stored UTC-naive). The period key is only required to
be unique per period *for a given subject* (the counter key already includes the subject id).

Version: 1.0.0
Init Date: July 5, 2026
"""

import calendar
from datetime import datetime
from typing import Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES
from app.models.purchase import UserSubscription
from app.models.user import User

_TTL_BUFFER_SECONDS = 60  # small buffer so the key survives just past the boundary


def _now() -> datetime:
    return datetime.utcnow()  # naive UTC, matches the DB columns


def _add_months(dt: datetime, months: int) -> datetime:
    """Add calendar months, clamping the day to the target month's length (Jan 31 → Feb 28)."""
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def monthly_period_from_anchor(anchor: datetime, now: datetime) -> Tuple[datetime, datetime]:
    """Current ``[start, end)`` monthly period anchored to ``anchor`` (anniversary-based)."""
    months = (now.year - anchor.year) * 12 + (now.month - anchor.month)
    start = _add_months(anchor, months)
    if start > now:
        months -= 1
        start = _add_months(anchor, months)
    end = _add_months(anchor, months + 1)
    return start, end


def calendar_month_period(now: datetime) -> Tuple[datetime, datetime]:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, _add_months(start, 1)


class BillingPeriodService:
    """Resolve ``(period_key, ttl_seconds)`` for the current monthly window of a subject."""

    @staticmethod
    def _key_and_ttl(start: datetime, end: datetime, now: datetime) -> Tuple[str, int]:
        period_key = start.strftime("%Y%m%d%H%M%S")
        ttl = int((end - now).total_seconds()) + _TTL_BUFFER_SECONDS
        return period_key, max(ttl, _TTL_BUFFER_SECONDS)

    async def resolve_window_for_user(
        self, db: AsyncSession, user: User
    ) -> Tuple[datetime, datetime, str, int]:
        """Full window: (period_start, period_end, period_key, ttl_seconds)."""
        now = _now()
        sub = (await db.execute(
            select(UserSubscription).where(
                UserSubscription.user_id == user.id,
                UserSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
            )
        )).scalar_one_or_none()

        if sub and sub.current_period_start and sub.current_period_end:
            # Subscriber: align exactly to the Stripe billing cycle.
            start, end = sub.current_period_start, sub.current_period_end
            if end <= now:  # stale period (webhook lag) → fall back to anniversary from its start
                start, end = monthly_period_from_anchor(sub.current_period_start, now)
        else:
            # Free user: monthly anniversary of the signup date.
            anchor = user.created_at or now
            start, end = monthly_period_from_anchor(anchor, now)

        key, ttl = self._key_and_ttl(start, end, now)
        return start, end, key, ttl

    async def resolve_for_user(self, db: AsyncSession, user: User) -> Tuple[str, int]:
        _start, _end, key, ttl = await self.resolve_window_for_user(db, user)
        return key, ttl

    def resolve_window_for_guest(self) -> Tuple[datetime, datetime, str, int]:
        now = _now()
        start, end = calendar_month_period(now)
        key, ttl = self._key_and_ttl(start, end, now)
        return start, end, key, ttl

    def resolve_for_guest(self) -> Tuple[str, int]:
        _start, _end, key, ttl = self.resolve_window_for_guest()
        return key, ttl

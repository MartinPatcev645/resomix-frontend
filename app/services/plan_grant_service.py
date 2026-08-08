"""
Complimentary Plan Grants
=========================

An admin gives a user a plan for a fixed period, free. No money moves and no Stripe object is
created — the grant is entirely ours.

WHERE IT SITS IN THE ENTITLEMENT ORDER

``EntitlementService.get_effective_plan`` resolves: **paid subscription → live grant →
users.plan_id → default**.

A paid subscription wins over a grant deliberately. Someone who is actually paying has a founding
lock, a renewal date and an invoice history that all hang off that subscription; letting a comp
shadow it would make the profile screen describe the wrong thing. A grant on top of a subscription
is therefore inert until the subscription lapses — at which point it takes over, which is usually
exactly what support intended when they added it.

EXPIRY IS READ-TIME

Nothing sweeps this table. ``ends_at`` is compared on each lookup, so a grant stops applying the
instant it lapses. No cron to fall behind, no window where the row says one thing and enforcement
does another, and no job to forget to deploy.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Plan
from app.models.plan_grant import GrantReason, UserPlanGrant
from app.models.user import User

logger = logging.getLogger(__name__)

# The durations an admin can pick. A fixed set rather than a free-text number of days: every option
# here is a deliberate product decision, and "997 days" should not be one click away.
#
# Keyed by a stable code so the UI, the API and the audit log all name the same thing.
GRANT_DURATIONS: Dict[str, Dict[str, Any]] = {
    "3d": {"label": "3 days", "days": 3},
    "7d": {"label": "7 days", "days": 7},
    "14d": {"label": "14 days", "days": 14},
    "1m": {"label": "1 month", "days": 30},
    "3m": {"label": "3 months", "days": 90},
}


class PlanGrantService:
    """Grants, revokes and resolves complimentary plans."""

    # ------------------------------------------------------------------ #
    # Read
    # ------------------------------------------------------------------ #
    @staticmethod
    async def active_grant(
        db: AsyncSession, user_id: int, now: Optional[datetime] = None
    ) -> Optional[UserPlanGrant]:
        """The live grant for this user, or None.

        Ordered by ``ends_at`` DESC so that if two overlap — support adding a second before the
        first lapses — the one that runs longest wins. Anything else would shorten a grant by
        adding to it.
        """
        now = now or datetime.utcnow()
        return (
            await db.execute(
                select(UserPlanGrant)
                .where(
                    UserPlanGrant.user_id == user_id,
                    UserPlanGrant.revoked_at.is_(None),
                    UserPlanGrant.starts_at <= now,
                    UserPlanGrant.ends_at > now,
                )
                .order_by(UserPlanGrant.ends_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    @staticmethod
    async def history(db: AsyncSession, user_id: int, limit: int = 20) -> List[UserPlanGrant]:
        """Every grant this user has ever had, newest first — including lapsed and revoked ones.

        Support needs "has this account been comped before?" as much as "is it comped now": a
        second free month is a different conversation from a first.
        """
        return list(
            (
                await db.execute(
                    select(UserPlanGrant)
                    .where(UserPlanGrant.user_id == user_id)
                    .order_by(UserPlanGrant.id.desc())
                    .limit(limit)
                )
            ).scalars().all()
        )

    @staticmethod
    def describe(grant: Optional[UserPlanGrant], plan: Optional[Plan] = None) -> Optional[Dict[str, Any]]:
        """The grant as the API and both UIs consume it.

        ``days_remaining`` is rounded UP: with 30 minutes left, "1 day remaining" is a better
        answer for a customer than "0 days remaining" on something they still have.
        """
        if grant is None:
            return None
        now = datetime.utcnow()
        remaining_seconds = (grant.ends_at - now).total_seconds()
        days = max(0, math.ceil(remaining_seconds / 86400))
        return {
            "plan_code": plan.code if plan else None,
            "plan_name": plan.name if plan else None,
            "reason": grant.reason,
            "note": grant.note,
            "starts_at": grant.starts_at.isoformat(),
            "ends_at": grant.ends_at.isoformat(),
            "days_remaining": days,
        }

    # ------------------------------------------------------------------ #
    # Write
    # ------------------------------------------------------------------ #
    async def grant(
        self,
        db: AsyncSession,
        *,
        user: User,
        plan: Plan,
        duration_code: str,
        granted_by: Optional[int],
        reason: str = GrantReason.TRIAL,
        note: Optional[str] = None,
    ) -> UserPlanGrant:
        """Give a user a plan, free, for a fixed period.

        Any live grant is revoked first. Two overlapping grants are never what an admin means by
        "give them another month" — they mean *replace*, and leaving both would make the effective
        end date depend on which row happened to sort first.
        """
        spec = GRANT_DURATIONS.get(duration_code)
        if spec is None:
            raise ValueError(
                f"Unknown duration {duration_code!r}. Expected one of: {', '.join(GRANT_DURATIONS)}"
            )
        if reason not in GrantReason.ALL:
            raise ValueError(f"Unknown reason {reason!r}")

        now = datetime.utcnow()
        existing = await self.active_grant(db, user.id, now)
        if existing is not None:
            existing.revoked_at = now
            existing.revoked_by = granted_by
            logger.info(
                "GRANT: superseding live grant %s for user %s", existing.id, user.id
            )

        row = UserPlanGrant(
            user_id=user.id,
            plan_id=plan.id,
            granted_by=granted_by,
            reason=reason,
            note=note,
            starts_at=now,
            ends_at=now + timedelta(days=spec["days"]),
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

        logger.info(
            "GRANT: user %s given %s free for %s (until %s) by admin %s",
            user.id, plan.code, spec["label"], row.ends_at, granted_by,
        )
        return row

    async def revoke(
        self, db: AsyncSession, *, user_id: int, revoked_by: Optional[int]
    ) -> Optional[UserPlanGrant]:
        """End a live grant now. Returns the grant that was ended, or None if there wasn't one.

        The row is kept and stamped rather than deleted: "this account was comped for a week and
        it was taken away early" is exactly the history support needs, and a DELETE erases it.
        """
        grant = await self.active_grant(db, user_id)
        if grant is None:
            return None
        grant.revoked_at = datetime.utcnow()
        grant.revoked_by = revoked_by
        await db.commit()
        logger.info("GRANT: grant %s for user %s revoked by admin %s", grant.id, user_id, revoked_by)
        return grant

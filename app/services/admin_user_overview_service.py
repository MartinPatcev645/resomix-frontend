"""
Admin User Overview
===================

Everything an admin needs about one user on one screen: who they are, when they were last here,
what they are paying, what they have made, and whether they have ever been in touch.

WHY THIS IS A SEPARATE ENDPOINT

It is roughly a dozen aggregates. Putting them on the LIST endpoint would make every page of the
users table pay for detail nobody is looking at, and putting them on the existing detail endpoint
would slow the edit dialog for the same reason. This is only fetched when someone opens the page.

WHY ONE QUERY

An async SQLAlchemy session cannot run queries concurrently — awaiting twelve counts in a loop is
twelve sequential round trips. They are folded into a single SELECT of scalar subqueries instead:
one trip, and MySQL evaluates each subquery against an index on `user_id`.

"Last activity" and "last login" are deliberately different questions:

* ``users.last_seen_at`` — the last authenticated request, written by a throttled touch in the auth
  dependency. Nothing else in the schema can answer this: ``system_logs`` records the endpoint and
  the IP but has **no user_id**, so a request cannot be attributed to a person.
* ``MAX(user_sessions.created_at)`` — the last time they signed in, which is a different thing. A
  session opened in January and used daily since would still report January.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

# One scalar subquery per figure. Kept as data rather than a dozen awaits so the whole shape of the
# screen is readable in one place, and so a new count is one line.
_COUNTS: tuple[tuple[str, str], ...] = (
    ("playlists", "SELECT COUNT(*) FROM playlists WHERE user_id = :uid"),
    ("tracks", "SELECT COUNT(*) FROM tracks WHERE user_id = :uid"),
    ("analyses", "SELECT COUNT(*) FROM track_analysis_results WHERE user_id = :uid"),
    ("track_ratings", "SELECT COUNT(*) FROM track_ratings WHERE user_id = :uid"),
    ("playlist_ratings", "SELECT COUNT(*) FROM playlist_ratings WHERE user_id = :uid"),
    ("favourites", "SELECT COUNT(*) FROM user_track_engagements WHERE user_id = :uid AND is_favorite = 1"),
    ("contacts", "SELECT COUNT(*) FROM contacts WHERE user_id = :uid"),
    ("feedbacks", "SELECT COUNT(*) FROM feedbacks WHERE user_id = :uid"),
    ("invoices", "SELECT COUNT(*) FROM billing_invoices WHERE user_id = :uid"),
    ("orders", "SELECT COUNT(*) FROM orders WHERE user_id = :uid"),
    ("active_sessions",
     "SELECT COUNT(*) FROM user_sessions WHERE user_id = :uid AND revoked_at IS NULL "
     "AND (expires_at IS NULL OR expires_at > NOW())"),
    ("total_spend_cents",
     "SELECT COALESCE(SUM(amount_paid_cents), 0) FROM billing_invoices "
     "WHERE user_id = :uid AND status = 'paid'"),
)


def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _role_names(user: User) -> list:
    """Role names, without letting a half-loaded relationship take the page down.

    The nested `UserRole.role` must be eager-loaded (see `async_get_user_with_roles`); reading it
    lazily under async SQLAlchemy raises `MissingGreenlet` — which is exactly how one list
    comprehension 500'd this whole screen. The loader is fixed, but this page is what an admin
    opens when something is already wrong, so it should not be the second casualty if another
    caller ever passes in a differently-loaded user.
    """
    try:
        return [r.role.name for r in (user.roles or [])]
    except Exception as exc:  # noqa: BLE001
        logger.warning("OVERVIEW: roles unavailable for user %s: %s", user.id, exc)
        return []


class AdminUserOverviewService:
    """Assembles the per-user admin overview."""

    async def counts(self, db: AsyncSession, user_id: int) -> Dict[str, int]:
        """Every figure on the screen, in one round trip.

        Degrades rather than fails: a table this deployment does not have yet (or cannot read)
        must not blank the whole page, so the fallback runs the subqueries individually and
        reports what it could get.
        """
        select_list = ", ".join(f"({sql}) AS `{name}`" for name, sql in _COUNTS)
        try:
            row = (await db.execute(text(f"SELECT {select_list}"), {"uid": user_id})).mappings().first()
            return {k: int(v or 0) for k, v in dict(row or {}).items()}
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: combined count query failed for user %s: %s", user_id, exc)
            return await self._counts_individually(db, user_id)

    @staticmethod
    async def _counts_individually(db: AsyncSession, user_id: int) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for name, sql in _COUNTS:
            try:
                out[name] = int((await db.execute(text(sql), {"uid": user_id})).scalar() or 0)
            except Exception:  # noqa: BLE001
                out[name] = -1  # "unavailable", distinct from a real zero
        return out

    async def last_session(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Most recent sign-in and the address it came from.

        `user_sessions` is the only place an IP is retained per user; `system_logs` has IPs but no
        user id, so it cannot answer "which IP was THIS person on".
        """
        try:
            row = (
                await db.execute(
                    text(
                        "SELECT created_at, ip_address, user_agent FROM user_sessions "
                        "WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1"
                    ),
                    {"uid": user_id},
                )
            ).first()
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: could not read sessions for user %s: %s", user_id, exc)
            return {"last_login": None, "last_ip": None, "last_user_agent": None}

        if not row:
            return {"last_login": None, "last_ip": None, "last_user_agent": None}
        return {"last_login": _iso(row[0]), "last_ip": row[1], "last_user_agent": row[2]}

    async def subscription(self, db: AsyncSession, user_id: int) -> Optional[Dict[str, Any]]:
        """Current plan and subscription state, worded the same way the customer sees it.

        Reuses `BillingService.cancellation_state` rather than re-deriving: support and the
        customer must not be looking at two different answers to "is this cancelling?".
        """
        from sqlalchemy import select

        from app.models.plan import Plan
        from app.models.purchase import UserSubscription
        from app.services.billing_service import BillingService

        row = (
            await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
        ).scalar_one_or_none()
        if row is None:
            return None

        plan = None
        if row.plan_id:
            plan = (await db.execute(select(Plan).where(Plan.id == row.plan_id))).scalar_one_or_none()

        return {
            "plan_code": plan.code if plan else None,
            "plan_name": plan.name if plan else None,
            "status": row.status,
            "currency": row.currency,
            "current_period_end": _iso(row.current_period_end),
            "is_founding": bool(row.is_founding),
            "founding_lock_ends_at": _iso(row.founding_lock_ends_at),
            "access_suspended_at": _iso(row.access_suspended_at),
            "access_suspended_reason": row.access_suspended_reason,
            "cancellation": BillingService.cancellation_state(row),
            "stripe_subscription_id": row.stripe_subscription_id,
            "stripe_customer_id": row.stripe_customer_id,
        }

    async def grants(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """The live complimentary plan, plus the history of every past one.

        Degrades rather than failing, like `counts`. `user_plan_grants` is newer than this page:
        on a deployment where the migration has not run yet, an unguarded query here would take
        down the WHOLE user profile instead of hiding one card.
        """
        from sqlalchemy import select

        from app.models.plan import Plan
        from app.services.plan_grant_service import PlanGrantService

        try:
            return await self._grants(db, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: grants unavailable for user %s: %s", user_id, exc)
            return {"grant": None, "grant_history": []}

    async def _grants(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        from sqlalchemy import select

        from app.models.plan import Plan
        from app.services.plan_grant_service import PlanGrantService

        live = await PlanGrantService.active_grant(db, user_id)
        plan = None
        if live is not None and live.plan_id:
            plan = (await db.execute(select(Plan).where(Plan.id == live.plan_id))).scalar_one_or_none()

        past = await PlanGrantService.history(db, user_id)
        plans = {
            p.id: p for p in (await db.execute(select(Plan))).scalars().all()
        }
        return {
            "grant": PlanGrantService.describe(live, plan),
            "grant_history": [
                {
                    "id": g.id,
                    "plan_name": plans[g.plan_id].name if g.plan_id in plans else None,
                    "reason": g.reason,
                    "note": g.note,
                    "starts_at": _iso(g.starts_at),
                    "ends_at": _iso(g.ends_at),
                    "revoked_at": _iso(g.revoked_at),
                }
                for g in past
            ],
        }

    async def recent(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """The latest contact and feedback, so an admin sees what they said without leaving.

        Truncated: the page shows enough to recognise the conversation, and the full text lives on
        the contact/feedback screens that already exist.
        """
        out: Dict[str, Any] = {"latest_contact": None, "latest_feedback": None}
        try:
            row = (
                await db.execute(
                    text(
                        "SELECT id, subject, LEFT(message, 300), status, submitted_at "
                        "FROM contacts WHERE user_id = :uid ORDER BY submitted_at DESC LIMIT 1"
                    ),
                    {"uid": user_id},
                )
            ).first()
            if row:
                out["latest_contact"] = {
                    "id": row[0], "subject": row[1], "excerpt": row[2],
                    "status": row[3], "submitted_at": _iso(row[4]),
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: contacts unavailable for user %s: %s", user_id, exc)

        try:
            row = (
                await db.execute(
                    text(
                        "SELECT id, category, LEFT(message, 300), satisfaction, status, submitted_at "
                        "FROM feedbacks WHERE user_id = :uid ORDER BY submitted_at DESC LIMIT 1"
                    ),
                    {"uid": user_id},
                )
            ).first()
            if row:
                out["latest_feedback"] = {
                    "id": row[0], "category": row[1], "excerpt": row[2],
                    "satisfaction": row[3], "status": row[4], "submitted_at": _iso(row[5]),
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: feedbacks unavailable for user %s: %s", user_id, exc)

        return out

    async def invoices(self, db: AsyncSession, user_id: int, limit: int = 12) -> list[Dict[str, Any]]:
        try:
            rows = (
                await db.execute(
                    text(
                        "SELECT stripe_invoice_id, amount_paid_cents, currency, status, "
                        "       period_start, period_end, hosted_invoice_url, created_at "
                        "FROM billing_invoices WHERE user_id = :uid "
                        "ORDER BY created_at DESC LIMIT :lim"
                    ),
                    {"uid": user_id, "lim": limit},
                )
            ).fetchall()
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: invoices unavailable for user %s: %s", user_id, exc)
            return []
        return [
            {
                "stripe_invoice_id": r[0], "amount_paid_cents": r[1], "currency": r[2],
                "status": r[3], "period_start": _iso(r[4]), "period_end": _iso(r[5]),
                "hosted_invoice_url": r[6], "created_at": _iso(r[7]),
            }
            for r in rows
        ]

    @staticmethod
    async def resolve_plans(db: AsyncSession, users: list[User]) -> Dict[int, Dict[str, str]]:
        """Effective plan for a whole PAGE of users, in three queries rather than 2N.

        The users table shows a Plan column, and calling `get_effective_plan` per row would be a
        hundred queries for a fifty-row page. This mirrors that function's precedence exactly —
        active subscription → `users.plan_id` → default — but resolves the whole page at once.

        Kept deliberately close to the original: if the precedence there ever changes, this is the
        other place that has to change with it.
        """
        from sqlalchemy import select

        from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES
        from app.models.plan import Plan
        from app.models.purchase import UserSubscription

        if not users:
            return {}
        user_ids = [u.id for u in users]

        subs = (
            await db.execute(
                select(UserSubscription.user_id, UserSubscription.plan_id).where(
                    UserSubscription.user_id.in_(user_ids),
                    UserSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
                    UserSubscription.plan_id.isnot(None),
                    UserSubscription.access_suspended_at.is_(None),
                )
            )
        ).all()
        sub_plan = {uid: pid for uid, pid in subs}

        plans = {p.id: p for p in (await db.execute(select(Plan))).scalars().all()}
        default = next((p for p in plans.values() if p.is_default), None)

        out: Dict[int, Dict[str, str]] = {}
        for user in users:
            plan = plans.get(sub_plan.get(user.id)) or plans.get(user.plan_id) or default
            if plan:
                out[user.id] = {"code": plan.code, "name": plan.name}
        return out

    async def _safe(self, label: str, user_id: int, coro_factory, fallback):
        """Run one section of the page, or fall back.

        THE WHOLE SCREEN MUST NOT DIE FOR ONE CARD. This page is what an admin opens when something
        is already wrong, so a single unreadable table taking it down is the worst possible moment
        to be strict — and it is also how a missing migration turned into a blank 500 rather than a
        page with one section missing.

        Each failure is logged, so a degraded card is visible in the logs rather than silent.
        """
        try:
            return await coro_factory()
        except Exception as exc:  # noqa: BLE001
            logger.warning("OVERVIEW: %s unavailable for user %s: %s", label, user_id, exc)
            return fallback

    async def build(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """The whole screen. Every section degrades independently — see `_safe`."""
        from app.services.entitlement_service import EntitlementService

        async def _plan():
            plan = await EntitlementService().get_effective_plan(db, user)
            return {"code": plan.code, "name": plan.name} if plan else None

        effective_plan = await self._safe("effective plan", user.id, _plan, None)

        return {
            "identity": {
                "id": user.id,
                "uuid": user.uuid,
                # Needed by the "view their tracks" link — that endpoint requires a partner.
                "partner_id": user.partner_id,
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "profile_picture": user.profile_picture,
                "roles": _role_names(user),
                "is_active": user.is_active,
                "is_email_verified": user.is_email_verified,
                "is_two_factor_enabled": user.is_two_factor_enabled,
                "language": user.language,
                "timezone": user.timezone,
                "created_at": _iso(user.created_at),
            },
            "activity": {
                # Different questions — see the module docstring.
                "last_seen_at": _iso(user.last_seen_at),
                **await self._safe("sessions", user.id, lambda: self.last_session(db, user.id),
                                   {"last_login": None, "last_ip": None, "last_user_agent": None}),
            },
            "lifecycle": {
                "deactivated_at": _iso(user.deactivated_at),
                "deactivation_reason": user.deactivation_reason,
                "deletion_requested_at": _iso(user.deletion_requested_at),
                "purge_due_at": _iso(user.purge_due_at),
            },
            # The plan they ACTUALLY get, which is not always the subscription's: a chargeback
            # suspension or a cancelled subscription both make these two disagree, and that gap is
            # exactly what an admin is looking for.
            "effective_plan": effective_plan,
            "subscription": await self._safe("subscription", user.id,
                                             lambda: self.subscription(db, user.id), None),
            # Complimentary access, and whether this account has been comped before — a second
            # free month is a different conversation from a first.
            **await self._safe("grants", user.id, lambda: self.grants(db, user.id),
                               {"grant": None, "grant_history": []}),
            "counts": await self._safe("counts", user.id, lambda: self.counts(db, user.id), {}),
            "support": await self._safe("support", user.id, lambda: self.recent(db, user.id),
                                        {"latest_contact": None, "latest_feedback": None}),
            "invoices": await self._safe("invoices", user.id, lambda: self.invoices(db, user.id), []),
        }

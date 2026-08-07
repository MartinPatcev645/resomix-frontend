"""
Consumer Billing Sync (Stripe webhook write-back)
=================================================

Mirrors Stripe consumer-subscription state into our DB. Called from WebhookService for
``customer.subscription.*`` and ``invoice.*`` events. Methods do NOT commit — the webhook handler
owns the transaction (add/flush only). Idempotency is handled upstream (dedupe by Stripe event id).

The effective plan is resolved live from ``user_subscriptions`` (EntitlementService), so writing the
row here is all that's needed — no cache bust.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingInvoice, SubscriptionEvent
from app.models.plan import PlanPrice
from app.models.purchase import UserSubscription
from app.models.user import User

logger = logging.getLogger(__name__)


def _ts(value: Optional[int]) -> Optional[datetime]:
    """Unix epoch → UTC-naive datetime (matches the timezone-naive billing columns)."""
    if not value:
        return None
    try:
        return datetime.utcfromtimestamp(int(value))
    except (ValueError, TypeError, OSError):
        return None


def _invoice_subscription_id(inv: Dict[str, Any]) -> Optional[str]:
    """The subscription id an invoice belongs to, across API versions.

    Stripe "Basil" (2025-03-31) deprecated the top-level ``invoice.subscription`` field and moved it
    to ``invoice.parent.subscription_details.subscription`` (see
    docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects). We read
    the new location first (it can be an id string OR an expanded object), then fall back to the
    legacy field so both old and new API versions work.
    """
    parent = inv.get("parent") or {}
    sub_details = (parent.get("subscription_details") or {}) if isinstance(parent, dict) else {}
    sub = sub_details.get("subscription") if isinstance(sub_details, dict) else None
    if isinstance(sub, dict):
        sub = sub.get("id")
    return sub or inv.get("subscription")


class BillingSyncService:
    """Applies Stripe subscription/invoice events to user_subscriptions / billing_invoices /
    subscription_events."""

    async def _user_by_id(self, db: AsyncSession, user_id: Any) -> Optional[User]:
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            return None
        return (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()

    async def _user_by_customer(self, db: AsyncSession, customer_id: Optional[str]) -> Optional[User]:
        if not customer_id:
            return None
        return (
            await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        ).scalar_one_or_none()

    async def _plan_id_for_price(self, db: AsyncSession, stripe_price_id: Optional[str]) -> Optional[int]:
        if not stripe_price_id:
            return None
        row = (
            await db.execute(select(PlanPrice.plan_id).where(PlanPrice.stripe_price_id == stripe_price_id))
        ).first()
        return row[0] if row else None

    async def _get_subscription_row(self, db: AsyncSession, user_id: int) -> Optional[UserSubscription]:
        return (
            await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
        ).scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # subscription_schedule.* — the founding lock (pricing v2.1 F3)
    # ------------------------------------------------------------------ #
    async def sync_schedule(self, db: AsyncSession, schedule: Dict[str, Any], event_type: str) -> None:
        """Mirror a subscription schedule's state onto the local subscription row.

        Stripe *enforces* the founding lock; this only keeps our copy honest so support and the
        profile screen can answer "am I still on the founding rate?" without a round-trip.

        The events that matter most are the ones that END a lock. ``released`` fires when the
        schedule detaches (by design, when phase 2 begins — see ``end_behavior="release"``) and
        ``canceled`` when the subscription goes away. Either way the lock is gone, and a profile
        screen still promising a founding rate afterwards would be telling a customer something
        false about their own money. So the flag is cleared on those, not just set on creation.
        """
        # A RELEASED schedule reports `subscription: null` and moves the id to
        # `released_subscription` — releasing is precisely the act of detaching the two. Reading
        # only `subscription` meant the release event bailed out one line into this method, so
        # `is_founding` never cleared and the profile kept promising a founding rate the customer
        # had already rolled off. That is the single event this method exists to handle.
        subscription_id = schedule.get("subscription") or schedule.get("released_subscription")
        if not subscription_id:
            # A schedule can exist before its subscription (created from a phase start date). We
            # only track schedules attached to a live subscription; the later `updated` event
            # carries the id once Stripe attaches it.
            return

        row = (
            await db.execute(
                select(UserSubscription).where(
                    UserSubscription.stripe_subscription_id == subscription_id
                )
            )
        ).scalar_one_or_none()
        if row is None:
            logger.info("BILLING: schedule %s has no local subscription row yet", schedule.get("id"))
            return

        # Decide from the schedule's STATUS first, and only fall back to the event name.
        #
        # Releasing emits `subscription_schedule.released` immediately followed by a
        # `subscription_schedule.updated` for the same schedule, in the same second. Judging by
        # event name alone, `released` cleared the flag and the trailing `updated` — not being in
        # the "ended" list — set it straight back. The customer had rolled onto the list price and
        # the profile went on promising them a founding rate, permanently.
        #
        # The status is the state; the event name is only how we were told about it.
        # Stripe's schedule statuses are not_started | active | completed | released | canceled.
        ENDED_STATUSES = ("released", "canceled", "completed")
        status = str(schedule.get("status") or "").lower()
        ended = status in ENDED_STATUSES or event_type.endswith(
            ("released", "canceled", "completed", "aborted")
        )
        if ended:
            # Only the schedule we are CURRENTLY tracking may end the lock.
            #
            # A subscription can outlive more than one schedule: `repair_founding_locks.py` releases
            # a broken stump and immediately builds a replacement, and support may do the same by
            # hand. Both schedules point at the same subscription, so a late-arriving `released` for
            # the OLD one would otherwise tear down the NEW lock that had just been recorded —
            # leaving Stripe correctly enforcing a rate our own screens deny exists.
            incoming = schedule.get("id")
            if row.stripe_schedule_id and incoming and row.stripe_schedule_id != incoming:
                logger.info(
                    "BILLING: ignoring %s for superseded schedule %s (subscription now on %s)",
                    event_type, incoming, row.stripe_schedule_id,
                )
                return

            # The rate is no longer pinned. `founding_lock_ends_at` is deliberately left in place:
            # it is a historical fact — when the lock ran out — and clearing it would erase the
            # only local record that the customer ever had one.
            row.is_founding = False
            row.stripe_schedule_id = None
        else:
            # A schedule with ONE phase is not a founding lock — it is a founding price running
            # forever with nothing to roll onto. `from_subscription` always creates exactly that,
            # and phase 2 is added immediately afterwards; claiming the lock on the `created` event
            # reported success for a schedule that might never get its second phase. That is how a
            # silently-failed `modify` still produced `is_founding=1` in production.
            #
            # Requiring two phases costs nothing in the happy path — the `updated` event that adds
            # phase 2 sets the flag a moment later — and makes a broken lock visible as is_founding=0.
            phases = schedule.get("phases") or []
            if len(phases) < 2:
                logger.info(
                    "BILLING: schedule %s has %d phase(s); not claiming a founding lock yet",
                    schedule.get("id"), len(phases),
                )
                return

            row.is_founding = True
            row.stripe_schedule_id = schedule.get("id")
            end_at = self._phase_one_end(schedule)
            if end_at is None and row.founding_lock_ends_at is None:
                # This event carried no usable boundary AND we still have no date on file.
                #
                # `subscription_schedule.created` fires while the schedule has ONE phase (we add
                # phase 2 immediately afterwards), so it can never supply a boundary; the `.updated`
                # event that follows can. But webhook order is not guaranteed, and either can arrive
                # before the subscription row exists — in which case it returns early above. Lose
                # that race with `.updated` and the date stays NULL forever, so the profile screen
                # cannot say when the founding rate ends.
                #
                # Re-read the schedule from Stripe, which is current whatever order events landed.
                end_at = self._phase_one_end_from_stripe(schedule.get("id"))
            if end_at is not None:
                # Stripe's own boundary, which beats the estimate written at checkout — its cycle
                # dates can shift by a day around month ends.
                row.founding_lock_ends_at = end_at

        await db.flush()

    @staticmethod
    def _phase_one_end_from_stripe(schedule_id: Optional[str]) -> Optional[datetime]:
        """Read the founding phase's end straight from Stripe.

        Only used to repair a missing date — see the caller. Never raises: this runs inside the
        webhook handler, and an exception would make us return 500, Stripe would retry the whole
        event, and a cosmetic date would have cost us the whole sync.
        """
        if not schedule_id:
            return None
        try:
            import stripe

            # Attribute access, not `.get`: a live `StripeObject` is not a dict, and its
            # `__getattr__` shadows `dict.get` so `.get("phases")` raises AttributeError. (The
            # `schedule` argument to sync_schedule IS a plain dict — it has been through
            # `sanitize_for_json` — which is why the two use different access styles.)
            fresh = stripe.SubscriptionSchedule.retrieve(schedule_id)
            phases = fresh.phases or []
            if len(phases) < 2:
                return None
            return _ts(phases[0].end_date)
        except Exception as exc:  # noqa: BLE001 — see the docstring
            logger.warning("BILLING: could not re-read schedule %s for its phase end: %s", schedule_id, exc)
            return None

    @staticmethod
    def _phase_one_end(schedule: Dict[str, Any]) -> Optional[datetime]:
        """When the founding phase ends, taken from Stripe's own phase boundary.

        Requires a second phase: a single-phase schedule has nothing to roll onto, so its phase-1
        end is not a price change and must not be reported as one.
        """
        phases = schedule.get("phases") or []
        if len(phases) < 2:
            return None
        return _ts(phases[0].get("end_date"))

    # ------------------------------------------------------------------ #
    # customer.subscription.created / updated / deleted
    # ------------------------------------------------------------------ #
    async def sync_subscription(
        self, db: AsyncSession, sub: Dict[str, Any], event_type: str, stripe_event_id: Optional[str]
    ) -> None:
        customer_id = sub.get("customer")
        metadata = sub.get("metadata") or {}

        user = await self._user_by_id(db, metadata.get("user_id"))
        if user is None:
            user = await self._user_by_customer(db, customer_id)
        if user is None:
            logger.warning("Subscription webhook: no matching user (sub=%s customer=%s)", sub.get("id"), customer_id)
            return

        items = ((sub.get("items") or {}).get("data")) or []
        price = (items[0].get("price") if items else {}) or {}
        stripe_price_id = price.get("id")
        currency = (price.get("currency") or "").upper() or None

        plan_id = await self._plan_id_for_price(db, stripe_price_id)
        if plan_id is None and metadata.get("plan_id"):
            try:
                plan_id = int(metadata["plan_id"])
            except (TypeError, ValueError):
                plan_id = None

        deleted = event_type.endswith("deleted")
        # A deleted subscription no longer grants a plan (falls back to free).
        new_status = "canceled" if deleted else (sub.get("status") or "active")

        row = await self._get_subscription_row(db, user.id)
        prev_plan_id = row.plan_id if row else None

        if row is None:
            row = UserSubscription(user_id=user.id, stripe_subscription_id=sub.get("id"))
            db.add(row)
        row.stripe_subscription_id = sub.get("id") or row.stripe_subscription_id
        row.stripe_customer_id = customer_id
        row.stripe_price_id = stripe_price_id
        row.currency = currency
        row.plan_id = plan_id
        row.status = new_status
        # Stripe "Basil" (2025-03-31) moved current_period_start/end OFF the Subscription object and
        # ONTO each SubscriptionItem — our account's API version (2026-xx dahlia) no longer returns
        # them at the subscription level, which is why they were landing NULL. Read them from the
        # (single) item, with a fallback to the legacy subscription-level fields for older API versions.
        # See docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end
        item0 = items[0] if items else {}
        row.current_period_start = _ts(item0.get("current_period_start") or sub.get("current_period_start"))
        row.current_period_end = _ts(item0.get("current_period_end") or sub.get("current_period_end"))
        row.cancel_at_period_end = bool(sub.get("cancel_at_period_end"))
        row.canceled_at = _ts(sub.get("canceled_at"))
        row.trial_end = _ts(sub.get("trial_end"))

        ev_type = "canceled" if deleted else ("created" if event_type.endswith("created") else "updated")
        db.add(
            SubscriptionEvent(
                user_id=user.id,
                stripe_event_id=stripe_event_id,
                type=ev_type,
                from_plan_id=prev_plan_id,
                to_plan_id=None if deleted else plan_id,
                currency=currency,
                effective_at=datetime.utcnow(),
            )
        )
        await db.flush()
        logger.info("Synced subscription for user %s → plan=%s status=%s (%s)", user.id, plan_id, new_status, ev_type)

    # ------------------------------------------------------------------ #
    # invoice.paid / invoice.payment_failed
    # ------------------------------------------------------------------ #
    async def record_invoice(self, db: AsyncSession, inv: Dict[str, Any]) -> None:
        stripe_invoice_id = inv.get("id")
        if not stripe_invoice_id:
            return
        customer_id = inv.get("customer")
        subscription_id = _invoice_subscription_id(inv)

        user = await self._user_by_customer(db, customer_id)
        if user is None and subscription_id:
            row = (
                await db.execute(
                    select(UserSubscription).where(UserSubscription.stripe_subscription_id == subscription_id)
                )
            ).scalar_one_or_none()
            if row:
                user = await self._user_by_id(db, row.user_id)
        if user is None:
            logger.warning("Invoice webhook: no matching user (invoice=%s customer=%s)", stripe_invoice_id, customer_id)
            return

        lines = ((inv.get("lines") or {}).get("data")) or []
        line = lines[0] if lines else {}
        line_price = (line.get("price") or {}) if isinstance(line, dict) else {}
        period = (line.get("period") or {}) if isinstance(line, dict) else {}
        period_start = _ts(period.get("start") or inv.get("period_start"))
        period_end = _ts(period.get("end") or inv.get("period_end"))

        plan_id = await self._plan_id_for_price(db, line_price.get("id"))
        if plan_id is None and subscription_id:
            row = (
                await db.execute(
                    select(UserSubscription).where(UserSubscription.stripe_subscription_id == subscription_id)
                )
            ).scalar_one_or_none()
            plan_id = row.plan_id if row else None

        existing = (
            await db.execute(select(BillingInvoice).where(BillingInvoice.stripe_invoice_id == stripe_invoice_id))
        ).scalar_one_or_none()
        if existing is None:
            existing = BillingInvoice(user_id=user.id, stripe_invoice_id=stripe_invoice_id)
            db.add(existing)

        existing.user_id = user.id
        existing.stripe_subscription_id = subscription_id
        existing.plan_id = plan_id
        existing.amount_paid_cents = int(inv.get("amount_paid") or 0)
        existing.currency = (inv.get("currency") or "eur").upper()
        existing.status = inv.get("status") or "open"
        existing.period_start = period_start
        existing.period_end = period_end
        existing.hosted_invoice_url = inv.get("hosted_invoice_url")
        existing.invoice_pdf = inv.get("invoice_pdf")
        existing.paid_at = _ts((inv.get("status_transitions") or {}).get("paid_at"))
        await db.flush()

    async def mark_payment_failed(self, db: AsyncSession, inv: Dict[str, Any], stripe_event_id: Optional[str]) -> None:
        await self.record_invoice(db, inv)
        subscription_id = _invoice_subscription_id(inv)
        if not subscription_id:
            return
        row = (
            await db.execute(
                select(UserSubscription).where(UserSubscription.stripe_subscription_id == subscription_id)
            )
        ).scalar_one_or_none()
        if row:
            row.status = "past_due"
            db.add(
                SubscriptionEvent(
                    user_id=row.user_id,
                    stripe_event_id=stripe_event_id,
                    type="payment_failed",
                    from_plan_id=row.plan_id,
                    to_plan_id=row.plan_id,
                    currency=row.currency,
                    effective_at=datetime.utcnow(),
                )
            )
            await db.flush()

"""
Refunds and Chargebacks
=======================

What happens to a consumer subscription when money goes back to the cardholder.

THE THING STRIPE DOES NOT DO FOR US
-----------------------------------

**Refunding an invoice does not cancel the subscription.** Stripe treats the charge and the
subscription as unrelated objects, so before this service existed an admin could refund someone's
€9.99 in full and leave them with a live Pro subscription that would renew on schedule. The money
went back; the access never did.

FOUR OUTCOMES
-------------

======================  ==========================  ==================================
Event                   Money                       Access
======================  ==========================  ==================================
full refund             returned                    **ends now** — cancelled in Stripe
partial refund          partly returned             unchanged
dispute opened          held by the bank            **suspended**, reversibly
dispute won             returned to us              restored
dispute lost            gone                        stays suspended
======================  ==========================  ==================================

Full vs partial is decided on ``amount_refunded >= amount``, not on anyone's intent — it is the
only signal that is always present, and a €3 goodwill refund must not end a subscription.

WHY A DISPUTE DOES NOT WRITE ``status``
---------------------------------------

Stripe keeps a disputed subscription **active** for the whole dispute. Writing
``status = 'disputed'`` would be undone by the very next ``customer.subscription.updated``, handing
access back within seconds. Suspension is our decision about our product, so it lives in
``access_suspended_at``, which no sync path touches. See the ``d8b4f2a6c1e3`` migration.

Everything here is best-effort and returns rather than raises: it runs inside a Stripe webhook, and
an exception would return 500 and make Stripe replay an event we may have already applied.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingInvoice
from app.models.purchase import UserSubscription
from app.models.user import User

logger = logging.getLogger(__name__)

# Dispute statuses that mean the money is settled one way or the other. `warning_*` statuses are
# early notices from the network — no funds have moved and nothing should change yet.
DISPUTE_WON = "won"
DISPUTE_LOST = "lost"
DISPUTE_CLOSED_STATUSES = (DISPUTE_WON, DISPUTE_LOST)


def _id_of(value: Any) -> Optional[str]:
    """Stripe fields hold either an id string or the expanded object. Accept both."""
    if isinstance(value, dict):
        return value.get("id")
    return value if isinstance(value, str) else None


class BillingRefundService:
    """Applies refunds and chargebacks to a consumer subscription."""

    # ------------------------------------------------------------------ #
    # Finding the subscription behind a charge
    # ------------------------------------------------------------------ #
    async def _subscription_for_charge(
        self, db: AsyncSession, charge: Dict[str, Any]
    ) -> Optional[UserSubscription]:
        """The consumer subscription a charge paid for, or None if it was not one.

        Local first: ``billing_invoices`` already maps invoice → subscription for every invoice we
        have seen, so the common case costs one indexed SELECT and no network call. Stripe is only
        consulted when the invoice predates our records.

        Returning None is a normal outcome, not a failure — one-time cart charges reach the same
        webhook and are handled elsewhere.
        """
        # `charge.invoice` was REMOVED from the Charge object (it is gone in 2026-04-22.dahlia;
        # a Charge now carries only `payment_intent`). Reading it alone meant every refund
        # resolved to None and silently did nothing — the money went back and the customer kept
        # their plan, which is the exact defect this service exists to prevent.
        #
        # Kept first because older API versions and replayed historical events still send it.
        invoice_id = _id_of(charge.get("invoice")) or self._invoice_id_from_payment_intent(charge)

        if invoice_id:
            row = (
                await db.execute(
                    select(BillingInvoice).where(BillingInvoice.stripe_invoice_id == invoice_id)
                )
            ).scalar_one_or_none()
            if row and row.stripe_subscription_id:
                return await self._subscription_by_stripe_id(db, row.stripe_subscription_id)

            subscription_id = self._subscription_id_from_stripe_invoice(invoice_id)
            if subscription_id:
                return await self._subscription_by_stripe_id(db, subscription_id)

        # No invoice at all: a one-off charge (the track cart). Not ours.
        return None

    @staticmethod
    def _invoice_id_from_payment_intent(charge: Dict[str, Any]) -> Optional[str]:
        """The invoice a charge paid, for API versions where `charge.invoice` no longer exists.

        Stripe restructured invoice payments: the link now lives on the ``InvoicePayment`` object,
        which can be listed by the payment intent that settled it. One API call, on an event that
        is rare (a refund), so it is not worth denormalising a payment-intent column onto
        ``billing_invoices`` to avoid.

        Never raises — a network blip must not fail the webhook, and returning None simply means
        "not one of ours", which is already a normal outcome for cart charges.
        """
        payment_intent = _id_of(charge.get("payment_intent"))
        if not payment_intent:
            return None
        try:
            payments = stripe.InvoicePayment.list(
                payment={"type": "payment_intent", "payment_intent": payment_intent},
                limit=1,
            )
            data = payments.data or []
            if not data:
                return None
            # Attribute access: a live StripeObject's `__getattr__` shadows dict.get.
            return _id_of(getattr(data[0], "invoice", None))
        except Exception as exc:  # noqa: BLE001 — see the docstring
            logger.warning(
                "REFUND: could not resolve an invoice for payment_intent %s: %s",
                payment_intent, exc,
            )
            return None

    @staticmethod
    def _subscription_id_from_stripe_invoice(invoice_id: str) -> Optional[str]:
        """Read the subscription id off an invoice we have no local record of.

        Never raises — a network blip here must not fail the webhook.
        """
        try:
            invoice = stripe.Invoice.retrieve(invoice_id)
            # Attribute access, not `.get`: a live StripeObject's `__getattr__` shadows dict.get.
            # Basil (2025-03-31) moved this under `parent.subscription_details`; the legacy
            # top-level field is the fallback for older API versions.
            parent = getattr(invoice, "parent", None)
            details = getattr(parent, "subscription_details", None) if parent else None
            subscription = getattr(details, "subscription", None) if details else None
            return _id_of(subscription) or _id_of(getattr(invoice, "subscription", None))
        except Exception as exc:  # noqa: BLE001 — see the module docstring
            logger.warning("REFUND: could not read invoice %s from Stripe: %s", invoice_id, exc)
            return None

    async def _subscription_by_stripe_id(
        self, db: AsyncSession, subscription_id: str
    ) -> Optional[UserSubscription]:
        return (
            await db.execute(
                select(UserSubscription).where(
                    UserSubscription.stripe_subscription_id == subscription_id
                )
            )
        ).scalar_one_or_none()

    @staticmethod
    async def user_for(db: AsyncSession, row: UserSubscription) -> Optional[User]:
        return (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Cancelling in Stripe
    # ------------------------------------------------------------------ #
    @staticmethod
    def cancel_in_stripe(subscription_id: str) -> bool:
        """End the subscription at Stripe, immediately. Returns True if Stripe accepted it.

        A founding subscriber's subscription is attached to a **subscription schedule**, and Stripe
        refuses to cancel one directly while the schedule owns it. The schedule is released first —
        the same release-then-act sequence ``repair_founding_locks.py`` uses.

        Cancelling only locally would leave Stripe billing a plan we had already revoked, so a
        failure here is loud in the log even though it does not raise.
        """
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            schedule_id = _id_of(getattr(subscription, "schedule", None))
            if schedule_id:
                try:
                    stripe.SubscriptionSchedule.release(schedule_id)
                    logger.info("REFUND: released schedule %s before cancelling", schedule_id)
                except Exception as exc:  # noqa: BLE001
                    # Already released or completed. Cancelling may still work, so carry on.
                    logger.warning("REFUND: could not release schedule %s: %s", schedule_id, exc)

            stripe.Subscription.cancel(subscription_id)
            logger.info("REFUND: cancelled subscription %s in Stripe", subscription_id)
            return True
        except Exception as exc:  # noqa: BLE001 — see the module docstring
            logger.error(
                "REFUND: could not cancel %s in Stripe — it will keep billing: %s",
                subscription_id, exc,
            )
            return False

    # ------------------------------------------------------------------ #
    # charge.refunded
    # ------------------------------------------------------------------ #
    @staticmethod
    def is_full_refund(charge: Dict[str, Any]) -> bool:
        """Was the whole charge returned?

        Decided on the amounts, never on intent: a partial goodwill refund must not end someone's
        subscription. A zero-amount charge counts as full so a free trial refund is not treated as
        partial.
        """
        amount = int(charge.get("amount") or 0)
        refunded = int(charge.get("amount_refunded") or 0)
        return refunded >= amount if amount > 0 else True

    async def handle_refund(
        self, db: AsyncSession, charge: Dict[str, Any]
    ) -> Optional[Tuple[str, UserSubscription]]:
        """Apply ``charge.refunded``. Returns ``(outcome, row)`` for the caller to notify on.

        ``outcome`` is ``"full"`` or ``"partial"``; None means the charge was not for a consumer
        subscription and nothing was done. Does NOT commit — the webhook owns the transaction.
        """
        row = await self._subscription_for_charge(db, charge)
        if row is None:
            return None

        if not self.is_full_refund(charge):
            logger.info(
                "REFUND: partial refund on %s — subscription %s left untouched",
                charge.get("id"), row.stripe_subscription_id,
            )
            return ("partial", row)

        # Stripe first: cancelling locally while Stripe keeps billing is the worse half-state.
        if row.stripe_subscription_id:
            self.cancel_in_stripe(row.stripe_subscription_id)

        now = datetime.utcnow()
        row.status = "canceled"
        row.ended_at = row.ended_at or now
        row.canceled_at = row.canceled_at or now
        row.cancellation_reason = "refunded"
        # The lock is gone with the subscription; leaving it set would have the profile screen
        # promise a founding rate on an account that no longer has a subscription at all.
        row.is_founding = False
        row.stripe_schedule_id = None
        await db.flush()

        logger.info(
            "REFUND: full refund on %s — subscription %s ended, user %s back to free",
            charge.get("id"), row.stripe_subscription_id, row.user_id,
        )
        return ("full", row)

    # ------------------------------------------------------------------ #
    # charge.dispute.*
    # ------------------------------------------------------------------ #
    async def handle_dispute_opened(
        self, db: AsyncSession, dispute: Dict[str, Any]
    ) -> Optional[UserSubscription]:
        """Suspend access while a chargeback is open. Reversible; see the module docstring.

        Returns the row when a consumer subscription was suspended, else None — a dispute on a
        one-time cart order reaches the same webhook and is handled by ``PurchaseService``.
        """
        row = await self._subscription_for_dispute(db, dispute)
        if row is None:
            return None
        if row.access_suspended_at is not None:
            return None  # already suspended; nothing changed, so nothing to announce

        row.access_suspended_at = datetime.utcnow()
        row.access_suspended_reason = "disputed"
        await db.flush()
        logger.warning(
            "DISPUTE: %s opened on subscription %s — access suspended for user %s",
            dispute.get("id"), row.stripe_subscription_id, row.user_id,
        )
        return row

    async def handle_dispute_closed(
        self, db: AsyncSession, dispute: Dict[str, Any]
    ) -> Optional[Tuple[str, UserSubscription]]:
        """Resolve a chargeback. Returns ``("won"|"lost", row)``, or None if nothing applied.

        Won → access back, because the customer did nothing wrong and was cut off for weeks.
        Lost → access stays suspended; they were already told, and "you lost" adds only friction.
        """
        status = str(dispute.get("status") or "").lower()
        if status not in DISPUTE_CLOSED_STATUSES:
            # A `warning_*` status is an early notice from the network — no funds have moved.
            logger.info("DISPUTE: %s closed with status %r — no action", dispute.get("id"), status)
            return None

        row = await self._subscription_for_dispute(db, dispute)
        if row is None:
            return None

        if status == DISPUTE_WON:
            if row.access_suspended_reason != "disputed":
                # Suspended for some other reason, or never suspended. Do not hand back access we
                # did not take for this dispute.
                return None
            row.access_suspended_at = None
            row.access_suspended_reason = None
            await db.flush()
            logger.info(
                "DISPUTE: %s won — access restored for user %s", dispute.get("id"), row.user_id
            )
            return (DISPUTE_WON, row)

        logger.warning(
            "DISPUTE: %s lost — user %s stays on the free plan", dispute.get("id"), row.user_id
        )
        return (DISPUTE_LOST, row)

    async def _subscription_for_dispute(
        self, db: AsyncSession, dispute: Dict[str, Any]
    ) -> Optional[UserSubscription]:
        """A dispute names a charge; the charge names the invoice; the invoice names the
        subscription. The charge is usually only an id, so it is fetched when needed."""
        charge = dispute.get("charge")
        if isinstance(charge, dict):
            return await self._subscription_for_charge(db, charge)

        charge_id = _id_of(charge)
        if not charge_id:
            # A dispute can also name only the payment intent. That is enough on its own.
            payment_intent = _id_of(dispute.get("payment_intent"))
            if not payment_intent:
                return None
            return await self._subscription_for_charge(db, {"payment_intent": payment_intent})

        try:
            fetched = stripe.Charge.retrieve(charge_id)
            # BOTH fields: `invoice` is gone on current API versions and `payment_intent` is the
            # only remaining link, but older versions still carry `invoice`. Passing just one
            # would make disputes silently resolve to "not ours".
            return await self._subscription_for_charge(db, {
                "id": fetched.id,
                "invoice": _id_of(getattr(fetched, "invoice", None)),
                "payment_intent": _id_of(getattr(fetched, "payment_intent", None)),
            })
        except Exception as exc:  # noqa: BLE001 — see the module docstring
            logger.warning("DISPUTE: could not read charge %s from Stripe: %s", charge_id, exc)
            return None

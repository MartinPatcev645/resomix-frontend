"""
Billing Email Service
=====================

The customer-facing side of a billing change: cancelled, ended, refunded, disputed, restored.
Stripe sends receipts and dunning notices; it never sends any of these.

WHY A SEPARATE SERVICE

``EmailService`` is auth- and contact-shaped — one method per message, each rendering its own
template. Billing messages share a different set of concerns (money formatting, period dates, plan
names, and a dedupe rule none of the auth mails need), so they get their own layer that *uses*
``EmailService`` for delivery rather than growing it sideways.

TWO RULES THAT MATTER MORE THAN THE COPY
----------------------------------------

**1. Never raise into a webhook.** ``WebhookService`` returns 500 on any exception so Stripe
retries the whole event. An SMTP timeout inside a handler would therefore replay a subscription
sync. Every public method here returns a bool and swallows its own failures, following the same
best-effort convention as ``contact_service`` and ``notification_service._send_and_log``.

**2. Send after the commit, never inside it.** Callers collect what they want sent and dispatch it
once the transaction has landed. An email announcing a state change that then got rolled back is
worse than no email — the customer acts on something that never happened.

The dedupe key is the **state**, not the event; see ``BillingNotification``.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.billing import BillingNotification
from app.models.user import User
from app.services.email_service import EmailService
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)

# Subject lines. Kept together so the whole outbound voice can be read at a glance rather than
# reconstructed from six call sites.
SUBJECTS: Dict[str, str] = {
    "subscription_started": "Welcome to Resomix Pro",
    "subscription_cancelled": "Your Resomix subscription is cancelled",
    "subscription_ended": "Your Resomix subscription has ended",
    "subscription_refunded": "Your Resomix subscription has been refunded",
    "subscription_partial_refund": "A refund has been issued — Resomix",
    "subscription_disputed": "Your Resomix subscription has been suspended",
    "subscription_restored": "Your Resomix access is back",
    "subscription_resumed": "Your Resomix subscription is back on",
}


def fmt_money(cents: Optional[int], currency: Optional[str]) -> Optional[str]:
    """Minor units → a string a human recognises as their own charge.

    Returns None rather than a zero when there is nothing to show, so templates can drop the phrase
    entirely instead of printing "we refunded €0.00".
    """
    if cents is None:
        return None
    code = (currency or "EUR").upper()
    symbol = {"EUR": "€", "USD": "$", "GBP": "£"}.get(code)
    amount = f"{cents / 100:.2f}"
    return f"{symbol}{amount}" if symbol else f"{amount} {code}"


def fmt_date(value: Optional[datetime]) -> Optional[str]:
    """A date, not a timestamp. Nobody needs the minute their access ends, and printing it invites
    an argument about time zones we would lose."""
    return value.strftime("%-d %B %Y") if value else None


class BillingEmailService:
    """Renders and sends billing notifications, exactly once per real change."""

    def __init__(self) -> None:
        self.email_service = EmailService()
        self.logging_service = LoggingService()

    # ------------------------------------------------------------------ #
    # Dedupe
    # ------------------------------------------------------------------ #
    async def already_sent(self, db: AsyncSession, dedupe_key: str) -> bool:
        row = (
            await db.execute(
                select(BillingNotification.id).where(BillingNotification.dedupe_key == dedupe_key)
            )
        ).first()
        return row is not None

    async def last_notification(
        self, db: AsyncSession, stripe_object_id: str, template: str
    ) -> Optional[BillingNotification]:
        """The most recent message of this kind we sent about this Stripe object, if any.

        Used to answer "have we already told them this subscription was cancelling?" — the
        precondition for confirming a reversal. Without it, a resume confirmation would fire on
        every ordinary renewal, since "not cancelling" is the normal state of a healthy
        subscription.
        """
        return (
            await db.execute(
                select(BillingNotification)
                .where(
                    BillingNotification.stripe_object_id == stripe_object_id,
                    BillingNotification.template == template,
                )
                .order_by(BillingNotification.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _claim(
        self,
        db: AsyncSession,
        *,
        user: User,
        dedupe_key: str,
        template: str,
        stripe_event_id: Optional[str],
        stripe_object_id: Optional[str] = None,
    ) -> bool:
        """Reserve the right to send this message. False means someone already has it.

        Claim BEFORE sending, in its own committed transaction. Two webhook workers can process
        sibling events concurrently, and the unique index is the only thing that actually
        serialises them — a read-then-write check would let both pass. Losing the race raises
        IntegrityError, which is the signal to stay quiet, not an error to report.
        """
        if await self.already_sent(db, dedupe_key):
            return False
        db.add(
            BillingNotification(
                user_id=user.id,
                dedupe_key=dedupe_key,
                template=template,
                recipient_email=user.email,
                stripe_event_id=stripe_event_id,
                stripe_object_id=stripe_object_id,
                status="sent",
            )
        )
        try:
            await db.commit()
            return True
        except IntegrityError:
            # The other worker got there first. Expected under concurrency, not a fault.
            await db.rollback()
            logger.info("BILLING EMAIL: %s already claimed by a concurrent handler", dedupe_key)
            return False

    async def _mark_failed(self, db: AsyncSession, dedupe_key: str) -> None:
        """Record that delivery failed, keeping the dedupe row.

        The row stays so a bounce does not retry forever on every subsequent webhook; the status
        is what tells support the customer was never actually told.
        """
        try:
            row = (
                await db.execute(
                    select(BillingNotification).where(BillingNotification.dedupe_key == dedupe_key)
                )
            ).scalar_one_or_none()
            if row is not None:
                row.status = "failed"
                await db.commit()
        except Exception as exc:  # noqa: BLE001 — bookkeeping must not raise into a webhook
            await db.rollback()
            logger.warning("BILLING EMAIL: could not mark %s failed: %s", dedupe_key, exc)

    # ------------------------------------------------------------------ #
    # Send
    # ------------------------------------------------------------------ #
    async def send(
        self,
        db: AsyncSession,
        *,
        user: Optional[User],
        template: str,
        dedupe_key: str,
        context: Optional[Dict[str, Any]] = None,
        stripe_event_id: Optional[str] = None,
        stripe_object_id: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> bool:
        """Send one billing notification. Returns True only if it was actually delivered.

        Never raises: see the module docstring. A caller inside a webhook handler can ignore the
        return value entirely and the webhook stays correct.
        """
        if user is None or not user.email:
            logger.warning("BILLING EMAIL: no recipient for %s (%s)", template, dedupe_key)
            return False

        if not await self._claim(
            db, user=user, dedupe_key=dedupe_key, template=template,
            stripe_event_id=stripe_event_id, stripe_object_id=stripe_object_id,
        ):
            return False

        payload = {
            # `name` is what the greeting uses. Fall back through the identifiers we have rather
            # than addressing someone as "None".
            "name": user.name or user.username or "there",
            "app_url": settings.app_url,
            "plan_name": "Pro",
            **(context or {}),
        }

        try:
            sent = await self.email_service.send_templated(
                email=user.email,
                subject=subject or SUBJECTS.get(template, "Resomix billing update"),
                template_name=f"{template}.html",
                context=payload,
            )
        except Exception as exc:  # noqa: BLE001 — see the module docstring
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="billing_email_send_failed",
                message=f"Failed to send {template}",
                metadata={"user_uuid": user.uuid, "template": template, "dedupe_key": dedupe_key},
                error=exc,
            )
            sent = False

        if not sent:
            await self._mark_failed(db, dedupe_key)
        return bool(sent)

    # ------------------------------------------------------------------ #
    # One method per message — the vocabulary callers use
    # ------------------------------------------------------------------ #
    async def subscription_cancelled(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        subscription_id: str,
        effective_at: Optional[datetime],
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Cancelled, access continues until ``effective_at``.

        The date is part of the dedupe key: cancelling, resuming, then cancelling again for a
        different date is a genuinely new fact and should be told again.
        """
        key = f"cancelled:{subscription_id}:{effective_at.isoformat() if effective_at else 'unknown'}"
        return await self.send(
            db,
            user=user,
            template="subscription_cancelled",
            dedupe_key=key,
            stripe_event_id=stripe_event_id,
            stripe_object_id=subscription_id,
            context={"plan_name": plan_name, "effective_at": fmt_date(effective_at)},
        )

    async def subscription_started(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        subscription_id: str,
        plan_name: str = "Pro",
        amount_cents: Optional[int] = None,
        currency: Optional[str] = None,
        interval: Optional[str] = None,
        renews_at: Optional[datetime] = None,
        founding_until: Optional[datetime] = None,
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Welcome — sent once, when a subscription first becomes real.

        Keyed on the subscription id alone: a customer who cancels and later resubscribes gets a
        NEW subscription from Stripe, so they are welcomed again, which is right. A repeated
        `customer.subscription.created` for the same id is a webhook replay and stays silent.

        `founding_until` is passed only for a founding subscriber — the locked rate is the offer
        they actually bought, and putting it in writing is the point.
        """
        return await self.send(
            db,
            user=user,
            template="subscription_started",
            dedupe_key=f"started:{subscription_id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=subscription_id,
            context={
                "plan_name": plan_name,
                "price": fmt_money(amount_cents, currency),
                "interval": interval,
                "renews_at": fmt_date(renews_at),
                "founding_until": fmt_date(founding_until),
            },
        )

    async def subscription_resumed(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        subscription_id: str,
        renews_at: Optional[datetime] = None,
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Cancellation reversed — closes the loop on a cancellation notice we already sent.

        ONLY sends if we previously told this customer the subscription was cancelling. "Not
        cancelling" is the normal state of a healthy subscription, so without that precondition
        this would fire on every renewal, card update and plan change.

        The dedupe key hangs off the cancellation row's id, so a customer who cancels, resumes,
        cancels again and resumes again gets both confirmations — each one answers a different
        cancellation.
        """
        cancelled = await self.last_notification(db, subscription_id, "subscription_cancelled")
        if cancelled is None:
            return False

        return await self.send(
            db,
            user=user,
            template="subscription_resumed",
            dedupe_key=f"resumed:{subscription_id}:{cancelled.id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=subscription_id,
            context={"plan_name": plan_name, "renews_at": fmt_date(renews_at)},
        )

    async def subscription_ended(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        subscription_id: str,
        effective_at: Optional[datetime] = None,
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Access has stopped. A subscription can only end once, so the id alone is the key."""
        return await self.send(
            db,
            user=user,
            template="subscription_ended",
            dedupe_key=f"ended:{subscription_id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=subscription_id,
            context={"plan_name": plan_name, "effective_at": fmt_date(effective_at)},
        )

    async def subscription_refunded(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        charge_id: str,
        amount_cents: Optional[int],
        currency: Optional[str],
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Refunded in full → access ended immediately."""
        return await self.send(
            db,
            user=user,
            template="subscription_refunded",
            dedupe_key=f"refunded:{charge_id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=charge_id,
            context={"plan_name": plan_name, "amount": fmt_money(amount_cents, currency)},
        )

    async def subscription_partial_refund(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        charge_id: str,
        amount_cents: Optional[int],
        currency: Optional[str],
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Partly refunded, plan untouched.

        The amount is in the key: a second partial refund on the same charge is a new event the
        customer needs to hear about, unlike a repeated webhook for the same one.
        """
        return await self.send(
            db,
            user=user,
            template="subscription_partial_refund",
            dedupe_key=f"partial_refund:{charge_id}:{amount_cents or 0}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=charge_id,
            context={"plan_name": plan_name, "amount": fmt_money(amount_cents, currency)},
        )

    async def subscription_disputed(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        dispute_id: str,
        amount_cents: Optional[int] = None,
        currency: Optional[str] = None,
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Chargeback opened → access suspended pending the bank's decision."""
        return await self.send(
            db,
            user=user,
            template="subscription_disputed",
            dedupe_key=f"disputed:{dispute_id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=dispute_id,
            context={"plan_name": plan_name, "amount": fmt_money(amount_cents, currency)},
        )

    async def subscription_restored(
        self,
        db: AsyncSession,
        user: Optional[User],
        *,
        dispute_id: str,
        plan_name: str = "Pro",
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Dispute won → access back. A lost dispute sends nothing; see the template."""
        return await self.send(
            db,
            user=user,
            template="subscription_restored",
            dedupe_key=f"restored:{dispute_id}",
            stripe_event_id=stripe_event_id,
            stripe_object_id=dispute_id,
            context={"plan_name": plan_name},
        )

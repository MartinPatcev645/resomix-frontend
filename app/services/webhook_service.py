"""
Webhook Service
===============

Service to manage external webhooks (e.g., Stripe confirmations).
Handles signature verification, idempotency logic, and maps events to purchase services.

Version: 1.0.0
Author: Muhammad Usman Naeem
Date: May 2026
"""

from typing import Dict, Any, Optional
import json
import stripe
import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.models.log import SystemLog
from app.models.plan import Plan
from app.models.purchase import UserSubscription
from app.models.user import User
from app.repositories.log_repository import LogRepository
from app.services.purchase_service import PurchaseService
from app.services.billing_email_service import BillingEmailService
from app.services.billing_sync_service import BillingSyncService
from app.services.billing_service import BillingService

logger = logging.getLogger(__name__)

def sanitize_for_json(data: Any) -> Any:
    """Recursively convert Decimal objects to float/int/str so they are JSON serializable."""
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, Decimal):
        return int(data) if data % 1 == 0 else float(data)
    return data



class WebhookService:
    """Service layer managing Stripe webhooks and payment event flows."""

    def __init__(self) -> None:
        self.purchase_service = PurchaseService()
        self.billing_sync = BillingSyncService()
        self.billing_service = BillingService()
        self.billing_email = BillingEmailService()
        self.log_repo = LogRepository()
        stripe.api_key = settings.stripe_secret_key

    # Reasons that already have their own, more specific message. Sending the generic "your
    # subscription has ended" on top would be a second email about the same event, and in the
    # payment_failed case it lands on someone whose card merely expired — which decision Q5 of
    # the account-lifecycle plan explicitly rules out (Stripe's dunning mail already covers it).
    _SUPPRESS_ENDED_EMAIL_REASONS = ("payment_failed", "refunded", "disputed", "payment_disputed")

    async def _notify_subscription_state(
        self, db: AsyncSession, subscription_id: str, stripe_event_id: Optional[str]
    ) -> None:
        """Send a cancellation notice, if the committed state calls for one.

        WHY THE ROW IS RE-READ RATHER THAN PASSED IN

        A single cancellation reaches us through more than one event, and for a founding
        subscriber it may arrive only on the *schedule*. Deriving the message from the committed
        row through `cancellation_state` means every path produces the same wording and — because
        the dedupe key is built from that same date — the same key. Deciding inside each handler
        would let two events disagree by a day and send two emails.

        Never raises. This runs after the commit, and the caller's `except` would otherwise turn a
        mail problem into a 500 and make Stripe replay an event we have already applied.
        """
        try:
            row = (
                await db.execute(
                    select(UserSubscription).where(
                        UserSubscription.stripe_subscription_id == subscription_id
                    )
                )
            ).scalar_one_or_none()
            if row is None:
                return

            state = BillingService.cancellation_state(row)
            if not state:
                return  # running normally — nothing to say

            user = (
                await db.execute(select(User).where(User.id == row.user_id))
            ).scalar_one_or_none()
            if user is None:
                return

            plan = (
                await db.execute(select(Plan).where(Plan.id == row.plan_id))
            ).scalar_one_or_none() if row.plan_id else None
            plan_name = plan.name if plan else "Pro"

            if state["ended"]:
                if (row.cancellation_reason or "") in self._SUPPRESS_ENDED_EMAIL_REASONS:
                    return
                await self.billing_email.subscription_ended(
                    db, user,
                    subscription_id=subscription_id,
                    effective_at=row.ended_at or row.cancel_at or row.current_period_end,
                    plan_name=plan_name,
                    stripe_event_id=stripe_event_id,
                )
            elif state["pending"]:
                await self.billing_email.subscription_cancelled(
                    db, user,
                    subscription_id=subscription_id,
                    effective_at=row.cancel_at or row.current_period_end,
                    plan_name=plan_name,
                    stripe_event_id=stripe_event_id,
                )
        except Exception as exc:  # noqa: BLE001 — see the docstring
            logger.error(
                "BILLING EMAIL: could not notify for subscription %s: %s", subscription_id, exc
            )

    async def handle_stripe_webhook(
        self,
        db: AsyncSession,
        payload: bytes,
        sig_header: Optional[str],
        url_path: str,
        method: str,
        client_ip: Optional[str]
    ) -> Dict[str, Any]:
        """
        Securely verify and process a Stripe event, ensuring idempotency and logging.
        """
        webhook_secret = settings.stripe_webhook_secret

        if not sig_header:
            logger.warning("Missing Stripe-Signature header")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signature")

        try:
            # 1. Verify Stripe Signature
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError:
            logger.error("Invalid Stripe payload")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Stripe signature verification failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

        # 2. Idempotency Check
        stripe_event_id = event.id
        existing_log = await self.log_repo.async_get_log_by_stripe_event_id(db, stripe_event_id)
        if existing_log:
            logger.info(f"Stripe event {stripe_event_id} already processed. Skipping.")
            return {"status": "success", "message": "Already processed"}

        # 3. Create Audit Log
        log_entry = SystemLog(
            level="INFO",
            category="WEBHOOK",
            action=f"stripe_{event.type}",
            message=f"Processing Stripe event: {stripe_event_id}",
            log_metadata={
                "stripe_event_id": stripe_event_id,
                "event_type": event.type,
                "raw_payload": sanitize_for_json(event.to_dict())
            },
            endpoint=url_path,
            method=method,
            client_ip=client_ip
        )
        db.add(log_entry)
        await db.flush()

        # 4. Route and Process Event
        #
        # Handlers record WHICH subscription they touched; nothing is emailed from inside the
        # transaction. See `_notify_subscription_state` for why the notice waits for the commit.
        notify_subscription_id: Optional[str] = None
        try:
            if event.type == "checkout.session.completed":
                session = sanitize_for_json(event.data.object.to_dict())
                # Only the one-time track cart uses fulfill_order (it needs internal_order_id).
                # Subscription checkouts are applied via the customer.subscription.* events below.
                if (session.get("metadata") or {}).get("internal_order_id"):
                    await self.purchase_service.fulfill_order(db, session)
                elif session.get("mode") == "subscription":
                    # Pin a founding subscription to its rate (F2). Only acts when the session was
                    # sold at a founding price; never raises, so a lock failure cannot wedge the
                    # webhook and force Stripe to replay the whole event.
                    await self.billing_service.apply_founding_lock(db, session)

            elif event.type == "charge.dispute.created":
                dispute = sanitize_for_json(event.data.object.to_dict())
                await self.purchase_service.handle_dispute(db, dispute)

            # --- Consumer subscription billing ---
            elif event.type in (
                "customer.subscription.created",
                "customer.subscription.updated",
                "customer.subscription.deleted",
            ):
                sub = sanitize_for_json(event.data.object.to_dict())
                await self.billing_sync.sync_subscription(db, sub, event.type, stripe_event_id)
                notify_subscription_id = sub.get("id")

            elif event.type in ("invoice.paid", "invoice.payment_succeeded"):
                invoice = sanitize_for_json(event.data.object.to_dict())
                await self.billing_sync.record_invoice(db, invoice)

            elif event.type == "invoice.payment_failed":
                invoice = sanitize_for_json(event.data.object.to_dict())
                await self.billing_sync.mark_payment_failed(db, invoice, stripe_event_id)

            # --- Founding lock (subscription schedules) ---
            #
            # Stripe is the enforcer; these keep our local mirror honest. `released` and `canceled`
            # matter most: they mean the lock is GONE, and a profile screen still promising a
            # founding rate after that would be telling the customer something false about their
            # own money.
            elif event.type in (
                "subscription_schedule.created",
                "subscription_schedule.updated",
                "subscription_schedule.released",
                "subscription_schedule.canceled",
                "subscription_schedule.completed",
                "subscription_schedule.aborted",
            ):
                schedule = sanitize_for_json(event.data.object.to_dict())
                await self.billing_sync.sync_schedule(db, schedule, event.type)
                # A founding subscriber's cancellation lands HERE, not on the subscription object,
                # so this path has to be able to notify too.
                notify_subscription_id = (
                    schedule.get("subscription") or schedule.get("released_subscription")
                )

            # Commit the audit log and fulfillment changes atomically
            await db.commit()

            # Only now, with the transaction landed, tell the customer. An email announcing a
            # state change that then rolled back is worse than no email.
            if notify_subscription_id:
                await self._notify_subscription_state(db, notify_subscription_id, stripe_event_id)

            return {"status": "success"}

        except Exception as e:
            await db.rollback()
            logger.error(f"Error processing Stripe webhook {stripe_event_id}: {str(e)}")
            
            # Log the processing failure
            fail_log = SystemLog(
                level="ERROR",
                category="WEBHOOK",
                action=f"stripe_{event.type}_failed",
                message=f"Failed to process Stripe event {stripe_event_id}: {str(e)}",
                log_metadata={"stripe_event_id": stripe_event_id},
                stack_trace=str(e)
            )
            db.add(fail_log)
            await db.commit()
            
            # Return 500 so Stripe retries
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Processing failed")

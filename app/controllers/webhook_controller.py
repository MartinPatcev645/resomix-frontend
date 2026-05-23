"""
Webhook Controller
==================

This controller handles the processing of incoming webhooks from external services like Stripe.
"""

import json
import stripe
import logging
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.log import SystemLog
from app.services.purchase_service import PurchaseService

logger = logging.getLogger(__name__)

class WebhookController:
    def __init__(self):
        self.purchase_service = PurchaseService()
        stripe.api_key = settings.stripe_secret_key

    async def handle_stripe_webhook(self, db: AsyncSession, request: Request) -> dict:
        """
        Phase 3: The Idempotent Webhook Pipeline
        Goal: Securely receive and process Stripe confirmations.
        """
        payload = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        webhook_secret = settings.stripe_webhook_secret

        if not sig_header:
            logger.warning("Missing Stripe-Signature header")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signature")

        try:
            # 2. Signature Verification
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError:
            # Invalid payload
            logger.error("Invalid Stripe payload")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logger.error(f"Stripe signature verification failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

        # 3. Idempotency Check
        # Take the Stripe event.id (e.g., evt_12345)
        stripe_event_id = event.get("id")
        
        # Query system_logs to see if we already processed this event
        # Note: We store the event ID in log_metadata
        stmt = select(SystemLog).where(
            SystemLog.log_metadata["stripe_event_id"].as_string() == stripe_event_id
        )
        result = await db.execute(stmt)
        if result.scalars().first():
            logger.info(f"Stripe event {stripe_event_id} already processed. Skipping.")
            return {"status": "success", "message": "Already processed"}

        # 4. Audit Logging (Atomic or separate? We'll log it first)
        log_entry = SystemLog(
            level="INFO",
            category="WEBHOOK",
            action=f"stripe_{event.get('type')}",
            message=f"Processing Stripe event: {stripe_event_id}",
            log_metadata={
                "stripe_event_id": stripe_event_id,
                "event_type": event.get("type"),
                "raw_payload": event.to_dict()
            },
            endpoint=str(request.url.path),
            method=request.method,
            client_ip=request.client.host if request.client else None
        )
        db.add(log_entry)
        
        # Route the event to appropriate service
        # Phase 4 Workflow: checkout.session.completed
        try:
            from app.models.partner import Partner

            if event.get("type") == "checkout.session.completed":
                session = event.get("data", {}).get("object")
                await self.purchase_service.fulfill_order(db, session)
            
            elif event.get("type") == "charge.dispute.created":
                dispute = event.get("data", {}).get("object")
                # Phase 5: Dispute Automation
                await self.purchase_service.handle_dispute(db, dispute)

            elif event.get("type") in ["customer.subscription.created", "customer.subscription.updated"]:
                subscription = event.get("data", {}).get("object")
                metadata = subscription.get("metadata", {})
                partner_id_str = metadata.get("partner_id")
                tier = metadata.get("tier")

                partner = None
                if partner_id_str:
                    partner_id = int(partner_id_str)
                    stmt = select(Partner).where(Partner.id == partner_id)
                    p_res = await db.execute(stmt)
                    partner = p_res.scalar_one_or_none()
                
                if not partner:
                    # Fallback lookup by stripe customer ID
                    stripe_customer_id = subscription.get("customer")
                    stmt = select(Partner).where(Partner.stripe_customer_id == stripe_customer_id)
                    p_res = await db.execute(stmt)
                    partner = p_res.scalar_one_or_none()

                if partner:
                    partner.stripe_subscription_id = subscription.get("id")
                    status = subscription.get("status")
                    if status in ["active", "trialing"]:
                        if tier:
                            partner.tier = tier
                        partner.is_active = True
                    elif status in ["unpaid", "canceled", "incomplete_expired"]:
                        partner.is_active = False
                    logger.info(f"Stripe Webhook: Updated Partner {partner.id} subscription status to {status} (tier {partner.tier})")

            elif event.get("type") == "customer.subscription.deleted":
                subscription = event.get("data", {}).get("object")
                stripe_sub_id = subscription.get("id")

                stmt = select(Partner).where(Partner.stripe_subscription_id == stripe_sub_id)
                p_res = await db.execute(stmt)
                partner = p_res.scalar_one_or_none()

                if partner:
                    partner.stripe_subscription_id = None
                    partner.tier = "sandbox"
                    logger.info(f"Stripe Webhook: Reverted Partner {partner.id} to sandbox due to subscription deletion.")

            elif event.get("type") == "invoice.paid":
                invoice = event.get("data", {}).get("object")
                stripe_customer_id = invoice.get("customer")
                amount_paid = invoice.get("amount_paid", 0) / 100.0
                logger.info(f"Stripe Webhook: Successful invoice payment of €{amount_paid} for Stripe Customer {stripe_customer_id}")

            elif event.get("type") == "invoice.payment_failed":
                invoice = event.get("data", {}).get("object")
                stripe_customer_id = invoice.get("customer")
                logger.error(f"Stripe Webhook: Invoice payment failed for customer {stripe_customer_id}. Suspending partner account.")

                stmt = select(Partner).where(Partner.stripe_customer_id == stripe_customer_id)
                p_res = await db.execute(stmt)
                partner = p_res.scalar_one_or_none()

                if partner:
                    partner.is_active = False
                    logger.warning(f"Stripe Webhook: Suspended Partner {partner.id} account.")

            # Commit audit log and subscription changes
            await db.commit()
            return {"status": "success"}

        except Exception as e:
            await db.rollback()
            logger.error(f"Error processing Stripe webhook {stripe_event_id}: {str(e)}")
            # Log the failure as well
            fail_log = SystemLog(
                level="ERROR",
                category="WEBHOOK",
                action=f"stripe_{event.get('type')}_failed",
                message=f"Failed to process Stripe event {stripe_event_id}: {str(e)}",
                log_metadata={"stripe_event_id": stripe_event_id},
                stack_trace=str(e)
            )
            db.add(fail_log)
            await db.commit()
            
            # Return 500 so Stripe retries
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Processing failed")

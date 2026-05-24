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

from app.core.config import settings
from app.models.log import SystemLog
from app.repositories.log_repository import LogRepository
from app.services.purchase_service import PurchaseService

logger = logging.getLogger(__name__)


class WebhookService:
    """Service layer managing Stripe webhooks and payment event flows."""

    def __init__(self) -> None:
        self.purchase_service = PurchaseService()
        self.log_repo = LogRepository()
        stripe.api_key = settings.stripe_secret_key

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
        stripe_event_id = event.get("id")
        existing_log = await self.log_repo.async_get_log_by_stripe_event_id(db, stripe_event_id)
        if existing_log:
            logger.info(f"Stripe event {stripe_event_id} already processed. Skipping.")
            return {"status": "success", "message": "Already processed"}

        # 3. Create Audit Log
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
            endpoint=url_path,
            method=method,
            client_ip=client_ip
        )
        db.add(log_entry)
        await db.flush()

        # 4. Route and Process Event
        try:
            if event.get("type") == "checkout.session.completed":
                session = event.get("data", {}).get("object")
                await self.purchase_service.fulfill_order(db, session)
            
            elif event.get("type") == "charge.dispute.created":
                dispute = event.get("data", {}).get("object")
                await self.purchase_service.handle_dispute(db, dispute)

            # Commit the audit log and fulfillment changes atomically
            await db.commit()
            return {"status": "success"}

        except Exception as e:
            await db.rollback()
            logger.error(f"Error processing Stripe webhook {stripe_event_id}: {str(e)}")
            
            # Log the processing failure
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

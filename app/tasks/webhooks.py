"""
Partner Webhook Dispatcher Tasks
================================

Celery tasks for executing asynchronous, secure HTTP POST deliveries of webhook events
to partners, featuring automatic HMAC-SHA256 signing and exponential-backoff retries.
"""

import hmac
import hashlib
import json
import logging
import time
import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import httpx
from celery import Task
from sqlalchemy import select

from app.core.config import settings
from app.core.context import set_current_partner_id
from app.models.partner import PartnerWebhook, WebhookDeliveryLog
from .async_runner import run_async_task
from database.connection import AsyncSessionLocal
from .celery_app import celery_app

logger = logging.getLogger(__name__)

async def _async_dispatch_webhook(
    partner_id: int, 
    event_type: str, 
    payload: Dict[str, Any], 
    attempt_number: int, 
    webhook_id: Optional[int]
) -> None:
    """Async core of the webhook dispatcher."""
    # Set the current partner ID context to satisfy database multi-tenancy failsafes
    set_current_partner_id(partner_id)

    async with AsyncSessionLocal() as db:
        # Resolve webhook subscriptions
        if webhook_id:
            # If we are retrying or manually targeting a single webhook
            stmt = select(PartnerWebhook).where(
                PartnerWebhook.id == webhook_id,
                PartnerWebhook.partner_id == partner_id,
                PartnerWebhook.is_active == True
            )
        else:
            # Query all active webhook subscriptions for this partner
            stmt = select(PartnerWebhook).where(
                PartnerWebhook.partner_id == partner_id,
                PartnerWebhook.is_active == True
            )
        
        result = await db.execute(stmt)
        webhooks = result.scalars().all()

        if not webhooks:
            logger.info(f"No active webhook subscriptions found for partner {partner_id}.")
            return

        for webhook in webhooks:
            # Check if this webhook is subscribed to this event type
            subscribed_events = webhook.events or []
            if event_type not in subscribed_events:
                logger.debug(f"Webhook {webhook.id} is not subscribed to event '{event_type}'")
                continue

            logger.info(
                f"Dispatching webhook event '{event_type}' to partner {partner_id} "
                f"at {webhook.url} (Attempt {attempt_number})"
            )

            # Generate unique event identifier and wrapped payload
            event_uuid = f"evt_{uuid.uuid4().hex}"
            wrapped_payload = {
                "id": event_uuid,
                "event": event_type,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "partner_id": partner_id,
                "data": payload
            }

            # Serialize payload to sorted-key JSON bytes for deterministic signing
            payload_bytes = json.dumps(wrapped_payload, sort_keys=True).encode("utf-8")
            
            # Compute signature using partner webhook's secret hash as key
            signature = hmac.new(
                webhook.secret_hash.encode("utf-8"),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()

            headers = {
                "Content-Type": "application/json",
                "X-Resomix-Signature": signature,
                "User-Agent": "Resomix-Webhook-Dispatcher/1.0"
            }

            # POST request with precise timeout & latency tracking
            start_time = time.time()
            response_status = None
            response_latency_ms = None
            error_message = None
            delivered = False

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        webhook.url, 
                        content=payload_bytes, 
                        headers=headers
                    )
                    latency = int((time.time() - start_time) * 1000)
                    response_status = response.status_code
                    response_latency_ms = latency

                    if 200 <= response.status_code < 300:
                        delivered = True
                    else:
                        error_message = f"HTTP {response.status_code}: {response.text[:500]}"
            except httpx.RequestError as exc:
                latency = int((time.time() - start_time) * 1000)
                response_latency_ms = latency
                error_message = f"Network or connection error: {str(exc)}"
                logger.error(f"Webhook delivery request error on webhook {webhook.id}: {str(exc)}")
            except Exception as exc:
                latency = int((time.time() - start_time) * 1000)
                response_latency_ms = latency
                error_message = f"Unexpected error: {str(exc)}"
                logger.error(f"Unexpected webhook delivery error on webhook {webhook.id}: {str(exc)}")

            # Log delivery attempt
            delivery_log = WebhookDeliveryLog(
                correlation_id=event_uuid,
                webhook_id=webhook.id,
                partner_id=partner_id,
                event_type=event_type,
                payload=wrapped_payload,
                attempt_number=attempt_number,
                response_status=response_status,
                response_latency_ms=response_latency_ms,
                error_message=error_message,
                delivered_at=datetime.utcnow() if delivered else None
            )
            db.add(delivery_log)

            # Update webhook statistics & failures
            webhook.last_delivery_at = datetime.utcnow()
            webhook.last_delivery_status_code = response_status
            
            if delivered:
                webhook.consecutive_failures = 0
                logger.info(f"Webhook {webhook.id} successfully delivered on attempt {attempt_number}.")
            else:
                webhook.consecutive_failures += 1
                logger.warning(
                    f"Webhook {webhook.id} delivery failed (Consecutive failures: {webhook.consecutive_failures}). "
                    f"Error: {error_message}"
                )

                # Auto-deactivate webhook if failure threshold reached (10 consecutive errors)
                if webhook.consecutive_failures >= 10:
                    webhook.is_active = False
                    logger.error(f"Webhook {webhook.id} for partner {partner_id} deactivated due to 10 consecutive failures.")

                # Schedule Celery-based retry if retry count remains
                if attempt_number < 6:
                    retry_countdown = [60, 300, 1800, 7200, 28800][attempt_number - 1]
                    logger.info(
                        f"Scheduling retry attempt {attempt_number + 1} for webhook {webhook.id} "
                        f"in {retry_countdown} seconds."
                    )
                    dispatch_webhook.apply_async(
                        args=(partner_id, event_type, payload),
                        kwargs={"attempt_number": attempt_number + 1, "webhook_id": webhook.id},
                        countdown=retry_countdown
                    )

        # Commit all logging and updates to MariaDB
        await db.commit()


@celery_app.task(bind=True, max_retries=5)
def dispatch_webhook(
    self, 
    partner_id: int, 
    event_type: str, 
    payload: Dict[str, Any], 
    attempt_number: int = 1, 
    webhook_id: Optional[int] = None
) -> None:
    """
    Celery task to dispatch a B2B partner webhook event.
    Executes the underlying async logic in a synchronous celery execution frame.
    """
    run_async_task(_async_dispatch_webhook(
        partner_id=partner_id,
        event_type=event_type,
        payload=payload,
        attempt_number=attempt_number,
        webhook_id=webhook_id
    ))

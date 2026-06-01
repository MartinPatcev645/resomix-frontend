"""
Webhook Controller
==================

This controller handles the processing of incoming webhooks from external services like Stripe.
"""

import logging
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


class WebhookController:
    def __init__(self):
        self.webhook_service = WebhookService()

    async def handle_stripe_webhook(self, db: AsyncSession, request: Request) -> dict:
        """
        Securely hand off Stripe webhook event processing to WebhookService.
        """
        payload = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        url_path = str(request.url.path)
        method = request.method
        client_ip = request.client.host if request.client else None

        return await self.webhook_service.handle_stripe_webhook(
            db=db,
            payload=payload,
            sig_header=sig_header,
            url_path=url_path,
            method=method,
            client_ip=client_ip
        )


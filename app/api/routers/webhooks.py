"""
Webhooks Router
===============

Secure endpoint for receiving Stripe webhooks.
Uses /api/v1 prefix specifically to match the Stripe CLI command configured by the user.
"""

from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies.database import get_database_session
from app.controllers.webhook_controller import WebhookController

# Note: Using /api/v1/webhooks to match 'stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe'
router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])
webhook_controller = WebhookController()

@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_database_session)
):
    """
    Handle incoming Stripe webhook events.
    Bypasses standard authentication (signature is verified internally).
    """
    return await webhook_controller.handle_stripe_webhook(db, request)

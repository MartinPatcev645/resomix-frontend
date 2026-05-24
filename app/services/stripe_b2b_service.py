"""
Stripe B2B Subscription Service
===============================

Handles B2B subscription lifecycle, including Stripe customer creation with VIES VAT
verification, automatic tax calculation (Greek VAT & EU OSS), and Checkout Session generation.
"""

import logging
import stripe
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.partner import Partner
from app.services.vies_service import ViesService

logger = logging.getLogger(__name__)

class StripeB2bService:
    """Service for handling B2B partner billing and Stripe subscription setup."""

    def __init__(self):
        stripe.api_key = settings.stripe_secret_key

    async def get_or_create_customer(self, db: AsyncSession, partner: Partner) -> str:
        """
        Retrieve or create a Stripe Customer for a given partner.
        Validates VAT numbers via VIES and attaches them as customer tax IDs.
        """
        if partner.stripe_customer_id:
            logger.info(f"Partner {partner.id} already has Stripe Customer ID: {partner.stripe_customer_id}")
            return partner.stripe_customer_id

        logger.info(f"Creating new Stripe Customer for partner {partner.id} ({partner.legal_name})")
        
        customer_kwargs: Dict[str, Any] = {
            "email": partner.contact_email,
            "name": partner.legal_name,
            "metadata": {
                "partner_id": partner.id,
                "partner_uuid": partner.partner_uuid
            }
        }

        # Add physical address template if country code is present
        if partner.country_code:
            customer_kwargs["address"] = {
                "country": partner.country_code.upper()
            }

        # Validate VAT ID via VIES if present
        tax_id_data = None
        if partner.vat_number and partner.country_code:
            vies_res = await ViesService.validate_vat(partner.vat_number, partner.country_code)
            if vies_res.get("valid"):
                logger.info(f"VAT '{partner.vat_number}' for partner {partner.id} is VIES-verified.")
                
                # Format VAT correctly for Stripe tax ID (requires country code prefix)
                country_prefix = partner.country_code.upper()
                if country_prefix == "GR":
                    country_prefix = "EL"
                
                clean_vat = partner.vat_number.upper().strip()
                if not clean_vat.startswith(country_prefix):
                    clean_vat = f"{country_prefix}{clean_vat}"
                
                tax_id_data = {
                    "type": "eu_vat",
                    "value": clean_vat
                }
            else:
                logger.warning(
                    f"VAT '{partner.vat_number}' for partner {partner.id} failed VIES validation: "
                    f"{vies_res.get('error') or 'Invalid status'}"
                )

        # Create Stripe customer
        customer = stripe.Customer.create(**customer_kwargs)
        
        # Attach Tax ID if verified
        if tax_id_data:
            try:
                stripe.Customer.create_tax_id(
                    customer.id,
                    type=tax_id_data["type"],
                    value=tax_id_data["value"]
                )
                logger.info(f"Attached VIES-validated VAT tax ID {tax_id_data['value']} to Stripe Customer {customer.id}")
            except Exception as e:
                logger.error(f"Failed to attach tax ID to Stripe Customer: {e}")

        # Update partner record with Stripe customer ID
        partner.stripe_customer_id = customer.id
        await db.flush() # Sync with current transaction
        
        return customer.id

    async def create_b2b_checkout_session(
        self, 
        db: AsyncSession, 
        partner: Partner, 
        tier: str, 
        billing_cycle: str,
        po_number: Optional[str] = None
    ) -> str:
        """
        Generate a Stripe Checkout Session for a B2B partner subscription.
        Automatically registers Greek VAT / EU OSS and applies correct tax calculations.
        """
        # 1. Resolve Stripe price ID
        tier_lower = tier.lower()
        cycle_lower = billing_cycle.lower()

        if tier_lower == "starter":
            price_id = settings.stripe_price_starter_monthly if cycle_lower == "monthly" else settings.stripe_price_starter_annual
        elif tier_lower == "growth":
            price_id = settings.stripe_price_growth_monthly if cycle_lower == "monthly" else settings.stripe_price_growth_annual
        elif tier_lower == "enterprise":
            price_id = settings.stripe_price_enterprise_monthly if cycle_lower == "monthly" else settings.stripe_price_enterprise_annual
        else:
            raise ValueError(f"Invalid B2B subscription tier: {tier}")

        # 2. Retrieve or create Stripe customer
        customer_id = await self.get_or_create_customer(db, partner)

        # 3. Setup checkout session
        metadata = {
            "partner_id": str(partner.id),
            "tier": tier_lower,
            "billing_cycle": cycle_lower,
        }
        if po_number:
            metadata["po_number"] = po_number

        session_kwargs = {
            "customer": customer_id,
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            # Enable Stripe Tax automatic calculation (crucial for Greek VAT registration / EU OSS)
            "automatic_tax": {"enabled": True},
            "customer_update": {"address": "auto"},
            "success_url": f"{settings.resomix_server_url}/api/v1/admin/partners/stripe-success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{settings.resomix_server_url}/api/v1/admin/partners/stripe-cancel",
            "metadata": metadata,
            "subscription_data": {
                "metadata": metadata,
                # Force standard branded invoicing options
                "invoice_settings": {
                    "issuer": {"type": "self"}
                }
            }
        }

        # Create checkout session
        session = stripe.checkout.Session.create(**session_kwargs)
        
        return session.url

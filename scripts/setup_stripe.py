"""
Stripe B2B Product & Pricing Setup Utility
==========================================

Utility script to automatically provision B2B subscription products and monthly/annual prices
on Stripe. Outputs the resulting Price IDs for inclusion in the .env file.
"""

import os
import stripe
from dotenv import load_dotenv

# Load current environment variables
load_dotenv()

# Retrieve Stripe test secret key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

if not stripe.api_key or stripe.api_key.startswith("sk_test_mock"):
    print("WARNING: STRIPE_SECRET_KEY is not configured or is a mock key. Please set a valid test key in your .env.")
    print("Script will run in dry-run mode or exit if Stripe API fails.")

# 3 B2B Subscription tiers, prices, and SaaS Tax Code (txcd_10103001 = Software as a Service)
TIERS = {
    "Starter": {
        "description": "Starter plan for independent labels and boutique studios",
        "monthly": 99.00,
        "annual": 990.00, # 17% discount (10 months for price of 12)
    },
    "Growth": {
        "description": "Growth plan for growing sync companies and mid-sized catalogs",
        "monthly": 299.00,
        "annual": 2990.00, # 17% discount
    },
    "Enterprise": {
        "description": "Enterprise tier for major labels with high-volume requirements",
        "monthly": 999.00,
        "annual": 9990.00, # 17% discount
    }
}

def setup_stripe_billing():
    """Create Products and Prices in Stripe."""
    env_lines = []
    
    print("\nStarting Resomix B2B Stripe Billing Setup...")
    print("==========================================")
    
    for name, details in TIERS.items():
        print(f"\n[+] Provisioning Product: Resomix B2B {name}...")
        
        try:
            # 1. Create Product
            product = stripe.Product.create(
                name=f"Resomix B2B - {name}",
                description=details["description"],
                tax_code="txcd_10103001", # Standard B2B SaaS tax code for Stripe Tax automatic calculation
                metadata={
                    "resomix_tier": name.lower(),
                    "type": "b2b_subscription"
                }
            )
            
            # 2. Create Monthly Price
            price_monthly = stripe.Price.create(
                product=product.id,
                unit_amount=int(details["monthly"] * 100), # Stripe expects amount in cents
                currency="eur",
                recurring={"interval": "month"},
                metadata={
                    "resomix_tier": name.lower(),
                    "billing_cycle": "monthly"
                }
            )
            
            # 3. Create Annual Price
            price_annual = stripe.Price.create(
                product=product.id,
                unit_amount=int(details["annual"] * 100),
                currency="eur",
                recurring={"interval": "year"},
                metadata={
                    "resomix_tier": name.lower(),
                    "billing_cycle": "annual"
                }
            )
            
            print(f"    Product ID: {product.id}")
            print(f"    Monthly Price ID: {price_monthly.id} (€{details['monthly']}/mo)")
            print(f"    Annual Price ID: {price_annual.id} (€{details['annual']}/yr)")
            
            # Collect environment variables
            tier_upper = name.upper()
            env_lines.append(f"STRIPE_PRICE_{tier_upper}_MONTHLY={price_monthly.id}")
            env_lines.append(f"STRIPE_PRICE_{tier_upper}_ANNUAL={price_annual.id}")
            
        except Exception as e:
            print(f"    [-] Failed to provision tier {name}: {e}")
            
    print("\n==========================================")
    print("SETUP COMPLETE! Copy the following keys into your `.env` file:")
    print("==========================================\n")
    for line in env_lines:
        print(line)
    print("\n==========================================\n")

if __name__ == "__main__":
    setup_stripe_billing()

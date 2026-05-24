import asyncio
import os
import sys

# Ensure backend root directory is in path
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_root)

from database.connection import AsyncSessionLocal
from app.services.partner_service import PartnerService
from app.schemas.partner import PartnerBaseResponse

async def main():
    service = PartnerService()
    async with AsyncSessionLocal() as db:
        # Fetch the partner with ID 10167
        partner_id = 10167
        print(f"Querying partner ID {partner_id}...")
        partner = await service.get_partner(db, partner_id)
        if partner:
            print("Successfully found partner!")
            print(f"Legal Name: {partner.legal_name}")
            print(f"Display Name: {partner.display_name}")
            print(f"Email: {partner.contact_email}")
            print(f"Tier: {partner.tier}")
            
            # Verify validation against the Pydantic response schema
            validated = PartnerBaseResponse.model_validate(partner)
            print("Successfully validated against PartnerBaseResponse!")
            print(validated.model_dump())
        else:
            print(f"Partner {partner_id} not found in the database.")

if __name__ == "__main__":
    asyncio.run(main())

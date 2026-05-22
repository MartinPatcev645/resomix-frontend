import asyncio
import os
import sys
import json

# Ensure backend root directory is in path
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_root)

from database.connection import AsyncSessionLocal
from app.controllers.partner_controller import PartnerController

async def test_sftp_status(partner_id: int):
    controller = PartnerController()
    async with AsyncSessionLocal() as db:
        print(f"\n--- Testing SFTP Status for Partner ID {partner_id} ---")
        response = await controller.get_partner_sftp_status(db, partner_id)
        print(f"Status Code: {response.status_code}")
        
        # Load and parse body
        body = json.loads(response.body.decode("utf-8"))
        print("Parsed JSON Response:")
        print(json.dumps(body, indent=2))
        
        # Validate structure
        assert "success" in body, "Response missing 'success'"
        assert "data" in body, "Response missing 'data'"
        data = body["data"]
        assert "provisioned" in data, "Response data missing 'provisioned'"
        
        if data["provisioned"]:
            print("Verified: Partner has provisioned SFTP status details.")
            assert data["username"] is not None, "Provisioned SFTP must have username"
            assert data["host"] is not None, "Provisioned SFTP must have host"
        else:
            print("Verified: Partner is NOT provisioned. Graceful unprovisioned payload returned successfully!")
            assert data["username"] is None, "Unprovisioned username must be None"
            assert data["host"] is None, "Unprovisioned host must be None"

async def main():
    # Test with ID 10151 (an unprovisioned partner from console log)
    await test_sftp_status(10151)
    
    # Test with ID 10167 (from implementation plan / db check)
    await test_sftp_status(10167)

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import os
import sys

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.services.partner_service import PartnerService
from app.schemas.partner import ApiKeyIssueRequest
from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context

async def issue_key():
    # Flag as admin to bypass multi-tenancy failsafe
    set_admin_context(True)
    
    async with AsyncSessionLocal() as db:
        service = PartnerService()
        
        # Issue a key for Partner 2 (Test Partner)
        # We set RPS to 5 to make it easy to trigger burst protection in testing
        request = ApiKeyIssueRequest(
            partner_id=2, 
            label="Load Test Key",
            scopes=["search:read", "ingest:write", "metadata:read", "analytics:read"],
            rate_limit_rps=5,
            rate_limit_monthly=100000
        )
        
        try:
            api_key, plaintext = await service.issue_api_key(db, request)
            print("Successfully issued new API Key for Partner 2")
            print(f"API KEY: {plaintext}")
            print(f"RPS LIMIT: 5")
            print(f"MONTHLY LIMIT: 100,000")
        except Exception as e:
            print(f"Error issuing key: {e}")

if __name__ == "__main__":
    asyncio.run(issue_key())

import asyncio
import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database.connection import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        print("\n=== REGISTERED PARTNERS ===")
        res_p = await db.execute(text("SELECT id, partner_uuid, display_name, tier FROM partners"))
        for p in res_p.fetchall():
            print(f"ID: {p[0]}, UUID: {p[1]}, Name: {p[2]}, Tier: {p[3]}")
        
        print("\n=== TRACK COUNTS BY PARTNER ===")
        res_t = await db.execute(text("SELECT partner_id, COUNT(*) FROM tracks GROUP BY partner_id"))
        for t in res_t.fetchall():
            print(f"Partner ID: {t[0]}, Tracks: {t[1]}")
        print("===============================\n")

if __name__ == "__main__":
    asyncio.run(main())

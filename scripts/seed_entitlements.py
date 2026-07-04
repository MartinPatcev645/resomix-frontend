"""
Seed Entitlements (runner)
=========================

Idempotent baseline seed for the frontend plan/entitlement system.

    python -m scripts.seed_entitlements

Safe to run repeatedly (create-if-missing) — it never overwrites admin-tuned values.
"""

import asyncio

from app.core.context import set_admin_context
from app.services.entitlement_seed import seed_entitlements
from database.connection import AsyncSessionLocal


async def _run() -> None:
    # plans/features are not partner-scoped, but set admin context for consistency.
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        created = await seed_entitlements(db)
        await db.commit()
    print(f"[seed_entitlements] created: {created}")


if __name__ == "__main__":
    asyncio.run(_run())

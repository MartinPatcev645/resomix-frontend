"""
Quota Sync Worker
=================

Background asyncio task that periodically synchronizes Redis-based monthly quota 
counters to the partner_quotas table in MariaDB.

Follows the pattern established in telemetry_worker.py and cleanup_worker.py.

Version: 1.0.0
Date: May 12, 2026
Author: Muhammad Usman Naeem
"""

import asyncio
import logging
from app.services.partner_service import PartnerService
from app.core.config import settings
from database.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def start_quota_sync_worker():
    """
    Background worker that flushes Redis quota counters to MariaDB.
    
    Runs on a configurable interval (default 300 seconds / 5 minutes).
    Each cycle:
        1. Opens a new DB session.
        2. Calls PartnerService.sync_quotas_from_redis().
        3. Logs the stats.
        4. Sleeps until next cycle.
    """
    sync_interval = getattr(settings, "quota_sync_interval_seconds", 300)
    partner_service = PartnerService()

    logger.info(f"Quota sync worker started. Interval: {sync_interval}s")

    # Initial delay to let the application fully start up and Redis pool initialize
    await asyncio.sleep(10)

    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Use admin context or bypass if necessary (PartnerService uses direct SQL)
                # But here it's fine since it's a system task.
                stats = await partner_service.sync_quotas_from_redis(db)
                
                if stats.get("updated", 0) > 0 or stats.get("errors", 0) > 0:
                    logger.info(
                        f"Quota sync cycle complete: "
                        f"total_keys={stats['total_keys']}, "
                        f"updated={stats['updated']}, "
                        f"errors={stats['errors']}"
                    )
                    
        except asyncio.CancelledError:
            logger.info("Quota sync worker cancelled. Shutting down.")
            raise
        except Exception as e:
            logger.error(f"Quota sync worker encountered an error: {e}", exc_info=True)

        await asyncio.sleep(sync_interval)

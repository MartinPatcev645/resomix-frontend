"""
Telemetry Flush Worker
======================

Background asyncio task that periodically pops telemetry events from the Redis
queue and bulk-inserts them into the consumption_events table.

Follows the same pattern as cleanup_worker.py — runs as an asyncio.create_task()
in the FastAPI lifespan manager.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import asyncio
import logging

from app.services.telemetry_service import TelemetryService
from app.core.config import settings
from database.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def start_telemetry_flush_worker():
    """
    Background worker that flushes the Redis telemetry queue to MariaDB.

    Runs on a configurable interval (default 120 seconds).
    Each cycle:
        1. Opens a new DB session from the async session factory.
        2. Calls TelemetryService.flush_queue_to_db() to pop and insert.
        3. Closes the session.
        4. Sleeps until the next cycle.

    The worker is started via asyncio.create_task() in the FastAPI lifespan
    and cancelled on shutdown — identical to the cleanup_worker pattern.
    """
    flush_interval = getattr(settings, "telemetry_flush_interval_seconds", 120)
    telemetry_service = TelemetryService()

    logger.info(
        f"Telemetry flush worker started. "
        f"Interval: {flush_interval}s, "
        f"Redis key: {telemetry_service._get_redis_key()}"
    )

    # Initial delay to let the application fully start up
    await asyncio.sleep(5)

    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await telemetry_service.flush_queue_to_db(db)

                if result.get("total_inserted", 0) > 0:
                    logger.info(
                        f"Telemetry flush cycle complete: "
                        f"inserted={result['total_inserted']}, "
                        f"skipped={result['total_skipped']}, "
                        f"batches={result['batches_processed']}"
                    )

                if result.get("errors"):
                    for error in result["errors"]:
                        logger.warning(f"Telemetry flush error: {error}")

        except asyncio.CancelledError:
            logger.info("Telemetry flush worker cancelled. Shutting down.")
            raise  # Re-raise to properly exit the task
        except Exception as e:
            logger.error(
                f"Telemetry flush worker encountered an error: {e}",
                exc_info=True,
            )

        await asyncio.sleep(flush_interval)

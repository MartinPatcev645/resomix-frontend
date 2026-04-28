"""
Telemetry Service
=================

This service handles the business logic for stream telemetry event processing.
It implements a two-phase architecture:
    Phase 1 (hot path): Serialize events and LPUSH to Redis queue.
    Phase 2 (background): Pop from Redis and bulk-INSERT into MariaDB.

No database access occurs on the hot path to ensure sub-millisecond response
times for the frontend's 30-second heartbeat and sendBeacon calls.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import json
import logging
import redis.asyncio as aioredis

from app.repositories.telemetry_repository import TelemetryRepository
from app.core.config import settings
from app.db.redis import _redis_pool

logger = logging.getLogger(__name__)


class TelemetryService:
    """
    Service for stream telemetry event processing.

    Orchestrates the Redis-based event queue and delegates
    bulk persistence to the TelemetryRepository.
    """

    def __init__(self):
        """Initialize telemetry service with repository dependency."""
        self.telemetry_repository = TelemetryRepository()

    def _get_redis_key(self) -> str:
        """Get the Redis list key for the telemetry event queue."""
        return getattr(settings, "telemetry_redis_key", "telemetry:stream_events_queue")

    async def _get_redis_client(self) -> Optional[aioredis.Redis]:
        """
        Get a Redis client from the connection pool.

        Returns:
            Redis client or None if pool is unavailable.
        """
        try:
            if _redis_pool is not None:
                return aioredis.Redis(connection_pool=_redis_pool)
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
        return None

    async def enqueue_events(
        self,
        events: List[Dict[str, Any]],
        client_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Phase 1 (hot path): Enqueue telemetry events into the Redis queue.

        Serializes each event with server-side metadata (client_ip, source_device)
        and pushes to the Redis list. No database access occurs here.

        If Redis is unavailable, returns a failure result. The controller layer
        handles the fallback.

        Args:
            events: List of event dicts from the validated TelemetryBatch
            client_ip: Client IP address from the HTTP request

        Returns:
            {"success": bool, "accepted": int, "error": str|None}
        """
        redis_key = self._get_redis_key()
        client = await self._get_redis_client()

        if client is None:
            logger.warning(
                "Redis unavailable for telemetry enqueue. "
                f"Dropping {len(events)} events."
            )
            return {
                "success": False,
                "accepted": 0,
                "error": "Queue service temporarily unavailable",
            }

        try:
            # Enrich each event with server-side metadata
            enriched_events = []
            for event in events:
                enriched = {
                    **event,
                    "client_ip": client_ip,
                    # ──────────────────────────────────────────────────────────
                    # ⚠️ DON'T DELETE — Source Device Detection
                    # Hardcoded to 'web' for now. When native clients are
                    # introduced, determine this from User-Agent or a
                    # dedicated client SDK identifier passed in the request.
                    # Source: User-Agent header parsing or X-Client-Platform header
                    # ──────────────────────────────────────────────────────────
                    "source_device": "web",
                }
                enriched_events.append(enriched)

            # Serialize the entire batch as a single JSON string and LPUSH
            payload = json.dumps(enriched_events)
            await client.lpush(redis_key, payload)

            logger.info(
                f"Enqueued {len(enriched_events)} telemetry events to Redis "
                f"(key={redis_key})"
            )

            return {
                "success": True,
                "accepted": len(enriched_events),
                "error": None,
            }

        except Exception as e:
            logger.error(f"Failed to enqueue telemetry events to Redis: {e}")
            return {
                "success": False,
                "accepted": 0,
                "error": f"Failed to enqueue events: {str(e)}",
            }
        finally:
            await client.close()

    async def flush_queue_to_db(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Phase 2 (background worker): Pop events from Redis and bulk-INSERT into DB.

        Pops up to `telemetry_worker_pop_size` batches from the Redis queue,
        deserializes them, and delegates to the repository for bulk insertion.

        Args:
            db: Database session for the bulk insert

        Returns:
            {"success": bool, "total_inserted": int, "total_skipped": int,
             "batches_processed": int, "errors": list}
        """
        redis_key = self._get_redis_key()
        pop_size = getattr(settings, "telemetry_worker_pop_size", 1000)

        client = await self._get_redis_client()
        if client is None:
            return {
                "success": False,
                "total_inserted": 0,
                "total_skipped": 0,
                "batches_processed": 0,
                "errors": ["Redis unavailable for flush"],
            }

        total_inserted = 0
        total_skipped = 0
        batches_processed = 0
        all_errors = []
        all_events = []

        try:
            # Pop batches from Redis (each LPUSH was one serialized batch)
            for _ in range(pop_size):
                raw = await client.rpop(redis_key)
                if raw is None:
                    break  # Queue is empty

                try:
                    batch = json.loads(raw)
                    if isinstance(batch, list):
                        all_events.extend(batch)
                    batches_processed += 1
                except json.JSONDecodeError as e:
                    all_errors.append(f"JSON decode error: {str(e)}")
                    continue

            if not all_events:
                return {
                    "success": True,
                    "total_inserted": 0,
                    "total_skipped": 0,
                    "batches_processed": batches_processed,
                    "errors": all_errors,
                }

            # Delegate to repository for bulk insert
            result = await self.telemetry_repository.async_bulk_insert_events(
                db, all_events
            )

            total_inserted = result.get("inserted", 0)
            total_skipped = result.get("skipped", 0)
            all_errors.extend(result.get("errors", []))

            if total_inserted > 0:
                logger.info(
                    f"Telemetry flush: inserted={total_inserted}, "
                    f"skipped={total_skipped}, batches={batches_processed}"
                )

            return {
                "success": result.get("success", False),
                "total_inserted": total_inserted,
                "total_skipped": total_skipped,
                "batches_processed": batches_processed,
                "errors": all_errors,
            }

        except Exception as e:
            logger.error(f"Telemetry flush failed: {e}")
            return {
                "success": False,
                "total_inserted": total_inserted,
                "total_skipped": total_skipped,
                "batches_processed": batches_processed,
                "errors": all_errors + [f"Flush exception: {str(e)}"],
            }
        finally:
            await client.close()

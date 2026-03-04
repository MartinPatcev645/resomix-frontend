import asyncio
import logging
import ast
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from database.connection import AsyncSessionLocal
from app.models.track import Track
from app.services.hetzner_service import HetznerService
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)


async def start_session_cleanup_worker():
    """
    Background worker that listens for Redis keyspace expiration events
    for user sessions, then aggressively triggers track deletions on Hetzner.
    """
    import redis.asyncio as aioredis
    from app.db.redis import _redis_pool

    if not _redis_pool:
        logger.error(
            "Redis pool is not initialized. Cannot start session cleanup worker."
        )
        return

    try:
        client = aioredis.Redis(connection_pool=_redis_pool)
        pubsub = client.pubsub()
        await client.ping()
        logger.info("Session Cleanup Worker successfully pinged Redis pool.")
    except Exception as e:
        logger.error(f"Failed to bind Redis client in worker: {e}")
        return

    # Enable Expiry events in Redis config explicitly
    try:
        await client.config_set("notify-keyspace-events", "Ex")
    except Exception as e:
        logger.warning(
            f"Could not automatically set notify-keyspace-events. Ensure Redis is configured with 'Ex'. Error: {e}"
        )

    # Listen to the exact expired channel
    await pubsub.psubscribe("__keyevent@0__:expired")
    logger.info(
        "Session cleanup worker started. Listening for Redis session expirations..."
    )

    try:
        hetzner_svc = HetznerService()
        log_svc = LoggingService()

        # Continuous listening loop
        async for message in pubsub.listen():
            logger.debug(f"[CLEANUP_WORKER] Raw message received: {message}")
            if message and message.get("type") in ["pmessage", "message"]:
                raw_data = message.get("data")
                key_name = (
                    raw_data.decode("utf-8")
                    if isinstance(raw_data, bytes)
                    else raw_data
                )
                logger.debug(
                    f"[CLEANUP_WORKER] Received keyspace event: type={message.get('type')}, data={key_name}"
                )
                if key_name and key_name.startswith("session:user:"):
                    try:
                        # Extract user ID from the expired TTL key
                        user_id = int(key_name.split(":")[-1])
                        logger.info(
                            f"[CLEANUP_WORKER] Session for user_id={user_id} expired. Triggering track cleanups..."
                        )

                        # Spin up database session to find their uploaded tracks
                        async with AsyncSessionLocal() as db_session:
                            from sqlalchemy import select

                            # We only delete tracks of type='upload'
                            stmt = select(Track).where(
                                Track.user_id == user_id, Track.type == "upload"
                            )
                            result = await db_session.execute(stmt)
                            tracks = result.scalars().all()

                            if not tracks:
                                logger.info(
                                    f"No active 'upload' tracks found for expired user_id={user_id}."
                                )
                                continue

                            for track in tracks:
                                logger.info(
                                    f"Attempting to delete Hetzner assets for track {track.uuid} (User {user_id})"
                                )

                                # Do the actual deletion Request to Hetzner
                                delete_result = (
                                    await hetzner_svc.delete_track_on_hetzner(
                                        track.uuid
                                    )
                                )

                                # Log it securely instead of dropping the local DB row
                                log_entry_message = f"Automated cleanup: Hetzner deletion {'succeeded' if delete_result.get('success') else 'failed'}."
                                log_svc.log(
                                    async_db=db_session,
                                    level=(
                                        "INFO"
                                        if delete_result.get("success")
                                        else "ERROR"
                                    ),
                                    category="SYSTEM",
                                    action="hetzner_track_cleanup",
                                    message=log_entry_message,
                                    metadata={
                                        "user_id": user_id,
                                        "track_uuid": track.uuid,
                                        "hetzner_response": delete_result,
                                    },
                                )
                                # Ensure logs commit per track to trace individual statuses
                                await db_session.commit()

                    except Exception as loop_ex:
                        logger.exception(
                            f"Error handling expired session key {key_name}: {str(loop_ex)}"
                        )

    except asyncio.CancelledError:
        logger.info("Session cleanup worker stopping (cancelled).")
    except Exception as e:
        logger.exception(f"Fatal error in session cleanup worker: {str(e)}")
    finally:
        await pubsub.close()
        await client.close()

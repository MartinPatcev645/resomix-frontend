"""
Telemetry Repository
====================

This repository handles data access operations for stream telemetry events.
It provides bulk INSERT functionality for the consumption_events table,
optimized for high-volume batch writes from the Redis queue.

Resolves frontend UUIDs to internal BIGINT IDs by pre-fetching from the
tracks and users tables before inserting.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, List, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import logging

from app.models.consumption_event import ConsumptionEvent
from app.models.track import Track
from app.models.user import User

logger = logging.getLogger(__name__)


class TelemetryRepository:
    """
    Repository for telemetry consumption event data access.

    Does NOT extend BaseRepository since the primary operation is bulk-write,
    not standard single-record CRUD.
    """

    async def _resolve_track_uuids(
        self, db: AsyncSession, track_uuids: Set[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Resolve track UUIDs to internal IDs, ISRCs, and label IDs.

        Args:
            db: Database session
            track_uuids: Set of track UUID strings to resolve

        Returns:
            Dict mapping UUID -> {"id": int, "isrc": str|None, "label_id": int|None}
        """
        if not track_uuids:
            return {}

        try:
            stmt = select(
                Track.uuid,
                Track.id,
                Track.isrc,
                Track.label_id,
            ).where(Track.uuid.in_(list(track_uuids)))

            result = await db.execute(stmt)
            rows = result.all()

            mapping = {}
            for row in rows:
                mapping[row.uuid] = {
                    "id": row.id,
                    "isrc": row.isrc,
                    "label_id": row.label_id,
                }

            return mapping

        except Exception as e:
            logger.error(f"Failed to resolve track UUIDs: {e}")
            return {}

    async def _resolve_user_uuids(
        self, db: AsyncSession, user_uuids: Set[str]
    ) -> Dict[str, int]:
        """
        Resolve user UUIDs to internal BIGINT IDs.

        Args:
            db: Database session
            user_uuids: Set of user UUID strings to resolve

        Returns:
            Dict mapping UUID -> internal user ID (BIGINT)
        """
        if not user_uuids:
            return {}

        try:
            stmt = select(User.uuid, User.id).where(
                User.uuid.in_(list(user_uuids))
            )
            result = await db.execute(stmt)
            rows = result.all()
            return {row.uuid: row.id for row in rows}

        except Exception as e:
            logger.error(f"Failed to resolve user UUIDs: {e}")
            return {}

    async def async_bulk_insert_events(
        self, db: AsyncSession, events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Bulk-insert consumption events into the database.

        Resolves track UUIDs -> BIGINT IDs (+ isrc, label_id) and
        user UUIDs -> BIGINT IDs before inserting.

        Events with unresolvable track_id are inserted with track_id=NULL
        (data is not dropped, but logged as a warning).

        Args:
            db: Database session
            events: List of event dicts with fields matching the frontend contract

        Returns:
            {"success": bool, "inserted": int, "skipped": int, "errors": list}
        """
        if not events:
            return {"success": True, "inserted": 0, "skipped": 0, "errors": []}

        errors = []
        inserted_count = 0

        try:
            # Step 1: Collect unique UUIDs for batch resolution
            track_uuids: Set[str] = set()
            user_uuids: Set[str] = set()

            for event in events:
                track_uuid = event.get("track_id")
                if track_uuid:
                    track_uuids.add(track_uuid)

                user_uuid = event.get("user_id")
                if user_uuid:
                    user_uuids.add(user_uuid)

            # Step 2: Resolve UUIDs to internal IDs in bulk
            track_map = await self._resolve_track_uuids(db, track_uuids)
            user_map = await self._resolve_user_uuids(db, user_uuids)

            # Step 3: Build ORM objects for bulk insert
            db_objects = []
            for event in events:
                try:
                    track_uuid = event.get("track_id")
                    track_info = track_map.get(track_uuid, {})

                    user_uuid = event.get("user_id")
                    resolved_user_id = user_map.get(user_uuid) if user_uuid else None

                    if track_uuid and track_uuid not in track_map:
                        logger.warning(
                            f"Track UUID '{track_uuid}' not found in DB. "
                            f"Inserting event with track_id=NULL."
                        )

                    db_obj = ConsumptionEvent(
                        event_category=event.get("event_type"),
                        track_id=track_info.get("id"),
                        track_format_id=event.get("track_format_id"),
                        isrc=track_info.get("isrc"),
                        label_id=track_info.get("label_id"),
                        user_id=resolved_user_id,
                        # ──────────────────────────────────────────────────────
                        # ⚠️ DON'T DELETE — Country Code Resolution
                        # Currently set to NULL. Will be populated via GeoIP
                        # lookup on client_ip when a GeoIP service (e.g.,
                        # MaxMind GeoLite2) is integrated.
                        # Source: GeoIP service applied to client_ip field
                        # ──────────────────────────────────────────────────────
                        country_code=None,
                        client_ip=event.get("client_ip"),
                        playback_context=event.get("context"),
                        # ──────────────────────────────────────────────────────
                        # ⚠️ DON'T DELETE — Source Device Detection
                        # Currently hardcoded to 'web'. When iOS/Android/Desktop
                        # clients are introduced, this should be determined from
                        # the User-Agent header or a dedicated client identifier.
                        # Source: User-Agent parsing or client SDK identifier
                        # ──────────────────────────────────────────────────────
                        source_device="web",
                        session_id=event.get("tab_id"),
                        duration_seconds=event.get("duration_seconds", 0),
                    )
                    db_objects.append(db_obj)

                except Exception as e:
                    errors.append(
                        f"Failed to build event object: {str(e)} | "
                        f"event_type={event.get('event_type')}, "
                        f"track_id={event.get('track_id')}"
                    )
                    continue

            # Step 4: Bulk add and commit
            if db_objects:
                db.add_all(db_objects)
                await db.commit()
                inserted_count = len(db_objects)

            return {
                "success": True,
                "inserted": inserted_count,
                "skipped": len(events) - inserted_count,
                "errors": errors,
            }

        except Exception as e:
            await db.rollback()
            logger.error(f"Bulk insert failed: {e}")
            return {
                "success": False,
                "inserted": 0,
                "skipped": len(events),
                "errors": [f"Bulk insert transaction failed: {str(e)}"],
            }

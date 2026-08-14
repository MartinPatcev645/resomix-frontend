"""
Track Artifact Status Repository
================================

Data-access for ``track_artifact_status`` — the per-upload state of the two sibling artifacts
(similarity playlist, analysis). Tenant-scoped: the global partner failsafe auto-filters reads by
the active partner, so these queries don't repeat the ``partner_id`` filter (writes set it
explicitly on the row).

Two shapes of call, and they are deliberately different:

* **the read** is a batch map, `{track_id: {...}}`, so a 20-row Library page costs one query rather
  than twenty. This is the whole reason the reads live here rather than as a relationship on the
  model — a lazy relationship would reintroduce the N+1 the batch maps beside it exist to avoid.
* **the writes** are single-row UPDATEs keyed on ``track_id``, each opening and committing its own
  transaction, because every caller is a Celery task recording an outcome. They must never raise:
  failing to record that an analysis finished cannot be allowed to turn a delivered analysis into a
  failed task.

Version: 1.0.0
Init Date: August 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.track_artifact_status import (
    ARTIFACT_PENDING,
    ARTIFACT_READY,
    ARTIFACT_STATES,
    TrackArtifactStatus,
)

logger = logging.getLogger(__name__)


class TrackArtifactStatusRepository:
    """Read the sibling-artifact state for a page of tracks; record it from the workers."""

    # ------------------------------------------------------------------ #
    # Read (request path)
    # ------------------------------------------------------------------ #
    async def async_get_artifact_status_map(
        self, db: AsyncSession, track_ids: List[int], partner_id: Optional[int] = None
    ) -> Dict[int, Dict[str, Any]]:
        """Map each track id -> its sibling-artifact state.

        One query for the whole page. Tracks with no row are simply absent, and the serializer
        treats that absence as "we have no state for this" rather than inventing one — an upload
        that predates this table, or a partner/catalogue track that never had siblings, must not
        be reported as pending.
        """
        if not track_ids:
            return {}

        conditions = [TrackArtifactStatus.track_id.in_(track_ids)]
        if partner_id is not None:
            conditions.append(TrackArtifactStatus.partner_id == partner_id)

        stmt = select(
            TrackArtifactStatus.track_id,
            TrackArtifactStatus.playlist_state,
            TrackArtifactStatus.playlist_error,
            TrackArtifactStatus.analysis_state,
            TrackArtifactStatus.analysis_error,
        ).where(and_(*conditions))

        result = await db.execute(stmt)
        return {
            row.track_id: {
                "playlist_state": row.playlist_state,
                "playlist_error": row.playlist_error,
                "analysis_state": row.analysis_state,
                "analysis_error": row.analysis_error,
            }
            for row in result.all()
        }

    # ------------------------------------------------------------------ #
    # Seed (upload path — same transaction as the track)
    # ------------------------------------------------------------------ #
    @staticmethod
    async def seed(
        db: AsyncSession,
        *,
        track_id: int,
        partner_id: int,
        user_id: Optional[int],
    ) -> None:
        """Create the row for a just-persisted upload, both states ``pending``.

        Deliberately does NOT commit — it is part of the caller's transaction, so a track that
        fails to insert cannot leave an orphan status row behind, and a successful upload can never
        be missing one.
        """
        await db.execute(
            insert(TrackArtifactStatus).values(
                track_id=track_id,
                partner_id=partner_id,
                user_id=user_id,
                playlist_state=ARTIFACT_PENDING,
                analysis_state=ARTIFACT_PENDING,
            )
        )

    # ------------------------------------------------------------------ #
    # Write (worker path — own session, own commit, never raises)
    # ------------------------------------------------------------------ #
    @classmethod
    async def set_playlist_state(
        cls, track_id: Optional[int], state: str, *, error: Optional[str] = None
    ) -> None:
        """Record the similarity playlist's outcome for one upload."""
        await cls._set(track_id, "playlist", state, error)

    @classmethod
    async def set_analysis_state(
        cls, track_id: Optional[int], state: str, *, error: Optional[str] = None
    ) -> None:
        """Record the analysis's outcome for one upload."""
        await cls._set(track_id, "analysis", state, error)

    @classmethod
    async def _set(
        cls, track_id: Optional[int], side: str, state: str, error: Optional[str]
    ) -> None:
        """The shared write. Own session, own commit, swallows everything.

        Self-contained because every caller is a Celery task that has already done the real work;
        the session it was using may be closed, and a bookkeeping failure must not propagate. The
        cost of losing one of these writes is a capsule that keeps spinning until the next terminal
        state — the cost of raising is a delivered artifact reported as a failure.
        """
        if not track_id:
            return
        if state not in ARTIFACT_STATES:
            # A typo'd state would be written straight through and then read back as "unknown" by
            # every client. Refusing it here keeps the column's domain closed.
            logger.error(
                "ARTIFACT STATUS: refusing unknown %s state %r for track %s", side, state, track_id
            )
            return

        values: Dict[str, Any] = {f"{side}_state": state, f"{side}_error": error}
        if state == ARTIFACT_READY:
            values[f"{side}_completed_at"] = datetime.utcnow()

        try:
            from database.connection import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(TrackArtifactStatus)
                    .where(TrackArtifactStatus.track_id == track_id)
                    .values(**values)
                )
                await db.commit()
        except Exception as exc:  # pragma: no cover — bookkeeping must not fail the task
            logger.warning(
                "ARTIFACT STATUS: could not record %s=%s for track %s: %s",
                side, state, track_id, exc,
            )

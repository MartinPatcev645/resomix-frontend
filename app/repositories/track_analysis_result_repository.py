"""
Track Analysis Result Repository
================================

Data-access for ``track_analysis_results`` — the single-value analysis summary per uploaded
track. Tenant-scoped: the global partner failsafe auto-filters reads by the active partner, so
these queries don't repeat the ``partner_id`` filter (writes set it explicitly on the row).

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Optional

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TrackAnalysisResult


class TrackAnalysisResultRepository:
    """CRUD for the analysis summary rows (upsert keyed by the Alwyzon-owned analysis_uuid)."""

    async def async_get_analysis_map(
        self, db: AsyncSession, track_ids: List[int], partner_id: Optional[int] = None
    ) -> Dict[int, str]:
        """Map each track id -> the UUID of its (latest) analysis. Used to tell the library which
        uploaded tracks already have an analysis (mirrors the similarity playlist map). Tracks with
        no analysis are simply absent from the map.
        """
        if not track_ids:
            return {}
        conditions = [TrackAnalysisResult.track_id.in_(track_ids)]
        if partner_id is not None:
            conditions.append(TrackAnalysisResult.partner_id == partner_id)
        stmt = (
            select(TrackAnalysisResult.track_id, TrackAnalysisResult.analysis_uuid)
            .where(and_(*conditions))
            .order_by(desc(TrackAnalysisResult.created_at), desc(TrackAnalysisResult.id))
        )
        result = await db.execute(stmt)
        mapping: Dict[int, str] = {}
        for track_id, analysis_uuid in result.all():
            if track_id not in mapping:  # rows are newest-first; keep the latest per track
                mapping[track_id] = analysis_uuid
        return mapping

    async def async_get_by_analysis_uuid(
        self, db: AsyncSession, analysis_uuid: str
    ) -> Optional[TrackAnalysisResult]:
        stmt = select(TrackAnalysisResult).where(
            TrackAnalysisResult.analysis_uuid == analysis_uuid
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def async_get_latest_by_track_id(
        self, db: AsyncSession, track_id: int
    ) -> Optional[TrackAnalysisResult]:
        stmt = (
            select(TrackAnalysisResult)
            .where(TrackAnalysisResult.track_id == track_id)
            .order_by(desc(TrackAnalysisResult.created_at))
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def async_list_for_user(
        self, db: AsyncSession, user_id: int, *, offset: int = 0, limit: int = 50
    ) -> List[TrackAnalysisResult]:
        stmt = (
            select(TrackAnalysisResult)
            .where(TrackAnalysisResult.user_id == user_id)
            .order_by(desc(TrackAnalysisResult.created_at))
            .offset(offset)
            .limit(limit)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def async_upsert(
        self,
        db: AsyncSession,
        *,
        analysis_uuid: str,
        track_id: int,
        user_id: Optional[int],
        partner_id: int,
        fields: dict,
    ) -> TrackAnalysisResult:
        """Insert or update the summary row for ``analysis_uuid`` (idempotent re-runs)."""
        existing = await self.async_get_by_analysis_uuid(db, analysis_uuid)
        if existing:
            existing.track_id = track_id
            existing.user_id = user_id
            existing.partner_id = partner_id
            for key, value in fields.items():
                setattr(existing, key, value)
            db.add(existing)
            await db.flush()
            return existing

        row = TrackAnalysisResult(
            analysis_uuid=analysis_uuid,
            track_id=track_id,
            user_id=user_id,
            partner_id=partner_id,
            **fields,
        )
        db.add(row)
        await db.flush()
        return row

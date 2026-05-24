"""
Partner Quota Repository
========================

Repository for managing partner monthly quotas, usage logs, and sync operations.
Handles operations on PartnerQuota and PartnerUsageLog tables.

Version: 1.0.0
Author: Muhammad Usman Naeem
Date: May 2026
"""

from typing import Optional, Union
from datetime import datetime, date
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerQuota, PartnerUsageLog
from app.repositories.base_repository import BaseRepository


class PartnerQuotaRepository(BaseRepository[PartnerQuota]):
    """Repository for PartnerQuota and PartnerUsageLog operations"""

    def __init__(self):
        super().__init__(PartnerQuota)

    def _find_existing(self, db: Session, **kwargs) -> Optional[PartnerQuota]:
        """Find existing quota record by partner, API key, and period start (Sync)"""
        partner_id = kwargs.get("partner_id")
        api_key_id = kwargs.get("api_key_id")
        period_start = kwargs.get("period_start")
        if partner_id and api_key_id and period_start:
            return db.query(PartnerQuota).filter(
                PartnerQuota.partner_id == partner_id,
                PartnerQuota.api_key_id == api_key_id,
                PartnerQuota.period_start == period_start
            ).first()
        return None

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[PartnerQuota]:
        """Find existing quota record by partner, API key, and period start (Async)"""
        partner_id = kwargs.get("partner_id")
        api_key_id = kwargs.get("api_key_id")
        period_start = kwargs.get("period_start")
        if partner_id and api_key_id and period_start:
            stmt = select(PartnerQuota).where(
                PartnerQuota.partner_id == partner_id,
                PartnerQuota.api_key_id == api_key_id,
                PartnerQuota.period_start == period_start
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None

    async def async_get_monthly_usage(
        self, db: AsyncSession, api_key_id: int, start_of_month: datetime
    ) -> int:
        """Get total usage count from PartnerUsageLog for this API key in the current period"""
        stmt = select(func.count(PartnerUsageLog.id)).where(
            PartnerUsageLog.api_key_id == api_key_id,
            PartnerUsageLog.created_at >= start_of_month,
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    async def async_get_quota_usage(
        self, db: AsyncSession, api_key_id: int, period_start: Union[date, str]
    ) -> int:
        """Get the requests_made from PartnerQuota for a specific period_start"""
        if isinstance(period_start, date):
            period_start = period_start.strftime("%Y-%m-%d")
        stmt = select(PartnerQuota.requests_made).where(
            PartnerQuota.api_key_id == api_key_id,
            PartnerQuota.period_start == period_start
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    async def async_upsert_partner_quota(
        self,
        db: AsyncSession,
        pid: int,
        akid: int,
        start: date,
        end: date,
        made: int,
        limit: int,
        commit: bool = True
    ) -> None:
        """Atomically upsert partner quota usage with check on overage"""
        from sqlalchemy import text
        stmt = text(
            """
            INSERT INTO partner_quotas (
                partner_id, api_key_id, period_start, period_end, 
                requests_made, quota_limit, last_synced_at
            )
            VALUES (:pid, :akid, :start, :end, :made, :limit, NOW())
            ON DUPLICATE KEY UPDATE 
                requests_made = VALUES(requests_made),
                quota_limit = VALUES(quota_limit),
                last_synced_at = VALUES(last_synced_at),
                is_overage = (VALUES(requests_made) > VALUES(quota_limit))
            """
        )
        await db.execute(
            stmt,
            {
                "pid": pid,
                "akid": akid,
                "start": start,
                "end": end,
                "made": made,
                "limit": limit,
            },
        )
        if commit:
            await db.commit()

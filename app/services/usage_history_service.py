"""
Usage History Service
======================

Durable write-through for per-subject, per-feature, per-billing-period usage. Redis stays the fast
reserve/enforcement counter (self-clearing via TTL); this persists a row per (subject, feature,
period) so past-period usage survives the TTL and is reportable.

Best-effort: uses its own short-lived session so it never affects the request transaction, and
swallows errors (usage history must never break an upload / playlist creation).
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


class UsageHistoryService:
    async def get_used_count(
        self, db, subject_type: str, subject_id: str, feature_key: str, period_start
    ) -> Optional[int]:
        """This period's durable usage, or None if it cannot be read.

        The authority for ENFORCEMENT is Redis; this row is the audit trail. It is only consulted
        when Redis has lost the key, to answer "had this subject already used some of this period?"
        — otherwise an eviction silently grants a fresh allowance.

        None (not 0) on failure, so the caller can tell "no usage" from "could not tell" and fail
        open rather than inventing a count.
        """
        from sqlalchemy import select
        from app.models.billing import UsagePeriodHistory

        try:
            row = (await db.execute(
                select(UsagePeriodHistory.used_count).where(
                    UsagePeriodHistory.subject_type == subject_type,
                    UsagePeriodHistory.subject_id == str(subject_id),
                    UsagePeriodHistory.feature_key == feature_key,
                    UsagePeriodHistory.period_start == period_start,
                )
            )).scalar_one_or_none()
            return int(row) if row is not None else 0
        except Exception:
            return None

    async def record(
        self,
        subject_type: str,
        subject_id: str,
        plan_id: Optional[int],
        feature_key: str,
        period_start: datetime,
        period_end: datetime,
        limit_value: Optional[int],
    ) -> None:
        """Increment (or create) the durable usage row for this (subject, feature, period)."""
        from database.connection import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    text(
                        """
                        INSERT INTO usage_period_history
                            (subject_type, subject_id, plan_id, feature_key,
                             period_start, period_end, used_count, limit_value)
                        VALUES (:st, :si, :pid, :fk, :ps, :pe, 1, :lim)
                        ON DUPLICATE KEY UPDATE
                            used_count  = used_count + 1,
                            limit_value = VALUES(limit_value),
                            plan_id     = VALUES(plan_id),
                            period_end  = VALUES(period_end),
                            updated_at  = CURRENT_TIMESTAMP
                        """
                    ),
                    {
                        "st": subject_type,
                        "si": subject_id,
                        "pid": plan_id,
                        "fk": feature_key,
                        "ps": period_start,
                        "pe": period_end,
                        "lim": limit_value,
                    },
                )
                await db.commit()
        except Exception as exc:  # best-effort — never break the caller
            logger.warning("Usage history write failed (%s); ignoring", exc)

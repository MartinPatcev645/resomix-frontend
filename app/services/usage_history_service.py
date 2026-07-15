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

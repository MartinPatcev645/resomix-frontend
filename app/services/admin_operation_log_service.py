"""
Admin Operation Log Service
==========================

Service layer for capturing and persisting administrative operation logs.
Handles the creation of audit records with context enrichment.

Version: 1.1.0
Date: May 16, 2026
"""

from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.admin_operation_log import AdminOperationLog
import logging

logger = logging.getLogger(__name__)


class AdminOperationLogService:
    """
    Handles logging of administrative operations.
    """

    @staticmethod
    async def log_operation(
        db: AsyncSession,
        admin_user_id: int,
        action: str,
        target_type: str,
        target_id: str,
        before_state: Optional[Any] = None,
        after_state: Optional[Any] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> AdminOperationLog:
        """
        Creates and flushes an admin operation log entry.
        Does not commit; caller manages the transaction.
        """
        try:
            log_entry = AdminOperationLog(
                admin_user_id=admin_user_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                before_state=before_state,
                after_state=after_state,
                ip_address=ip_address,
                user_agent=user_agent,
                correlation_id=correlation_id,
            )
            db.add(log_entry)
            
            # Use flush instead of commit - Part 2 Roadmap requirement
            # The caller must commit the transaction.
            await db.flush()
            
            return log_entry
        except Exception as e:
            logger.error(f"Failed to create admin operation log: {str(e)}")
            # We don't raise here to prevent the main operation from failing due to logging issues.
            return None

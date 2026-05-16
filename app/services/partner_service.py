"""
Partner Service
===============

Business logic for partner management and API key lifecycle.
Handles partner creation, API key generation (hashing), rotation, and revocation.

Version: 1.0.0
Date: May 09, 2026
"""

import secrets
import hashlib
import uuid
import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.repositories.partner_repository import (
    PartnerRepository,
    PartnerApiKeyRepository,
)
from app.models.partner import Partner, PartnerApiKey
from app.schemas.partner import (
    PartnerCreateRequest,
    PartnerUpdateRequest,
    ApiKeyIssueRequest,
    ApiKeyRotateRequest,
)
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)


class PartnerService:
    """Service for handling partner and API key business logic."""

    def __init__(self):
        self.partner_repo = PartnerRepository()
        self.api_key_repo = PartnerApiKeyRepository()
        self.logging_service = LoggingService()

    def generate_api_key(self, tier: str = "sandbox") -> Tuple[str, str, str]:
        """
        Generate a new high-entropy API key.

        Returns:
            Tuple of (plaintext_key, key_hash, key_prefix)
        """
        # Format: rmx_<tier>_<32chars>
        raw_token = secrets.token_urlsafe(32)
        plaintext_key = f"rmx_{tier}_{raw_token}"

        # SHA-256 for secure storage
        key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()

        # Prefix for identification (first 16 chars of full key)
        # e.g. rmx_live_abcdef12
        key_prefix = plaintext_key[:16]

        return plaintext_key, key_hash, key_prefix

    async def create_partner(
        self, db: AsyncSession, request: PartnerCreateRequest
    ) -> Partner:
        """Create a new partner tenant."""
        partner_data = request.model_dump()
        partner_data["partner_uuid"] = str(uuid.uuid4())

        partner = await self.partner_repo.async_create(db, commit=False, **partner_data)

        self.logging_service.log(
            async_db=db,
            category="PARTNER",
            action="CREATE",
            message=f"Partner created: {partner.display_name} ({partner.partner_uuid})",
            metadata={"partner_id": partner.id, "tier": partner.tier},
        )

        return partner

    async def list_partners(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        tier: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[Partner], int]:
        """List partners with pagination."""
        skip = (page - 1) * page_size
        return await self.partner_repo.async_list_partners(
            db, skip, page_size, tier, is_active
        )

    async def update_partner(
        self, db: AsyncSession, partner_id: int, request: PartnerUpdateRequest
    ) -> Optional[Partner]:
        """Update an existing partner's details."""
        update_data = request.model_dump(exclude_unset=True)
        if not update_data:
            return await self.partner_repo.async_get_by_id(db, partner_id)

        partner = await self.partner_repo.async_update(db, partner_id, commit=False, **update_data)
        if partner:
            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="UPDATE",
                message=f"Partner updated: {partner.display_name} ({partner.partner_uuid})",
                metadata={
                    "partner_id": partner.id,
                    "updates": list(update_data.keys()),
                },
            )
        return partner

    async def delete_partner(self, db: AsyncSession, partner_id: int) -> bool:
        """
        Delete a partner. Performs a hard delete in this implementation.
        Revokes all associated API keys as well.
        """
        partner = await self.partner_repo.async_get_by_id(db, partner_id)
        if not partner:
            return False

        # Revoke all keys first (audit trail)
        keys = await self.api_key_repo.async_list_keys_for_partner(db, partner_id)
        for key in keys:
            if key.is_active:
                await self.api_key_repo.async_revoke_key(db, key.id, "Partner deleted", commit=False)

        success = await self.partner_repo.async_delete(db, partner_id, commit=False)
        if success:
            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="DELETE",
                message=f"Partner deleted: {partner.display_name} ({partner.partner_uuid})",
                metadata={"partner_id": partner_id},
            )
        return success

    async def issue_api_key(
        self, db: AsyncSession, request: ApiKeyIssueRequest
    ) -> Tuple[PartnerApiKey, str]:
        """Issue a new API key for a partner."""
        partner = await self.partner_repo.async_get_by_id(db, request.partner_id)
        if not partner:
            raise ValueError(f"Partner with ID {request.partner_id} not found")

        plaintext, key_hash, prefix = self.generate_api_key(partner.tier)

        key_data = {
            "partner_id": partner.id,
            "key_prefix": prefix,
            "key_hash": key_hash,
            "label": request.label,
            "scopes": request.scopes,
            "rate_limit_rps": request.rate_limit_rps,
            "rate_limit_monthly": request.rate_limit_monthly,
            "expires_at": request.expires_at,
            "is_active": True,
        }

        api_key = await self.api_key_repo.async_create(db, commit=False, **key_data)

        self.logging_service.log(
            async_db=db,
            category="PARTNER",
            action="API_KEY_ISSUE",
            message=f"API key issued for partner {partner.id}: {prefix}...",
            metadata={
                "partner_id": partner.id,
                "api_key_id": api_key.id,
                "label": request.label,
            },
        )

        return api_key, plaintext

    async def list_api_keys(
        self, db: AsyncSession, partner_id: int
    ) -> List[PartnerApiKey]:
        """List all keys for a partner, including usage stats."""
        keys = await self.api_key_repo.async_list_keys_for_partner(db, partner_id)

        # Populate usage_count for each key
        for key in keys:
            key.usage_count = await self.get_api_key_usage_count(db, key.id)

        return keys

    async def get_api_key_usage_count(self, db: AsyncSession, api_key_id: int) -> int:
        """Get the number of requests made with an API key in the current calendar month."""
        from sqlalchemy import text
        from datetime import datetime

        # Start of current month
        start_of_month = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        from app.models.partner import PartnerUsageLog
        from sqlalchemy import select, func

        # Use ORM for automatic tenant isolation and cleaner syntax
        stmt = select(func.count(PartnerUsageLog.id)).where(
            PartnerUsageLog.api_key_id == api_key_id,
            PartnerUsageLog.created_at >= start_of_month,
        )

        result = await db.execute(stmt)
        return result.scalar() or 0

    async def revoke_api_key(
        self, db: AsyncSession, api_key_id: int, reason: str
    ) -> bool:
        """Revoke an API key."""
        api_key = await self.api_key_repo.async_revoke_key(db, api_key_id, reason, commit=False)
        if api_key:
            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="API_KEY_REVOKE",
                message=f"API key revoked: {api_key.key_prefix}...",
                metadata={
                    "partner_id": api_key.partner_id,
                    "api_key_id": api_key.id,
                    "reason": reason,
                },
            )
            return True
        return False

    async def rotate_api_key(
        self, db: AsyncSession, request: ApiKeyRotateRequest
    ) -> Tuple[PartnerApiKey, str]:
        """
        Rotate an API key: Revoke old one and issue a new one with same config.
        Executed in a single transaction.
        """
        old_key = await self.api_key_repo.async_get_by_id(db, request.api_key_id)
        if not old_key:
            raise ValueError(f"API key with ID {request.api_key_id} not found")

        if not old_key.is_active:
            raise ValueError(
                f"Cannot rotate an inactive or already revoked API key (ID: {old_key.id})"
            )

        # 1. Revoke old key
        await self.api_key_repo.async_revoke_key(db, old_key.id, "Rotated by admin", commit=False)

        # 2. Issue new key with same parameters
        issue_request = ApiKeyIssueRequest(
            partner_id=old_key.partner_id,
            label=request.label or old_key.label,
            scopes=old_key.scopes,
            rate_limit_rps=old_key.rate_limit_rps,
            rate_limit_monthly=old_key.rate_limit_monthly,
            expires_at=old_key.expires_at,
        )

        return await self.issue_api_key(db, issue_request)

    async def validate_api_key(
        self,
        db: AsyncSession,
        api_key_string: str,
        required_scope: Optional[str] = None,
    ) -> Tuple[Partner, PartnerApiKey]:
        """
        Validate an API key string against the database.

        Returns:
            Tuple of (Partner, PartnerApiKey)

        Raises:
            ValueError: If key is invalid, revoked, expired, or partner is inactive, or missing required scope.
        """
        # 1. Hash the key for lookup
        key_hash = hashlib.sha256(api_key_string.encode()).hexdigest()

        # 2. Lookup key
        api_key = await self.api_key_repo.async_get_by_hash(db, key_hash)

        if not api_key:
            raise ValueError("Invalid API key")

        if not api_key.is_active:
            raise ValueError("API key has been revoked")

        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            raise ValueError("API key has expired")

        # 3. Check scope if required
        if required_scope:
            scopes = api_key.scopes or []
            if required_scope not in scopes:
                raise ValueError(f"API key missing required scope: {required_scope}")

        # 4. Check partner status
        partner = await self.partner_repo.async_get_by_id(db, api_key.partner_id)
        if not partner or not partner.is_active:
            raise ValueError("Partner account is inactive or disabled")

        return partner, api_key

    async def update_api_key_usage(self, api_key_id: int, ip_address: str) -> None:
        """
        Update the last_used_at and last_used_ip for an API key.
        This is intended to be run in a background task.
        """
        from database.connection import AsyncSessionLocal
        from sqlalchemy import update
        from datetime import datetime

        try:
            async with AsyncSessionLocal() as db:
                stmt = (
                    update(PartnerApiKey)
                    .where(PartnerApiKey.id == api_key_id)
                    .values(last_used_at=datetime.utcnow(), last_used_ip=ip_address)
                )
                await db.execute(stmt)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to update API key usage metadata: {e}")


    async def sync_quotas_from_redis(self, db: AsyncSession) -> Dict[str, int]:
        """
        Synchronize monthly quota counters from Redis to MariaDB.
        Scans all keys matching 'ratelimit:quota:*' and updates the partner_quotas table.
        """
        import calendar
        from datetime import date
        import redis.asyncio as aioredis
        from app.db import redis as redis_module
        from sqlalchemy import text

        stats = {"total_keys": 0, "updated": 0, "errors": 0}

        pool = redis_module._redis_pool
        if not pool:
            logger.warning("Quota Sync: Redis pool not available")
            return stats

        try:
            client = aioredis.Redis(connection_pool=pool)
            # Use SCAN to avoid blocking Redis on large datasets
            async for key in client.scan_iter("ratelimit:quota:*"):
                stats["total_keys"] += 1
                try:
                    # Key format: ratelimit:quota:{partner_id}:{api_key_id}:{year_month}
                    parts = key.split(":")
                    if len(parts) != 5:
                        continue

                    pid = int(parts[2])
                    akid = int(parts[3])
                    year_month = parts[4]  # e.g. "2026-05"

                    # Parse dates
                    year, month = map(int, year_month.split("-"))
                    last_day = calendar.monthrange(year, month)[1]
                    period_start = date(year, month, 1)
                    period_end = date(year, month, last_day)

                    # Get usage from Redis
                    requests_made = int(await client.get(key) or 0)

                    # Get quota limit from the API key record
                    # We look it up to ensure it's accurate if the plan changed
                    api_key = await self.api_key_repo.async_get_by_id(db, akid)
                    if not api_key:
                        continue

                    quota_limit = api_key.rate_limit_monthly

                    # Upsert into MariaDB
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
                            "start": period_start,
                            "end": period_end,
                            "made": requests_made,
                            "limit": quota_limit,
                        },
                    )

                    stats["updated"] += 1

                except Exception as e:
                    logger.error(f"Error syncing quota for key {key}: {e}")
                    stats["errors"] += 1

            await db.commit()

        except Exception as e:
            logger.error(f"Quota Sync Worker Error: {e}")
            stats["errors"] += 1

        return stats

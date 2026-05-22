import secrets
import hashlib
import uuid
import logging
import calendar
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
import redis.asyncio as aioredis
from app.db import redis as redis_module
from database.connection import AsyncSessionLocal

from app.repositories.partner_repository import (
    PartnerRepository,
    PartnerApiKeyRepository,
)
from app.repositories.partner_quota_repository import PartnerQuotaRepository
from app.models.partner import Partner, PartnerApiKey
from app.models.user import User
from app.services.admin_operation_log_service import AdminOperationLogService
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
        self.partner_quota_repo = PartnerQuotaRepository()
        self.logging_service = LoggingService()
        self.admin_log_service = AdminOperationLogService()

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
        self,
        db: AsyncSession,
        request: PartnerCreateRequest,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Partner:
        """Create a new partner tenant."""
        try:
            partner_data = request.model_dump()
            partner_data["partner_uuid"] = str(uuid.uuid4())

            partner = await self.partner_repo.async_create(db, commit=False, **partner_data)
            await db.flush()

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.create",
                    target_type="partner",
                    target_id=str(partner.id),
                    before_state=None,
                    after_state=request.model_dump(),
                    ip_address=ip_address
                )

            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="CREATE",
                message=f"Partner created: {partner.display_name} ({partner.partner_uuid})",
                metadata={"partner_id": partner.id, "tier": partner.tier},
            )

            await db.commit()
            return partner

        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating partner: {e}")
            raise

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
        self,
        db: AsyncSession,
        partner_id: int,
        request: PartnerUpdateRequest,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Optional[Partner]:
        """Update an existing partner's details."""
        try:
            update_data = request.model_dump(exclude_unset=True)
            if not update_data:
                partner = await self.partner_repo.async_get_by_id(db, partner_id)
                return partner

            partner = await self.partner_repo.async_update(db, partner_id, commit=False, **update_data)
            if not partner:
                await db.rollback()
                return None

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.update",
                    target_type="partner",
                    target_id=str(partner_id),
                    before_state=None,
                    after_state=update_data,
                    ip_address=ip_address
                )

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
            await db.commit()
            return partner

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating partner: {e}")
            raise

    async def delete_partner(
        self,
        db: AsyncSession,
        partner_id: int,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        Delete a partner. Performs a hard delete.
        Hard-deletes all associated API keys first to satisfy FK constraints,
        then removes the partner record itself.
        """
        try:
            partner = await self.partner_repo.async_get_by_id(db, partner_id)
            if not partner:
                return False

            await self.api_key_repo.async_delete_keys_for_partner(db, partner_id)

            success = await self.partner_repo.async_delete(db, partner_id, commit=False)
            if not success:
                await db.rollback()
                return False

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.delete",
                    target_type="partner",
                    target_id=str(partner_id),
                    before_state=None,
                    after_state=None,
                    ip_address=ip_address
                )

            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="DELETE",
                message=f"Partner deleted: {partner.display_name} ({partner.partner_uuid})",
                metadata={"partner_id": partner_id},
            )
            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting partner: {e}")
            raise

    async def issue_api_key(
        self,
        db: AsyncSession,
        request: ApiKeyIssueRequest,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[PartnerApiKey, str]:
        """Issue a new API key for a partner."""
        try:
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
            await db.flush()

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.issue_api_key",
                    target_type="api_key",
                    target_id=api_key.key_prefix,
                    before_state=None,
                    after_state={"partner_id": request.partner_id, "label": request.label},
                    ip_address=ip_address
                )

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

            await db.commit()
            return api_key, plaintext

        except Exception as e:
            await db.rollback()
            logger.error(f"Error issuing API key: {e}")
            raise

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
        start_of_month = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        return await self.partner_quota_repo.async_get_monthly_usage(db, api_key_id, start_of_month)

    async def revoke_api_key(
        self,
        db: AsyncSession,
        api_key_id: int,
        reason: str,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """Revoke an API key."""
        try:
            api_key = await self.api_key_repo.async_revoke_key(db, api_key_id, reason, commit=False)
            if not api_key:
                await db.rollback()
                return False

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.revoke_api_key",
                    target_type="api_key",
                    target_id=str(api_key_id),
                    before_state=None,
                    after_state={"reason": reason},
                    ip_address=ip_address
                )

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
            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Error revoking API key: {e}")
            raise

    async def rotate_api_key(
        self,
        db: AsyncSession,
        request: ApiKeyRotateRequest,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[PartnerApiKey, str]:
        """
        Rotate an API key: Revoke old one and issue a new one with same config.
        Executed in a single transaction.
        """
        try:
            old_key = await self.api_key_repo.async_get_by_id(db, request.api_key_id)
            if not old_key:
                raise ValueError(f"API key with ID {request.api_key_id} not found")

            if not old_key.is_active:
                raise ValueError(f"Cannot rotate an inactive or already revoked API key (ID: {old_key.id})")

            # 1. Revoke old key (commit=False)
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

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.rotate_api_key",
                    target_type="api_key",
                    target_id=str(request.api_key_id),
                    before_state=None,
                    after_state=None,
                    ip_address=ip_address
                )

            # issue_api_key will log partner.issue_api_key and commit the entire transaction.
            return await self.issue_api_key(
                db=db,
                request=issue_request,
                current_admin=current_admin,
                ip_address=ip_address
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error rotating API key: {e}")
            raise

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
        try:
            async with AsyncSessionLocal() as db:
                await self.api_key_repo.async_touch_last_used(db, api_key_id, ip_address)
        except Exception as e:
            logger.error(f"Failed to update API key usage metadata: {e}")

    async def sync_quotas_from_redis(self, db: AsyncSession) -> Dict[str, int]:
        """
        Synchronize monthly quota counters from Redis to MariaDB.
        Scans all keys matching 'ratelimit:quota:*' and updates the partner_quotas table.
        """
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
                    await self.partner_quota_repo.async_upsert_partner_quota(
                        db=db,
                        pid=pid,
                        akid=akid,
                        start=period_start,
                        end=period_end,
                        made=requests_made,
                        limit=quota_limit,
                        commit=True
                    )

                    stats["updated"] += 1

                except Exception as e:
                    logger.error(f"Error syncing quota for key {key}: {e}")
                    stats["errors"] += 1

        except Exception as e:
            logger.error(f"Quota Sync Worker Error: {e}")
            stats["errors"] += 1

        return stats

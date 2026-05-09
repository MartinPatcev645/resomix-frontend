"""
Partner and API Key Repositories
================================

Data access layer for partner management and API key operations.
Implements the repository pattern for B2B multi-tenancy entities.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import List, Optional, Any, Dict, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.repositories.base_repository import BaseRepository
from app.models.partner import Partner, PartnerApiKey


class PartnerRepository(BaseRepository[Partner]):
    """Repository for managing Partner entities."""

    def __init__(self):
        super().__init__(Partner)

    def _find_existing(self, db: Session, **kwargs) -> Optional[Partner]:
        """Find partner by UUID or Email."""
        if "partner_uuid" in kwargs:
            return self.get_by_field(db, "partner_uuid", kwargs["partner_uuid"])
        if "contact_email" in kwargs:
            return self.get_by_field(db, "contact_email", kwargs["contact_email"])
        return None

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Partner]:
        """Async find partner by UUID or Email."""
        if "partner_uuid" in kwargs:
            return await self.async_get_by_field(db, "partner_uuid", kwargs["partner_uuid"])
        if "contact_email" in kwargs:
            return await self.async_get_by_field(db, "contact_email", kwargs["contact_email"])
        return None

    async def async_list_partners(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        tier: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Tuple[List[Partner], int]:
        """List partners with filtering and pagination."""
        stmt = select(Partner)
        count_stmt = select(func.count()).select_from(Partner)
        
        filters = []
        if tier:
            filters.append(Partner.tier == tier)
        if is_active is not None:
            filters.append(Partner.is_active == is_active)
            
        if filters:
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))
            
        stmt = stmt.offset(skip).limit(limit).order_by(Partner.id.desc())
        
        result = await db.execute(stmt)
        count_result = await db.execute(count_stmt)
        
        return result.scalars().all(), count_result.scalar_one()


class PartnerApiKeyRepository(BaseRepository[PartnerApiKey]):
    """Repository for managing Partner API Keys."""

    def __init__(self):
        super().__init__(PartnerApiKey)

    def _find_existing(self, db: Session, **kwargs) -> Optional[PartnerApiKey]:
        """Find key by hash."""
        if "key_hash" in kwargs:
            return self.get_by_field(db, "key_hash", kwargs["key_hash"])
        return None

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[PartnerApiKey]:
        """Async find key by hash."""
        if "key_hash" in kwargs:
            return await self.async_get_by_field(db, "key_hash", kwargs["key_hash"])
        return None

    async def async_get_by_hash(self, db: AsyncSession, key_hash: str) -> Optional[PartnerApiKey]:
        """Look up an API key by its SHA-256 hash."""
        return await self.async_get_by_field(db, "key_hash", key_hash)

    async def async_list_keys_for_partner(self, db: AsyncSession, partner_id: int) -> List[PartnerApiKey]:
        """List all API keys for a specific partner."""
        stmt = select(PartnerApiKey).where(PartnerApiKey.partner_id == partner_id).order_by(PartnerApiKey.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()

    async def async_revoke_key(self, db: AsyncSession, api_key_id: int, reason: str) -> Optional[PartnerApiKey]:
        """Revoke an API key."""
        return await self.async_update(
            db, 
            api_key_id, 
            is_active=False, 
            revoked_at=func.now(), 
            revoked_reason=reason
        )

    async def async_touch_last_used(self, db: AsyncSession, api_key_id: int, client_ip: str):
        """Update last used timestamp and IP (non-blocking)."""
        stmt = select(PartnerApiKey).where(PartnerApiKey.id == api_key_id)
        result = await db.execute(stmt)
        key = result.scalar_one_or_none()
        if key:
            key.last_used_at = func.now()
            key.last_used_ip = client_ip
            await db.commit()

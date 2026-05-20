"""
SFTP User Repository
====================

Repository for managing SftpUser records, including fetching by username
for SFTPGo external authentication hooks and querying/updating provisioning
state for the automated partner provisioning flow (W2-4).
"""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload

from app.models.sftp_user import SftpUser
from app.repositories.base_repository import BaseRepository


class SftpUserRepository(BaseRepository[SftpUser]):
    """Repository for SftpUser CRUD and provisioning state operations."""

    def __init__(self):
        super().__init__(SftpUser)

    def _find_existing(self, db: Session, **kwargs) -> Optional[SftpUser]:
        if "username" in kwargs:
            return self.get_by_field(db, "username", kwargs["username"])
        return None

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[SftpUser]:
        if "username" in kwargs:
            return await self.async_get_by_field(db, "username", kwargs["username"])
        return None

    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[SftpUser]:
        """Fetch an SFTP user by exact username, eagerly loading their partner (for tier/quota)."""
        stmt = (
            select(SftpUser)
            .where(SftpUser.username == username)
            .options(selectinload(SftpUser.partner))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_partner_id(self, db: AsyncSession, partner_id: int) -> Optional[SftpUser]:
        """Fetch the active SFTP user for a given partner (max one per partner).

        Used by the provisioning service for status checks and retry logic.
        Eagerly loads the partner relationship so callers can access partner.tier
        without an additional query.
        """
        stmt = (
            select(SftpUser)
            .where(SftpUser.partner_id == partner_id, SftpUser.is_active == True)  # noqa: E712
            .options(selectinload(SftpUser.partner))
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_unprovisioned(self, db: AsyncSession) -> List[SftpUser]:
        """Return all active SFTP users whose Hetzner provisioning is still pending.

        A row is considered unprovisioned when sftp_provisioned_at IS NULL.
        Used by admin dashboards or a future background job that retries
        stale provisioning attempts automatically.
        """
        stmt = (
            select(SftpUser)
            .where(
                SftpUser.is_active == True,  # noqa: E712
                SftpUser.sftp_provisioned_at == None,  # noqa: E711
            )
            .options(selectinload(SftpUser.partner))
            .order_by(SftpUser.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def mark_provisioned(self, db: AsyncSession, sftp_user: SftpUser) -> SftpUser:
        """Stamp sftp_provisioned_at with the current UTC time.

        This is the single point of truth for marking a provisioning attempt
        as successful. After this call the caller must commit the session.

        Args:
            db:        The active async database session.
            sftp_user: The SftpUser ORM instance to update (must be attached
                       to this session — fetched in the same request context).

        Returns:
            The same SftpUser instance with sftp_provisioned_at populated.
        """
        sftp_user.sftp_provisioned_at = datetime.now(timezone.utc)
        db.add(sftp_user)
        return sftp_user


sftp_user_repo = SftpUserRepository()

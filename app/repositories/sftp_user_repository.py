"""
SFTP User Repository
====================

Repository for managing SftpUser records, including fetching by username
for SFTPGo external authentication hooks.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.sftp_user import SftpUser
from app.repositories.base_repository import BaseRepository

class SftpUserRepository(BaseRepository[SftpUser]):
    """Repository for SftpUser operations."""

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
        """Fetch an SFTP user by their exact username, eagerly loading their partner tier."""
        from sqlalchemy.orm import selectinload
        stmt = select(SftpUser).where(SftpUser.username == username).options(selectinload(SftpUser.partner))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

sftp_user_repo = SftpUserRepository()

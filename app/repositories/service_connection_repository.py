"""
Service Connection repository
=============================

CRUD over ``user_service_connections`` — a user's linked external music services (Apple Music,
Spotify, Tidal, …), keyed by ``(user_id, provider)``. Provider-agnostic: every method takes the
provider, so a new export target reuses this repository unchanged. Tokens are encrypted by the
service layer — this repository never handles plaintext.
"""

from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.dialects.mysql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_service_connection import UserServiceConnection


class ServiceConnectionRepository:
    """Reads/writes for a user's linked external services."""

    async def async_get(self, db: AsyncSession, user_id: int, provider: str) -> Optional[UserServiceConnection]:
        stmt = select(UserServiceConnection).where(
            UserServiceConnection.user_id == user_id,
            UserServiceConnection.provider == provider,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_list_for_user(self, db: AsyncSession, user_id: int) -> List[UserServiceConnection]:
        """All services a user has linked (for a future 'connected accounts' view)."""
        result = await db.execute(
            select(UserServiceConnection).where(UserServiceConnection.user_id == user_id)
        )
        return list(result.scalars().all())

    async def async_upsert(self, db: AsyncSession, user_id: int, provider: str,
                           access_token_enc: str, *, refresh_token_enc: Optional[str] = None,
                           token_type: Optional[str] = None, expires_at=None,
                           external_account_id: Optional[str] = None, region: Optional[str] = None,
                           scopes: Optional[str] = None, meta: Optional[dict] = None) -> None:
        """Insert or replace the user's connection for this provider (unique on user_id+provider)."""
        values = dict(
            user_id=user_id, provider=provider, access_token_enc=access_token_enc,
            refresh_token_enc=refresh_token_enc, token_type=token_type, expires_at=expires_at,
            external_account_id=external_account_id, region=region, scopes=scopes, meta=meta,
        )
        stmt = insert(UserServiceConnection).values(**values)
        stmt = stmt.on_duplicate_key_update(
            access_token_enc=stmt.inserted.access_token_enc,
            refresh_token_enc=stmt.inserted.refresh_token_enc,
            token_type=stmt.inserted.token_type,
            expires_at=stmt.inserted.expires_at,
            external_account_id=stmt.inserted.external_account_id,
            region=stmt.inserted.region,
            scopes=stmt.inserted.scopes,
            meta=stmt.inserted.meta,
        )
        await db.execute(stmt)
        await db.commit()

    async def async_delete(self, db: AsyncSession, user_id: int, provider: str) -> bool:
        """Remove the user's connection for this provider. Returns True if a row was deleted."""
        result = await db.execute(
            delete(UserServiceConnection).where(
                UserServiceConnection.user_id == user_id,
                UserServiceConnection.provider == provider,
            )
        )
        await db.commit()
        return (result.rowcount or 0) > 0

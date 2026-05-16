"""
Spotify App Repository
======================

Database access layer for Spotify app entities and user associations.
Provides async helpers to manage multiple Spotify apps and user associations
with proper user_count synchronization.

Version: 3.0.1
Init Date: November 14, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.spotify_app import SpotifyApp, UserSpotifyApp
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class SpotifyAppRepository(BaseRepository[SpotifyApp]):
    """Repository for Spotify app management."""

    def __init__(self) -> None:
        super().__init__(SpotifyApp)

    # ------------------------------------------------------------------
    # BaseRepository overrides
    # ------------------------------------------------------------------

    def _find_existing(self, db: Session, **kwargs) -> Optional[SpotifyApp]:
        """Find existing Spotify app by name or client_id."""
        name = kwargs.get("name")
        client_id = kwargs.get("client_id")

        if name:
            return db.query(self.model).filter(self.model.name == name).first()
        elif client_id:
            return db.query(self.model).filter(self.model.client_id == client_id).first()
        return None

    async def _async_find_existing(
        self, db: AsyncSession, **kwargs
    ) -> Optional[SpotifyApp]:
        """Async version of _find_existing."""
        name = kwargs.get("name")
        client_id = kwargs.get("client_id")

        if name:
            stmt = select(self.model).where(self.model.name == name)
        elif client_id:
            stmt = select(self.model).where(self.model.client_id == client_id)
        else:
            return None

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Spotify App CRUD Operations
    # ------------------------------------------------------------------

    async def async_get_by_client_id(
        self, db: AsyncSession, client_id: str
    ) -> Optional[SpotifyApp]:
        """Get Spotify app by client_id."""
        stmt = select(SpotifyApp).where(SpotifyApp.client_id == client_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_list(
        self,
        db: AsyncSession,
        *,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SpotifyApp], int]:
        """List Spotify apps with optional filters."""
        stmt = select(SpotifyApp)
        count_stmt = select(func.count()).select_from(SpotifyApp)

        filters: List = []
        if is_active is not None:
            filters.append(SpotifyApp.is_active == is_active)
        if search:
            lowered = f"%{search.lower()}%"
            filters.append(func.lower(SpotifyApp.name).like(lowered))

        if filters:
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))

        stmt = stmt.order_by(SpotifyApp.created_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        apps = result.scalars().all()

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        return list(apps), total

    async def async_create(
        self, db: AsyncSession, **kwargs
    ) -> SpotifyApp:
        """Create a new Spotify app."""
        app = SpotifyApp(**kwargs)
        db.add(app)
        await db.flush()
        await db.refresh(app)
        return app

    async def async_update(
        self, db: AsyncSession, app_id: int, **kwargs
    ) -> Optional[SpotifyApp]:
        """Update a Spotify app."""
        app = await self.async_get_by_id(db, app_id)
        if not app:
            return None

        for field, value in kwargs.items():
            if hasattr(app, field) and value is not None:
                setattr(app, field, value)

        await db.flush()
        await db.refresh(app)
        return app

    async def async_delete(self, db: AsyncSession, app_id: int) -> bool:
        """Delete a Spotify app."""
        app = await self.async_get_by_id(db, app_id)
        if not app:
            return False

        await db.delete(app)
        await db.flush()
        return True

    # ------------------------------------------------------------------
    # User Count Management
    # ------------------------------------------------------------------

    async def async_increment_user_count(
        self, db: AsyncSession, app_id: int
    ) -> bool:
        """Atomically increment user_count for a Spotify app."""
        stmt = (
            update(SpotifyApp)
            .where(SpotifyApp.id == app_id)
            .values(user_count=SpotifyApp.user_count + 1)
        )
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount > 0

    async def async_decrement_user_count(
        self, db: AsyncSession, app_id: int
    ) -> bool:
        """Atomically decrement user_count for a Spotify app."""
        stmt = (
            update(SpotifyApp)
            .where(
                and_(
                    SpotifyApp.id == app_id,
                    SpotifyApp.user_count > 0,
                )
            )
            .values(user_count=SpotifyApp.user_count - 1)
        )
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount > 0

    async def async_count_by_app_id(
        self, db: AsyncSession, app_id: int
    ) -> int:
        """Count actual user associations for a specific app."""
        stmt = select(func.count()).select_from(UserSpotifyApp).where(
            UserSpotifyApp.spotify_app_id == app_id
        )
        result = await db.execute(stmt)
        return result.scalar_one() or 0


class UserSpotifyAppRepository(BaseRepository[UserSpotifyApp]):
    """Repository for user-Spotify app association management."""

    def __init__(self) -> None:
        super().__init__(UserSpotifyApp)

    # ------------------------------------------------------------------
    # BaseRepository overrides
    # ------------------------------------------------------------------

    def _find_existing(self, db: Session, **kwargs) -> Optional[UserSpotifyApp]:
        """Find existing association by user_id."""
        user_id = kwargs.get("user_id")
        if user_id is None:
            return None

        return (
            db.query(self.model)
            .filter(self.model.user_id == user_id)
            .first()
        )

    async def _async_find_existing(
        self, db: AsyncSession, **kwargs
    ) -> Optional[UserSpotifyApp]:
        """Async version of _find_existing."""
        user_id = kwargs.get("user_id")
        if user_id is None:
            return None

        stmt = select(self.model).where(self.model.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # User Association Operations
    # ------------------------------------------------------------------

    async def async_get_by_user_id(
        self, db: AsyncSession, user_id: int
    ) -> Optional[UserSpotifyApp]:
        """Get user association by user_id."""
        stmt = select(UserSpotifyApp).where(UserSpotifyApp.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_list_associations(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        spotify_app_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, object]], int]:
        """List user associations with joined user and app data."""
        stmt = (
            select(
                UserSpotifyApp,
                User,
                SpotifyApp,
            )
            .join(User, User.id == UserSpotifyApp.user_id)
            .join(SpotifyApp, SpotifyApp.id == UserSpotifyApp.spotify_app_id)
        )

        count_stmt = (
            select(func.count())
            .select_from(UserSpotifyApp)
            .join(User, User.id == UserSpotifyApp.user_id)
            .join(SpotifyApp, SpotifyApp.id == UserSpotifyApp.spotify_app_id)
        )

        filters: List = []
        if spotify_app_id:
            filters.append(UserSpotifyApp.spotify_app_id == spotify_app_id)
        if search:
            lowered = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(User.email).like(lowered),
                    func.lower(User.username).like(lowered),
                    func.lower(User.uuid).like(lowered),
                )
            )

        if filters:
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))

        stmt = stmt.order_by(UserSpotifyApp.updated_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        rows: Sequence = result.all()

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        associations: List[Dict[str, object]] = []
        for row in rows:
            association_obj: UserSpotifyApp = row[0]
            user_obj: User = row[1]
            app_obj: SpotifyApp = row[2]

            associations.append(
                {
                    "association": association_obj,
                    "user": user_obj,
                    "app": app_obj,
                }
            )

        return associations, total

    async def async_create_association(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        spotify_app_id: int,
        created_by: Optional[int] = None,
    ) -> UserSpotifyApp:
        """Create a new user-Spotify app association."""
        association = UserSpotifyApp(
            user_id=user_id,
            spotify_app_id=spotify_app_id,
            created_by=created_by,
        )
        db.add(association)
        await db.flush()
        await db.refresh(association)
        return association

    async def async_update_association(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        spotify_app_id: int,
    ) -> Optional[UserSpotifyApp]:
        """Update user association (change user's app)."""
        association = await self.async_get_by_user_id(db, user_id)
        if not association:
            return None

        association.spotify_app_id = spotify_app_id
        await db.flush()
        await db.refresh(association)
        return association

    async def async_delete_association(
        self, db: AsyncSession, user_id: int
    ) -> bool:
        """Delete user association by user_id."""
        association = await self.async_get_by_user_id(db, user_id)
        if not association:
            return False

        await db.delete(association)
        await db.flush()
        return True

    async def async_count_by_app_id(
        self, db: AsyncSession, app_id: int
    ) -> int:
        """Count user associations for a specific app."""
        stmt = select(func.count()).select_from(UserSpotifyApp).where(
            UserSpotifyApp.spotify_app_id == app_id
        )
        result = await db.execute(stmt)
        return result.scalar_one() or 0


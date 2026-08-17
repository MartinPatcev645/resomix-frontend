"""
Playlist Engagement Repository
================================

This repository handles CRUD operations for UserPlaylistEngagement model.
It provides engagement operations including favorites and follows for playlists
using MariaDB with SQLAlchemy ORM.

Implements engagement operations including toggling favorites/follows,
retrieving user favorites and followed playlists.

Version: 3.0.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from app.models.playlist_engagement import UserPlaylistEngagement
from app.repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class PlaylistEngagementRepository(BaseRepository[UserPlaylistEngagement]):
    """Repository for UserPlaylistEngagement model operations."""

    def __init__(self):
        """Initialize PlaylistEngagementRepository with UserPlaylistEngagement model."""
        super().__init__(UserPlaylistEngagement)

    async def async_get_engagement(
        self, db: AsyncSession, user_id: int, playlist_id: int
    ) -> Optional[UserPlaylistEngagement]:
        """
        Get or create engagement record for a user and playlist.

        Args:
            db: Database session
            user_id: User ID
            playlist_id: Playlist ID

        Returns:
            UserPlaylistEngagement instance or None if error occurred
        """
        try:
            engagement, created = await self.async_get_or_create(
                db, user_id=user_id, playlist_id=playlist_id
            )
            return engagement
        except Exception as e:
            logger.error(f"Error getting engagement: {e}")
            return None

    async def async_toggle_favorite(
        self, db: AsyncSession, user_id: int, playlist_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Toggle favorite state for a user and playlist.

        Args:
            db: Database session
            user_id: User ID
            playlist_id: Playlist ID

        Returns:
            Dictionary with engagement data or None if error occurred
        """
        try:
            # Get or create engagement
            engagement = await self.async_get_engagement(db, user_id, playlist_id)
            if not engagement:
                return None

            # Toggle favorite state
            new_favorite_state = not engagement.is_favorite
            engagement.is_favorite = new_favorite_state

            # Update timestamps based on new state
            now = datetime.utcnow()
            if new_favorite_state:
                engagement.favorite_at = now
                engagement.unfavorite_at = None
            else:
                engagement.unfavorite_at = now
                engagement.favorite_at = None

            await db.commit()
            await db.refresh(engagement)

            return {
                "user_id": engagement.user_id,
                "playlist_id": engagement.playlist_id,
                "is_favorite": engagement.is_favorite,
                "is_following": engagement.is_following,
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error toggling favorite: {e}")
            return None

    async def async_toggle_follow(
        self, db: AsyncSession, user_id: int, playlist_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Toggle follow state for a user and playlist.

        Args:
            db: Database session
            user_id: User ID
            playlist_id: Playlist ID

        Returns:
            Dictionary with engagement data or None if error occurred
        """
        try:
            # Get or create engagement
            engagement = await self.async_get_engagement(db, user_id, playlist_id)
            if not engagement:
                return None

            # Toggle follow state
            new_follow_state = not engagement.is_following
            engagement.is_following = new_follow_state

            # Update timestamps based on new state
            now = datetime.utcnow()
            if new_follow_state:
                engagement.followed_at = now
                engagement.unfollowed_at = None
            else:
                engagement.unfollowed_at = now
                engagement.followed_at = None

            await db.commit()
            await db.refresh(engagement)

            return {
                "user_id": engagement.user_id,
                "playlist_id": engagement.playlist_id,
                "is_favorite": engagement.is_favorite,
                "is_following": engagement.is_following,
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error toggling follow: {e}")
            return None

    async def async_get_user_favorites(
        self, db: AsyncSession, user_id: int
    ) -> List[UserPlaylistEngagement]:
        """
        Get all favorite playlists for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of UserPlaylistEngagement instances where is_favorite=True
        """
        try:
            stmt = (
                select(self.model)
                .where(and_(self.model.user_id == user_id, self.model.is_favorite))
                .order_by(self.model.favorite_at.desc())
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"Error getting user favorites: {e}")
            return []

    async def async_get_user_following(
        self, db: AsyncSession, user_id: int
    ) -> List[UserPlaylistEngagement]:
        """
        Get all followed playlists for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of UserPlaylistEngagement instances where is_following=True
        """
        try:
            stmt = (
                select(self.model)
                .where(and_(self.model.user_id == user_id, self.model.is_following))
                .order_by(self.model.followed_at.desc())
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"Error getting user following: {e}")
            return []

    def _find_existing(self, db: Session, **kwargs) -> Optional[UserPlaylistEngagement]:
        """Find existing engagement by user_id and playlist_id.

        Args:
            db: Database session
            **kwargs: Fields to search with (should include user_id and playlist_id)

        Returns:
            Existing UserPlaylistEngagement instance or None
        """
        if "user_id" in kwargs and "playlist_id" in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.user_id == kwargs["user_id"],
                        self.model.playlist_id == kwargs["playlist_id"],
                    )
                )
                .first()
            )
        return None

    async def _async_find_existing(
        self, db: AsyncSession, **kwargs
    ) -> Optional[UserPlaylistEngagement]:
        """Async version of _find_existing.

        Args:
            db: Database session
            **kwargs: Fields to search with (should include user_id and playlist_id)

        Returns:
            Existing UserPlaylistEngagement instance or None
        """
        if "user_id" in kwargs and "playlist_id" in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.user_id == kwargs["user_id"],
                    self.model.playlist_id == kwargs["playlist_id"],
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None

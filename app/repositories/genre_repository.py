"""
Genre Repository
================

This repository handles CRUD operations for the Genre model using MariaDB.
It provides genre creation, retrieval, and search functionality with support
for name-based filtering and popularity-based queries.

Implements get-or-create patterns for genre management and provides
case-insensitive name lookups with track count analytics.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.genre import Genre
from app.repositories.base_repository import BaseRepository


class GenreRepository(BaseRepository[Genre]):
    """Repository for Genre model operations.
    
    Implements the genre get-or-create logic from Cache.genre() method
    which uses name-based lookup and creation.
    """
    
    def __init__(self):
        """Initialize GenreRepository with Genre model."""
        super().__init__(Genre)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Genre]:
        """Find existing genre by name (case-insensitive).
        
        Implements the lookup logic from Cache.genre() which uses
        case-insensitive name matching.
        
        Args:
            db: Database session
            **kwargs: Should contain 'name' field
            
        Returns:
            Existing Genre instance or None
        """
        name = kwargs.get('name')
        if not name:
            return None
            
        # Case-insensitive lookup like Cache._get_or_create
        return db.query(self.model).filter(
            self.model.name.ilike(name)
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Genre]:
        """Async version of _find_existing."""
        name = kwargs.get('name')
        if not name:
            return None
            
        stmt = select(self.model).where(self.model.name.ilike(name))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Genre-specific methods ---
    
    def get_by_name(self, db: Session, name: str) -> Optional[Genre]:
        """Get genre by exact name match.
        
        Args:
            db: Database session
            name: Genre name to search for
            
        Returns:
            Genre instance or None
        """
        return db.query(self.model).filter(self.model.name == name).first()
    
    async def async_get_by_name(self, db: AsyncSession, name: str) -> Optional[Genre]:
        """Async version of get_by_name."""
        stmt = select(self.model).where(self.model.name == name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def search_by_name(self, db: Session, name_pattern: str, limit: int = 10) -> list[Genre]:
        """Search genres by name pattern.
        
        Args:
            db: Database session
            name_pattern: Pattern to search for (supports wildcards)
            limit: Maximum results to return
            
        Returns:
            List of matching genres
        """
        return db.query(self.model).filter(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_name(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Genre]:
        """Async version of search_by_name."""
        stmt = select(self.model).where(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_popular_genres(self, db: Session, limit: int = 20) -> list[Genre]:
        """Get most popular genres based on track count.

        Joins via the genre_id foreign key on Track for accurate counts.

        Args:
            db: Database session
            limit: Maximum number of genres to return

        Returns:
            List of genres ordered by track count (descending)
        """
        from app.models.track import Track

        return (
            db.query(self.model)
            .join(Track, Track.genre_id == self.model.id)
            .group_by(self.model.id)
            .order_by(db.func.count(Track.id).desc())
            .limit(limit)
            .all()
        )
    
    async def async_get_popular_genres(self, db: AsyncSession, limit: int = 20) -> list[Genre]:
        """Async version of get_popular_genres."""
        from app.models.track import Track
        from sqlalchemy import func
        
        stmt = (
            select(self.model)
            .join(Track, Track.genre_id == self.model.id)
            .group_by(self.model.id)
            .order_by(func.count(Track.id).desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
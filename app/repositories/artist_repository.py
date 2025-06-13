"""
Artist Repository
=================

This repository handles CRUD operations for the Artist model using MariaDB.
It provides artist creation, retrieval, and search functionality with support
for name-based filtering and pattern matching.

Implements get-or-create patterns for artist management and provides
case-insensitive name lookups for efficient artist operations.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.artist import Artist
from app.repositories.base_repository import BaseRepository


class ArtistRepository(BaseRepository[Artist]):
    """Repository for Artist model operations.
    
    Implements the artist get-or-create logic from Cache.artist() method
    which uses name-based lookup and creation.
    """
    
    def __init__(self):
        """Initialize ArtistRepository with Artist model."""
        super().__init__(Artist)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Artist]:
        """Find existing artist by name (case-insensitive).
        
        Implements the lookup logic from Cache.artist() which uses
        case-insensitive name matching.
        
        Args:
            db: Database session
            **kwargs: Should contain 'name' field
            
        Returns:
            Existing Artist instance or None
        """
        name = kwargs.get('name')
        if not name:
            return None
            
        # Case-insensitive lookup like Cache._get_or_create
        return db.query(self.model).filter(
            self.model.name.ilike(name)
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Artist]:
        """Async version of _find_existing."""
        name = kwargs.get('name')
        if not name:
            return None
            
        stmt = select(self.model).where(self.model.name.ilike(name))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Artist-specific methods ---
    
    def get_by_name(self, db: Session, name: str) -> Optional[Artist]:
        """Get artist by exact name match.
        
        Args:
            db: Database session
            name: Artist name to search for
            
        Returns:
            Artist instance or None
        """
        return db.query(self.model).filter(self.model.name == name).first()
    
    async def async_get_by_name(self, db: AsyncSession, name: str) -> Optional[Artist]:
        """Async version of get_by_name."""
        stmt = select(self.model).where(self.model.name == name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def search_by_name(self, db: Session, name_pattern: str, limit: int = 10) -> list[Artist]:
        """Search artists by name pattern.
        
        Args:
            db: Database session
            name_pattern: Pattern to search for (supports wildcards)
            limit: Maximum results to return
            
        Returns:
            List of matching artists
        """
        return db.query(self.model).filter(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_name(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Artist]:
        """Async version of search_by_name."""
        stmt = select(self.model).where(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all() 
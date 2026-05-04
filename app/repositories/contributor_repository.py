"""
Contributor Repository
======================

This repository handles CRUD operations for the Contributor model using MariaDB.
It provides contributor creation, retrieval, and search functionality with support
for name-based filtering and pattern matching.

Replaces the legacy ArtistRepository. The Contributor model unifies artists,
composers, producers, and other participants under a single table.

Implements get-or-create patterns for contributor management and provides
case-insensitive name lookups for efficient contributor operations.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.contributor import Contributor
from app.repositories.base_repository import BaseRepository


class ContributorRepository(BaseRepository[Contributor]):
    """Repository for Contributor model operations.
    
    Implements the contributor get-or-create logic (formerly Cache.artist() method)
    which uses name-based lookup and creation.
    """
    
    def __init__(self):
        """Initialize ContributorRepository with Contributor model."""
        super().__init__(Contributor)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Contributor]:
        """Find existing contributor by full_name (case-insensitive).
        
        Args:
            db: Database session
            **kwargs: Should contain 'full_name' (or legacy 'name') field
            
        Returns:
            Existing Contributor instance or None
        """
        full_name = kwargs.get('full_name') or kwargs.get('name')
        if not full_name:
            return None
            
        return db.query(self.model).filter(
            self.model.full_name.ilike(full_name)
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Contributor]:
        """Async version of _find_existing."""
        full_name = kwargs.get('full_name') or kwargs.get('name')
        if not full_name:
            return None
            
        stmt = select(self.model).where(self.model.full_name.ilike(full_name))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Contributor-specific methods ---
    
    def get_by_full_name(self, db: Session, full_name: str) -> Optional[Contributor]:
        """Get contributor by exact name match.
        
        Args:
            db: Database session
            full_name: Contributor full name to search for
            
        Returns:
            Contributor instance or None
        """
        return db.query(self.model).filter(self.model.full_name == full_name).first()
    
    async def async_get_by_full_name(self, db: AsyncSession, full_name: str) -> Optional[Contributor]:
        """Async version of get_by_full_name."""
        stmt = select(self.model).where(self.model.full_name == full_name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def search_by_name(self, db: Session, name_pattern: str, limit: int = 10) -> list[Contributor]:
        """Search contributors by name pattern (case-insensitive).
        
        Args:
            db: Database session
            name_pattern: Pattern to search for
            limit: Maximum results to return
            
        Returns:
            List of matching contributors
        """
        return db.query(self.model).filter(
            self.model.full_name.ilike(f"%{name_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_name(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Contributor]:
        """Async version of search_by_name."""
        stmt = select(self.model).where(
            self.model.full_name.ilike(f"%{name_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_by_party_id(self, db: Session, party_id: str) -> list[Contributor]:
        """Get all contributors for a party (distributor).
        
        Args:
            db: Database session
            party_id: Party ID to filter by
            
        Returns:
            List of contributors belonging to the party
        """
        return db.query(self.model).filter(
            self.model.party_id == party_id
        ).all()
    
    async def async_get_by_party_id(self, db: AsyncSession, party_id: str) -> list[Contributor]:
        """Async version of get_by_party_id."""
        stmt = select(self.model).where(self.model.party_id == party_id)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    # --- Convenience aliases for backward compatibility with "artist" terminology ---
    
    def get_by_artist_name(self, db: Session, artist_name: str) -> Optional[Contributor]:
        """Alias for get_by_full_name — preserves artist terminology for services."""
        return self.get_by_full_name(db, artist_name)
    
    async def async_get_by_artist_name(self, db: AsyncSession, artist_name: str) -> Optional[Contributor]:
        """Async alias for get_by_full_name."""
        return await self.async_get_by_full_name(db, artist_name)
    
    def search_artists(self, db: Session, name_pattern: str, limit: int = 10) -> list[Contributor]:
        """Alias for search_by_name — preserves artist terminology for services."""
        return self.search_by_name(db, name_pattern, limit)
    
    async def async_search_artists(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Contributor]:
        """Async alias for search_by_name."""
        return await self.async_search_by_name(db, name_pattern, limit)

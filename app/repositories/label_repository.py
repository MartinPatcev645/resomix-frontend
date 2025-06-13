"""
Label Repository
================

This repository handles CRUD operations for the Label model using MariaDB.
It provides label creation, retrieval, and search functionality with support
for name-based filtering and website-based lookups.

Implements get-or-create patterns for label management and provides
case-insensitive name lookups for efficient label operations.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.label import Label
from app.repositories.base_repository import BaseRepository


class LabelRepository(BaseRepository[Label]):
    """Repository for Label model operations.
    
    Implements the label get-or-create logic from Cache.label() method
    which uses name-based lookup and creation.
    """
    
    def __init__(self):
        """Initialize LabelRepository with Label model."""
        super().__init__(Label)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Label]:
        """Find existing label by name (case-insensitive).
        
        Implements the lookup logic from Cache.label() which uses
        case-insensitive name matching.
        
        Args:
            db: Database session
            **kwargs: Should contain 'name' field
            
        Returns:
            Existing Label instance or None
        """
        name = kwargs.get('name')
        if not name:
            return None
            
        # Case-insensitive lookup like Cache._get_or_create
        return db.query(self.model).filter(
            self.model.name.ilike(name)
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Label]:
        """Async version of _find_existing."""
        name = kwargs.get('name')
        if not name:
            return None
            
        stmt = select(self.model).where(self.model.name.ilike(name))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Label-specific methods ---
    
    def get_by_name(self, db: Session, name: str) -> Optional[Label]:
        """Get label by exact name match.
        
        Args:
            db: Database session
            name: Label name to search for
            
        Returns:
            Label instance or None
        """
        return db.query(self.model).filter(self.model.name == name).first()
    
    async def async_get_by_name(self, db: AsyncSession, name: str) -> Optional[Label]:
        """Async version of get_by_name."""
        stmt = select(self.model).where(self.model.name == name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def search_by_name(self, db: Session, name_pattern: str, limit: int = 10) -> list[Label]:
        """Search labels by name pattern.
        
        Args:
            db: Database session
            name_pattern: Pattern to search for (supports wildcards)
            limit: Maximum results to return
            
        Returns:
            List of matching labels
        """
        return db.query(self.model).filter(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_name(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Label]:
        """Async version of search_by_name."""
        stmt = select(self.model).where(
            self.model.name.ilike(f"%{name_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_by_website(self, db: Session, website: str) -> Optional[Label]:
        """Get label by website URL.
        
        Args:
            db: Database session
            website: Website URL to search for
            
        Returns:
            Label instance or None
        """
        return db.query(self.model).filter(self.model.website == website).first()
    
    async def async_get_by_website(self, db: AsyncSession, website: str) -> Optional[Label]:
        """Async version of get_by_website."""
        stmt = select(self.model).where(self.model.website == website)
        result = await db.execute(stmt)
        return result.scalar_one_or_none() 
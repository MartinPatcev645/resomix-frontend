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
        """Find existing label by name (case-insensitive)."""
        label_name = kwargs.get('label_name') or kwargs.get('name')
        if not label_name:
            return None
            
        return db.query(self.model).filter(
            self.model.label_name.ilike(label_name)
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Label]:
        """Async version of _find_existing."""
        label_name = kwargs.get('label_name') or kwargs.get('name')
        if not label_name:
            return None
            
        stmt = select(self.model).where(self.model.label_name.ilike(label_name))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Label-specific methods ---
    
    def get_by_label_name(self, db: Session, label_name: str) -> Optional[Label]:
        """Get label by exact name match."""
        return db.query(self.model).filter(self.model.label_name == label_name).first()
    
    async def async_get_by_label_name(self, db: AsyncSession, label_name: str) -> Optional[Label]:
        """Async version of get_by_label_name."""
        stmt = select(self.model).where(self.model.label_name == label_name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def search_by_name(self, db: Session, name_pattern: str, limit: int = 10) -> list[Label]:
        """Search labels by name pattern."""
        return db.query(self.model).filter(
            self.model.label_name.ilike(f"%{name_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_name(self, db: AsyncSession, name_pattern: str, limit: int = 10) -> list[Label]:
        """Async version of search_by_name."""
        stmt = select(self.model).where(
            self.model.label_name.ilike(f"%{name_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def async_get_by_party_id(self, db: AsyncSession, party_id: str) -> Optional[Label]:
        """Get label by party ID."""
        stmt = select(self.model).where(self.model.party_id == party_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

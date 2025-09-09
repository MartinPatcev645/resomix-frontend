"""
Waitlist Repository
==================

This repository handles database operations for the Waitlist model.
It provides CRUD operations and specialized queries for waitlist management
using the base repository pattern with both sync and async support.

Implements waitlist-specific database operations including email lookups,
status filtering, and pagination for the ResomiX application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.repositories.base_repository import BaseRepository
from app.models.waitlist import Waitlist


class WaitlistRepository(BaseRepository[Waitlist]):
    """Repository for Waitlist model operations."""
    
    def __init__(self):
        """Initialize WaitlistRepository with Waitlist model."""
        super().__init__(Waitlist)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Waitlist]:
        """Find existing waitlist entry by email.
        
        Args:
            db: Database session
            **kwargs: Should contain 'email' field
            
        Returns:
            Existing Waitlist instance or None
        """
        email = kwargs.get('email')
        if not email:
            return None
            
        return db.query(self.model).filter(self.model.email == email).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Waitlist]:
        """Async version of _find_existing."""
        email = kwargs.get('email')
        if not email:
            return None
            
        stmt = select(self.model).where(self.model.email == email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Waitlist-specific methods ---
    
    def get_by_email(self, db: Session, email: str) -> Optional[Waitlist]:
        """Get waitlist entry by email.
        
        Args:
            db: Database session
            email: Email address to search for
            
        Returns:
            Waitlist instance or None
        """
        return db.query(self.model).filter(self.model.email == email).first()
    
    async def async_get_by_email(self, db: AsyncSession, email: str) -> Optional[Waitlist]:
        """Async version of get_by_email."""
        stmt = select(self.model).where(self.model.email == email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_by_status(self, db: Session, status: str, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Get waitlist entries by status.
        
        Args:
            db: Database session
            status: Status to filter by ('pending', 'approved', 'rejected')
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Waitlist instances
        """
        return (
            db.query(self.model)
            .filter(self.model.status == status)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    async def async_get_by_status(self, db: AsyncSession, status: str, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Async version of get_by_status."""
        stmt = (
            select(self.model)
            .where(self.model.status == status)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_pending_entries(self, db: Session, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Get pending waitlist entries.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of pending Waitlist instances
        """
        return self.get_by_status(db, 'pending', skip, limit)
    
    async def async_get_pending_entries(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Async version of get_pending_entries."""
        return await self.async_get_by_status(db, 'pending', skip, limit)
    
    def get_approved_entries(self, db: Session, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Get approved waitlist entries.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of approved Waitlist instances
        """
        return self.get_by_status(db, 'approved', skip, limit)
    
    async def async_get_approved_entries(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Waitlist]:
        """Async version of get_approved_entries."""
        return await self.async_get_by_status(db, 'approved', skip, limit)
    
    def count_by_status(self, db: Session, status: str) -> int:
        """Count waitlist entries by status.
        
        Args:
            db: Database session
            status: Status to count
            
        Returns:
            Number of entries with the specified status
        """
        return db.query(self.model).filter(self.model.status == status).count()
    
    async def async_count_by_status(self, db: AsyncSession, status: str) -> int:
        """Async version of count_by_status."""
        stmt = select(self.model).where(self.model.status == status)
        result = await db.execute(stmt)
        return len(result.scalars().all())
    
    def get_total_count(self, db: Session) -> int:
        """Get total number of waitlist entries.
        
        Args:
            db: Database session
            
        Returns:
            Total number of waitlist entries
        """
        return db.query(self.model).count()
    
    async def async_get_total_count(self, db: AsyncSession) -> int:
        """Async version of get_total_count."""
        stmt = select(self.model)
        result = await db.execute(stmt)
        return len(result.scalars().all())

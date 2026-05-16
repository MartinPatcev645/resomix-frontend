"""
Waitlist Repository
==================

This repository handles database operations for the Waitlist model.
It provides CRUD operations and specialized queries for waitlist management
using the base repository pattern with both sync and async support.

Implements waitlist-specific database operations including email lookups,
status filtering, and pagination for the Resomix application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, func, desc, asc, String
from datetime import datetime

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
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_waitlist_list_with_filters(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 30,
        search: Optional[str] = None,
        search_column: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "desc"
    ) -> Tuple[List[Waitlist], int]:
        """Get paginated waitlist list with filters for admin."""
        query = select(Waitlist)
        count_query = select(func.count(Waitlist.id))
        filters = []
        
        # Status filter
        if status:
            filters.append(Waitlist.status == status)
        
        # Search filter - support: id, email
        if search and search_column:
            if search_column == "id":
                try:
                    search_id = int(search)
                    filters.append(Waitlist.id == search_id)
                except ValueError:
                    search_term = f"%{search}%"
                    filters.append(func.cast(Waitlist.id, String).like(search_term))
            elif search_column == "email":
                search_term = f"%{search}%"
                filters.append(Waitlist.email.like(search_term))
        elif search:
            search_term = f"%{search}%"
            filters.append(Waitlist.email.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Waitlist.created_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                filters.append(Waitlist.created_at < date_to_obj.replace(hour=23, minute=59, second=59))
            except ValueError:
                pass
        
        # Apply filters
        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))
        
        # Get total count
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0
        
        # Apply sorting
        sort_column = getattr(Waitlist, sort_by, Waitlist.id)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.limit(page_size).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        waitlist_list = result.scalars().all()
        
        return waitlist_list, total
    
    async def delete_waitlist(self, db: AsyncSession, waitlist_id: int) -> bool:
        """Delete a single waitlist entry."""
        waitlist = await self.async_get_by_id(db, waitlist_id)
        if waitlist:
            await db.delete(waitlist)
            await db.flush()
            return True
        return False
    
    async def batch_delete_waitlist(self, db: AsyncSession, waitlist_ids: List[int]) -> int:
        """Delete multiple waitlist entries."""
        stmt = delete(Waitlist).where(Waitlist.id.in_(waitlist_ids))
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount
    
    async def update_waitlist_status(
        self,
        db: AsyncSession,
        waitlist_id: int,
        status: str
    ) -> Optional[Waitlist]:
        """Update waitlist status."""
        waitlist = await self.async_get_by_id(db, waitlist_id)
        if waitlist:
            waitlist.status = status
            await db.flush()
            await db.refresh(waitlist)
        return waitlist
    
    async def get_waitlist_for_export(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        search_column: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "desc"
    ) -> List[Waitlist]:
        """Get all waitlist entries for export (no pagination)."""
        query = select(Waitlist)
        filters = []
        
        # Status filter
        if status:
            filters.append(Waitlist.status == status)
        
        # Search filter
        if search and search_column:
            if search_column == "id":
                try:
                    search_id = int(search)
                    filters.append(Waitlist.id == search_id)
                except ValueError:
                    search_term = f"%{search}%"
                    filters.append(func.cast(Waitlist.id, String).like(search_term))
            elif search_column == "email":
                search_term = f"%{search}%"
                filters.append(Waitlist.email.like(search_term))
        elif search:
            search_term = f"%{search}%"
            filters.append(Waitlist.email.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Waitlist.created_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                filters.append(Waitlist.created_at < date_to_obj.replace(hour=23, minute=59, second=59))
            except ValueError:
                pass
        
        # Apply filters
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Waitlist, sort_by, Waitlist.id)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Execute query (no pagination)
        result = await db.execute(query)
        return result.scalars().all()

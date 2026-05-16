"""
Contact Repository
==================

This repository handles CRUD operations for the Contact model using MariaDB.
It provides contact creation, retrieval, status updates, and filtering capabilities
with proper error handling and data validation.

Implements contact management operations including user-based filtering,
inquiry tracking, and administrative status management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select, delete, func, and_, desc, asc, String
from datetime import datetime
from app.models.contact import Contact
from app.repositories.base_repository import BaseRepository


class ContactRepository(BaseRepository[Contact]):
    """Repository for contact operations."""
    
    def __init__(self):
        super().__init__(Contact)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Contact]:
        """Find existing contact record by email."""
        # For contact, we'll look up by email (if provided)
        # This is a simple implementation - adjust based on business logic
        email = kwargs.get('email')
        if email:
            return db.query(Contact).filter(Contact.email == email).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Contact]:
        """Async version of find existing contact record."""
        email = kwargs.get('email')
        if email:
            stmt = select(Contact).where(Contact.email == email)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None
    
    async def create_contact(
        self,
        db: AsyncSession,
        user_id: Optional[str],
        name: str,
        email: str,
        subject: Optional[str],
        phone: Optional[str],
        message: str
    ) -> Contact:
        """
        Create a new contact submission.
        
        Args:
            db: Database session
            user_id: Optional user ID
            name: Contact name
            email: Contact email
            subject: Optional subject
            phone: Optional phone number
            message: Contact message
            
        Returns:
            Created contact record
        """
        contact = Contact(
            user_id=user_id,
            name=name,
            email=email,
            subject=subject,
            phone=phone,
            message=message,
            status='open'
        )
        
        db.add(contact)
        await db.flush()
        await db.refresh(contact)
        
        return contact
    
    async def get_contacts_by_user(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 10,
        offset: int = 0
    ) -> List[Contact]:
        """
        Get contacts for a specific user.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of contact records
        """
        stmt = (
            select(Contact)
            .where(Contact.user_id == user_id)
            .order_by(Contact.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def get_contacts_by_status(
        self,
        db: AsyncSession,
        status: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Contact]:
        """
        Get contacts by status.
        
        Args:
            db: Database session
            status: Contact status ('open' or 'resolved')
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of contact records
        """
        stmt = (
            select(Contact)
            .where(Contact.status == status)
            .order_by(Contact.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def update_contact_status(
        self,
        db: AsyncSession,
        contact_id: int,
        status: str
    ) -> Optional[Contact]:
        """
        Update contact status.
        
        Args:
            db: Database session
            contact_id: Contact ID
            status: New status
            
        Returns:
            Updated contact record or None if not found
        """
        contact = await self.async_get_by_id(db, contact_id)
        if contact:
            contact.status = status
            await db.flush()
            await db.refresh(contact)
        
        return contact
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_contact_list_with_filters(
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
    ) -> Tuple[List[Contact], int]:
        """Get paginated contact list with filters for admin."""
        query = select(Contact)
        count_query = select(func.count(Contact.id))
        filters = []
        
        # Status filter
        if status:
            filters.append(Contact.status == status)
        
        # Search filter - support: id, user_id, name, email, message
        if search and search_column:
            if search_column == "id":
                try:
                    search_id = int(search)
                    filters.append(Contact.id == search_id)
                except ValueError:
                    search_term = f"%{search}%"
                    filters.append(func.cast(Contact.id, String).like(search_term))
            elif search_column == "user_id":
                search_term = f"%{search}%"
                filters.append(Contact.user_id.like(search_term))
            elif search_column == "name":
                search_term = f"%{search}%"
                filters.append(Contact.name.like(search_term))
            elif search_column == "email":
                search_term = f"%{search}%"
                filters.append(Contact.email.like(search_term))
            elif search_column == "message":
                search_term = f"%{search}%"
                filters.append(Contact.message.like(search_term))
        elif search:
            search_term = f"%{search}%"
            filters.append(Contact.message.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Contact.submitted_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                filters.append(Contact.submitted_at < date_to_obj.replace(hour=23, minute=59, second=59))
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
        sort_column = getattr(Contact, sort_by, Contact.id)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.limit(page_size).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        contact_list = result.scalars().all()
        
        return contact_list, total
    
    async def delete_contact(self, db: AsyncSession, contact_id: int) -> bool:
        """Delete a single contact entry."""
        contact = await self.async_get_by_id(db, contact_id)
        if contact:
            await db.delete(contact)
            await db.flush()
            return True
        return False
    
    async def batch_delete_contact(self, db: AsyncSession, contact_ids: List[int]) -> int:
        """Delete multiple contact entries."""
        stmt = delete(Contact).where(Contact.id.in_(contact_ids))
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount
    
    async def get_contact_for_export(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        search_column: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "desc"
    ) -> List[Contact]:
        """Get all contacts for export (no pagination)."""
        query = select(Contact)
        filters = []
        
        # Status filter
        if status:
            filters.append(Contact.status == status)
        
        # Search filter
        if search and search_column:
            if search_column == "id":
                try:
                    search_id = int(search)
                    filters.append(Contact.id == search_id)
                except ValueError:
                    search_term = f"%{search}%"
                    filters.append(func.cast(Contact.id, String).like(search_term))
            elif search_column == "user_id":
                search_term = f"%{search}%"
                filters.append(Contact.user_id.like(search_term))
            elif search_column == "name":
                search_term = f"%{search}%"
                filters.append(Contact.name.like(search_term))
            elif search_column == "email":
                search_term = f"%{search}%"
                filters.append(Contact.email.like(search_term))
            elif search_column == "message":
                search_term = f"%{search}%"
                filters.append(Contact.message.like(search_term))
        elif search:
            search_term = f"%{search}%"
            filters.append(Contact.message.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Contact.submitted_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                filters.append(Contact.submitted_at < date_to_obj.replace(hour=23, minute=59, second=59))
            except ValueError:
                pass
        
        # Apply filters
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Contact, sort_by, Contact.id)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Execute query (no pagination)
        result = await db.execute(query)
        return result.scalars().all()

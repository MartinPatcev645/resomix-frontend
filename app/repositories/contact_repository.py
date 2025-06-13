"""
Contact Repository
==================

Repository for contact-related database operations.

Author: AI Assistant
Date: December 2024
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select
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
        await db.commit()
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
            await db.commit()
            await db.refresh(contact)
        
        return contact 
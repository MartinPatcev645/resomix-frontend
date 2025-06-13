"""
Contact Service
===============

Service for contact form processing and business logic.

Author: AI Assistant
Date: December 2024
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.contact_repository import ContactRepository
from app.models.contact import Contact


class ContactService:
    """Service for contact operations."""
    
    def __init__(self):
        self.contact_repository = ContactRepository()
    
    async def process_contact_submission(
        self,
        db: AsyncSession,
        contact_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a contact form submission.
        
        Args:
            db: Database session
            contact_data: Contact form data
            
        Returns:
            Processing result
        """
        try:
            # Validate required fields
            name = contact_data.get('name')
            email = contact_data.get('email')
            message = contact_data.get('message')
            
            if not name or not email or not message:
                return {
                    "success": False,
                    "error": "Name, email, and message are required fields"
                }
            
            # Extract optional fields
            subject = contact_data.get('subject')
            phone = contact_data.get('phone')
            user_id = contact_data.get('user_id')
            
            # Create contact record
            contact = await self.contact_repository.create_contact(
                db=db,
                user_id=user_id,
                name=name,
                email=email,
                subject=subject,
                phone=phone,
                message=message
            )
            
            return {
                "success": True,
                "message": "Contact form submitted successfully and saved to database.",
                "contact_id": contact.id
            }
            
        except Exception as e:
            print(f"Error processing contact submission: {e}")
            return {
                "success": False,
                "error": "An error occurred while processing your contact submission"
            }
    
    async def get_user_contacts(
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
        return await self.contact_repository.get_contacts_by_user(
            db=db,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
    
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
        return await self.contact_repository.get_contacts_by_status(
            db=db,
            status=status,
            limit=limit,
            offset=offset
        )
    
    async def update_contact_status(
        self,
        db: AsyncSession,
        contact_id: int,
        status: str
    ) -> Dict[str, Any]:
        """
        Update contact status.
        
        Args:
            db: Database session
            contact_id: Contact ID
            status: New status
            
        Returns:
            Update result
        """
        try:
            contact = await self.contact_repository.update_contact_status(
                db=db,
                contact_id=contact_id,
                status=status
            )
            
            if contact:
                return {
                    "success": True,
                    "message": f"Contact status updated to {status}",
                    "contact_id": contact.id
                }
            else:
                return {
                    "success": False,
                    "error": f"Contact with ID {contact_id} not found"
                }
                
        except Exception as e:
            print(f"Error updating contact status: {e}")
            return {
                "success": False,
                "error": "An error occurred while updating contact status"
            }
    
    async def get_contact_by_id(
        self,
        db: AsyncSession,
        contact_id: int
    ) -> Optional[Contact]:
        """
        Get contact by ID.
        
        Args:
            db: Database session
            contact_id: Contact ID
            
        Returns:
            Contact record or None if not found
        """
        return await self.contact_repository.async_get_by_id(db, contact_id)

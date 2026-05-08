"""
Contact Service
===============

This service manages user contact/inquiry operations including creation, retrieval, and status updates.
It handles contact form submissions, user-based filtering, and administrative status management
using MariaDB repositories for data persistence.

Provides comprehensive contact management with validation, error handling,
and support for different inquiry types and statuses.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.contact_repository import ContactRepository
from app.models.contact import Contact
import math
import csv
import os
import uuid
from datetime import datetime, timedelta
from app.core.config import settings


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
    
    # ============================================================================
    # Admin Methods (similar to feedback_service.py)
    # ============================================================================
    
    async def get_contact_list_admin(self, db: AsyncSession, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get paginated contact list with filters for admin."""
        try:
            contact_list, total = await self.contact_repository.get_contact_list_with_filters(
                db=db, **{k: v for k, v in filters.items() if k not in ['format']}
            )
            total_pages = math.ceil(total / filters.get('page_size', 30)) if total > 0 else 0
            return {"success": True, "data": contact_list, "pagination": {
                "page": filters.get('page', 1), "page_size": filters.get('page_size', 30),
                "total": total, "total_pages": total_pages
            }}
        except Exception as e:
            return {"success": False, "error": str(e), "data": [], "pagination": {
                "page": 1, "page_size": 30, "total": 0, "total_pages": 0
            }}
    
    async def delete_contact_admin(self, db: AsyncSession, contact_id: int) -> Dict[str, Any]:
        """Delete a single contact entry."""
        try:
            deleted = await self.contact_repository.delete_contact(db, contact_id)
            return {"success": deleted, "message": "Contact deleted successfully"} if deleted else \
                   {"success": False, "error": f"Contact with ID {contact_id} not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def batch_delete_contact_admin(self, db: AsyncSession, contact_ids: List[int]) -> Dict[str, Any]:
        """Delete multiple contact entries."""
        try:
            deleted_count = await self.contact_repository.batch_delete_contact(db, contact_ids)
            return {"success": True, "deleted_count": deleted_count, 
                    "message": f"{deleted_count} contact entries deleted"}
        except Exception as e:
            return {"success": False, "error": str(e), "deleted_count": 0}
    
    async def mark_contact_status_admin(self, db: AsyncSession, contact_id: int, status: str) -> Dict[str, Any]:
        """Mark contact status for admin."""
        try:
            contact = await self.contact_repository.update_contact_status(db, contact_id, status)
            return {"success": True, "data": contact, "message": "Status updated successfully"} if contact else \
                   {"success": False, "error": f"Contact with ID {contact_id} not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def export_contact_csv_admin(self, db: AsyncSession, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Export contact to CSV file and return download URL."""
        try:
            contact_list = await self.contact_repository.get_contact_for_export(
                db=db, **{k: v for k, v in filters.items() if k not in ['page', 'page_size', 'format']}
            )
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"contact_export_{timestamp}_{uuid.uuid4().hex[:8]}.csv"
            export_dir = os.path.join(os.getcwd(), 'exports')
            os.makedirs(export_dir, exist_ok=True)
            
            with open(os.path.join(export_dir, filename), 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['ID', 'User ID', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status', 'Submitted At'])
                for c in contact_list:
                    writer.writerow([c.id, c.user_id or '', c.name or '', c.email or '', c.phone or '', 
                                   c.subject or '', c.message or '', c.status, 
                                   c.submitted_at.isoformat() if c.submitted_at else ''])
            
            base_url = settings.resomix_server_url
            return {
                "success": True,
                "download_url": f"{base_url}/exports/{filename}",
                "filename": filename,
                "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

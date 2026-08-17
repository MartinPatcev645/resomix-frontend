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
from app.services.email_service import EmailService
from app.models.contact import Contact
import math
import csv
import os
import uuid
from datetime import datetime, timedelta
from app.core.config import settings
from app.utils.sanitization import csv_safe
import logging

logger = logging.getLogger(__name__)


class ContactService:
    """Service for contact operations."""

    def __init__(self):
        self.contact_repository = ContactRepository()
        self.email_service = EmailService()
    
    async def process_contact_submission(
        self,
        db: AsyncSession,
        contact_data: Dict[str, Any],
        current_user: Optional[Any] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
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
            # Validate required fields. name + email are required; message is OPTIONAL (a B2B partner
            # request can be valid without a free-text use case — the structured fields carry intent).
            name = contact_data.get('name')
            email = contact_data.get('email')
            message = contact_data.get('message')

            if not name or not email:
                return {
                    "success": False,
                    "error": "Name and email are required fields"
                }

            # Extract optional + partner fields
            subject = contact_data.get('subject')
            phone = contact_data.get('phone')
            user_id = contact_data.get('user_id')
            contact_type = contact_data.get('contact_type') or 'consumer'
            if contact_type not in ('consumer', 'partner'):
                contact_type = 'consumer'
            company_name = contact_data.get('company_name')
            role = contact_data.get('role')
            partner_type = contact_data.get('partner_type')
            preferred_path = contact_data.get('preferred_path')
            catalog_context = contact_data.get('catalog_context')
            catalog_size = contact_data.get('catalog_size')
            estimated_calls = contact_data.get('estimated_calls')

            # The B2B fields only ever belong to a partner submission. Drop them defensively for
            # consumer contacts so a stray payload can't put partner data on a /contact row.
            if contact_type != 'partner':
                company_name = role = partner_type = preferred_path = None
                catalog_context = catalog_size = estimated_calls = None

            # Give partner requests a useful default subject for the admin list.
            if contact_type == 'partner' and not subject:
                subject = f"B2B Partner Request: {company_name or name}"

            # Create contact record
            contact = await self.contact_repository.create_contact(
                db=db,
                user_id=user_id,
                name=name,
                email=email,
                subject=subject,
                phone=phone,
                message=message,
                contact_type=contact_type,
                company_name=company_name,
                role=role,
                partner_type=partner_type,
                preferred_path=preferred_path,
                catalog_context=catalog_context,
                catalog_size=catalog_size,
                estimated_calls=estimated_calls,
            )

            # Send the acknowledgement email to the submitter. Best-effort — a mail hiccup must never
            # fail the submission (the record is already saved).
            try:
                await self.email_service.send_contact_confirmation(
                    email=email,
                    name=name,
                    contact_type=contact_type,
                )
            except Exception as email_exc:
                print(f"Contact confirmation email failed (non-fatal): {email_exc}")

            # Notify the admin inbox (ADMIN_NOTIFICATION_EMAIL) with the full details + who submitted
            # it (signed-in user or anonymous). Best-effort — never fail the submission on email
            # trouble; no-op if ADMIN_NOTIFICATION_EMAIL isn't configured.
            try:
                admin_details = {
                    "contact_id": contact.id,
                    "contact_type": contact_type,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "subject": subject,
                    "message": message,
                    "company_name": company_name,
                    "role": role,
                    "partner_type": partner_type,
                    "preferred_path": preferred_path,
                    "catalog_context": catalog_context,
                    "catalog_size": catalog_size,
                    "estimated_calls": estimated_calls,
                    "is_signed_in": bool(current_user),
                    "user_id": (getattr(current_user, "id", None) if current_user else contact_data.get("user_id")),
                    "user_email": (getattr(current_user, "email", None) if current_user else None),
                    "user_username": (getattr(current_user, "username", None) if current_user else None),
                    "user_name": (getattr(current_user, "name", None) if current_user else None),
                    "submitted_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
                }
                await self.email_service.send_contact_admin_notification(admin_details)
            except Exception as admin_exc:
                print(f"Contact admin notification failed (non-fatal): {admin_exc}")

            return {
                "success": True,
                "message": "Contact form submitted successfully and saved to database.",
                "contact_id": contact.id
            }
            
        except Exception as e:
            logger.error(f"Error processing contact submission: {e}")
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
            logger.error(f"Error updating contact status: {e}")
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
        # With the submitting account eager-loaded: every admin caller serializes the result, and
        # the `user` relationship is lazy (unusable in async context) unless loaded up front.
        return await self.contact_repository.get_contact_with_user(db, contact_id)
    
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
                writer.writerow(['ID', 'Type', 'User ID', 'Name', 'Email', 'Phone', 'Subject', 'Message',
                                 'Company', 'Role', 'Partner Type', 'Preferred Path', 'Catalogue Context',
                                 'Catalog Size', 'Est. Monthly Calls', 'Status', 'Submitted At'])
                for c in contact_list:
                    # csv_safe on every user-typed field — a spreadsheet executes a cell that
                    # starts with = + - or @ when the export is opened.
                    writer.writerow([c.id, getattr(c, 'contact_type', '') or '', c.user_id or '',
                                   csv_safe(c.name or ''), csv_safe(c.email or ''), csv_safe(c.phone or ''),
                                   csv_safe(c.subject or ''), csv_safe(c.message or ''),
                                   csv_safe(getattr(c, 'company_name', '') or ''), csv_safe(getattr(c, 'role', '') or ''),
                                   csv_safe(getattr(c, 'partner_type', '') or ''), csv_safe(getattr(c, 'preferred_path', '') or ''),
                                   csv_safe(getattr(c, 'catalog_context', '') or ''), csv_safe(getattr(c, 'catalog_size', '') or ''),
                                   csv_safe(getattr(c, 'estimated_calls', '') or ''), c.status,
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

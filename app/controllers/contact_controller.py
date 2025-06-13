"""
Contact Controller
==================

Controller for handling contact form requests and responses.

Author: AI Assistant
Date: December 2024
"""

from typing import Dict, Any
from fastapi.responses import JSONResponse
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.contact_service import ContactService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class ContactController:
    """Controller for contact operations."""
    
    def __init__(self):
        self.contact_service = ContactService()
    
    async def submit_contact(self, db: AsyncSession, contact_data: Dict[str, Any]) -> JSONResponse:
        """
        Submit a contact form.
        
        Args:
            db: Database session
            contact_data: Contact form data
            
        Returns:
            JSON response with submission result
        """
        log_request("contact submission", "POST", {
            "name": contact_data.get('name'),
            "email": contact_data.get('email'),
            "subject": contact_data.get('subject', 'N/A')
        })
        
        try:
            # Process contact submission
            result = await self.contact_service.process_contact_submission(db, contact_data)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            print(f"Error in contact controller: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing your contact submission"
                )
            )
    
    async def get_contact_by_id(self, db: AsyncSession, contact_id: int) -> JSONResponse:
        """
        Get a contact by ID.
        
        Args:
            db: Database session
            contact_id: Contact ID
            
        Returns:
            JSON response with contact data
        """
        try:
            contact = await self.contact_service.get_contact_by_id(db, contact_id)
            
            if contact:
                contact_data = {
                    "id": contact.id,
                    "user_id": contact.user_id,
                    "name": contact.name,
                    "email": contact.email,
                    "subject": contact.subject,
                    "phone": contact.phone,
                    "message": contact.message,
                    "status": contact.status,
                    "submitted_at": contact.submitted_at.isoformat() if contact.submitted_at else None
                }
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data=contact_data)
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=f"Contact with ID {contact_id} not found"
                    )
                )
                
        except Exception as e:
            print(f"Error getting contact by ID: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving contact"
                )
            )
    
    async def update_contact_status(self, db: AsyncSession, contact_id: int, status_data: Dict[str, Any]) -> JSONResponse:
        """
        Update contact status.
        
        Args:
            db: Database session
            contact_id: Contact ID
            status_data: Status update data
            
        Returns:
            JSON response with update result
        """
        try:
            new_status = status_data.get("status")
            if not new_status:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="Status is required"
                    )
                )
            
            result = await self.contact_service.update_contact_status(db, contact_id, new_status)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            print(f"Error updating contact status: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while updating contact status"
                )
            ) 
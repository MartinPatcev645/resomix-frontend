"""
Contact Controller
==================

This controller handles HTTP requests for user contact/inquiry functionality.
It processes contact form submissions, retrieval requests, and status updates,
coordinating with contact service to manage user inquiries and communications.

Manages request validation, response formatting, and error handling
for all contact-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.contact_service import ContactService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService


class ContactController:
    """Controller for contact operations."""
    
    def __init__(self):
        self.contact_service = ContactService()
        self.logging_service = LoggingService()
    
    async def submit_contact(self, db: AsyncSession, request: Request, contact_data: Dict[str, Any]) -> JSONResponse:
        """
        Submit a contact form.
        
        Args:
            db: Database session
            contact_data: Contact form data
            
        Returns:
            JSON response with submission result
        """
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Process contact submission
            result = await self.contact_service.process_contact_submission(db, contact_data)
            
            if result.get("success"):
                self.logging_service.log_user_action(db=db, action="contact_submit_success", message="Contact form submitted", correlation_id=correlation_id, metadata={"email": contact_data.get("email")})
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                self.logging_service.log_user_action(db=db, action="contact_submit_failed", message=result.get("error"), correlation_id=correlation_id, metadata={"email": contact_data.get("email")})
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="submit_contact", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing your contact submission"
                )
            )
    
    async def get_contact_by_id(self, db: AsyncSession, request: Request, contact_id: int) -> JSONResponse:
        """
        Get a contact by ID.
        
        Args:
            db: Database session
            contact_id: Contact ID
            
        Returns:
            JSON response with contact data
        """
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            contact = await self.contact_service.get_contact_by_id(db, contact_id)
            
            if contact:
                self.logging_service.log_user_action(db=db, action="get_contact_success", message="Contact retrieved", correlation_id=correlation_id, metadata={"contact_id": contact_id})
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
                self.logging_service.log_user_action(db=db, action="get_contact_not_found", message="Contact not found", correlation_id=correlation_id, metadata={"contact_id": contact_id})
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=f"Contact with ID {contact_id} not found"
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="get_contact_by_id", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving contact"
                )
            )
    
    async def update_contact_status(self, db: AsyncSession, request: Request, contact_id: int, status_data: Dict[str, Any]) -> JSONResponse:
        """
        Update contact status.
        
        Args:
            db: Database session
            contact_id: Contact ID
            status_data: Status update data
            
        Returns:
            JSON response with update result
        """
        correlation_id = self.logging_service.generate_correlation_id()
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
                self.logging_service.log_user_action(db=db, action="update_contact_status_success", message="Contact status updated", correlation_id=correlation_id, metadata={"contact_id": contact_id, "status": new_status})
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                self.logging_service.log_user_action(db=db, action="update_contact_status_failed", message=result.get("error"), correlation_id=correlation_id, metadata={"contact_id": contact_id})
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="update_contact_status", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while updating contact status"
                )
            )

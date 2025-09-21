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
import time
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Process contact submission
            result = await self.contact_service.process_contact_submission(db, contact_data)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=True,
                    data={"message": result.get("message")}
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="contact_submit_success",
                    message="Contact form submitted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "email": contact_data.get("email"),
                        "name": contact_data.get("name"),
                        "subject": contact_data.get("subject"),
                        "phone": contact_data.get("phone"),
                        "contact_id": result.get("contact_id"),
                        "response": response_data,
                        "operation": "contact_submission"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="contact_submit_failed",
                    message=f"Contact form submission failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=duration_ms,
                    metadata={
                        "email": contact_data.get("email"),
                        "name": contact_data.get("name"),
                        "subject": contact_data.get("subject"),
                        "phone": contact_data.get("phone"),
                        "error_details": result.get("error"),
                        "response": response_data,
                        "operation": "contact_submission"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while processing your contact submission"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="contact_submit_exception",
                message="Exception occurred during contact form submission",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="submit_contact",
                metadata={
                    "email": contact_data.get("email"),
                    "name": contact_data.get("name"),
                    "subject": contact_data.get("subject"),
                    "phone": contact_data.get("phone"),
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "contact_submission"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
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
                
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=True, data=contact_data)
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="get_contact_success",
                    message="Contact retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "contact_id": contact.id,
                        "user_id": contact.user_id,
                        "email": contact.email,
                        "name": contact.name,
                        "contact_status": contact.status,
                        "response": response_data,
                        "operation": "contact_retrieval"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=f"Contact with ID {contact_id} not found"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_contact_not_found",
                    message=f"Contact with ID {contact_id} not found",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "contact_id": contact_id,
                        "error": "Contact not found",
                        "response": response_data,
                        "operation": "contact_retrieval"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while retrieving contact"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_contact_exception",
                message="Exception occurred while retrieving contact",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get_contact_by_id",
                metadata={
                    "contact_id": contact_id,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "contact_retrieval"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            new_status = status_data.get("status")
            if not new_status:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error="Status is required"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="update_contact_status_validation_failed",
                    message="Contact status update failed: Status is required",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=duration_ms,
                    metadata={
                        "contact_id": contact_id,
                        "error": "Status is required",
                        "provided_data": status_data,
                        "response": response_data,
                        "operation": "contact_status_update"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_data
                )
            
            result = await self.contact_service.update_contact_status(db, contact_id, new_status)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=True,
                    data={"message": result.get("message")}
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="update_contact_status_success",
                    message="Contact status updated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "contact_id": contact_id,
                        "new_status": new_status,
                        "previous_status": result.get("previous_status"),
                        "response": response_data,
                        "operation": "contact_status_update"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="update_contact_status_failed",
                    message=f"Contact status update failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "contact_id": contact_id,
                        "attempted_status": new_status,
                        "error_details": result.get("error"),
                        "response": response_data,
                        "operation": "contact_status_update"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred while updating contact status"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="update_contact_status_exception",
                message="Exception occurred while updating contact status",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="update_contact_status",
                metadata={
                    "contact_id": contact_id,
                    "attempted_status": status_data.get("status"),
                    "status_data": status_data,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "contact_status_update"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )

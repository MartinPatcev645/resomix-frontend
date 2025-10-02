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

from typing import Dict, Any, List
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
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_contact_list_admin(self, db: AsyncSession, request: Request, filters: Dict[str, Any]) -> JSONResponse:
        """Get paginated contact list with filters for admin."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.contact_service.get_contact_list_admin(db, filters)
            if result.get("success"):
                contact_list = [{"id": c.id, "user_id": c.user_id, "name": c.name, "email": c.email,
                                "subject": c.subject, "phone": c.phone, "message": c.message, "status": c.status,
                                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None}
                               for c in result.get("data", [])]
                duration_ms = (time.time() - start_time) * 1000
                response_data = {"success": True, "data": contact_list, "pagination": result.get("pagination")}
                self.logging_service.log(async_db=db, level="INFO", category="ADMIN_ACTION",
                    action="admin_contact_list_success", message="Admin contact list retrieved successfully",
                    correlation_id=correlation_id, request=request, status_code=200, duration_ms=duration_ms,
                    metadata={"filters": filters, "result_count": len(contact_list), "operation": "admin_contact_list"})
                return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)
            else:
                return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error=result.get("error", "Failed to retrieve contact list")))
        except Exception as e:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def delete_contact_admin(self, db: AsyncSession, request: Request, contact_id: int) -> JSONResponse:
        """Delete a single contact entry."""
        try:
            result = await self.contact_service.delete_contact_admin(db, contact_id)
            if result.get("success"):
                return JSONResponse(status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data={"message": result.get("message")}))
            else:
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error=result.get("error")))
        except Exception as e:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def batch_delete_contact_admin(self, db: AsyncSession, request: Request, contact_ids: List[int]) -> JSONResponse:
        """Delete multiple contact entries."""
        try:
            result = await self.contact_service.batch_delete_contact_admin(db, contact_ids)
            return JSONResponse(status_code=status.HTTP_200_OK,
                content={"success": result.get("success"), "deleted_count": result.get("deleted_count", 0),
                        "message": result.get("message", result.get("error", ""))})
        except Exception as e:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def mark_contact_status_admin(self, db: AsyncSession, request: Request, contact_id: int, status_value: str) -> JSONResponse:
        """Mark contact status for admin."""
        try:
            result = await self.contact_service.mark_contact_status_admin(db, contact_id, status_value)
            if result.get("success"):
                contact = result.get("data")
                contact_data = {"id": contact.id, "user_id": contact.user_id, "name": contact.name,
                              "email": contact.email, "subject": contact.subject, "phone": contact.phone,
                              "message": contact.message, "status": contact.status,
                              "submitted_at": contact.submitted_at.isoformat() if contact.submitted_at else None}
                return JSONResponse(status_code=status.HTTP_200_OK,
                    content={"success": True, "data": contact_data, "message": result.get("message")})
            else:
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error=result.get("error")))
        except Exception as e:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def export_contact_csv_admin(self, db: AsyncSession, request: Request, filters: Dict[str, Any]) -> JSONResponse:
        """Export contact to CSV and return download URL."""
        try:
            result = await self.contact_service.export_contact_csv_admin(db, filters)
            if result.get("success"):
                return JSONResponse(status_code=status.HTTP_200_OK, content={
                    "success": True, "download_url": result.get("download_url"),
                    "filename": result.get("filename"), "expires_at": result.get("expires_at")
                })
            else:
                return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error=result.get("error", "Failed to export contact")))
        except Exception as e:
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))

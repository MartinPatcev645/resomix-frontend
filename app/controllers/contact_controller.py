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

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging
from app.services.contact_service import ContactService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User
from app.models.user import User

logger = logging.getLogger(__name__)


def _serialize_submitter(contact) -> Optional[Dict[str, Any]]:
    """The account behind a submission, or None when it was submitted anonymously.

    ``contacts.user_id`` is persisted at submit time, so "was this person signed in?" is real
    stored data — the same thing the admin notification email reports — not something we can only
    know at request time.

    The relationship is lazy by default and this runs in async context, so touching an unloaded
    ``contact.user`` would raise MissingGreenlet. Endpoints that want the account eager-load it;
    the rest simply get ``None`` here rather than a crash.
    """
    if getattr(contact, "user_id", None) is None:
        return None
    try:
        if "user" in sa_inspect(contact).unloaded:
            return None
    except Exception:
        return None

    user = contact.user
    if user is None:
        return None
    return {
        "id": user.id,
        "uuid": str(user.uuid) if getattr(user, "uuid", None) else None,
        "username": getattr(user, "username", None),
        "name": getattr(user, "name", None),
        "email": getattr(user, "email", None),
        "is_active": getattr(user, "is_active", None),
        "is_email_verified": getattr(user, "is_email_verified", None),
    }


def _serialize_contact(contact) -> Dict[str, Any]:
    """Serialize a Contact row for the admin API.

    Single source of truth for the shape, because there are three endpoints that return a contact
    (list, detail, mark-status) and they used to each build their own dict by hand. All three
    omitted ``contact_type`` and the B2B fields, so the admin table rendered every partner
    submission as "Consumer" — the payload simply never carried the type.

    ``getattr`` defaults keep this safe against a database that predates the partner columns.
    """
    return {
        "id": contact.id,
        "user_id": contact.user_id,
        "name": contact.name,
        "email": contact.email,
        "subject": contact.subject,
        "phone": contact.phone,
        "message": contact.message,
        "contact_type": getattr(contact, "contact_type", None) or "consumer",
        # B2B qualification fields — NULL on consumer contacts and on whichever questions the
        # submitting partner form does not ask.
        "company_name": getattr(contact, "company_name", None),
        "role": getattr(contact, "role", None),
        "partner_type": getattr(contact, "partner_type", None),
        "preferred_path": getattr(contact, "preferred_path", None),
        "catalog_context": getattr(contact, "catalog_context", None),
        "catalog_size": getattr(contact, "catalog_size", None),
        "estimated_calls": getattr(contact, "estimated_calls", None),
        # Who submitted it. `is_signed_in` is derived from the stored user_id so the admin UI can
        # say "anonymous" with confidence even when the account itself was since deleted (the FK is
        # ON DELETE SET NULL) or was not eager-loaded.
        "is_signed_in": getattr(contact, "user_id", None) is not None,
        "user": _serialize_submitter(contact),
        "status": contact.status,
        "submitted_at": contact.submitted_at.isoformat() if contact.submitted_at else None,
    }


class ContactController:
    """Controller for contact operations."""
    
    def __init__(self):
        self.contact_service = ContactService()
        self.logging_service = LoggingService()
        self.admin_log_service = AdminOperationLogService()

    def _log_admin_exception(
        self,
        db: AsyncSession,
        request: Request,
        error: Exception,
        action: str,
    ) -> None:
        """Persist an admin-path exception to the system logs (best-effort).

        The admin methods below catch exceptions and return a generic 500 to the client.
        Without this, those failures never reach the global exception handler and so were
        invisible on the admin Logs page. This records them just like the consumer-facing
        methods in this controller already do.
        """
        try:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action=action,
                message=f"Admin contact operation failed: {type(error).__name__}: {error}",
                request=request,
                status_code=500,
                error=error,
                context="admin contact",
            )
        except Exception as log_exc:  # never let logging break the error response
            logger.error(f"Failed to log admin contact exception ({action}): {log_exc}")


    async def submit_contact(self, db: AsyncSession, request: Request, contact_data: Dict[str, Any], current_user: Optional[User] = None) -> JSONResponse:
        """
        Submit a contact form.
        
        Args:
            db: Database session
            contact_data: Contact form data
            current_user: Optional authenticated user from JWT
            
        Returns:
            JSON response with submission result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Log authentication status for debugging
            if current_user:
                logger.info(f"CONTACT AUTH: User authenticated - ID={current_user.id}, UUID={current_user.uuid}, Email={current_user.email}")
            else:
                logger.info(f"CONTACT AUTH: User NOT authenticated (anonymous) - Request user_id={contact_data.get('user_id')}")
            
            # Prioritize JWT user over request body user_id
            if current_user:
                contact_data['user_id'] = current_user.id  # Use integer ID, not UUID
            
            # Process contact submission
            result = await self.contact_service.process_contact_submission(db, contact_data, current_user=current_user)
            
            if result.get("success"):
                await db.commit()
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
                await db.rollback()
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
            await db.rollback()
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
                contact_data = _serialize_contact(contact)

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
                await db.commit()
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
                await db.rollback()
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
            await db.rollback()
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
    
    async def get_contact_list_admin(
        self, 
        db: AsyncSession, 
        request: Request, 
        filters: Dict[str, Any],
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Get paginated contact list with filters for admin."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            result = await self.contact_service.get_contact_list_admin(db, filters)
            if result.get("success"):
                contact_list = [_serialize_contact(c) for c in result.get("data", [])]
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
            await db.rollback()
            self._log_admin_exception(db, request, e, "admin_contact_exception")
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def delete_contact_admin(
        self, 
        db: AsyncSession, 
        request: Request, 
        contact_id: int,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Delete a single contact entry."""
        try:
            # Audit: Get before state. get_contact_by_id returns a Contact model (or None),
            # NOT a {success, data} envelope — treat it as the object.
            entry = await self.contact_service.get_contact_by_id(db, contact_id)
            before_state = (
                {"id": entry.id, "email": entry.email, "status": entry.status}
                if entry else None
            )

            result = await self.contact_service.delete_contact_admin(db, contact_id)
            if result.get("success"):
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="contact.delete",
                        target_type="contact",
                        target_id=str(contact_id),
                        before_state=before_state,
                        after_state=None,
                        ip_address=request.client.host if request and request.client else None
                    )
                    await db.commit()

                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True, data={"message": result.get("message")}
                    ),
                )
            else:
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error=result.get("error")))
        except Exception as e:
            await db.rollback()
            self._log_admin_exception(db, request, e, "admin_contact_exception")
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def batch_delete_contact_admin(
        self, 
        db: AsyncSession, 
        request: Request, 
        contact_ids: List[int],
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Delete multiple contact entries."""
        try:
            result = await self.contact_service.batch_delete_contact_admin(
                db, contact_ids
            )
            
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="contact.batch_delete",
                    target_type="contact",
                    target_id="batch",
                    before_state={"ids": contact_ids},
                    after_state={"deleted_count": result.get("deleted_count")},
                    ip_address=request.client.host if request and request.client else None
                )
                await db.commit()

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"success": result.get("success"), "deleted_count": result.get("deleted_count", 0),
                        "message": result.get("message", result.get("error", ""))}
            )
        except Exception as e:
            await db.rollback()
            self._log_admin_exception(db, request, e, "admin_contact_exception")
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def mark_contact_status_admin(
        self,
        db: AsyncSession,
        request: Request,
        contact_id: int,
        status_value: str,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Update contact status for admin."""
        try:
            # Audit: Get before state. get_contact_by_id returns a Contact model (or None),
            # NOT a {success, data} envelope — treat it as the object.
            entry = await self.contact_service.get_contact_by_id(db, contact_id)
            before_state = {"status": entry.status} if entry else None

            result = await self.contact_service.mark_contact_status_admin(
                db, contact_id, status_value
            )
            if result.get("success"):
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="contact.update_status",
                        target_type="contact",
                        target_id=str(contact_id),
                        before_state=before_state,
                        after_state={"status": status_value},
                        ip_address=request.client.host if request and request.client else None
                    )
                    await db.commit()

                contact_data = _serialize_contact(result.get("data"))
                return JSONResponse(status_code=status.HTTP_200_OK,
                    content={"success": True, "data": contact_data, "message": result.get("message")})
            else:
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error=result.get("error")))
        except Exception as e:
            await db.rollback()
            self._log_admin_exception(db, request, e, "admin_contact_exception")
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))
    
    async def export_contact_csv_admin(
        self, 
        db: AsyncSession, 
        request: Request, 
        filters: Dict[str, Any],
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Export contact list to CSV and return download URL."""
        try:
            result = await self.contact_service.export_contact_csv_admin(db, filters)
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="contact.export",
                    target_type="contact",
                    target_id="csv",
                    before_state=filters,
                    after_state={"download_url": result.get("download_url")},
                    ip_address=request.client.host if request and request.client else None
                )
                await db.commit()
            if result.get("success"):
                return JSONResponse(status_code=status.HTTP_200_OK, content={
                    "success": True, "download_url": result.get("download_url"),
                    "filename": result.get("filename"), "expires_at": result.get("expires_at")
                })
            else:
                return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error=result.get("error", "Failed to export contact")))
        except Exception as e:
            await db.rollback()
            self._log_admin_exception(db, request, e, "admin_contact_exception")
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred"))

"""
Feedback Controller
===================

This controller handles HTTP requests for user feedback functionality.
It processes feedback submissions, retrieval requests, and status updates,
coordinating with feedback service to manage user feedback operations.

Manages request validation, response formatting, and error handling
for all feedback-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging
from app.services.feedback_service import FeedbackService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User

logger = logging.getLogger(__name__)


class FeedbackController:
    """Controller for feedback operations."""
    
    def __init__(self):
        self.feedback_service = FeedbackService()
        self.logging_service = LoggingService()
        self.admin_log_service = AdminOperationLogService()
    
    async def submit_feedback(self, db: AsyncSession, request: Request, feedback_data: Dict[str, Any], current_user: Optional[User] = None, partner_id: Optional[int] = None) -> JSONResponse:
        """
        Submit feedback.
        
        Args:
            db: Database session
            feedback_data: Feedback form data
            current_user: Optional authenticated user from JWT
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            JSON response with submission result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Log authentication status for debugging
            if current_user:
                logger.info(f"FEEDBACK AUTH: User authenticated - ID={current_user.id}, UUID={current_user.uuid}, Email={current_user.email}")
            else:
                logger.info(f"FEEDBACK AUTH: User NOT authenticated (anonymous) - Request user_id={feedback_data.get('user_id')}")
            
            # Prioritize JWT user over request body user_id
            if current_user:
                feedback_data['user_id'] = current_user.id  # Use integer ID, not UUID
            
            # Set partner_id
            feedback_data['partner_id'] = partner_id
            
            # Process feedback submission
            result = await self.feedback_service.process_feedback_submission(db, feedback_data)

            print(feedback_data)
            
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
                    action="feedback_submit_success",
                    message="Feedback submitted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "category": feedback_data.get("category"),
                        "user_id": feedback_data.get("user_id"),
                        "satisfaction": feedback_data.get("satisfaction"),
                        "recommendation": feedback_data.get("recommendation"),
                        "feedback_id": result.get("feedback_id"),
                        "message": feedback_data.get("feedback"),
                        "message_length": len(feedback_data.get("feedback", "")),
                        "response": response_data,
                        "operation": "feedback_submission"
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
                    action="feedback_submit_failed",
                    message=f"Feedback submission failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=duration_ms,
                    metadata={
                        "category": feedback_data.get("category"),
                        "user_id": feedback_data.get("user_id"),
                        "satisfaction": feedback_data.get("satisfaction"),
                        "recommendation": feedback_data.get("recommendation"),
                        "message_length": len(feedback_data.get("message", "")),
                        "error_details": result.get("error"),
                        "response": response_data,
                        "operation": "feedback_submission"
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
                error="An internal server error occurred while processing your feedback"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="feedback_submit_exception",
                message="Exception occurred during feedback submission",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="submit_feedback",
                metadata={
                    "category": feedback_data.get("category"),
                    "user_id": feedback_data.get("user_id"),
                    "satisfaction": feedback_data.get("satisfaction"),
                    "recommendation": feedback_data.get("recommendation"),
                    "message_length": len(feedback_data.get("message", "")),
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "feedback_submission"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def get_feedback_by_id(self, db: AsyncSession, request: Request, feedback_id: int, partner_id: Optional[int] = None) -> JSONResponse:
        """
        Get a feedback by ID.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            partner_id: Optional partner ID for tenant scoping
            
        Returns:
            JSON response with feedback data
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            feedback = await self.feedback_service.get_feedback_by_id(db, feedback_id, partner_id=partner_id)
            
            if feedback:
                feedback_data = {
                    "id": feedback.id,
                    "user_id": feedback.user_id,
                    "category": feedback.category,
                    "message": feedback.message,
                    "satisfaction": feedback.satisfaction,
                    "recommendation": feedback.recommendation,
                    "status": feedback.status,
                    "submitted_at": feedback.submitted_at.isoformat() if feedback.submitted_at else None
                }
                
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=True, data=feedback_data)
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="USER_ACTION",
                    action="get_feedback_success",
                    message="Feedback retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback.id,
                        "user_id": feedback.user_id,
                        "category": feedback.category,
                        "satisfaction": feedback.satisfaction,
                        "recommendation": feedback.recommendation,
                        "feedback_status": feedback.status,
                        "message_length": len(feedback.message) if feedback.message else 0,
                        "response": response_data,
                        "operation": "feedback_retrieval"
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
                    error=f"Feedback with ID {feedback_id} not found"
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="USER_ACTION",
                    action="get_feedback_not_found",
                    message=f"Feedback with ID {feedback_id} not found",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "error": "Feedback not found",
                        "response": response_data,
                        "operation": "feedback_retrieval"
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
                error="An internal server error occurred while retrieving feedback"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="get_feedback_exception",
                message="Exception occurred while retrieving feedback",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get_feedback_by_id",
                metadata={
                    "feedback_id": feedback_id,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "feedback_retrieval"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def update_feedback_status(self, db: AsyncSession, request: Request, feedback_id: int, status_data: Dict[str, Any], partner_id: Optional[int] = None) -> JSONResponse:
        """
        Update feedback status.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            status_data: Status update data
            partner_id: Optional partner ID for tenant scoping
            
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
                    action="update_feedback_status_validation_failed",
                    message="Feedback status update failed: Status is required",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "error": "Status is required",
                        "provided_data": status_data,
                        "response": response_data,
                        "operation": "feedback_status_update"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_data
                )
            
            result = await self.feedback_service.update_feedback_status(db, feedback_id, new_status, partner_id=partner_id)
            
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
                    action="update_feedback_status_success",
                    message="Feedback status updated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "new_status": new_status,
                        "previous_status": result.get("previous_status"),
                        "response": response_data,
                        "operation": "feedback_status_update"
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
                    action="update_feedback_status_failed",
                    message=f"Feedback status update failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "attempted_status": new_status,
                        "error_details": result.get("error"),
                        "response": response_data,
                        "operation": "feedback_status_update"
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
                error="An internal server error occurred while updating feedback status"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="update_feedback_status_exception",
                message="Exception occurred while updating feedback status",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="update_feedback_status",
                metadata={
                    "feedback_id": feedback_id,
                    "attempted_status": status_data.get("status"),
                    "status_data": status_data,
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "feedback_status_update"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_feedback_list_admin(
        self,
        db: AsyncSession,
        request: Request,
        filters: Dict[str, Any],
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Get paginated feedback list with filters for admin."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.feedback_service.get_feedback_list_admin(db, filters, partner_id=partner_id)
            
            if result.get("success"):
                # Convert feedback objects to dictionaries
                feedback_list = []
                for feedback in result.get("data", []):
                    feedback_list.append({
                        "id": feedback.id,
                        "user_id": feedback.user_id,
                        "category": feedback.category,
                        "message": feedback.message,
                        "satisfaction": feedback.satisfaction,
                        "recommendation": feedback.recommendation,
                        "status": feedback.status,
                        "submitted_at": feedback.submitted_at.isoformat() if feedback.submitted_at else None
                    })
                
                duration_ms = (time.time() - start_time) * 1000
                response_data = {
                    "success": True,
                    "data": feedback_list,
                    "pagination": result.get("pagination")
                }
                
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_feedback_list_success",
                    message="Admin feedback list retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "filters": filters,
                        "result_count": len(feedback_list),
                        "total": result.get("pagination", {}).get("total", 0),
                        "operation": "admin_feedback_list"
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
                    error=result.get("error", "Failed to retrieve feedback list")
                )
                
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN_ACTION",
                    action="admin_feedback_list_failed",
                    message="Failed to retrieve admin feedback list",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "filters": filters,
                        "error": result.get("error"),
                        "operation": "admin_feedback_list"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_feedback_list_exception",
                message="Exception occurred while retrieving admin feedback list",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get_feedback_list_admin",
                metadata={
                    "filters": filters,
                    "error_type": type(e).__name__,
                    "operation": "admin_feedback_list"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def delete_feedback_admin(
        self,
        db: AsyncSession,
        request: Request,
        feedback_id: int,
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Delete a single feedback entry."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Audit: Get before state
            entry = await self.feedback_service.get_feedback_by_id(db, feedback_id, partner_id=partner_id)
            before_state = None
            if entry:
                before_state = {
                    "id": entry.id,
                    "status": entry.status,
                    "category": entry.category,
                    "message": entry.message
                }

            result = await self.feedback_service.delete_feedback_admin(db, feedback_id, partner_id=partner_id)
            
            if result.get("success"):
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="feedback.delete",
                        target_type="feedback",
                        target_id=str(feedback_id),
                        before_state=before_state,
                        after_state=None,
                        ip_address=request.client.host if request and request.client else None
                    )
                    await db.commit()

                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=True,
                    data={"message": result.get("message")}
                )
                
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_feedback_delete_success",
                    message=f"Feedback {feedback_id} deleted successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "operation": "admin_feedback_delete"
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
                    category="ADMIN_ACTION",
                    action="admin_feedback_delete_failed",
                    message=f"Failed to delete feedback {feedback_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "error": result.get("error"),
                        "operation": "admin_feedback_delete"
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
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_feedback_delete_exception",
                message="Exception occurred while deleting feedback",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="delete_feedback_admin",
                metadata={
                    "feedback_id": feedback_id,
                    "error_type": type(e).__name__,
                    "operation": "admin_feedback_delete"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def batch_delete_feedback_admin(
        self,
        db: AsyncSession,
        request: Request,
        feedback_ids: List[int],
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Delete multiple feedback entries."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.feedback_service.batch_delete_feedback_admin(db, feedback_ids, partner_id=partner_id)
            
            if result.get("success") and current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="feedback.batch_delete",
                    target_type="feedback",
                    target_id="batch",
                    before_state={"ids": feedback_ids},
                    after_state={"deleted_count": result.get("deleted_count")},
                    ip_address=request.client.host if request and request.client else None
                )
                await db.commit()

            duration_ms = (time.time() - start_time) * 1000
            response_data = {
                "success": result.get("success"),
                "deleted_count": result.get("deleted_count", 0),
                "message": result.get("message", result.get("error", ""))
            }
            
            if result.get("success"):
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_batch_delete_success",
                    message=f"Batch deleted {result.get('deleted_count')} feedback entries",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_ids": feedback_ids,
                        "deleted_count": result.get("deleted_count"),
                        "operation": "admin_batch_delete"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN_ACTION",
                    action="admin_batch_delete_failed",
                    message="Batch delete failed",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_ids": feedback_ids,
                        "error": result.get("error"),
                        "operation": "admin_batch_delete"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_batch_delete_exception",
                message="Exception occurred during batch delete",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="batch_delete_feedback_admin",
                metadata={
                    "feedback_ids": feedback_ids,
                    "error_type": type(e).__name__,
                    "operation": "admin_batch_delete"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def mark_feedback_status_admin(
        self,
        db: AsyncSession,
        request: Request,
        feedback_id: int,
        status_value: str,
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Mark feedback status for admin."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Audit: Get before state
            entry = await self.feedback_service.get_feedback_by_id(db, feedback_id, partner_id=partner_id)
            before_state = None
            if entry:
                before_state = {"status": entry.status}

            result = await self.feedback_service.mark_feedback_status_admin(db, feedback_id, status_value, partner_id=partner_id)
            
            if result.get("success"):
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="feedback.mark_status",
                        target_type="feedback",
                        target_id=str(feedback_id),
                        before_state=before_state,
                        after_state={"status": status_value},
                        ip_address=request.client.host if request and request.client else None
                    )

                feedback = result.get("data")
                feedback_data = {
                    "id": feedback.id,
                    "user_id": feedback.user_id,
                    "category": feedback.category,
                    "message": feedback.message,
                    "satisfaction": feedback.satisfaction,
                    "recommendation": feedback.recommendation,
                    "status": feedback.status,
                    "submitted_at": feedback.submitted_at.isoformat() if feedback.submitted_at else None
                }
                
                duration_ms = (time.time() - start_time) * 1000
                response_data = {
                    "success": True,
                    "data": feedback_data,
                    "message": result.get("message")
                }
                
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_mark_status_success",
                    message=f"Feedback {feedback_id} status updated to {status_value}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "new_status": status_value,
                        "operation": "admin_mark_status"
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
                    category="ADMIN_ACTION",
                    action="admin_mark_status_failed",
                    message=f"Failed to update feedback {feedback_id} status",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "attempted_status": status_value,
                        "error": result.get("error"),
                        "operation": "admin_mark_status"
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
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_mark_status_exception",
                message="Exception occurred while marking feedback status",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="mark_feedback_status_admin",
                metadata={
                    "feedback_id": feedback_id,
                    "attempted_status": status_value,
                    "error_type": type(e).__name__,
                    "operation": "admin_mark_status"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    async def update_feedback_admin(
        self,
        db: AsyncSession,
        request: Request,
        feedback_id: int,
        update_data: Dict[str, Any],
        partner_id: Optional[int] = None
    ) -> JSONResponse:
        """Update feedback for admin."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.feedback_service.update_feedback_admin(db, feedback_id, update_data, partner_id=partner_id)
            
            if result.get("success"):
                feedback = result.get("data")
                feedback_data = {
                    "id": feedback.id,
                    "user_id": feedback.user_id,
                    "category": feedback.category,
                    "message": feedback.message,
                    "satisfaction": feedback.satisfaction,
                    "recommendation": feedback.recommendation,
                    "status": feedback.status,
                    "submitted_at": feedback.submitted_at.isoformat() if feedback.submitted_at else None
                }
                
                duration_ms = (time.time() - start_time) * 1000
                response_data = {
                    "success": True,
                    "data": feedback_data,
                    "message": result.get("message")
                }
                
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_update_feedback_success",
                    message=f"Feedback {feedback_id} updated successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "update_fields": list(update_data.keys()),
                        "operation": "admin_update_feedback"
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
                    category="ADMIN_ACTION",
                    action="admin_update_feedback_failed",
                    message=f"Failed to update feedback {feedback_id}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=404,
                    duration_ms=duration_ms,
                    metadata={
                        "feedback_id": feedback_id,
                        "update_data": update_data,
                        "error": result.get("error"),
                        "operation": "admin_update_feedback"
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
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_update_feedback_exception",
                message="Exception occurred while updating feedback",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="update_feedback_admin",
                metadata={
                    "feedback_id": feedback_id,
                    "update_data": update_data,
                    "error_type": type(e).__name__,
                    "operation": "admin_update_feedback"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def get_feedback_statistics_admin(
        self,
        db: AsyncSession,
        request: Request,
        partner_id: Optional[int] = None
    ) -> JSONResponse:
        """Get feedback statistics for admin dashboard."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.feedback_service.get_feedback_statistics_admin(db, partner_id=partner_id)
            
            duration_ms = (time.time() - start_time) * 1000
            response_data = {
                "success": result.get("success"),
                "stats": result.get("stats")
            }
            
            if result.get("success"):
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_stats_success",
                    message="Feedback statistics retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "stats": result.get("stats"),
                        "operation": "admin_feedback_stats"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN_ACTION",
                    action="admin_stats_failed",
                    message="Failed to retrieve feedback statistics",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "error": result.get("error"),
                        "operation": "admin_feedback_stats"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_stats_exception",
                message="Exception occurred while retrieving feedback statistics",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="get_feedback_statistics_admin",
                metadata={
                    "error_type": type(e).__name__,
                    "operation": "admin_feedback_stats"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
    
    async def export_feedback_csv_admin(
        self,
        db: AsyncSession,
        request: Request,
        filters: Dict[str, Any]
    ) -> JSONResponse:
        """Export feedback to CSV and return download URL."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.feedback_service.export_feedback_csv_admin(db, filters)
            
            duration_ms = (time.time() - start_time) * 1000
            
            if result.get("success"):
                response_data = {
                    "success": True,
                    "download_url": result.get("download_url"),
                    "filename": result.get("filename"),
                    "expires_at": result.get("expires_at")
                }
                
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="ADMIN_ACTION",
                    action="admin_export_feedback_success",
                    message="Feedback exported successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    metadata={
                        "filters": filters,
                        "filename": result.get("filename"),
                        "operation": "admin_feedback_export"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
            else:
                response_data = format_response(
                    success=False,
                    error=result.get("error", "Failed to export feedback")
                )
                
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="ADMIN_ACTION",
                    action="admin_export_feedback_failed",
                    message="Failed to export feedback",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    metadata={
                        "filters": filters,
                        "error": result.get("error"),
                        "operation": "admin_feedback_export"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="An internal server error occurred"
            )
            
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="admin_export_feedback_exception",
                message="Exception occurred while exporting feedback",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="export_feedback_csv_admin",
                metadata={
                    "filters": filters,
                    "error_type": type(e).__name__,
                    "operation": "admin_feedback_export"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )

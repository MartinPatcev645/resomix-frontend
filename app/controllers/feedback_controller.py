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

from typing import Dict, Any
from fastapi.responses import JSONResponse
from fastapi import status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import time
from app.services.feedback_service import FeedbackService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService


class FeedbackController:
    """Controller for feedback operations."""
    
    def __init__(self):
        self.feedback_service = FeedbackService()
        self.logging_service = LoggingService()
    
    async def submit_feedback(self, db: AsyncSession, request: Request, feedback_data: Dict[str, Any]) -> JSONResponse:
        """
        Submit feedback.
        
        Args:
            db: Database session
            feedback_data: Feedback form data
            
        Returns:
            JSON response with submission result
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
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
                        "message": feedback_data.get("message"),
                        "message_length": len(feedback_data.get("message", "")),
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
    
    async def get_feedback_by_id(self, db: AsyncSession, request: Request, feedback_id: int) -> JSONResponse:
        """
        Get a feedback by ID.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            
        Returns:
            JSON response with feedback data
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            feedback = await self.feedback_service.get_feedback_by_id(db, feedback_id)
            
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
    
    async def update_feedback_status(self, db: AsyncSession, request: Request, feedback_id: int, status_data: Dict[str, Any]) -> JSONResponse:
        """
        Update feedback status.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
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
            
            result = await self.feedback_service.update_feedback_status(db, feedback_id, new_status)
            
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

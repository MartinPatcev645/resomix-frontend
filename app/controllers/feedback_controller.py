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
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Process feedback submission
            result = await self.feedback_service.process_feedback_submission(db, feedback_data)
            
            if result.get("success"):
                self.logging_service.log_user_action(db=db, action="feedback_submit_success", message="Feedback submitted", correlation_id=correlation_id, metadata={"category": feedback_data.get("category")})
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                self.logging_service.log_user_action(db=db, action="feedback_submit_failed", message=result.get("error"), correlation_id=correlation_id, metadata={"category": feedback_data.get("category")})
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="submit_feedback", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing your feedback"
                )
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
        correlation_id = self.logging_service.generate_correlation_id()
        try:
            feedback = await self.feedback_service.get_feedback_by_id(db, feedback_id)
            
            if feedback:
                self.logging_service.log_user_action(db=db, action="get_feedback_success", message="Feedback retrieved", correlation_id=correlation_id, metadata={"feedback_id": feedback_id})
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
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data=feedback_data)
                )
            else:
                self.logging_service.log_user_action(db=db, action="get_feedback_not_found", message="Feedback not found", correlation_id=correlation_id, metadata={"feedback_id": feedback_id})
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=f"Feedback with ID {feedback_id} not found"
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="get_feedback_by_id", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving feedback"
                )
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
            
            result = await self.feedback_service.update_feedback_status(db, feedback_id, new_status)
            
            if result.get("success"):
                self.logging_service.log_user_action(db=db, action="update_feedback_status_success", message="Feedback status updated", correlation_id=correlation_id, metadata={"feedback_id": feedback_id, "status": new_status})
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data={"message": result.get("message")}
                    )
                )
            else:
                self.logging_service.log_user_action(db=db, action="update_feedback_status_failed", message=result.get("error"), correlation_id=correlation_id, metadata={"feedback_id": feedback_id})
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            self.logging_service.log_error(db=db, error=e, context="update_feedback_status", correlation_id=correlation_id, request=request)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while updating feedback status"
                )
            )

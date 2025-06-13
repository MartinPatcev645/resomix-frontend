"""
Feedback Service
================

This service manages user feedback operations including creation, retrieval, and status updates.
It handles feedback categorization, user-based filtering, and administrative status management
using MariaDB repositories for data persistence.

Provides comprehensive feedback management with validation, error handling,
and support for different feedback categories and statuses.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.feedback_repository import FeedbackRepository
from app.models.feedback import Feedback


class FeedbackService:
    """Service for feedback operations."""
    
    def __init__(self):
        self.feedback_repository = FeedbackRepository()
    
    async def process_feedback_submission(
        self,
        db: AsyncSession,
        feedback_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a feedback submission.
        
        Args:
            db: Database session
            feedback_data: Feedback form data
            
        Returns:
            Processing result
        """
        try:
            # Validate required fields
            satisfaction = feedback_data.get('satisfaction')
            recommendation = feedback_data.get('recommendation')
            
            if not satisfaction or not recommendation:
                return {
                    "success": False,
                    "error": "Satisfaction and recommendation ratings are required"
                }
            
            # Validate rating ranges
            if not (1 <= satisfaction <= 10) or not (1 <= recommendation <= 10):
                return {
                    "success": False,
                    "error": "Ratings must be between 1 and 10"
                }
            
            # Extract optional fields
            category = feedback_data.get('category')
            message = feedback_data.get('feedback')  # Note: 'feedback' in request becomes 'message' in DB
            user_id = feedback_data.get('user_id')
            
            # Create feedback record
            feedback = await self.feedback_repository.create_feedback(
                db=db,
                user_id=user_id,
                category=category,
                message=message,
                satisfaction=satisfaction,
                recommendation=recommendation
            )
            
            return {
                "success": True,
                "message": "Feedback received successfully and saved to database.",
                "feedback_id": feedback.id
            }
            
        except Exception as e:
            print(f"Error processing feedback submission: {e}")
            return {
                "success": False,
                "error": "An error occurred while processing your feedback"
            }
    
    async def get_user_feedback(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 10,
        offset: int = 0
    ) -> List[Feedback]:
        """
        Get feedback for a specific user.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of feedback records
        """
        return await self.feedback_repository.get_feedback_by_user(
            db=db,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
    
    async def get_feedback_by_category(
        self,
        db: AsyncSession,
        category: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Feedback]:
        """
        Get feedback by category.
        
        Args:
            db: Database session
            category: Feedback category
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of feedback records
        """
        return await self.feedback_repository.get_feedback_by_category(
            db=db,
            category=category,
            limit=limit,
            offset=offset
        )
    
    async def get_feedback_by_status(
        self,
        db: AsyncSession,
        status: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Feedback]:
        """
        Get feedback by status.
        
        Args:
            db: Database session
            status: Feedback status ('open' or 'resolved')
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of feedback records
        """
        return await self.feedback_repository.get_feedback_by_status(
            db=db,
            status=status,
            limit=limit,
            offset=offset
        )
    
    async def update_feedback_status(
        self,
        db: AsyncSession,
        feedback_id: int,
        status: str
    ) -> Dict[str, Any]:
        """
        Update feedback status.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            status: New status
            
        Returns:
            Update result
        """
        try:
            feedback = await self.feedback_repository.update_feedback_status(
                db=db,
                feedback_id=feedback_id,
                status=status
            )
            
            if feedback:
                return {
                    "success": True,
                    "message": f"Feedback status updated to {status}",
                    "feedback_id": feedback.id
                }
            else:
                return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
                
        except Exception as e:
            print(f"Error updating feedback status: {e}")
            return {
                "success": False,
                "error": "An error occurred while updating feedback status"
            }
    
    async def get_feedback_by_id(
        self,
        db: AsyncSession,
        feedback_id: int
    ) -> Optional[Feedback]:
        """
        Get feedback by ID.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            
        Returns:
            Feedback record or None if not found
        """
        return await self.feedback_repository.async_get_by_id(db, feedback_id)

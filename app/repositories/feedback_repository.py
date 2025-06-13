"""
Feedback Repository
===================

Repository for feedback-related database operations.

Author: AI Assistant
Date: December 2024
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.feedback import Feedback
from app.repositories.base_repository import BaseRepository


class FeedbackRepository(BaseRepository[Feedback]):
    """Repository for feedback operations."""
    
    def __init__(self):
        super().__init__(Feedback)
    
    async def create_feedback(
        self,
        db: AsyncSession,
        user_id: Optional[str],
        category: Optional[str],
        message: Optional[str],
        satisfaction: int,
        recommendation: int
    ) -> Feedback:
        """
        Create a new feedback submission.
        
        Args:
            db: Database session
            user_id: Optional user ID
            category: Optional feedback category
            message: Optional feedback message
            satisfaction: Satisfaction rating (1-10)
            recommendation: Recommendation rating (1-10)
            
        Returns:
            Created feedback record
        """
        feedback = Feedback(
            user_id=user_id,
            category=category,
            message=message,
            satisfaction=satisfaction,
            recommendation=recommendation,
            status='open'
        )
        
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        
        return feedback
    
    async def get_feedback_by_user(
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
        stmt = (
            select(Feedback)
            .where(Feedback.user_id == user_id)
            .order_by(Feedback.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
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
        stmt = (
            select(Feedback)
            .where(Feedback.category == category)
            .order_by(Feedback.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
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
        stmt = (
            select(Feedback)
            .where(Feedback.status == status)
            .order_by(Feedback.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def get_feedback_by_rating_range(
        self,
        db: AsyncSession,
        min_satisfaction: int = 1,
        max_satisfaction: int = 10,
        limit: int = 50,
        offset: int = 0
    ) -> List[Feedback]:
        """
        Get feedback by satisfaction rating range.
        
        Args:
            db: Database session
            min_satisfaction: Minimum satisfaction rating
            max_satisfaction: Maximum satisfaction rating
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of feedback records
        """
        stmt = (
            select(Feedback)
            .where(
                Feedback.satisfaction >= min_satisfaction,
                Feedback.satisfaction <= max_satisfaction
            )
            .order_by(Feedback.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def update_feedback_status(
        self,
        db: AsyncSession,
        feedback_id: int,
        status: str
    ) -> Optional[Feedback]:
        """
        Update feedback status.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            status: New status
            
        Returns:
            Updated feedback record or None if not found
        """
        feedback = await self.get_by_id(db, feedback_id)
        if feedback:
            feedback.status = status
            await db.commit()
            await db.refresh(feedback)
        
        return feedback 
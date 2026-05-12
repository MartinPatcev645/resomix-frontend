"""
Feedback Repository
===================

This repository handles CRUD operations for the Feedback model using MariaDB.
It provides feedback creation, retrieval, status updates, and filtering capabilities
with proper error handling and data validation.

Implements feedback management operations including user-based filtering,
category-based queries, and administrative status management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select, delete, func, and_, desc, asc, String
from datetime import datetime
from app.models.feedback import Feedback
from app.repositories.base_repository import BaseRepository


class FeedbackRepository(BaseRepository[Feedback]):
    """Repository for feedback operations."""
    
    def __init__(self):
        super().__init__(Feedback)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Feedback]:
        """Find existing feedback record by user_id and submitted_at."""
        # For feedback, we'll look up by user_id and submitted_at (if provided)
        # This is a simple implementation - adjust based on business logic
        user_id = kwargs.get('user_id')
        if user_id:
            return db.query(Feedback).filter(Feedback.user_id == user_id).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Feedback]:
        """Async version of find existing feedback record."""
        user_id = kwargs.get('user_id')
        if user_id:
            stmt = select(Feedback).where(Feedback.user_id == user_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        return None
    
    async def create_feedback(
        self,
        db: AsyncSession,
        user_id: Optional[int],
        partner_id: int,
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
            partner_id=partner_id,
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
        user_id: int,
        partner_id: Optional[int] = None,
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
        filters = [Feedback.user_id == user_id]
        if partner_id:
            filters.append(Feedback.partner_id == partner_id)
            
        stmt = (
            select(Feedback)
            .where(and_(*filters))
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
        status: str,
        partner_id: Optional[int] = None
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
        feedback = await self.async_get_by_id(db, feedback_id, partner_id=partner_id)
        if feedback:
            feedback.status = status
            await db.commit()
            await db.refresh(feedback)
        
        return feedback

    async def async_get_by_id(self, db: AsyncSession, id: int, partner_id: Optional[int] = None) -> Optional[Feedback]:
        """Async version of get_by_id with partner scoping."""
        filters = [Feedback.id == id]
        if partner_id:
            filters.append(Feedback.partner_id == partner_id)
            
        stmt = select(Feedback).where(and_(*filters))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_feedback_list_with_filters(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 30,
        search: Optional[str] = None,
        search_column: Optional[str] = None,
        status: str = "all",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "submitted_at",
        sort_order: str = "desc",
        partner_id: Optional[int] = None
    ) -> Tuple[List[Feedback], int]:
        """
        Get paginated feedback list with filters for admin.
        
        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            search: Search term
            search_column: Column to search in (message, category, user_id)
            status: Filter by status (open, resolved, all)
            date_from: Start date filter
            date_to: End date filter
            sort_by: Column to sort by
            sort_order: Sort order (asc, desc)
            
        Returns:
            Tuple of (feedback list, total count)
        """
        # Build base query
        query = select(Feedback)
        count_query = select(func.count(Feedback.id))
        
        # Apply filters
        filters = []
        
        # Partner filter
        if partner_id:
            filters.append(Feedback.partner_id == partner_id)
            
        # Status filter
        if status != "all":
            filters.append(Feedback.status == status)
        
        # Search filter - only support 'message' and 'id'
        if search and search_column:
            if search_column == "message":
                search_term = f"%{search}%"
                filters.append(Feedback.message.like(search_term))
            elif search_column == "id":
                # For ID search, try exact match first, then partial match
                try:
                    # Try exact match if search is a number
                    search_id = int(search)
                    filters.append(Feedback.id == search_id)
                except ValueError:
                    # If not a number, do partial match by converting ID to string
                    search_term = f"%{search}%"
                    filters.append(func.cast(Feedback.id, String).like(search_term))
        elif search:
            # Default to message search if no column specified
            search_term = f"%{search}%"
            filters.append(Feedback.message.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Feedback.submitted_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                # Add one day to include the entire end date
                filters.append(Feedback.submitted_at < date_to_obj.replace(hour=23, minute=59, second=59))
            except ValueError:
                pass
        
        # Apply all filters
        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))
        
        # Get total count
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0
        
        # Apply sorting
        sort_column = getattr(Feedback, sort_by, Feedback.submitted_at)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.limit(page_size).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        feedback_list = result.scalars().all()
        
        return feedback_list, total
    
    async def delete_feedback(self, db: AsyncSession, feedback_id: int, partner_id: Optional[int] = None) -> bool:
        """
        Delete a single feedback entry.
        
        Args:
            db: Database session
            feedback_id: Feedback ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        feedback = await self.async_get_by_id(db, feedback_id, partner_id=partner_id)
        if feedback:
            await db.delete(feedback)
            await db.commit()
            return True
        return False
    
    async def batch_delete_feedback(self, db: AsyncSession, feedback_ids: List[int], partner_id: Optional[int] = None) -> int:
        """
        Delete multiple feedback entries.
        
        Args:
            db: Database session
            feedback_ids: List of feedback IDs to delete
            partner_id: Optional partner ID for scoping
            
        Returns:
            Number of deleted entries
        """
        filters = [Feedback.id.in_(feedback_ids)]
        if partner_id:
            filters.append(Feedback.partner_id == partner_id)
            
        stmt = delete(Feedback).where(and_(*filters))
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount
    
    async def update_feedback(
        self,
        db: AsyncSession,
        feedback_id: int,
        update_data: Dict[str, Any],
        partner_id: Optional[int] = None
    ) -> Optional[Feedback]:
        """
        Update feedback fields.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            update_data: Dictionary of fields to update
            
        Returns:
            Updated feedback or None if not found
        """
        feedback = await self.async_get_by_id(db, feedback_id)
        if feedback:
            for key, value in update_data.items():
                if hasattr(feedback, key) and value is not None:
                    setattr(feedback, key, value)
            await db.commit()
            await db.refresh(feedback)
        
        return feedback
    
    async def get_feedback_statistics(self, db: AsyncSession, partner_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get feedback statistics for admin dashboard.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary containing various statistics
        """
        # Get counts by status
        total_query = select(func.count(Feedback.id))
        open_query = select(func.count(Feedback.id)).where(Feedback.status == 'open')
        resolved_query = select(func.count(Feedback.id)).where(Feedback.status == 'resolved')
        
        if partner_id:
            total_query = total_query.where(Feedback.partner_id == partner_id)
            open_query = open_query.where(Feedback.partner_id == partner_id)
            resolved_query = resolved_query.where(Feedback.partner_id == partner_id)
            
        # Get averages
        avg_satisfaction_query = select(func.avg(Feedback.satisfaction))
        avg_recommendation_query = select(func.avg(Feedback.recommendation))
        
        if partner_id:
            avg_satisfaction_query = avg_satisfaction_query.where(Feedback.partner_id == partner_id)
            avg_recommendation_query = avg_recommendation_query.where(Feedback.partner_id == partner_id)
        
        # Execute queries
        total_result = await db.execute(total_query)
        open_result = await db.execute(open_query)
        resolved_result = await db.execute(resolved_query)
        avg_satisfaction_result = await db.execute(avg_satisfaction_query)
        avg_recommendation_result = await db.execute(avg_recommendation_query)
        
        total = total_result.scalar() or 0
        open_count = open_result.scalar() or 0
        resolved_count = resolved_result.scalar() or 0
        avg_satisfaction = avg_satisfaction_result.scalar() or 0.0
        avg_recommendation = avg_recommendation_result.scalar() or 0.0
        
        # Get category distribution
        category_query = select(
            Feedback.category,
            func.count(Feedback.id).label('count')
        )
        
        if partner_id:
            category_query = category_query.where(Feedback.partner_id == partner_id)
            
        category_query = category_query.group_by(Feedback.category)
        
        category_result = await db.execute(category_query)
        category_stats = {}
        for row in category_result:
            category = row[0] if row[0] else "uncategorized"
            count = row[1]
            category_stats[category] = count
        
        return {
            "total": total,
            "open": open_count,
            "resolved": resolved_count,
            "avg_satisfaction": round(float(avg_satisfaction), 2),
            "avg_recommendation": round(float(avg_recommendation), 2),
            "by_category": category_stats
        }
    
    async def get_feedback_for_export(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        search_column: Optional[str] = None,
        status: str = "all",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "submitted_at",
        sort_order: str = "desc",
        partner_id: Optional[int] = None
    ) -> List[Feedback]:
        """
        Get all feedback for export (no pagination).
        
        Args:
            db: Database session
            search: Search term
            search_column: Column to search in (message, id)
            status: Filter by status (open, resolved, all)
            date_from: Start date filter
            date_to: End date filter
            sort_by: Column to sort by
            sort_order: Sort order (asc, desc)
            
        Returns:
            List of all feedback matching filters
        """
        # Build base query
        query = select(Feedback)
        
        # Apply filters
        filters = []
        
        # Partner filter
        if partner_id:
            filters.append(Feedback.partner_id == partner_id)
            
        # Status filter
        if status != "all":
            filters.append(Feedback.status == status)
        
        # Search filter - only support 'message' and 'id'
        if search and search_column:
            if search_column == "message":
                search_term = f"%{search}%"
                filters.append(Feedback.message.like(search_term))
            elif search_column == "id":
                try:
                    search_id = int(search)
                    filters.append(Feedback.id == search_id)
                except ValueError:
                    search_term = f"%{search}%"
                    filters.append(func.cast(Feedback.id, String).like(search_term))
        elif search:
            search_term = f"%{search}%"
            filters.append(Feedback.message.like(search_term))
        
        # Date range filter
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                filters.append(Feedback.submitted_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                filters.append(Feedback.submitted_at < date_to_obj.replace(hour=23, minute=59, second=59))
            except ValueError:
                pass
        
        # Apply all filters
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Feedback, sort_by, Feedback.submitted_at)
        if sort_order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Execute query (no pagination)
        result = await db.execute(query)
        return result.scalars().all()

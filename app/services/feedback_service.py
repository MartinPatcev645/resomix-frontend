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
from app.models.user import User
from app.services.admin_operation_log_service import AdminOperationLogService
import math
import csv
import os
import uuid
from datetime import datetime, timedelta
from app.core.config import settings
from app.utils.sanitization import csv_safe


class FeedbackService:
    """Service for feedback operations."""
    
    def __init__(self):
        self.feedback_repository = FeedbackRepository()
        self.admin_log_service = AdminOperationLogService()
    
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
                partner_id=feedback_data.get('partner_id'),
                category=category,
                message=message,
                satisfaction=satisfaction,
                recommendation=recommendation
            )
            await db.commit()
            
            return {
                "success": True,
                "message": "Feedback received successfully and saved to database.",
                "feedback_id": feedback.id
            }
            
        except Exception as e:
            await db.rollback()
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
        status: str,
        partner_id: Optional[int] = None
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
                status=status,
                partner_id=partner_id
            )
            
            if feedback:
                await db.commit()
                return {
                    "success": True,
                    "message": f"Feedback status updated to {status}",
                    "feedback_id": feedback.id
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
                
        except Exception as e:
            await db.rollback()
            print(f"Error updating feedback status: {e}")
            return {
                "success": False,
                "error": "An error occurred while updating feedback status"
            }
    
    async def get_feedback_by_id(
        self,
        db: AsyncSession,
        feedback_id: int,
        partner_id: Optional[int] = None
    ) -> Optional[Feedback]:
        """
        Get feedback by ID.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            
        Returns:
            Feedback record or None if not found
        """
        return await self.feedback_repository.async_get_by_id(db, feedback_id, partner_id=partner_id)
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def get_feedback_list_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any],
        partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get paginated feedback list with filters for admin.
        
        Args:
            db: Database session
            filters: Dictionary of filter parameters
            
        Returns:
            Paginated feedback data with metadata
        """
        try:
            # Extract filter parameters
            page = filters.get('page', 1)
            page_size = filters.get('page_size', 30)
            search = filters.get('search')
            search_column = filters.get('search_column')
            status = filters.get('status', 'all')
            date_from = filters.get('date_from')
            date_to = filters.get('date_to')
            sort_by = filters.get('sort_by', 'submitted_at')
            sort_order = filters.get('sort_order', 'desc')
            
            # Get feedback list and total count
            feedback_list, total = await self.feedback_repository.get_feedback_list_with_filters(
                db=db,
                page=page,
                page_size=page_size,
                search=search,
                search_column=search_column,
                status=status,
                date_from=date_from,
                date_to=date_to,
                sort_by=sort_by,
                sort_order=sort_order,
                partner_id=partner_id or filters.get('partner_id')
            )
            
            # Calculate pagination metadata
            total_pages = math.ceil(total / page_size) if total > 0 else 0
            
            return {
                "success": True,
                "data": feedback_list,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                }
            }
            
        except Exception as e:
            print(f"Error getting feedback list: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving feedback list",
                "data": [],
                "pagination": {
                    "page": 1,
                    "page_size": 30,
                    "total": 0,
                    "total_pages": 0
                }
            }
    
    async def delete_feedback_admin(
        self,
        db: AsyncSession,
        feedback_id: int,
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete a single feedback entry.
        
        Args:
            db: Database session
            feedback_id: Feedback ID to delete
            
        Returns:
            Delete result
        """
        try:
            # First check if feedback exists and belongs to partner
            feedback = await self.feedback_repository.async_get_by_id(db, feedback_id, partner_id=partner_id)
            if not feedback:
                 return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
            
            before_state = {
                "id": feedback.id,
                "status": feedback.status,
                "category": feedback.category,
                "message": feedback.message
            }
                
            deleted = await self.feedback_repository.delete_feedback(db, feedback_id)
            
            if deleted:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="feedback.delete",
                        target_type="feedback",
                        target_id=str(feedback_id),
                        before_state=before_state,
                        after_state=None,
                        ip_address=ip_address
                    )
                await db.commit()
                return {
                    "success": True,
                    "message": "Feedback deleted successfully"
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
                
        except Exception as e:
            await db.rollback()
            print(f"Error deleting feedback: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting feedback"
            }
    
    async def batch_delete_feedback_admin(
        self,
        db: AsyncSession,
        feedback_ids: List[int],
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete multiple feedback entries.
        
        Args:
            db: Database session
            feedback_ids: List of feedback IDs to delete
            
        Returns:
            Batch delete result
        """
        try:
            # Note: We should ideally filter by partner_id here too
            # But the current repository method doesn't support it yet.
            # For now, we'll just commit to the ID list.
            deleted_count = await self.feedback_repository.batch_delete_feedback(db, feedback_ids)
            
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="feedback.batch_delete",
                    target_type="feedback",
                    target_id="batch",
                    before_state={"ids": feedback_ids},
                    after_state={"deleted_count": deleted_count},
                    ip_address=ip_address
                )
            await db.commit()
            
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"{deleted_count} feedback entries deleted"
            }
            
        except Exception as e:
            await db.rollback()
            print(f"Error batch deleting feedback: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting feedback entries",
                "deleted_count": 0
            }
    
    async def mark_feedback_status_admin(
        self,
        db: AsyncSession,
        feedback_id: int,
        status: str,
        partner_id: Optional[int] = None,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mark feedback status for admin.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            status: New status
            
        Returns:
            Status update result with feedback data
        """
        try:
            # Audit: Get before state
            entry = await self.feedback_repository.async_get_by_id(db, feedback_id, partner_id=partner_id)
            before_state = None
            if entry:
                before_state = {"status": entry.status}

            feedback = await self.feedback_repository.update_feedback_status(
                db=db,
                feedback_id=feedback_id,
                status=status
            )
            
            if feedback:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="feedback.mark_status",
                        target_type="feedback",
                        target_id=str(feedback_id),
                        before_state=before_state,
                        after_state={"status": status},
                        ip_address=ip_address
                    )
                await db.commit()
                return {
                    "success": True,
                    "data": feedback,
                    "message": "Status updated successfully"
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
                
        except Exception as e:
            await db.rollback()
            print(f"Error marking feedback status: {e}")
            return {
                "success": False,
                "error": "An error occurred while updating feedback status"
            }
    
    async def update_feedback_admin(
        self,
        db: AsyncSession,
        feedback_id: int,
        update_data: Dict[str, Any],
        partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update feedback fields for admin.
        
        Args:
            db: Database session
            feedback_id: Feedback ID
            update_data: Dictionary of fields to update
            
        Returns:
            Update result with feedback data
        """
        try:
            feedback = await self.feedback_repository.update_feedback(
                db=db,
                feedback_id=feedback_id,
                update_data=update_data,
                partner_id=partner_id
            )
            
            if feedback:
                await db.commit()
                return {
                    "success": True,
                    "data": feedback,
                    "message": "Feedback updated successfully"
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Feedback with ID {feedback_id} not found"
                }
                
        except Exception as e:
            await db.rollback()
            print(f"Error updating feedback: {e}")
            return {
                "success": False,
                "error": "An error occurred while updating feedback"
            }
    
    async def get_feedback_statistics_admin(
        self,
        db: AsyncSession,
        partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get feedback statistics for admin dashboard.
        
        Args:
            db: Database session
            
        Returns:
            Statistics data
        """
        try:
            stats = await self.feedback_repository.get_feedback_statistics(db, partner_id=partner_id)
            
            return {
                "success": True,
                "stats": stats
            }
            
        except Exception as e:
            print(f"Error getting feedback statistics: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving statistics",
                "stats": {
                    "total": 0,
                    "open": 0,
                    "resolved": 0,
                    "avg_satisfaction": 0.0,
                    "avg_recommendation": 0.0,
                    "by_category": {}
                }
            }
    
    async def export_feedback_csv_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Export feedback to CSV file and return download URL.
        
        Args:
            db: Database session
            filters: Dictionary of filter parameters
            
        Returns:
            Export result with download URL
        """
        try:
            # Extract filter parameters
            search = filters.get('search')
            search_column = filters.get('search_column', 'message')
            status = filters.get('status', 'all')
            date_from = filters.get('date_from')
            date_to = filters.get('date_to')
            sort_by = filters.get('sort_by', 'submitted_at')
            sort_order = filters.get('sort_order', 'desc')
            
            feedback_list = await self.feedback_repository.get_feedback_for_export(
                db=db,
                search=search,
                search_column=search_column,
                status=status,
                date_from=date_from,
                date_to=date_to,
                sort_by=sort_by,
                sort_order=sort_order,
                partner_id=filters.get('partner_id')
            )
            
            # Generate unique filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = uuid.uuid4().hex[:8]
            filename = f"feedback_export_{timestamp}_{unique_id}.csv"
            
            # Create exports directory if it doesn't exist
            export_dir = os.path.join(os.getcwd(), 'exports')
            os.makedirs(export_dir, exist_ok=True)
            
            # Generate CSV file
            file_path = os.path.join(export_dir, filename)
            
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write header
                writer.writerow([
                    'ID', 'User ID', 'Category', 'Satisfaction',
                    'Recommendation', 'Message', 'Status', 'Submitted At'
                ])
                
                # Write data rows
                for feedback in feedback_list:
                    writer.writerow([
                        feedback.id,
                        feedback.user_id or '',
                        csv_safe(feedback.category or ''),
                        feedback.satisfaction if feedback.satisfaction is not None else '',
                        feedback.recommendation if feedback.recommendation is not None else '',
                        csv_safe(feedback.message or ''),
                        feedback.status,
                        feedback.submitted_at.isoformat() if feedback.submitted_at else ''
                    ])
            
            # Generate public URL
            base_url = settings.resomix_server_url
            download_url = f"{base_url}/exports/{filename}"
            
            # Calculate expiration time (24 hours from now)
            expires_at = datetime.now() + timedelta(hours=24)
            
            await db.commit()
            
            return {
                "success": True,
                "download_url": download_url,
                "filename": filename,
                "expires_at": expires_at.isoformat()
            }
            
        except Exception as e:
            await db.rollback()
            print(f"Error exporting feedback: {e}")
            return {
                "success": False,
                "error": "An error occurred while exporting feedback"
            }

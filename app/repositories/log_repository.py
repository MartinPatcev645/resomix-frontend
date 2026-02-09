"""
Log Repository
==============

This repository handles all database operations for system logging.
It provides comprehensive CRUD operations for the SystemLog model with
specialized methods for different types of logging operations.

Supports request logging, error tracking, user action logging, and
admin dashboard queries with proper filtering and pagination.

Version: 3.0.1
Init Date: September 21, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, asc, and_, or_, func
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.models.log import SystemLog
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class LogRepository(BaseRepository[SystemLog]):
    """Repository for handling system log database operations"""
    
    def __init__(self):
        """Initialize the log repository"""
        super().__init__(SystemLog)
    
    # --- Synchronous Operations ---
    
    def create_log(
        self,
        db: Session,
        level: str = "INFO",
        category: str = None,
        action: str = None,
        message: str = None,
        **kwargs
    ) -> SystemLog:
        """
        Create a new system log entry
        
        Args:
            db: Database session
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            category: Log category (REQUEST, ERROR, USER_ACTION, SYSTEM, etc.)
            action: Specific action taken
            message: Log message
            **kwargs: Additional fields (correlation_id, method, endpoint, etc.)
            
        Returns:
            Created SystemLog instance
        """
        try:
            log_data = {
                'level': level,
                'category': category,
                'action': action,
                'message': message,
                **kwargs
            }
            
            # Remove None values to use database defaults
            log_data = {k: v for k, v in log_data.items() if v is not None}
            
            return self.create(db, **log_data)
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to create log entry: {e}")
            db.rollback()
            raise
    
    def get_logs_by_level(
        self,
        db: Session,
        level: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[SystemLog]:
        """Get logs filtered by level"""
        return db.query(SystemLog)\
            .filter(SystemLog.level == level)\
            .order_by(desc(SystemLog.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    def get_logs_by_category(
        self,
        db: Session,
        category: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[SystemLog]:
        """Get logs filtered by category"""
        return db.query(SystemLog)\
            .filter(SystemLog.category == category)\
            .order_by(desc(SystemLog.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    def get_logs_by_date_range(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime,
        limit: int = 1000,
        offset: int = 0
    ) -> List[SystemLog]:
        """Get logs within a date range"""
        return db.query(SystemLog)\
            .filter(and_(
                SystemLog.created_at >= start_date,
                SystemLog.created_at <= end_date
            ))\
            .order_by(desc(SystemLog.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    def get_error_logs(
        self,
        db: Session,
        hours: int = 24,
        limit: int = 100
    ) -> List[SystemLog]:
        """Get recent error logs"""
        since = datetime.utcnow() - timedelta(hours=hours)
        return db.query(SystemLog)\
            .filter(and_(
                SystemLog.level.in_(['ERROR', 'CRITICAL']),
                SystemLog.created_at >= since
            ))\
            .order_by(desc(SystemLog.created_at))\
            .limit(limit)\
            .all()
    
    def get_logs_by_endpoint(
        self,
        db: Session,
        endpoint: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[SystemLog]:
        """Get logs for a specific endpoint"""
        return db.query(SystemLog)\
            .filter(SystemLog.endpoint == endpoint)\
            .order_by(desc(SystemLog.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    def get_slow_requests(
        self,
        db: Session,
        min_duration_ms: float = 1000.0,
        hours: int = 24,
        limit: int = 100
    ) -> List[SystemLog]:
        """Get slow requests above threshold"""
        since = datetime.utcnow() - timedelta(hours=hours)
        return db.query(SystemLog)\
            .filter(and_(
                SystemLog.duration_ms >= min_duration_ms,
                SystemLog.created_at >= since,
                SystemLog.category == 'REQUEST'
            ))\
            .order_by(desc(SystemLog.duration_ms))\
            .limit(limit)\
            .all()
    
    def get_logs_by_track(
        self,
        db: Session,
        track_id: int,
        limit: int = 50
    ) -> List[SystemLog]:
        """Get logs related to a specific track"""
        return db.query(SystemLog)\
            .filter(SystemLog.track_id == track_id)\
            .order_by(desc(SystemLog.created_at))\
            .limit(limit)\
            .all()
    
    def get_logs_by_playlist(
        self,
        db: Session,
        playlist_id: int,
        limit: int = 50
    ) -> List[SystemLog]:
        """Get logs related to a specific playlist"""
        return db.query(SystemLog)\
            .filter(SystemLog.playlist_id == playlist_id)\
            .order_by(desc(SystemLog.created_at))\
            .limit(limit)\
            .all()
    
    def search_logs(
        self,
        db: Session,
        query: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[SystemLog]:
        """Search logs by message content"""
        search_pattern = f"%{query}%"
        return db.query(SystemLog)\
            .filter(or_(
                SystemLog.message.like(search_pattern),
                SystemLog.action.like(search_pattern),
                SystemLog.endpoint.like(search_pattern)
            ))\
            .order_by(desc(SystemLog.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    def get_log_stats(self, db: Session, hours: int = 24) -> Dict[str, Any]:
        """Get logging statistics for dashboard"""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        try:
            # Count by level
            level_counts = db.query(
                SystemLog.level,
                func.count(SystemLog.id).label('count')
            ).filter(SystemLog.created_at >= since)\
             .group_by(SystemLog.level)\
             .all()
            
            # Count by category
            category_counts = db.query(
                SystemLog.category,
                func.count(SystemLog.id).label('count')
            ).filter(SystemLog.created_at >= since)\
             .group_by(SystemLog.category)\
             .all()
            
            # Error rate
            total_requests = db.query(func.count(SystemLog.id))\
                .filter(and_(
                    SystemLog.created_at >= since,
                    SystemLog.category == 'REQUEST'
                )).scalar() or 0
                
            error_requests = db.query(func.count(SystemLog.id))\
                .filter(and_(
                    SystemLog.created_at >= since,
                    SystemLog.category == 'REQUEST',
                    SystemLog.status_code >= 400
                )).scalar() or 0
            
            error_rate = (error_requests / total_requests * 100) if total_requests > 0 else 0
            
            # Average response time
            avg_duration = db.query(func.avg(SystemLog.duration_ms))\
                .filter(and_(
                    SystemLog.created_at >= since,
                    SystemLog.category == 'REQUEST',
                    SystemLog.duration_ms.isnot(None)
                )).scalar() or 0
            
            return {
                'total_logs': sum(count for _, count in level_counts),
                'level_distribution': {level: count for level, count in level_counts},
                'category_distribution': {cat: count for cat, count in category_counts},
                'error_rate_percent': round(error_rate, 2),
                'average_response_time_ms': round(float(avg_duration), 2) if avg_duration else 0,
                'total_requests': total_requests,
                'error_requests': error_requests,
                'period_hours': hours
            }
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to get log stats: {e}")
            return {}
    
    def cleanup_old_logs(self, db: Session, days_to_keep: int = 365) -> int:
        """Clean up old log entries"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        try:
            deleted_count = db.query(SystemLog)\
                .filter(SystemLog.created_at < cutoff_date)\
                .delete()
            db.commit()
            return deleted_count
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to cleanup old logs: {e}")
            db.rollback()
            raise
    
    # --- Async Operations ---
    
    async def async_create_log(
        self,
        db: AsyncSession,
        level: str = "INFO",
        category: str = None,
        action: str = None,
        message: str = None,
        **kwargs
    ) -> SystemLog:
        """
        Async version of create_log for high-performance logging
        """
        try:
            log_data = {
                'level': level,
                'category': category,
                'action': action,
                'message': message,
                **kwargs
            }
            
            # Remove None values
            log_data = {k: v for k, v in log_data.items() if v is not None}
            
            log_entry = SystemLog(**log_data)
            db.add(log_entry)
            await db.commit()
            await db.refresh(log_entry)
            
            return log_entry
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to create async log entry: {e}")
            await db.rollback()
            raise
    
    async def async_get_recent_logs(
        self,
        db: AsyncSession,
        limit: int = 100,
        level: str = None,
        category: str = None
    ) -> List[SystemLog]:
        """Get recent logs async with optional filtering"""
        try:
            query = select(SystemLog).order_by(desc(SystemLog.created_at))
            
            if level:
                query = query.where(SystemLog.level == level)
            
            if category:
                query = query.where(SystemLog.category == category)
            
            query = query.limit(limit)
            
            result = await db.execute(query)
            return result.scalars().all()
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to get recent logs: {e}")
            return []
    
    async def async_get_log_stats(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Async version of get_log_stats"""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        try:
            # Count by level
            level_query = select(
                SystemLog.level,
                func.count(SystemLog.id).label('count')
            ).where(SystemLog.created_at >= since)\
             .group_by(SystemLog.level)
            
            level_result = await db.execute(level_query)
            level_counts = level_result.all()
            
            # Total requests count
            total_query = select(func.count(SystemLog.id))\
                .where(and_(
                    SystemLog.created_at >= since,
                    SystemLog.category == 'REQUEST'
                ))
            
            total_result = await db.execute(total_query)
            total_requests = total_result.scalar() or 0
            
            # Error requests count
            error_query = select(func.count(SystemLog.id))\
                .where(and_(
                    SystemLog.created_at >= since,
                    SystemLog.category == 'REQUEST',
                    SystemLog.status_code >= 400
                ))
            
            error_result = await db.execute(error_query)
            error_requests = error_result.scalar() or 0
            
            error_rate = (error_requests / total_requests * 100) if total_requests > 0 else 0
            
            return {
                'total_logs': sum(count for _, count in level_counts),
                'level_distribution': {level: count for level, count in level_counts},
                'error_rate_percent': round(error_rate, 2),
                'total_requests': total_requests,
                'error_requests': error_requests,
                'period_hours': hours
            }
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to get async log stats: {e}")
            return {}

    def get_filtered_logs(
        self,
        db: Session,
        filters: Dict[str, Any] = None,
        limit: int = 100,
        offset: int = 0,
        order_by: str = 'created_at',
        order_dir: str = 'desc'
    ) -> Tuple[List[SystemLog], int]:
        """
        Get logs with flexible filtering for admin dashboard
        
        Args:
            db: Database session
            filters: Dictionary of filters (level, category, start_date, end_date, etc.)
            limit: Number of records to return
            offset: Number of records to skip
            order_by: Column to order by
            order_dir: Order direction ('asc' or 'desc')
            
        Returns:
            Tuple of (logs, total_count)
        """
        try:
            query = db.query(SystemLog)
            count_query = db.query(func.count(SystemLog.id))
            
            # Apply filters
            if filters:
                conditions = []
                
                if 'level' in filters and filters['level']:
                    conditions.append(SystemLog.level == filters['level'])
                
                if 'category' in filters and filters['category']:
                    conditions.append(SystemLog.category == filters['category'])
                
                if 'action' in filters and filters['action']:
                    conditions.append(SystemLog.action.like(f"%{filters['action']}%"))
                
                if 'endpoint' in filters and filters['endpoint']:
                    conditions.append(SystemLog.endpoint.like(f"%{filters['endpoint']}%"))
                
                if 'start_date' in filters and filters['start_date']:
                    conditions.append(SystemLog.created_at >= filters['start_date'])
                
                if 'end_date' in filters and filters['end_date']:
                    conditions.append(SystemLog.created_at <= filters['end_date'])
                
                if 'track_id' in filters and filters['track_id']:
                    conditions.append(SystemLog.track_id == filters['track_id'])
                
                if 'playlist_id' in filters and filters['playlist_id']:
                    conditions.append(SystemLog.playlist_id == filters['playlist_id'])
                
                if 'client_ip' in filters and filters['client_ip']:
                    conditions.append(SystemLog.client_ip == filters['client_ip'])
                
                if 'min_duration' in filters and filters['min_duration']:
                    conditions.append(SystemLog.duration_ms >= filters['min_duration'])
                
                if 'status_code' in filters and filters['status_code']:
                    conditions.append(SystemLog.status_code == filters['status_code'])
                
                if conditions:
                    filter_condition = and_(*conditions)
                    query = query.filter(filter_condition)
                    count_query = count_query.filter(filter_condition)
            
            # Get total count
            total_count = count_query.scalar() or 0
            
            # Apply ordering
            order_column = getattr(SystemLog, order_by, SystemLog.created_at)
            if order_dir.lower() == 'desc':
                query = query.order_by(desc(order_column))
            else:
                query = query.order_by(asc(order_column))
            
            # Apply pagination
            logs = query.offset(offset).limit(limit).all()
            
            return logs, total_count
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to get filtered logs: {e}")
            return [], 0

    # --- Abstract method implementations ---
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[SystemLog]:
        """
        Find existing log entry based on correlation_id and created_at.
        For logs, we typically don't want exact duplicates, so we check
        correlation_id and timestamp within a small window.
        """
        if 'correlation_id' in kwargs and kwargs['correlation_id']:
            # Look for logs with same correlation_id within last minute
            recent_time = datetime.utcnow() - timedelta(minutes=1)
            
            return db.query(SystemLog)\
                .filter(and_(
                    SystemLog.correlation_id == kwargs['correlation_id'],
                    SystemLog.created_at >= recent_time
                ))\
                .first()
        
        # For logs without correlation_id, assume they're unique
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[SystemLog]:
        """
        Async version of _find_existing
        """
        if 'correlation_id' in kwargs and kwargs['correlation_id']:
            recent_time = datetime.utcnow() - timedelta(minutes=1)
            
            query = select(SystemLog).where(and_(
                SystemLog.correlation_id == kwargs['correlation_id'],
                SystemLog.created_at >= recent_time
            ))
            
            result = await db.execute(query)
            return result.scalar_one_or_none()
        
        return None

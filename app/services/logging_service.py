"""
Logging Service
===============

This service provides high-level business logic for comprehensive system logging.
It handles different types of logging operations including request tracking, error logging,
user actions, and system events with proper categorization and metadata handling.

Serves as the main interface for all logging operations throughout the application
with support for both synchronous and asynchronous operations.

Version: 3.0.1
Init Date: September 21, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import traceback
import uuid
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from fastapi import Request
import logging

from app.repositories.log_repository import LogRepository
from app.models.log import SystemLog
from app.utils.system_metrics import snapshot

logger = logging.getLogger(__name__)


class LoggingService:
    """Service for handling comprehensive system logging operations"""
    
    def __init__(self):
        """Initialize the logging service"""
        self.log_repository = LogRepository()
    
    def generate_correlation_id(self) -> str:
        """Generate a unique correlation ID for request tracking"""
        return str(uuid.uuid4())
    
    # --- Request Logging ---
    
    def log_request(
        self,
        db: Session,
        request: Request,
        response_status: int,
        duration_ms: float,
        response_size: int = None,
        correlation_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> SystemLog:
        """
        Log an HTTP request with comprehensive details
        
        Args:
            db: Database session
            request: FastAPI Request object
            response_status: HTTP response status code
            duration_ms: Request processing time in milliseconds
            response_size: Response size in bytes
            correlation_id: Optional correlation ID for request tracking
            metadata: Additional metadata to store
            
        Returns:
            Created SystemLog instance
        """
        try:
            # Get system metrics
            metrics = snapshot()
            
            # Extract request details
            client_ip = self._get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")
            referer = request.headers.get("referer", "")
            
            # Parse query parameters
            query_params = dict(request.query_params) if request.query_params else None
            
            log_data = {
                'correlation_id': correlation_id,
                'method': request.method,
                'endpoint': str(request.url.path),
                'path': str(request.url),
                'query_params': query_params,
                'status_code': response_status,
                'response_size': response_size,
                'duration_ms': duration_ms,
                'level': self._get_log_level_from_status(response_status),
                'category': 'REQUEST',
                'action': f"{request.method}_{request.url.path.replace('/', '_').strip('_')}",
                'message': f"{request.method} {request.url.path} - {response_status} ({duration_ms:.1f}ms)",
                'client_ip': client_ip,
                'user_agent': user_agent,
                'referer': referer,
                'cpu_percent': metrics.get('cpu_percent'),
                'memory_percent': metrics.get('mem_percent'),
                'log_metadata': {
                    **(metadata or {}),
                    'process_cpu': metrics.get('proc_cpu_percent'),
                    'process_rss': metrics.get('proc_rss'),
                    'net_sent': metrics.get('net_bytes_sent'),
                    'net_recv': metrics.get('net_bytes_recv')
                }
            }
            
            return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log request: {e}")
            # Don't re-raise to avoid breaking the request flow
            return None
    
    # --- Error Logging ---
    
    def log_error(
        self,
        db: Union[Session, AsyncSession],
        error: Exception,
        context: str = None,
        level: str = "ERROR",
        correlation_id: str = None,
        request: Request = None,
        track_id: int = None,
        playlist_id: int = None,
        album_id: int = None,
        artist_id: int = None,
        metadata: Dict[str, Any] = None
    ) -> SystemLog:
        """
        Log an error with full context and stack trace
        
        Args:
            db: Database session (sync or async)
            error: Exception that occurred
            context: Additional context about where the error occurred
            level: Log level (ERROR or CRITICAL)
            correlation_id: Request correlation ID
            request: FastAPI Request object if available
            track_id: Related track ID
            playlist_id: Related playlist ID
            album_id: Related album ID
            artist_id: Related artist ID
            metadata: Additional metadata
            
        Returns:
            Created SystemLog instance
        """
        try:
            error_message = str(error)
            stack_trace = traceback.format_exc()
            
            # Build context message
            full_message = error_message
            if context:
                full_message = f"{context}: {error_message}"
            
            log_data = {
                'correlation_id': correlation_id,
                'level': level,
                'category': 'ERROR',
                'action': 'EXCEPTION',
                'message': full_message,
                'stack_trace': stack_trace,
                'track_id': track_id,
                'playlist_id': playlist_id,
                'album_id': album_id,
                'artist_id': artist_id,
                'log_metadata': {
                    'error_type': type(error).__name__,
                    'context': context,
                    **(metadata or {})
                }
            }
            
            # Add request details if available
            if request:
                log_data.update({
                    'method': request.method,
                    'endpoint': str(request.url.path),
                    'path': str(request.url),
                    'client_ip': self._get_client_ip(request),
                    'user_agent': request.headers.get("user-agent", "")
                })
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
            return None
    
    # --- User Action Logging ---
    
    def log_user_action(
        self,
        db: Union[Session, AsyncSession],
        action: str,
        message: str = None,
        correlation_id: str = None,
        track_id: int = None,
        playlist_id: int = None,
        album_id: int = None,
        artist_id: int = None,
        metadata: Dict[str, Any] = None
    ) -> SystemLog:
        """
        Log a user action for audit trail
        
        Args:
            db: Database session (sync or async)
            action: Action performed (e.g., 'upload_track', 'create_playlist')
            message: Descriptive message
            correlation_id: Request correlation ID
            track_id: Related track ID
            playlist_id: Related playlist ID
            album_id: Related album ID
            artist_id: Related artist ID
            metadata: Additional metadata
            
        Returns:
            Created SystemLog instance
        """
        try:
            log_data = {
                'correlation_id': correlation_id,
                'level': 'INFO',
                'category': 'USER_ACTION',
                'action': action,
                'message': message or f"User performed action: {action}",
                'track_id': track_id,
                'playlist_id': playlist_id,
                'album_id': album_id,
                'artist_id': artist_id,
                'log_metadata': metadata
            }
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                # For async sessions, we can't return the result directly
                # We'll create the log entry but return None
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log user action: {e}")
            return None
    
    # --- System Event Logging ---
    
    def log_system_event(
        self,
        db: Union[Session, AsyncSession],
        event: str,
        message: str = None,
        level: str = "INFO",
        metadata: Dict[str, Any] = None
    ) -> SystemLog:
        """
        Log a system event
        
        Args:
            db: Database session (sync or async)
            event: System event (e.g., 'service_start', 'database_backup')
            message: Event description
            level: Log level
            metadata: Additional metadata
            
        Returns:
            Created SystemLog instance
        """
        try:
            log_data = {
                'correlation_id': None,
                'level': level,
                'category': 'SYSTEM',
                'action': event,
                'message': message or f"System event: {event}",
                'log_metadata': metadata
            }
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log system event: {e}")
            return None
    
    # --- Transfer Logging ---
    
    def log_transfer_operation(
        self,
        db: Union[Session, AsyncSession],
        platform: str,
        operation: str,
        playlist_id: int,
        status: str,
        details: Dict[str, Any],
        correlation_id: str = None,
        duration_ms: float = None
    ) -> SystemLog:
        """
        Log playlist transfer operations (Spotify, Tidal, etc.)
        
        Args:
            db: Database session (sync or async)
            platform: Platform name (spotify, tidal, etc.)
            operation: Operation type (transfer_playlist, search_track, etc.)
            playlist_id: Playlist being transferred
            status: Operation status (success, failure, partial)
            details: Operation details (tracks found, errors, etc.)
            correlation_id: Request correlation ID
            duration_ms: Operation duration
            
        Returns:
            Created SystemLog instance
        """
        try:
            log_data = {
                'correlation_id': correlation_id,
                'level': 'INFO' if status == 'success' else 'WARNING',
                'category': 'TRANSFER',
                'action': f"{platform}_{operation}",
                'message': f"{platform.title()} {operation}: {status}",
                'playlist_id': playlist_id,
                'duration_ms': duration_ms,
                'log_metadata': {
                    'platform': platform,
                    'operation': operation,
                    'status': status,
                    **details
                }
            }
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log transfer operation: {e}")
            return None
    
    # --- Upload Logging ---
    
    def log_upload_operation(
        self,
        db: Union[Session, AsyncSession],
        operation: str,
        track_id: int = None,
        filename: str = None,
        file_size: int = None,
        status: str = "success",
        error_message: str = None,
        correlation_id: str = None,
        duration_ms: float = None
    ) -> SystemLog:
        """
        Log track upload operations
        
        Args:
            db: Database session (sync or async)
            operation: Upload operation (upload_start, metadata_extract, file_process, etc.)
            track_id: Track ID if available
            filename: Original filename
            file_size: File size in bytes
            status: Operation status
            error_message: Error message if failed
            correlation_id: Request correlation ID
            duration_ms: Operation duration
            
        Returns:
            Created SystemLog instance
        """
        try:
            level = 'INFO' if status == 'success' else 'ERROR'
            message = f"Upload {operation}: {status}"
            if filename:
                message += f" - {filename}"
            if error_message:
                message += f" - {error_message}"
            
            log_data = {
                'correlation_id': correlation_id,
                'level': level,
                'category': 'UPLOAD',
                'action': f"upload_{operation}",
                'message': message,
                'track_id': track_id,
                'duration_ms': duration_ms,
                'log_metadata': {
                    'operation': operation,
                    'filename': filename,
                    'file_size': file_size,
                    'status': status,
                    'error_message': error_message
                }
            }
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to log upload operation: {e}")
            return None
    
    # --- Admin Dashboard Methods ---
    
    def get_dashboard_logs(
        self,
        db: Session,
        filters: Dict[str, Any] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Get logs for admin dashboard with pagination and filtering
        
        Args:
            db: Database session
            filters: Filter criteria
            page: Page number (1-based)
            page_size: Records per page
            
        Returns:
            Dictionary with logs, pagination info, and metadata
        """
        try:
            offset = (page - 1) * page_size
            logs, total_count = self.log_repository.get_filtered_logs(
                db, filters, page_size, offset
            )
            
            total_pages = (total_count + page_size - 1) // page_size
            
            return {
                'logs': [log.to_dict() for log in logs],
                'pagination': {
                    'current_page': page,
                    'page_size': page_size,
                    'total_count': total_count,
                    'total_pages': total_pages,
                    'has_next': page < total_pages,
                    'has_prev': page > 1
                },
                'filters_applied': filters or {}
            }
            
        except Exception as e:
            logger.error(f"Failed to get dashboard logs: {e}")
            return {
                'logs': [],
                'pagination': {'current_page': 1, 'page_size': page_size, 'total_count': 0, 'total_pages': 0},
                'error': str(e)
            }
    
    def get_log_statistics(self, db: Session, hours: int = 24) -> Dict[str, Any]:
        """
        Get comprehensive logging statistics for dashboard
        
        Args:
            db: Database session
            hours: Time period for statistics
            
        Returns:
            Dictionary with various statistics
        """
        try:
            return self.log_repository.get_log_stats(db, hours)
            
        except Exception as e:
            logger.error(f"Failed to get log statistics: {e}")
            return {}
    
    # --- Async Methods ---
    
    async def async_log_request(
        self,
        db: AsyncSession,
        request: Request,
        response_status: int,
        duration_ms: float,
        response_size: int = None,
        correlation_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> SystemLog:
        """Async version of log_request for high-performance scenarios"""
        try:
            metrics = snapshot()
            client_ip = self._get_client_ip(request)
            
            log_data = {
                'correlation_id': correlation_id,
                'method': request.method,
                'endpoint': str(request.url.path),
                'path': str(request.url),
                'query_params': dict(request.query_params) if request.query_params else None,
                'status_code': response_status,
                'response_size': response_size,
                'duration_ms': duration_ms,
                'level': self._get_log_level_from_status(response_status),
                'category': 'REQUEST',
                'action': f"{request.method}_{request.url.path.replace('/', '_').strip('_')}",
                'message': f"{request.method} {request.url.path} - {response_status} ({duration_ms:.1f}ms)",
                'client_ip': client_ip,
                'user_agent': request.headers.get("user-agent", ""),
                'cpu_percent': metrics.get('cpu_percent'),
                'memory_percent': metrics.get('mem_percent'),
                'log_metadata': metadata
            }
            
            return await self.log_repository.async_create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to async log request: {e}")
            return None
    
    async def async_log_error(
        self,
        db: Union[Session, AsyncSession],
        error: Exception,
        context: str = None,
        correlation_id: str = None,
        **kwargs
    ) -> SystemLog:
        """Async version of log_error"""
        try:
            log_data = {
                'correlation_id': correlation_id,
                'level': 'ERROR',
                'category': 'ERROR',
                'action': 'EXCEPTION',
                'message': f"{context}: {str(error)}" if context else str(error),
                'stack_trace': traceback.format_exc(),
                'log_metadata': {
                    'error_type': type(error).__name__,
                    'context': context
                },
                **kwargs
            }
            
            # Handle both sync and async sessions
            if isinstance(db, AsyncSession):
                import asyncio
                asyncio.create_task(self._async_create_log_task(db, **log_data))
                return None
            else:
                return self.log_repository.create_log(db, **log_data)
            
        except Exception as e:
            logger.error(f"Failed to async log error: {e}")
            return None
    
    # --- Helper Methods ---
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request headers"""
        # Check for forwarded headers first (for load balancers/proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct client
        return str(request.client.host) if request.client else "unknown"
    
    def _get_log_level_from_status(self, status_code: int) -> str:
        """Determine log level based on HTTP status code"""
        if status_code >= 500:
            return "ERROR"
        elif status_code >= 400:
            return "WARNING"
        else:
            return "INFO"
    
    # --- Cleanup Methods ---
    
    def cleanup_old_logs(self, db: Session, days_to_keep: int = 365) -> Dict[str, Any]:
        """
        Clean up old logs and return summary
        
        Args:
            db: Database session
            days_to_keep: Number of days to keep
            
        Returns:
            Cleanup summary
        """
        try:
            deleted_count = self.log_repository.cleanup_old_logs(db, days_to_keep)
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'days_kept': days_to_keep,
                'cleanup_date': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to cleanup logs: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def _async_create_log_task(self, db: AsyncSession, **log_data):
        """Helper method to create log entries in async sessions"""
        try:
            await self.log_repository.async_create_log(db, **log_data)
        except Exception as e:
            logger.error(f"Failed to create async log entry: {e}")

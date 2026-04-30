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
from typing import Dict, Any
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
    
    def log(
        self,
        db: Session = None,
        async_db: AsyncSession = None,
        # Core logging fields
        level: str = "INFO",
        category: str = "GENERAL",
        action: str = None,
        message: str = None,
        correlation_id: str = None,
        # Request fields
        request: Request = None,
        method: str = None,
        endpoint: str = None,
        path: str = None,
        query_params: Dict = None,
        client_ip: str = None,
        user_agent: str = None,
        referer: str = None,
        # Response fields
        status_code: int = None,
        response_size: int = None,
        duration_ms: float = None,
        # Resource IDs
        track_id: int = None,
        playlist_id: int = None,
        album_id: int = None,
        artist_id: int = None,
        # Error fields
        error: Exception = None,
        stack_trace: str = None,
        context: str = None,
        # System metrics (will be auto-collected if request is provided)
        cpu_percent: float = None,
        memory_percent: float = None,
        # Custom metadata
        metadata: Dict[str, Any] = None,
        # File/Upload fields
        filename: str = None,
        file_size: int = None,
        # Transfer fields
        platform: str = None,
        operation: str = None,
        transfer_status: str = None,
        transfer_details: Dict[str, Any] = None
    ) -> SystemLog:
        """
        Universal logging function that handles all types of logging scenarios.
        
        Args:
            db: Sync database session (use either db or async_db, not both)
            async_db: Async database session (use either db or async_db, not both)
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            category: Log category (REQUEST, ERROR, USER_ACTION, SYSTEM, TRANSFER, UPLOAD, etc.)
            action: Specific action being logged
            message: Log message (will be auto-generated if not provided)
            correlation_id: Request correlation ID for tracking
            request: FastAPI Request object (auto-extracts client info and metrics)
            method: HTTP method (auto-extracted from request if not provided)
            endpoint: API endpoint path (auto-extracted from request if not provided)
            path: Full request path (auto-extracted from request if not provided)
            query_params: Query parameters (auto-extracted from request if not provided)
            client_ip: Client IP address (auto-extracted from request if not provided)
            user_agent: User agent (auto-extracted from request if not provided)
            referer: Referer header (auto-extracted from request if not provided)
            status_code: HTTP response status code
            response_size: Response size in bytes
            duration_ms: Operation duration in milliseconds
            track_id: Related track ID
            playlist_id: Related playlist ID
            album_id: Related album ID
            artist_id: Related artist ID
            error: Exception object (auto-extracts stack trace)
            stack_trace: Stack trace string (auto-generated if error provided)
            context: Additional context for errors
            cpu_percent: CPU usage percentage (auto-collected if request provided)
            memory_percent: Memory usage percentage (auto-collected if request provided)
            metadata: Additional custom metadata
            filename: File name for upload operations
            file_size: File size for upload operations
            platform: Platform name for transfer operations (spotify, tidal, etc.)
            operation: Operation type for transfers
            transfer_status: Status of transfer operation
            transfer_details: Additional transfer details
            
        Returns:
            SystemLog instance if successful, None if failed
        """
        try:
            # Auto-extract request information if request object is provided
            if request:
                method = method or request.method
                endpoint = endpoint or str(request.url.path)
                path = path or str(request.url)
                query_params = query_params or (dict(request.query_params) if request.query_params else None)
                client_ip = client_ip or self._get_client_ip(request)
                user_agent = user_agent or request.headers.get("user-agent", "")
                referer = referer or request.headers.get("referer", "")
                
                # Auto-collect system metrics if request is provided
                if cpu_percent is None or memory_percent is None:
                    metrics = snapshot()
                    cpu_percent = cpu_percent or metrics.get('cpu_percent')
                    memory_percent = memory_percent or metrics.get('mem_percent')
                    
                    # Add process metrics to metadata
                    if metadata is None:
                        metadata = {}
                    metadata.update({
                        'process_cpu': metrics.get('proc_cpu_percent'),
                        'process_rss': metrics.get('proc_rss'),
                        'net_sent': metrics.get('net_bytes_sent'),
                        'net_recv': metrics.get('net_bytes_recv')
                    })
            
            # Always include context in metadata if provided
            if context:
                if metadata is None:
                    metadata = {}
                metadata['context'] = context
            
            # Auto-extract error information
            if error:
                stack_trace = stack_trace or traceback.format_exc()
                level = level or "ERROR"
                category = category or "ERROR"
                action = action or "EXCEPTION"
                
                if metadata is None:
                    metadata = {}
                metadata.update({
                    'error_type': type(error).__name__
                })
                
                # Build error message
                error_message = str(error)
                if context:
                    error_message = f"{context}: {error_message}"
                message = message or error_message
            
            # Auto-generate action for requests
            if category == "REQUEST" and method and endpoint and not action:
                action = f"{method}_{endpoint.replace('/', '_').strip('_')}"
            
            # Auto-generate message if not provided
            if not message:
                if category == "REQUEST" and method and endpoint and status_code:
                    message = f"{method} {endpoint} - {status_code}"
                    if duration_ms:
                        message += f" ({duration_ms:.1f}ms)"
                elif category == "USER_ACTION" and action:
                    message = f"User performed action: {action}"
                elif category == "SYSTEM" and action:
                    message = f"System event: {action}"
                elif category == "TRANSFER" and platform and operation:
                    message = f"{platform.title()} {operation}: {transfer_status or 'executed'}"
                elif category == "UPLOAD" and operation:
                    message = f"Upload {operation}: {transfer_status or 'executed'}"
                    if filename:
                        message += f" - {filename}"
                elif action:
                    message = f"Action: {action}"
                else:
                    message = f"{category} log entry"
            
            # Auto-determine log level from status code if not provided
            if status_code and level == "INFO":
                level = self._get_log_level_from_status(status_code)
            
            # Build transfer metadata if transfer fields provided
            if platform or operation or transfer_status or transfer_details:
                if metadata is None:
                    metadata = {}
                if platform:
                    metadata['platform'] = platform
                if operation:
                    metadata['operation'] = operation
                if transfer_status:
                    metadata['status'] = transfer_status
                if transfer_details:
                    metadata.update(transfer_details)
            
            # Build upload metadata if upload fields provided
            if filename or file_size:
                if metadata is None:
                    metadata = {}
                if filename:
                    metadata['filename'] = filename
                if file_size:
                    metadata['file_size'] = file_size
            
            # Prepare log data
            log_data = {
                'correlation_id': correlation_id,
                'level': level,
                'category': category,
                'action': action,
                'message': message,
                'method': method,
                'endpoint': endpoint,
                'path': path,
                'query_params': query_params,
                'status_code': status_code,
                'response_size': response_size,
                'duration_ms': duration_ms,
                'client_ip': client_ip,
                'user_agent': user_agent,
                'referer': referer,
                'track_id': track_id,
                'playlist_id': playlist_id,
                'artist_id': artist_id,
                'stack_trace': stack_trace,
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
            }

            # album_id no longer has its own DB column (system_logs uses release_id now).
            # Preserve it in log_metadata for backward-compatibility.
            if album_id is not None:
                if metadata is None:
                    metadata = {}
                metadata['album_id'] = album_id

            log_data['log_metadata'] = metadata
            
            # Remove None values to avoid unnecessary database fields
            log_data = {k: v for k, v in log_data.items() if v is not None}
            
            # Use appropriate repository method based on session type
            if async_db:
                # Create async task for logging with new session to avoid conflicts
                import asyncio
                asyncio.create_task(self._async_create_log_with_new_session(**log_data))
                return None  # Async operations don't return the log object immediately
            elif db:
                return self.log_repository.create_log(db, **log_data)
            else:
                # No session provided, create async task with new session
                import asyncio
                asyncio.create_task(self._async_create_log_with_new_session(**log_data))
                return None
                
        except Exception as e:
            logger.error(f"Failed to create log entry: {e}")
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

    async def _async_create_log_with_new_session(self, **log_data):
        """
        Helper method to create log entries using a new database session.
        This prevents session state conflicts by using a separate session.
        """
        try:
            from database.connection import AsyncSessionLocal
            
            # Create a new session for logging to avoid conflicts
            async with AsyncSessionLocal() as log_session:
                await self.log_repository.async_create_log(log_session, **log_data)
                # No need for manual commit - repository already handles it
        except Exception as e:
            logger.error(f"Failed to create async log entry: {e}")

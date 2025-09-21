"""
Log Schemas
===========

This module defines Pydantic schemas for system logging operations.
It provides validation models for log creation, filtering, and API responses
with proper type checking and data validation.

Supports comprehensive logging schema validation for admin dashboard
and API endpoints with proper request/response formatting.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from enum import Enum


class LogLevel(str, Enum):
    """Log level enumeration"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogCategory(str, Enum):
    """Log category enumeration"""
    REQUEST = "REQUEST"
    ERROR = "ERROR"
    USER_ACTION = "USER_ACTION"
    SYSTEM = "SYSTEM"
    TRANSFER = "TRANSFER"
    UPLOAD = "UPLOAD"
    AUTH = "AUTH"
    ADMIN = "ADMIN"


class LogCreateRequest(BaseModel):
    """Schema for creating a new log entry"""
    correlation_id: Optional[str] = None
    method: Optional[str] = Field(None, max_length=10)
    endpoint: Optional[str] = Field(None, max_length=500)
    path: Optional[str] = Field(None, max_length=500)
    query_params: Optional[Dict[str, Any]] = None
    status_code: Optional[int] = Field(None, ge=100, le=599)
    response_size: Optional[int] = Field(None, ge=0)
    duration_ms: Optional[float] = Field(None, ge=0)
    level: LogLevel = LogLevel.INFO
    category: Optional[LogCategory] = None
    action: Optional[str] = Field(None, max_length=100)
    message: Optional[str] = None
    client_ip: Optional[str] = Field(None, max_length=45)
    user_agent: Optional[str] = Field(None, max_length=500)
    referer: Optional[str] = Field(None, max_length=500)
    cpu_percent: Optional[float] = Field(None, ge=0, le=100)
    memory_percent: Optional[float] = Field(None, ge=0, le=100)
    track_id: Optional[int] = None
    playlist_id: Optional[int] = None
    album_id: Optional[int] = None
    artist_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LogResponse(BaseModel):
    """Schema for log response"""
    id: int
    correlation_id: Optional[str]
    method: Optional[str]
    endpoint: Optional[str]
    path: Optional[str]
    query_params: Optional[Dict[str, Any]]
    status_code: Optional[int]
    response_size: Optional[int]
    duration_ms: Optional[float]
    level: str
    category: Optional[str]
    action: Optional[str]
    message: Optional[str]
    client_ip: Optional[str]
    user_agent: Optional[str]
    referer: Optional[str]
    cpu_percent: Optional[float]
    memory_percent: Optional[float]
    track_id: Optional[int]
    playlist_id: Optional[int]
    album_id: Optional[int]
    artist_id: Optional[int]
    metadata: Optional[Dict[str, Any]]
    stack_trace: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LogFilterRequest(BaseModel):
    """Schema for filtering logs in admin dashboard"""
    level: Optional[LogLevel] = None
    category: Optional[LogCategory] = None
    action: Optional[str] = Field(None, max_length=100)
    endpoint: Optional[str] = Field(None, max_length=500)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    track_id: Optional[int] = None
    playlist_id: Optional[int] = None
    album_id: Optional[int] = None
    artist_id: Optional[int] = None
    client_ip: Optional[str] = Field(None, max_length=45)
    min_duration: Optional[float] = Field(None, ge=0, description="Minimum duration in milliseconds")
    status_code: Optional[int] = Field(None, ge=100, le=599)
    search_query: Optional[str] = Field(None, max_length=500, description="Search in message, action, or endpoint")
    page: int = Field(1, ge=1, description="Page number (1-based)")
    page_size: int = Field(50, ge=1, le=1000, description="Number of records per page")
    order_by: str = Field("created_at", description="Column to order by")
    order_dir: str = Field("desc", regex="^(asc|desc)$", description="Order direction")

    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        """Validate that end_date is after start_date"""
        if v and 'start_date' in values and values['start_date']:
            if v <= values['start_date']:
                raise ValueError('end_date must be after start_date')
        return v


class PaginationInfo(BaseModel):
    """Schema for pagination information"""
    current_page: int
    page_size: int
    total_count: int
    total_pages: int
    has_next: bool
    has_prev: bool


class LogListResponse(BaseModel):
    """Schema for paginated log list response"""
    logs: List[LogResponse]
    pagination: PaginationInfo
    filters_applied: Dict[str, Any]


class LogStatistics(BaseModel):
    """Schema for log statistics"""
    total_logs: int = 0
    level_distribution: Dict[str, int] = {}
    category_distribution: Dict[str, int] = {}
    error_rate_percent: float = 0.0
    average_response_time_ms: float = 0.0
    total_requests: int = 0
    error_requests: int = 0
    period_hours: int = 24


class RequestLogData(BaseModel):
    """Schema for request logging data"""
    method: str
    endpoint: str
    path: str
    query_params: Optional[Dict[str, Any]] = None
    status_code: int
    duration_ms: float
    response_size: Optional[int] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    referer: Optional[str] = None
    correlation_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ErrorLogData(BaseModel):
    """Schema for error logging data"""
    error_type: str
    error_message: str
    stack_trace: Optional[str] = None
    context: Optional[str] = None
    correlation_id: Optional[str] = None
    track_id: Optional[int] = None
    playlist_id: Optional[int] = None
    album_id: Optional[int] = None
    artist_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class UserActionLogData(BaseModel):
    """Schema for user action logging data"""
    action: str
    message: Optional[str] = None
    correlation_id: Optional[str] = None
    track_id: Optional[int] = None
    playlist_id: Optional[int] = None
    album_id: Optional[int] = None
    artist_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class TransferLogData(BaseModel):
    """Schema for transfer operation logging"""
    platform: str
    operation: str
    playlist_id: int
    status: str
    tracks_found: Optional[int] = None
    tracks_added: Optional[int] = None
    tracks_failed: Optional[int] = None
    error_messages: Optional[List[str]] = None
    correlation_id: Optional[str] = None
    duration_ms: Optional[float] = None


class UploadLogData(BaseModel):
    """Schema for upload operation logging"""
    operation: str
    filename: Optional[str] = None
    file_size: Optional[int] = None
    track_id: Optional[int] = None
    status: str = "success"
    error_message: Optional[str] = None
    correlation_id: Optional[str] = None
    duration_ms: Optional[float] = None


class SystemEventLogData(BaseModel):
    """Schema for system event logging"""
    event: str
    message: Optional[str] = None
    level: LogLevel = LogLevel.INFO
    metadata: Optional[Dict[str, Any]] = None


class LogCleanupRequest(BaseModel):
    """Schema for log cleanup requests"""
    days_to_keep: int = Field(365, ge=1, le=3650, description="Number of days to keep logs")


class LogCleanupResponse(BaseModel):
    """Schema for log cleanup response"""
    success: bool
    deleted_count: Optional[int] = None
    days_kept: Optional[int] = None
    cleanup_date: Optional[datetime] = None
    error: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LogHealthCheck(BaseModel):
    """Schema for logging system health check"""
    logs_last_hour: int
    errors_last_hour: int
    average_response_time: float
    database_connection: bool
    storage_space_mb: Optional[float] = None
    oldest_log_date: Optional[datetime] = None
    newest_log_date: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

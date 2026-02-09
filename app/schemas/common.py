"""
Common Schemas
==============

This module contains shared Pydantic schemas used across multiple API endpoints.
It defines common request/response models, validation schemas, error handling,
and utility schemas for consistent API behavior and data formatting.

Provides base schemas for pagination, error responses, file handling,
configuration constants, and standardized response formatting.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Any, Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class ResponseStatus(str, Enum):
    """Standard response status values."""
    SUCCESS = "success"
    ERROR = "error"
    NOT_FOUND = "not_found"


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = Field(..., description="Whether the operation was successful")
    data: Optional[Any] = Field(None, description="Response data for successful operations")
    error: Optional[str] = Field(None, description="Error message for failed operations")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {"message": "Operation completed successfully"}
            }
        }


class ErrorResponse(BaseModel):
    """Error response schema."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "An error occurred while processing the request"
            }
        }


class ValidationErrorDetail(BaseModel):
    """Detailed validation error information."""
    field: str = Field(..., description="The field that failed validation")
    message: str = Field(..., description="Validation error message")
    value: Optional[Any] = Field(None, description="The invalid value that was provided")


class ValidationErrorResponse(BaseModel):
    """Validation error response schema."""
    success: bool = Field(False, description="Always false for validation errors")
    error: str = Field(..., description="General validation error message")
    details: Optional[List[ValidationErrorDetail]] = Field(None, description="Detailed validation errors")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Validation failed",
                "details": [
                    {
                        "field": "email",
                        "message": "Invalid email format",
                        "value": "invalid-email"
                    }
                ]
            }
        }


class PaginationRequest(BaseModel):
    """Standard pagination request parameters."""
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")


class PaginationResponse(BaseModel):
    """Standard pagination response metadata."""
    total: int = Field(..., description="Total number of available records")
    skip: int = Field(..., description="Number of records skipped")
    limit: int = Field(..., description="Maximum number of records requested")
    count: int = Field(..., description="Number of records returned in this response")


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""
    success: bool = Field(True, description="Whether the operation was successful")
    data: List[Any] = Field(..., description="List of data items")
    pagination: PaginationResponse = Field(..., description="Pagination metadata")


class HealthCheckResponse(BaseModel):
    """Health check response schema."""
    name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    status: str = Field(..., description="Application status")
    docs_url: str = Field(..., description="URL to API documentation")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Resomix API",
                "version": "1.0.1",
                "status": "running",
                "docs_url": "/docs"
            }
        }


class StatusEnum(str, Enum):
    """Common status values used across entities."""
    OPEN = "open"
    RESOLVED = "resolved"
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    COMPLETED = "completed"


class FileInfo(BaseModel):
    """File information schema."""
    filename: str = Field(..., description="Original filename")
    size: Optional[int] = Field(None, description="File size in bytes")
    content_type: Optional[str] = Field(None, description="MIME content type")
    duration: Optional[float] = Field(None, description="Duration in seconds with decimal precision (for audio files)")
    timestamp: Optional[str] = Field(None, description="Timestamp for the interaction")


class TopSkRequest(BaseModel):
    """Base class for requests that include top_sk parameter."""
    top_sk: Optional[int] = Field(
        None, 
        description="Number of similar tracks to return (10, 20, 50, or 100)",
        ge=1,
        le=100
    )

    class Config:
        json_schema_extra = {
            "example": {
                "top_sk": 20
            }
        }


# Common constants for validation
ALLOWED_TOP_SK_VALUES = [10, 20, 50, 100]
DEFAULT_TOP_SK = 20

# Audio file configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/mp3", 
    "audio/wav",
    "audio/flac",
    "audio/ogg",
    "audio/aac",
    "audio/m4a"
] 
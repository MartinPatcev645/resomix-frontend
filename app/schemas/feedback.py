"""
Feedback Schemas
================

This module contains Pydantic schemas for user feedback functionality.
It defines request and response models for feedback submission, retrieval,
and status management with comprehensive validation and error handling.

Provides schemas for feedback forms, rating validation, category management,
and administrative operations for user satisfaction tracking.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from app.schemas.common import StatusEnum


class FeedbackRequest(BaseModel):
    """Request schema for feedback submission."""
    satisfaction: int = Field(..., description="Satisfaction rating from 1-10", ge=1, le=10)
    recommendation: int = Field(..., description="Recommendation rating from 1-10", ge=1, le=10)
    feedback: Optional[str] = Field(None, description="Optional feedback text", max_length=1000)
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")
    category: Optional[str] = Field(None, description="Optional feedback category", max_length=50)

    class Config:
        json_schema_extra = {
            "example": {
                "satisfaction": 8,
                "recommendation": 9,
                "feedback": "Great service, but could be faster",
                "category": "performance"
            }
        }


class FeedbackResponse(BaseModel):
    """Response schema for feedback submission."""
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Feedback received successfully and saved to database."
            }
        }


class FeedbackSuccessResponse(BaseModel):
    """Success response wrapper for feedback submission."""
    success: bool = Field(True, description="Always true for successful responses")
    data: FeedbackResponse = Field(..., description="Feedback submission result")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Feedback received successfully and saved to database."
                }
            }
        }


class FeedbackErrorResponse(BaseModel):
    """Error response schema for feedback operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Ratings must be between 1 and 10"
            }
        }


class FeedbackEntity(BaseModel):
    """Schema for feedback database entity."""
    id: Optional[int] = Field(None, description="Feedback record ID")
    user_id: Optional[str] = Field(None, description="User ID")
    category: Optional[str] = Field(None, description="Feedback category")
    message: Optional[str] = Field(None, description="Feedback message")
    satisfaction: Optional[int] = Field(None, description="Satisfaction rating")
    recommendation: Optional[int] = Field(None, description="Recommendation rating")
    status: StatusEnum = Field(StatusEnum.OPEN, description="Feedback status")
    submitted_at: Optional[str] = Field(None, description="Submission timestamp")

    class Config:
        from_attributes = True


class FeedbackUpdateRequest(BaseModel):
    """Request schema for updating feedback status."""
    status: StatusEnum = Field(..., description="New status for the feedback")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        }


# ============================================================================
# Admin Schemas
# ============================================================================

class AdminFeedbackFilters(BaseModel):
    """Query parameters for admin feedback list endpoint."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field(None, description="Column to search in: message, category, or user_id")
    status: Optional[str] = Field("all", description="Filter by status: open, resolved, or all")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("submitted_at", description="Column to sort by")
    sort_order: str = Field("desc", description="Sort order: asc or desc")

    class Config:
        json_schema_extra = {
            "example": {
                "page": 1,
                "page_size": 30,
                "search": "bug",
                "search_column": "message",
                "status": "open",
                "date_from": "2025-09-01",
                "date_to": "2025-10-01",
                "sort_by": "submitted_at",
                "sort_order": "desc"
            }
        }


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")

    class Config:
        json_schema_extra = {
            "example": {
                "page": 1,
                "page_size": 30,
                "total": 100,
                "total_pages": 4
            }
        }


class AdminFeedbackListResponse(BaseModel):
    """Response schema for admin feedback list."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[FeedbackEntity] = Field(..., description="List of feedback entries")
    pagination: PaginationMeta = Field(..., description="Pagination information")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [
                    {
                        "id": 1,
                        "user_id": "uuid-or-null",
                        "category": "general",
                        "message": "Feedback text",
                        "satisfaction": 5,
                        "recommendation": 4,
                        "status": "open",
                        "submitted_at": "2025-10-01T10:30:00Z"
                    }
                ],
                "pagination": {
                    "page": 1,
                    "page_size": 30,
                    "total": 100,
                    "total_pages": 4
                }
            }
        }


class AdminBatchDeleteRequest(BaseModel):
    """Request schema for batch delete operation."""
    ids: List[int] = Field(..., description="List of feedback IDs to delete", min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "ids": [1, 2, 3, 4, 5]
            }
        }


class AdminBatchDeleteResponse(BaseModel):
    """Response schema for batch delete operation."""
    success: bool = Field(True, description="Always true for successful responses")
    deleted_count: int = Field(..., description="Number of items deleted")
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "deleted_count": 5,
                "message": "5 feedback entries deleted"
            }
        }


class AdminFeedbackUpdateRequest(BaseModel):
    """Request schema for admin feedback update."""
    status: Optional[str] = Field(None, description="Feedback status")
    category: Optional[str] = Field(None, description="Feedback category", max_length=50)

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved",
                "category": "bug"
            }
        }


class AdminFeedbackDetailResponse(BaseModel):
    """Response schema for admin feedback detail operations."""
    success: bool = Field(True, description="Always true for successful responses")
    data: FeedbackEntity = Field(..., description="Feedback data")
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "id": 1,
                    "user_id": "uuid",
                    "category": "general",
                    "message": "Feedback text",
                    "satisfaction": 5,
                    "recommendation": 4,
                    "status": "resolved",
                    "submitted_at": "2025-10-01T10:30:00Z"
                },
                "message": "Status updated successfully"
            }
        }


class FeedbackCategoryStats(BaseModel):
    """Statistics by category."""
    category: str = Field(..., description="Category name")
    count: int = Field(..., description="Number of feedback entries")


class AdminFeedbackStats(BaseModel):
    """Feedback statistics."""
    total: int = Field(..., description="Total feedback count")
    open: int = Field(..., description="Open feedback count")
    resolved: int = Field(..., description="Resolved feedback count")
    avg_satisfaction: float = Field(..., description="Average satisfaction rating", alias="average_satisfaction")
    avg_recommendation: float = Field(..., description="Average recommendation rating", alias="average_recommendation")
    by_category: Dict[str, int] = Field(..., description="Feedback count by category")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "total": 1000,
                "open": 750,
                "resolved": 250,
                "avg_satisfaction": 4.2,
                "avg_recommendation": 4.5,
                "by_category": {
                    "general": 500,
                    "bug": 200,
                    "feature": 300
                }
            }
        }


class AdminFeedbackStatsResponse(BaseModel):
    """Response schema for feedback statistics."""
    success: bool = Field(True, description="Always true for successful responses")
    stats: AdminFeedbackStats = Field(..., description="Feedback statistics")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "stats": {
                    "total": 1000,
                    "open": 750,
                    "resolved": 250,
                    "avg_satisfaction": 4.2,
                    "avg_recommendation": 4.5,
                    "by_category": {
                        "general": 500,
                        "bug": 200
                    }
                }
            }
        }


class AdminDeleteResponse(BaseModel):
    """Response schema for delete operations."""
    success: bool = Field(True, description="Always true for successful responses")
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Feedback deleted successfully"
            }
        }


class AdminFeedbackExportRequest(BaseModel):
    """Request schema for feedback export."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(30, ge=1, le=100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field("message", description="Column to search in: message or id")
    status: Optional[str] = Field("all", description="Filter by status: open, resolved, or all")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("submitted_at", description="Column to sort by")
    sort_order: str = Field("desc", description="Sort order: asc or desc")

    class Config:
        json_schema_extra = {
            "example": {
                "page": 1,
                "page_size": 30,
                "search": "bug",
                "search_column": "message",
                "status": "open",
                "date_from": "2025-01-01",
                "date_to": "2025-12-31",
                "sort_by": "submitted_at",
                "sort_order": "desc"
            }
        }


class AdminFeedbackExportResponse(BaseModel):
    """Response schema for feedback export."""
    success: bool = Field(True, description="Always true for successful responses")
    download_url: str = Field(..., description="URL to download the exported file")
    filename: str = Field(..., description="Name of the exported file")
    expires_at: str = Field(..., description="ISO timestamp when the download link expires")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "download_url": "/exports/feedback_20250102_123456.csv",
                "filename": "feedback_20250102_123456.csv",
                "expires_at": "2025-01-03T12:34:56Z"
            }
        }

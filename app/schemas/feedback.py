"""
Feedback Schemas
================

This module contains Pydantic schemas for feedback endpoints,
including request and response models for feedback operations.

Author: AI Assistant
Date: December 2024
"""

from typing import Optional
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
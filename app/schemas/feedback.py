"""
Feedback Schemas
================

This module contains Pydantic schemas for feedback and contact form endpoints,
including request and response models for feedback and contact operations.

Author: AI Assistant
Date: December 2024
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, validator, EmailStr
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


class ContactRequest(BaseModel):
    """Request schema for contact form submission."""
    name: str = Field(..., description="Contact person's name", min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Contact person's email address")
    message: str = Field(..., description="Contact message", min_length=1, max_length=2000)
    subject: Optional[str] = Field(None, description="Optional subject line", max_length=150)
    phone: Optional[str] = Field(None, description="Optional phone number", max_length=20)
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")
    formType: Literal["contact"] = Field("contact", description="Form type identifier")

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None:
            # Basic phone validation - remove spaces, dashes, parentheses, and plus signs
            cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('+', '')
            if not cleaned.isdigit() or len(cleaned) < 7 or len(cleaned) > 15:
                raise ValueError('Invalid phone number format')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "message": "I would like to know more about your services",
                "subject": "General Inquiry",
                "phone": "+1-555-123-4567",
                "formType": "contact"
            }
        }


class CombinedFeedbackRequest(BaseModel):
    """Combined request schema that can handle both feedback and contact forms."""
    # Feedback fields
    satisfaction: Optional[int] = Field(None, description="Satisfaction rating from 1-10", ge=1, le=10)
    recommendation: Optional[int] = Field(None, description="Recommendation rating from 1-10", ge=1, le=10)
    feedback: Optional[str] = Field(None, description="Optional feedback text", max_length=1000)
    category: Optional[str] = Field(None, description="Optional feedback category", max_length=50)
    
    # Contact fields
    name: Optional[str] = Field(None, description="Contact person's name", max_length=100)
    email: Optional[str] = Field(None, description="Contact person's email address")
    message: Optional[str] = Field(None, description="Contact message", max_length=2000)
    subject: Optional[str] = Field(None, description="Optional subject line", max_length=150)
    phone: Optional[str] = Field(None, description="Optional phone number", max_length=20)
    
    # Common fields
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")
    formType: Optional[str] = Field(None, description="Form type identifier ('contact' for contact forms)")

    @validator('email')
    def validate_email_format(cls, v):
        if v is not None and '@' not in v:
            raise ValueError('Invalid email format')
        return v

    def __init__(self, **data):
        super().__init__(**data)
        # Validate based on form type
        if self.formType == "contact":
            if not self.name:
                raise ValueError("Name is required for contact forms")
            if not self.email:
                raise ValueError("Email is required for contact forms")
            if not self.message:
                raise ValueError("Message is required for contact forms")
        else:
            # Default to feedback form validation
            if self.satisfaction is None:
                raise ValueError("Satisfaction rating is required for feedback")
            if self.recommendation is None:
                raise ValueError("Recommendation rating is required for feedback")

    class Config:
        json_schema_extra = {
            "example": {
                "satisfaction": 8,
                "recommendation": 9,
                "feedback": "Great service!",
                "formType": "feedback"
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


class ContactResponse(BaseModel):
    """Response schema for contact form submission."""
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Contact form submitted successfully and saved to database."
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


class ContactSuccessResponse(BaseModel):
    """Success response wrapper for contact form submission."""
    success: bool = Field(True, description="Always true for successful responses")
    data: ContactResponse = Field(..., description="Contact form submission result")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Contact form submitted successfully and saved to database."
                }
            }
        }


class FeedbackErrorResponse(BaseModel):
    """Error response schema for feedback/contact operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Ratings must be between 1 and 10"
            }
        }


# Database entity schemas (for service layer)
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


class ContactEntity(BaseModel):
    """Schema for contact database entity."""
    id: Optional[int] = Field(None, description="Contact record ID")
    user_id: Optional[str] = Field(None, description="User ID")
    name: Optional[str] = Field(None, description="Contact name")
    email: Optional[str] = Field(None, description="Contact email")
    subject: Optional[str] = Field(None, description="Contact subject")
    phone: Optional[str] = Field(None, description="Contact phone")
    message: Optional[str] = Field(None, description="Contact message")
    status: StatusEnum = Field(StatusEnum.OPEN, description="Contact status")
    submitted_at: Optional[str] = Field(None, description="Submission timestamp")


class FeedbackUpdateRequest(BaseModel):
    """Request schema for updating feedback status."""
    status: StatusEnum = Field(..., description="New status for the feedback")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        }


class ContactUpdateRequest(BaseModel):
    """Request schema for updating contact status."""
    status: StatusEnum = Field(..., description="New status for the contact")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        } 
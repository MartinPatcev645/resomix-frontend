"""
Contact Schemas
===============

This module contains Pydantic schemas for contact form endpoints,
including request and response models for contact operations.

Author: AI Assistant
Date: December 2024
"""

from typing import Optional
from pydantic import BaseModel, Field, validator, EmailStr
from app.schemas.common import StatusEnum


class ContactRequest(BaseModel):
    """Request schema for contact form submission."""
    name: str = Field(..., description="Contact person's name", min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Contact person's email address")
    message: str = Field(..., description="Contact message", min_length=1, max_length=2000)
    subject: Optional[str] = Field(None, description="Optional subject line", max_length=150)
    phone: Optional[str] = Field(None, description="Optional phone number", max_length=20)
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")

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
                "phone": "+1-555-123-4567"
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


class ContactErrorResponse(BaseModel):
    """Error response schema for contact operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Name and email are required"
            }
        }


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

    class Config:
        from_attributes = True


class ContactUpdateRequest(BaseModel):
    """Request schema for updating contact status."""
    status: StatusEnum = Field(..., description="New status for the contact")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        } 
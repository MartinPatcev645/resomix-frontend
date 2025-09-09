"""
Waitlist Schemas
================

This module contains Pydantic schemas for waitlist functionality.
It defines request and response models for waitlist operations including
email submission, status management, and validation with comprehensive error handling.

Provides schemas for waitlist management, email validation, status tracking,
and administrative operations for user waitlist management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field, validator, EmailStr
from datetime import datetime
from app.schemas.common import APIResponse, ErrorResponse


class WaitlistRequest(BaseModel):
    """Request schema for waitlist email submission."""
    email: EmailStr = Field(..., description="Email address to add to waitlist")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class WaitlistResponse(BaseModel):
    """Response schema for waitlist operations."""
    id: int = Field(..., description="Waitlist entry ID")
    email: str = Field(..., description="Email address")
    status: str = Field(..., description="Waitlist status (pending, approved, rejected)")
    created_at: datetime = Field(..., description="When the entry was created")
    updated_at: datetime = Field(..., description="When the entry was last updated")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "user@example.com",
                "status": "pending",
                "created_at": "2025-01-11T10:30:00",
                "updated_at": "2025-01-11T10:30:00"
            }
        }


class WaitlistSuccessResponse(APIResponse):
    """Success response for waitlist operations."""
    data: WaitlistResponse = Field(..., description="Waitlist entry data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "id": 1,
                    "email": "user@example.com",
                    "status": "pending",
                    "created_at": "2025-01-11T10:30:00",
                    "updated_at": "2025-01-11T10:30:00"
                }
            }
        }


class WaitlistErrorResponse(ErrorResponse):
    """Error response for waitlist operations."""
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Email already exists in waitlist"
            }
        }

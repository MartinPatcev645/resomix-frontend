"""
Preview Schemas
===============

This module contains Pydantic schemas for preview-related endpoints.
It defines request and response models for preview download URL generation
with comprehensive validation and error handling.

Provides schemas for preview download requests, URL responses,
and integration with the ResomiX server for preview file access.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field, validator
from app.schemas.common import ALLOWED_TOP_SK_VALUES


class PreviewDownloadRequest(BaseModel):
    """Request schema for preview download URL generation."""
    track_id: str = Field(..., description="The track ID to generate preview URL for", min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": "67addcb39387d00fbdc3acdf"
            }
        }


class PreviewDownloadResponse(BaseModel):
    """Response schema for preview download URL generation."""
    download_url: list = Field(..., description="Generated preview URL for the audio file (currently empty list)")

    class Config:
        json_schema_extra = {
            "example": {
                "download_url": []
            }
        }


class PreviewDownloadSuccessResponse(BaseModel):
    """Success response wrapper for preview download URL generation."""
    success: bool = Field(True, description="Always true for successful responses")
    data: PreviewDownloadResponse = Field(..., description="Preview download URL data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "download_url": []
                }
            }
        }


class PreviewErrorResponse(BaseModel):
    """Error response schema for preview operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Track not found or access denied"
            }
        }


# Internal schemas for service layer
class ResomixServerRequest(BaseModel):
    """Internal schema for ResomiX server requests."""
    track_uuid: str = Field(..., description="Track UUID for ResomiX server")


class ResomixServerResponse(BaseModel):
    """Internal schema for ResomiX server responses."""
    status: str = Field(..., description="Response status from ResomiX server")
    message: Optional[str] = Field(None, description="Response message")
    download_url: Optional[str] = Field(None, description="Generated download URL")


class PreviewConfiguration(BaseModel):
    """Configuration schema for preview operations."""
    resomix_server_url: Optional[str] = Field(None, description="URL of the ResomiX server")
    download_timeout: int = Field(default=30, description="Download request timeout in seconds")
    max_retries: int = Field(default=3, description="Maximum number of retry attempts") 
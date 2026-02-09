"""
Preview Schemas
===============

This module contains Pydantic schemas for preview-related endpoints.
It defines request and response models for preview download URL generation
with comprehensive validation and error handling.

Provides schemas for preview download requests, URL responses,
and integration with the Resomix server for preview file access.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field


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
    download_url: str = Field(
        description="Signed URL for preview download",
        example="https://media.resomix.com/signed-audio/?uuid=abc123&xpi=encrypted_expiry&token=hmac_signature"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "download_url": "https://media.resomix.com/signed-audio/?uuid=67addcb39387d00fbdc3acdf&xpi=gAAAAABh...&token=abc123..."
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
                    "download_url": "https://media.resomix.com/signed-audio/?uuid=67addcb39387d00fbdc3acdf&xpi=gAAAAABh...&token=abc123..."
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
    """Internal schema for Resomix server requests."""
    track_uuid: str = Field(..., description="Track UUID for Resomix server")


class ResomixServerResponse(BaseModel):
    """Internal schema for Resomix server responses."""
    status: str = Field(..., description="Response status from Resomix server")
    message: Optional[str] = Field(None, description="Response message")
    download_url: Optional[str] = Field(None, description="Generated download URL")

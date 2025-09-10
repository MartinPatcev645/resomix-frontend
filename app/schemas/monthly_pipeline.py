"""
Monthly Pipeline API Schemas
============================

This module contains Pydantic schemas for monthly pipeline track functionality.
It defines request and response models for monthly pipeline track processing,
with comprehensive validation and error handling.

Provides schemas for monthly pipeline track upload, processing results,
and standardized response formatting.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field


class MonthlyPipelineTrackRequest(BaseModel):
    """Request schema for monthly pipeline track endpoint."""
    path: str = Field(..., description="File path for the track", min_length=1, max_length=1000)

    class Config:
        json_schema_extra = {
            "example": {
                "path": "/some/path/to/track.mp3"
            }
        }


class MonthlyPipelineTrackResponse(BaseModel):
    """Response schema for monthly pipeline track endpoint."""
    message: str = Field(..., description="Success message")
    track_uuid: str = Field(..., description="UUID of the processed track")
    path: str = Field(..., description="File path that was processed")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Track processed successfully and stored in database",
                "track_uuid": "507f1f77bcf86cd799439012", 
                "path": "/some/path/to/track.mp3"
            }
        }


class MonthlyPipelineTrackSuccessResponse(BaseModel):
    """Success response wrapper for monthly pipeline track."""
    success: bool = Field(True, description="Always true for successful responses")
    data: MonthlyPipelineTrackResponse = Field(..., description="Monthly pipeline track processing results")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Track processed successfully and stored in database",
                    "track_uuid": "507f1f77bcf86cd799439012",
                    "path": "/some/path/to/track.mp3"
                }
            }
        }


class MonthlyPipelineTrackErrorResponse(BaseModel):
    """Error response schema for monthly pipeline track operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Failed to generate embedding preview: similarity server error"
            }
        }


class MonthlyPipelineUpdateEmbeddingsSuccessResponse(BaseModel):
    """Success response for update_embeddings operation."""
    success: bool = Field(True, description="Always true for successful responses")
    data: dict = Field(..., description="Arbitrary response payload from similarity server")


class MonthlyPipelineUpdateEmbeddingsErrorResponse(BaseModel):
    """Error response schema for update_embeddings operation."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")

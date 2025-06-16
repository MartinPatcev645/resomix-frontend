"""
Track Upload Schemas
====================

This module contains Pydantic schemas for track upload functionality.
It defines request and response models for track upload, file validation,
and database insertion with comprehensive validation and error handling.

Provides schemas for track upload requests, upload responses,
metadata handling, and detailed track information processing.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.common import FileInfo


class TrackUploadMetadata(BaseModel):
    """Schema for track metadata in upload responses."""
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist name(s)")
    album: Optional[str] = Field(None, description="Album name")
    genre: str = Field(..., description="Genre")
    label: Optional[str] = Field(None, description="Record label")
    year: Optional[str] = Field(None, description="Release year")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Amazing Song",
                "artist": "Fantastic Artist",
                "album": "Great Album",
                "genre": "Electronic",
                "label": "Cool Records",
                "year": "2023"
            }
        }


class TrackUploadResponse(BaseModel):
    """Response schema for successful track upload."""
    filename: str = Field(..., description="Sanitized filename of the uploaded file")
    track_uuid: str = Field(..., description="Generated UUID for the track")
    track_id: int = Field(..., description="Database ID of the inserted track")
    file_size: int = Field(..., description="File size in bytes")
    metadata: TrackUploadMetadata = Field(..., description="Extracted and processed metadata")
    file_path: str = Field(..., description="File path identifier")
    preview_path: str = Field(..., description="Preview file path")

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "amazing_song.mp3",
                "track_uuid": "67ad9cec799206f8d64acd08",
                "track_id": 12345,
                "file_size": 5242880,
                "metadata": {
                    "title": "Amazing Song",
                    "artist": "Fantastic Artist",
                    "album": "Great Album",
                    "genre": "Electronic",
                    "label": "Cool Records",
                    "year": "2023"
                },
                "file_path": "67ad9cec799206f8d64acd08",
                "preview_path": "/mnt/data/UPLOADS/67ad9cec799206f8d64acd08.mp3"
            }
        }


class TrackUploadSuccessResponse(BaseModel):
    """Schema for successful track upload API response."""
    success: bool = Field(True, description="Success status")
    message: str = Field(..., description="Success message")
    data: TrackUploadResponse = Field(..., description="Upload response data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Track uploaded successfully and added to database",
                "data": {
                    "filename": "amazing_song.mp3",
                    "track_uuid": "67ad9cec799206f8d64acd08",
                    "track_id": 12345,
                    "file_size": 5242880,
                    "metadata": {
                        "title": "Amazing Song",
                        "artist": "Fantastic Artist",
                        "album": "Great Album",
                        "genre": "Electronic",
                        "label": "Cool Records",
                        "year": "2023"
                    },
                    "file_path": "67ad9cec799206f8d64acd08",
                    "preview_path": "/mnt/data/UPLOADS/67ad9cec799206f8d64acd08.mp3"
                }
            }
        }


class TrackUploadErrorResponse(BaseModel):
    """Schema for track upload error responses."""
    success: bool = Field(False, description="Success status")
    error: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Unsupported file format: .txt"
            }
        } 
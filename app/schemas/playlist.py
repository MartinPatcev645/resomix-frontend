"""
Playlist Schemas
================

This module contains Pydantic schemas for playlist-related operations.
It defines request and response models for playlist management, track organization,
and playlist information processing with comprehensive validation and error handling.

Provides schemas for playlist creation, updates, track management,
and playlist relationship handling with users and tracks.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List
from pydantic import BaseModel, Field, validator
from app.schemas.similarity import SimilarityByIdResponse
import re


# Request Schemas
class PlaylistRenameRequest(BaseModel):
    """Request schema for renaming a playlist."""
    playlist_id: str = Field(..., description="Playlist UUID")
    new_name: str = Field(..., description="New playlist name", min_length=1, max_length=100)

    @validator('new_name')
    def validate_new_name(cls, v):
        """Validate playlist name to allow only alphanumeric characters and basic special characters."""
        if not v or not v.strip():
            raise ValueError('Playlist name cannot be empty or whitespace only')
        
        # Allow alphanumeric characters, spaces, hyphens, underscores, and basic punctuation
        # Pattern: letters, numbers, spaces, hyphens, underscores, periods, apostrophes, parentheses
        allowed_pattern = r"^[a-zA-Z0-9\s\-_.'()]+$"
        
        if not re.match(allowed_pattern, v.strip()):
            raise ValueError('Playlist name can only contain letters, numbers, spaces, hyphens, underscores, periods, apostrophes, and parentheses')
        
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
                "new_name": "My Awesome Playlist"
            }
        }


class PlaylistVisibilityRequest(BaseModel):
    """Request schema for changing playlist visibility."""
    playlist_id: str = Field(..., description="Playlist UUID")
    is_public: bool = Field(..., description="Whether the playlist should be public")

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
                "is_public": True
            }
        }


class PlaylistByIdRequest(BaseModel):
    """Request schema for getting playlist by ID."""
    playlist_id: str = Field(..., description="Playlist UUID")

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


# Response Schemas
class PlaylistOperationResponse(BaseModel):
    """Response schema for playlist operations (rename, visibility change)."""
    success: bool = Field(..., description="Operation success status")
    message: str = Field(..., description="Operation result message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Playlist renamed successfully"
            }
        }


class PlaylistErrorResponse(BaseModel):
    """Error response schema for playlist operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Playlist not found"
            }
        }


class PlaylistSimilarityResponse(BaseModel):
    """Response schema for playlist similarity data."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityByIdResponse = Field(..., description="Playlist similarity data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "queried_track": {
                        "rank": 0,
                        "score": 1.0,
                        "id": "67addcb39387d00fbdc3acdf",
                        "label": "Global Underground",
                        "duration": 491,
                        "artist": "Oxia",
                        "title": "Whole Life (Original Mix)",
                        "year": 2010
                    },
                    "similar_tracks": [
                        {
                            "rank": 1,
                            "score": 0.8956789,
                            "id": "67addcb39387d00fbdc3ace0",
                            "label": "Anjunabeats",
                            "duration": 456,
                            "artist": "Above & Beyond",
                            "title": "Sun & Moon",
                            "year": 2011
                        }
                    ],
                    "playlist": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Playlist"
                    }
                }
            }
        }

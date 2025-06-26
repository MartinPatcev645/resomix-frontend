"""
Rating Schemas
==============

This module contains Pydantic schemas for rating and review operations.
It defines request and response models for track and playlist ratings,
user feedback processing with comprehensive validation and error handling.

Provides schemas for rating submissions, rating aggregation, review management,
and user preference tracking for tracks and playlists.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime


# Request Schemas
class TrackRatingRequest(BaseModel):
    """Request schema for rating a track."""
    track_id: str = Field(..., description="Track ID to rate (UUID or ObjectId format)", min_length=24)
    playlist_id: str = Field(..., description="Playlist ID (UUID) from which the rating is being submitted", min_length=36, max_length=36)
    rating: int = Field(..., description="Rating value: 0 (not similar) or 1 (similar)")
    user_id: Optional[str] = Field(None, description="User ID (optional for anonymous ratings)", max_length=36)

    @validator('track_id')
    def validate_track_id(cls, v):
        """Validate track_id is a valid UUID or ObjectId format."""
        # Check if it's a valid UUID format (36 chars with hyphens)
        if len(v) == 36 and v.count('-') == 4:
            try:
                import uuid
                uuid.UUID(v)
                return v
            except ValueError:
                pass
        
        # Check if it's a valid ObjectId format (24 hex characters)
        if len(v) == 24:
            try:
                int(v, 16)  # Check if it's valid hexadecimal
                return v
            except ValueError:
                pass
        
        # Check for other common ID formats (allow alphanumeric strings 12-50 chars)
        if 12 <= len(v) <= 50 and v.replace('-', '').replace('_', '').isalnum():
            return v
            
        raise ValueError('Track ID must be a valid UUID, ObjectId, or alphanumeric identifier')

    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate playlist_id is a valid UUID format."""
        if len(v) == 36 and v.count('-') == 4:
            try:
                import uuid
                uuid.UUID(v)
                return v
            except ValueError:
                pass
        raise ValueError('Playlist ID must be a valid UUID format')

    @validator('rating')
    def validate_track_rating(cls, v):
        """Validate track rating is 0 or 1."""
        if v not in [0, 1]:
            raise ValueError('Track rating must be 0 (not similar) or 1 (similar)')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": "67b003e3c0f27a0796ede831",
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
                "rating": 1,
                "user_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class PlaylistRatingRequest(BaseModel):
    """Request schema for rating a playlist."""
    playlist_id: str = Field(..., description="Playlist ID to rate (UUID or ObjectId format)", min_length=24)
    rating: int = Field(..., description="Rating value: 0-3 stars")
    message: Optional[str] = Field(None, description="Optional message/feedback about the playlist", max_length=1000)
    user_id: Optional[str] = Field(None, description="User ID (optional for anonymous ratings)", max_length=36)

    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate playlist_id is a valid UUID or ObjectId format."""
        # Check if it's a valid UUID format (36 chars with hyphens)
        if len(v) == 36 and v.count('-') == 4:
            try:
                import uuid
                uuid.UUID(v)
                return v
            except ValueError:
                pass
        
        # Check if it's a valid ObjectId format (24 hex characters)
        if len(v) == 24:
            try:
                int(v, 16)  # Check if it's valid hexadecimal
                return v
            except ValueError:
                pass
        
        # Check for other common ID formats (allow alphanumeric strings 12-50 chars)
        if 12 <= len(v) <= 50 and v.replace('-', '').replace('_', '').isalnum():
            return v
            
        raise ValueError('Playlist ID must be a valid UUID, ObjectId, or alphanumeric identifier')

    @validator('rating')
    def validate_playlist_rating(cls, v):
        """Validate playlist rating is between 0 and 3."""
        if v not in [0, 1, 2, 3]:
            raise ValueError('Playlist rating must be between 0 and 3 stars')
        return v

    @validator('message')
    def validate_message(cls, v):
        """Validate message length and content."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None  # Convert empty string to None
            if len(v) > 1000:
                raise ValueError('Message must not exceed 1000 characters')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "67b003e3c0f27a0796ede831",
                "rating": 3,
                "message": "Great playlist! Love the track selection and flow.",
                "user_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class GetRatingRequest(BaseModel):
    """Request schema for getting a rating."""
    user_id: Optional[str] = Field(None, description="User ID (optional for anonymous ratings)", max_length=36)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


# Response Schemas
class RatingResponse(BaseModel):
    """Response schema for rating operations."""
    id: int = Field(..., description="Rating ID")
    track_id: Optional[str] = Field(None, description="Track UUID (for track ratings)")
    playlist_id: Optional[str] = Field(None, description="Playlist UUID (for playlist ratings)")
    user_id: Optional[str] = Field(None, description="User ID")
    rating: int = Field(..., description="Rating value")
    message: Optional[str] = Field(None, description="User message/feedback (for playlist ratings)")
    rated_at: datetime = Field(..., description="Rating timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "track_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "playlist_id": None,
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "rating": 1,
                "message": None,
                "rated_at": "2025-01-13T10:30:00Z"
            }
        }


class RatingOperationResponse(BaseModel):
    """Response schema for rating operations (create, update, delete)."""
    success: bool = Field(..., description="Operation success status")
    message: str = Field(..., description="Operation result message")
    data: Optional[RatingResponse] = Field(None, description="Rating data (for create/update operations)")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Playlist rated successfully",
                "data": {
                    "id": 1,
                    "track_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "playlist_id": None,
                    "user_id": "550e8400-e29b-41d4-a716-446655440000",
                    "rating": 1,
                    "message": None,
                    "rated_at": "2025-01-13T10:30:00Z"
                }
            }
        }


class RatingStatsResponse(BaseModel):
    """Response schema for rating statistics."""
    total_ratings: int = Field(..., description="Total number of ratings")
    average_rating: Optional[float] = Field(None, description="Average rating (for playlists)")
    rating_distribution: dict = Field(..., description="Distribution of ratings by value")

    class Config:
        json_schema_extra = {
            "example": {
                "total_ratings": 150,
                "average_rating": 2.4,
                "rating_distribution": {
                    "0": 10,
                    "1": 25,
                    "2": 60,
                    "3": 55
                }
            }
        }


class RatingErrorResponse(BaseModel):
    """Error response schema for rating operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Track not found"
            }
        }

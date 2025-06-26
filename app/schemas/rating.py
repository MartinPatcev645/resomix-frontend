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
    track_id: int = Field(..., description="Track ID to rate", gt=0)
    rating: int = Field(..., description="Rating value: 0 (not similar) or 1 (similar)")
    user_id: Optional[str] = Field(None, description="User ID (optional for anonymous ratings)", max_length=36)

    @validator('rating')
    def validate_track_rating(cls, v):
        """Validate track rating is 0 or 1."""
        if v not in [0, 1]:
            raise ValueError('Track rating must be 0 (not similar) or 1 (similar)')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": 123,
                "rating": 1,
                "user_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class PlaylistRatingRequest(BaseModel):
    """Request schema for rating a playlist."""
    playlist_id: str = Field(..., description="Playlist UUID to rate", min_length=36, max_length=36)
    rating: int = Field(..., description="Rating value: 0-3 stars")
    message: Optional[str] = Field(None, description="Optional message/feedback about the playlist", max_length=1000)
    user_id: Optional[str] = Field(None, description="User ID (optional for anonymous ratings)", max_length=36)

    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate playlist_id is a valid UUID format."""
        try:
            # Try to parse as UUID to validate format
            import uuid
            uuid.UUID(v)
            return v
        except ValueError:
            raise ValueError('Playlist ID must be a valid UUID')

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
                "playlist_id": "d8aa3a8d-1423-4ec1-8af9-e0477c801879",
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
    track_id: Optional[int] = Field(None, description="Track ID (for track ratings)")
    playlist_id: Optional[str] = Field(None, description="Playlist UUID (for playlist ratings)")
    user_id: Optional[str] = Field(None, description="User ID")
    rating: int = Field(..., description="Rating value")
    message: Optional[str] = Field(None, description="User message/feedback (for playlist ratings)")
    rated_at: datetime = Field(..., description="Rating timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "track_id": None,
                "playlist_id": "d8aa3a8d-1423-4ec1-8af9-e0477c801879",
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "rating": 3,
                "message": "Great playlist! Love the track selection and flow.",
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
                    "track_id": None,
                    "playlist_id": "d8aa3a8d-1423-4ec1-8af9-e0477c801879",
                    "user_id": "550e8400-e29b-41d4-a716-446655440000",
                    "rating": 3,
                    "message": "Great playlist! Love the track selection and flow.",
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

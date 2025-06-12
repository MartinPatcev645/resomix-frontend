"""
Similarity Schemas
==================

This module contains Pydantic schemas for similarity calculation endpoints,
including request and response models for audio similarity operations.

Author: AI Assistant
Date: December 2024
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import TopSkRequest, ALLOWED_TOP_SK_VALUES


class SimilarityByIdRequest(BaseModel):
    """Request schema for similarity calculation by track ID."""
    track_id: str = Field(..., description="The MongoDB ID of the track to find similar tracks for", min_length=1)
    top_sk: Optional[int] = Field(
        None, 
        description="Number of similar tracks to return (10, 20, 50, or 100)",
        ge=1,
        le=100
    )

    @validator('top_sk')
    def validate_top_sk(cls, v):
        if v is not None and v not in ALLOWED_TOP_SK_VALUES:
            raise ValueError(f'top_sk must be one of {ALLOWED_TOP_SK_VALUES}')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": "507f1f77bcf86cd799439011",
                "top_sk": 20
            }
        }


class SimilarTrackResult(BaseModel):
    """Schema for individual similar track result."""
    rank: int = Field(..., description="Rank of similarity (1 is most similar)")
    score: float = Field(..., description="Similarity score (higher means more similar)")
    id: str = Field(..., description="Track database ID")
    filename: str = Field(..., description="Track filename")
    album: Optional[str] = Field(None, description="Album name")
    duration: Optional[int] = Field(None, description="Track duration in seconds")
    artist: Optional[str] = Field(None, description="Artist name")

    class Config:
        json_schema_extra = {
            "example": {
                "rank": 1,
                "score": 0.95,
                "id": "507f1f77bcf86cd799439012",
                "filename": "similar_track.mp3",
                "album": "Great Album",
                "duration": 180,
                "artist": "Amazing Artist"
            }
        }


class QueriedTrackInfo(BaseModel):
    """Schema for the track that was queried for similarity."""
    id: str = Field(..., description="Track database ID")
    filename: str = Field(..., description="Track filename")
    album: Optional[str] = Field(None, description="Album name")
    duration: Optional[int] = Field(None, description="Track duration in seconds")
    artist: Optional[str] = Field(None, description="Artist name")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "filename": "query_track.mp3",
                "album": "Original Album",
                "duration": 210,
                "artist": "Original Artist"
            }
        }


class SimilarityUploadResponse(BaseModel):
    """Response schema for similarity calculation by upload."""
    original_filename: str = Field(..., description="Original filename of uploaded file")
    duration: int = Field(..., description="Duration of uploaded audio in seconds")
    similar_tracks: List[SimilarTrackResult] = Field(..., description="List of similar tracks")

    class Config:
        json_schema_extra = {
            "example": {
                "original_filename": "uploaded_track.mp3",
                "duration": 195,
                "similar_tracks": [
                    {
                        "rank": 1,
                        "score": 0.95,
                        "id": "507f1f77bcf86cd799439012",
                        "filename": "similar_track.mp3",
                        "album": "Great Album",
                        "duration": 180,
                        "artist": "Amazing Artist"
                    }
                ]
            }
        }


class SimilarityByIdResponse(BaseModel):
    """Response schema for similarity calculation by track ID."""
    queried_track: Optional[QueriedTrackInfo] = Field(None, description="Information about the queried track")
    similar_tracks: List[SimilarTrackResult] = Field(..., description="List of similar tracks")
    message: Optional[str] = Field(None, description="Additional message (e.g., when track not found in similarity server)")

    class Config:
        json_schema_extra = {
            "example": {
                "queried_track": {
                    "id": "507f1f77bcf86cd799439011",
                    "filename": "query_track.mp3",
                    "album": "Original Album",
                    "duration": 210,
                    "artist": "Original Artist"
                },
                "similar_tracks": [
                    {
                        "rank": 1,
                        "score": 0.95,
                        "id": "507f1f77bcf86cd799439012",
                        "filename": "similar_track.mp3",
                        "album": "Great Album",
                        "duration": 180,
                        "artist": "Amazing Artist"
                    }
                ]
            }
        }


class SimilarityErrorResponse(BaseModel):
    """Error response schema for similarity operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Similarity processing failed"
            }
        }


class SimilarityUploadSuccessResponse(BaseModel):
    """Success response wrapper for similarity upload."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityUploadResponse = Field(..., description="Similarity calculation results")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "original_filename": "uploaded_track.mp3",
                    "duration": 195,
                    "similar_tracks": [
                        {
                            "rank": 1,
                            "score": 0.95,
                            "id": "507f1f77bcf86cd799439012",
                            "filename": "similar_track.mp3",
                            "album": "Great Album",
                            "duration": 180,
                            "artist": "Amazing Artist"
                        }
                    ]
                }
            }
        }


class SimilarityByIdSuccessResponse(BaseModel):
    """Success response wrapper for similarity by ID."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityByIdResponse = Field(..., description="Similarity calculation results")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "queried_track": {
                        "id": "507f1f77bcf86cd799439011",
                        "filename": "query_track.mp3",
                        "album": "Original Album",
                        "duration": 210,
                        "artist": "Original Artist"
                    },
                    "similar_tracks": [
                        {
                            "rank": 1,
                            "score": 0.95,
                            "id": "507f1f77bcf86cd799439012",
                            "filename": "similar_track.mp3",
                            "album": "Great Album",
                            "duration": 180,
                            "artist": "Amazing Artist"
                        }
                    ]
                }
            }
        }


# Internal schemas for service layer
class SimilarityServerRequest(BaseModel):
    """Internal schema for similarity server requests."""
    top_k: int = Field(..., description="Number of results to request from similarity server")
    file_path: Optional[str] = Field(None, description="File path for path-based similarity")


class SimilarityServerResponse(BaseModel):
    """Internal schema for similarity server responses."""
    status: str = Field(..., description="Response status from similarity server")
    message: Optional[str] = Field(None, description="Response message")
    results: List[Dict[str, Any]] = Field(default_factory=list, description="Raw similarity results")


class SimilarityConfiguration(BaseModel):
    """Configuration schema for similarity calculations."""
    allowed_top_sk_values: List[int] = Field(default=ALLOWED_TOP_SK_VALUES, description="Allowed top_sk values")
    default_top_sk: int = Field(default=20, description="Default top_sk value")
    duplication_thresholds: List[int] = Field(default=[2, 2, 4, 5], description="Duplication thresholds for each top_sk")
    similarity_server_url: Optional[str] = Field(None, description="URL of the similarity microservice")
    path_prefix_to_remove: str = Field(default="/home/usman/data/", description="Path prefix to remove from server responses") 
"""
Similarity API Schemas
======================

This module contains Pydantic schemas for audio similarity functionality.
It defines request and response models for similarity calculations,
track information, and result formatting with comprehensive validation.

Provides schemas for similarity by upload, similarity by ID,
track results, error handling, and response standardization.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import TopSkRequest, ALLOWED_TOP_SK_VALUES


class SimilarityByIdRequest(BaseModel):
    """Request schema for similarity calculation by track ID."""
    track_id: str = Field(..., description="UUID of the track to find similar tracks for")
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
    rank: int = Field(..., description="Similarity rank (1 = most similar)")
    score: float = Field(..., description="Similarity score (0.0 to 1.0)")
    id: str = Field(..., description="Track UUID")
    label: Optional[str] = Field(None, description="Record label")
    duration: Optional[int] = Field(None, description="Track duration in seconds")
    artist: str = Field(..., description="Artist name")
    title: str = Field(..., description="Track title")
    year: Optional[int] = Field(None, description="Release year")

    class Config:
        json_schema_extra = {
            "example": {
                "rank": 1,
                "score": 0.9899008274078369,
                "id": "67addcb39387d00fbdc3acdf",
                "label": "Global Underground",
                "duration": 491,
                "artist": "Oxia",
                "title": "Whole Life (Original Mix)",
                "year": 2010
            }
        }


class QueriedTrackInfo(BaseModel):
    """Schema for the track that was queried for similarity."""
    id: str = Field(..., description="Track database ID")
    album: Optional[str] = Field(None, description="Album name")
    label: Optional[str] = Field(None, description="Label name")
    genre: Optional[str] = Field(None, description="Genre name")
    duration: Optional[int] = Field(None, description="Track duration in seconds")
    artist: Optional[str] = Field(None, description="Artist name")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "album": "Original Album",
                "label": "Global Underground",
                "genre": "Electronic",
                "duration": 210,
                "artist": "Original Artist"
            }
        }


class UploadedTrackInfo(BaseModel):
    """Schema for uploaded track information."""
    uuid: str = Field(..., description="Generated UUID for the uploaded track")
    track_id: int = Field(..., description="Database ID of the uploaded track")
    file_size: int = Field(..., description="File size in bytes")
    metadata: dict = Field(..., description="Extracted metadata")
    preview_path: str = Field(..., description="Preview file path")

    class Config:
        json_schema_extra = {
            "example": {
                "uuid": "67ad9cec799206f8d64acd08",
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
                "preview_path": "/mnt/data/UPLOADS/67ad9cec799206f8d64acd08.mp3"
            }
        }


class SimilarityUploadResponse(BaseModel):
    """Response schema for similarity calculation by upload."""
    queried_track: SimilarTrackResult = Field(..., description="Information about the uploaded (queried) track")
    similar_tracks: List[SimilarTrackResult] = Field(..., description="List of similar tracks")

    class Config:
        json_schema_extra = {
            "example": {
                "queried_track": {
                    "rank": 0,
                    "score": 1.0,
                    "id": "67ad9cec799206f8d64acd08",
                    "label": "User Upload",
                    "duration": 195,
                    "artist": "Amazing Artist",
                    "title": "Uploaded Track",
                    "year": 2023
                },
                "similar_tracks": [
                    {
                        "rank": 1,
                        "score": 0.9899008274078369,
                        "id": "67addcb39387d00fbdc3acdf",
                        "label": "Global Underground",
                        "duration": 491,
                        "artist": "Oxia",
                        "title": "Whole Life (Original Mix)",
                        "year": 2010
                    }
                ]
            }
        }


class SimilarityByIdResponse(BaseModel):
    """Response schema for similarity calculation by track ID."""
    query_track: SimilarTrackResult = Field(..., description="Information about the queried track")
    similar_tracks: List[SimilarTrackResult] = Field(..., description="List of similar tracks")

    class Config:
        json_schema_extra = {
            "example": {
                "query_track": {
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
                ]
            }
        }


class SimilarityErrorResponse(BaseModel):
    """Error response schema for similarity operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "File too large. Maximum size is 100MB."
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
                    "queried_track": {
                        "rank": 0,
                        "score": 1.0,
                        "id": "67ad9cec799206f8d64acd08",
                        "label": "User Upload",
                        "duration": 195,
                        "artist": "Amazing Artist",
                        "title": "Uploaded Track",
                        "year": 2023
                    },
                    "similar_tracks": [
                        {
                            "rank": 1,
                            "score": 0.9899008274078369,
                            "id": "67addcb39387d00fbdc3acdf",
                            "label": "Global Underground",
                            "duration": 491,
                            "artist": "Oxia",
                            "title": "Whole Life (Original Mix)",
                            "year": 2010
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
                    "query_track": {
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
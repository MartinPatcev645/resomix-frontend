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
from app.schemas.common import ALLOWED_TOP_SK_VALUES


class SimilarityByIdRequest(BaseModel):
    """Request schema for similarity calculation by track ID."""

    track_id: str = Field(
        ..., description="UUID of the track to find similar tracks for"
    )
    top_sk: Optional[int] = Field(
        None,
        description="Number of similar tracks to return (10, 20, 50, or 100)",
        ge=1,
        le=100,
    )
    engine: Optional[str] = Field(None, description="Similarity engine (E1-E6)")

    @validator("top_sk")
    def validate_top_sk(cls, v):
        if v is not None and v not in ALLOWED_TOP_SK_VALUES:
            raise ValueError(f"top_sk must be one of {ALLOWED_TOP_SK_VALUES}")
        return v

    @validator("engine")
    def validate_engine(cls, v):
        if v is None:
            return None
        if v not in ["E1", "E2", "E3", "E4", "E5", "E6"]:
            return None  # Return None if invalid instead of default, or raise error? User said "we will not pass anything... if we don't get any engine". So invalid -> None seems safe or just let it pass? Better to validate strict or None.
            # User said "anything we want to do with defaults etc we'll do there".
            # I will return None if invalid to avoid sending bad data.
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "track_id": "507f1f77bcf86cd799439011",
                "top_sk": 20,
                "engine": "E4",
            }
        }


class SimilarTrackResult(BaseModel):
    """Schema for individual similar track result."""

    rank: int = Field(..., description="Similarity rank (1 = most similar)")
    score: float = Field(..., description="Similarity score (0.0 to 1.0)")
    id: str = Field(..., description="Track UUID")
    label: Optional[str] = Field(None, description="Record label")
    duration: Optional[float] = Field(
        None, description="Track duration in seconds with decimal precision"
    )
    artist: str = Field(..., description="Artist name")
    title: str = Field(..., description="Track title")
    year: Optional[int] = Field(None, description="Release year")
    type: Optional[str] = Field(None, description="Track type (upload or internal)")

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
                "year": 2010,
            }
        }


class QueriedTrackInfo(BaseModel):
    """Schema for the track that was queried for similarity."""

    id: str = Field(..., description="Track database ID")
    album: Optional[str] = Field(None, description="Album name")
    label: Optional[str] = Field(None, description="Label name")
    genre: Optional[str] = Field(None, description="Genre name")
    duration: Optional[float] = Field(
        None, description="Track duration in seconds with decimal precision"
    )
    artist: Optional[str] = Field(None, description="Artist name")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "album": "Original Album",
                "label": "Global Underground",
                "genre": "Electronic",
                "duration": 210,
                "artist": "Original Artist",
            }
        }


class PlaylistInfo(BaseModel):
    """Schema for playlist information returned with similarity results."""

    id: str = Field(..., description="Playlist UUID (for external use)")
    uuid: str = Field(..., description="Playlist UUID (alias for id)")
    name: str = Field(..., description="Playlist name")
    is_public: bool = Field(..., description="Whether the playlist is public")
    seed_track_title: Optional[str] = Field(
        None, description="Title of the seed track if available"
    )
    seed_track_type: Optional[str] = Field(
        None,
        description="Type of the seed track: 'upload' (user-uploaded) or 'internal' (catalog)",
    )
    fork_id: str = Field(
        "",
        description="UUID of the original playlist if this is a fork, empty string if not a fork",
    )
    num_tracks: int = Field(0, description="Number of tracks in playlist_tracks")
    play_time: int = Field(
        0,
        description="Total play time in seconds (sum of track durations including seed track)",
    )
    created_at: Optional[str] = Field(
        None, description="Playlist creation timestamp (ISO format)"
    )
    is_favorite: bool = Field(
        False,
        description="Whether the playlist is in user's favorites (False if user not logged in)",
    )
    is_following: bool = Field(
        False,
        description="Whether the user is following the playlist (False if user not logged in)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "uuid": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Playlist",
                "is_public": False,
                "seed_track_title": "Whole Life (Original Mix)",
                "fork_id": "original-playlist-uuid",
                "num_tracks": 10,
                "play_time": 3600,
                "created_at": "2025-01-15T10:30:00",
                "is_favorite": False,
                "is_following": False,
            }
        }


class SimilarityUploadResponse(BaseModel):
    """Response schema for similarity calculation by upload."""

    queried_track: SimilarTrackResult = Field(
        ..., description="Information about the uploaded (queried) track"
    )
    similar_tracks: List[SimilarTrackResult] = Field(
        ..., description="List of similar tracks"
    )
    playlist: Optional[PlaylistInfo] = Field(
        None, description="Created playlist information"
    )

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
                    "year": 2023,
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
                        "year": 2010,
                    }
                ],
                "playlist": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Playlist",
                    "is_public": False,
                    "fork_id": "original-playlist-uuid",
                    "is_favorite": False,
                    "is_following": False,
                },
            }
        }


class SimilarityByIdResponse(BaseModel):
    """Response schema for similarity calculation by track ID."""

    queried_track: SimilarTrackResult = Field(
        ..., description="Information about the queried track"
    )
    similar_tracks: List[SimilarTrackResult] = Field(
        ..., description="List of similar tracks"
    )
    playlist: Optional[PlaylistInfo] = Field(
        None, description="Created playlist information"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "queried_track": {
                    "rank": 0,
                    "score": 1.0,
                    "id": "67addcb39387d00fbdc3acdf",
                    "label": "Global Underground",
                    "duration": 491,
                    "artist": "Oxia",
                    "title": "Whole Life (Original Mix)",
                    "year": 2010,
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
                        "year": 2011,
                    }
                ],
                "playlist": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Playlist",
                    "is_public": False,
                    "fork_id": "original-playlist-uuid",
                    "is_favorite": False,
                    "is_following": False,
                },
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
                "error": "File too large. Maximum size is 100MB.",
            }
        }


class SimilarityUploadSuccessResponse(BaseModel):
    """Success response wrapper for similarity upload."""

    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityUploadResponse = Field(
        ..., description="Similarity calculation results"
    )

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
                        "year": 2023,
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
                            "year": 2010,
                        }
                    ],
                    "playlist": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Playlist",
                        "is_public": False,
                        "fork_id": "original-playlist-uuid",
                    },
                },
            }
        }


class SimilarityByIdSuccessResponse(BaseModel):
    """Success response wrapper for similarity by ID."""

    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityByIdResponse = Field(
        ..., description="Similarity calculation results"
    )

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
                        "year": 2010,
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
                            "year": 2011,
                        }
                    ],
                    "playlist": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Playlist",
                        "is_public": False,
                        "fork_id": "original-playlist-uuid",
                    },
                },
            }
        }


# Internal schemas for service layer
class SimilarityServerRequest(BaseModel):
    """Internal schema for similarity server requests."""

    top_k: int = Field(
        ..., description="Number of results to request from similarity server"
    )
    file_path: Optional[str] = Field(
        None, description="File path for path-based similarity"
    )


class SimilarityServerResponse(BaseModel):
    """Internal schema for similarity server responses."""

    status: str = Field(..., description="Response status from similarity server")
    message: Optional[str] = Field(None, description="Response message")
    results: List[Dict[str, Any]] = Field(
        default_factory=list, description="Raw similarity results"
    )


class SimilarityConfiguration(BaseModel):
    """Configuration schema for similarity calculations."""

    allowed_top_sk_values: List[int] = Field(
        default=ALLOWED_TOP_SK_VALUES, description="Allowed top_sk values"
    )
    default_top_sk: int = Field(default=20, description="Default top_sk value")
    duplication_thresholds: List[int] = Field(
        default=[2, 2, 4, 5], description="Duplication thresholds for each top_sk"
    )
    similarity_server_url: Optional[str] = Field(
        None, description="URL of the similarity microservice"
    )
    path_prefix_to_remove: str = Field(
        default="/home/usman/data/",
        description="Path prefix to remove from server responses",
    )

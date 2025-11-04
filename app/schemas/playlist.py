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

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.similarity import SimilarityByIdResponse
import re
from decimal import Decimal


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
        # Pattern: letters, numbers, spaces, hyphens, underscores, periods, apostrophes, parentheses, commas
        allowed_pattern = r"^[a-zA-Z0-9\s\-_.'(),]+$"
        
        if not re.match(allowed_pattern, v.strip()):
            raise ValueError('Playlist name can only contain letters, numbers, spaces, hyphens, underscores, periods, apostrophes, parentheses, and commas')
        
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


class PlaylistForkRequest(BaseModel):
    """Request schema for forking a playlist."""
    playlist_id: str = Field(..., description="UUID of the playlist to fork")
    
    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate that playlist_id is not empty."""
        if not v or not v.strip():
            raise ValueError('Playlist ID cannot be empty')
        return v.strip()
    
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
                        "name": "Playlist",
                        "is_public": False,
                        "fork_id": "original-playlist-uuid",
                        "is_favorite": False,
                        "is_following": False
                    }
                }
            }
        }


class PlaylistForkResponse(BaseModel):
    """Response schema for playlist fork operation."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SimilarityByIdResponse = Field(..., description="Forked playlist data in similarity format")
    
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
                    "similar_tracks": [...],
                    "playlist": {
                        "id": "new-playlist-uuid",
                        "name": "Playlist Name",
                        "is_public": False,
                        "fork_id": "original-playlist-uuid",
                        "is_favorite": False,
                        "is_following": False
                    }
                }
            }
        }


# ============================================================================
# Admin Schemas
# ============================================================================

class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int
    page_size: int
    total: int
    total_pages: int


class PlaylistEntity(BaseModel):
    """Schema for playlist database entity."""
    id: int
    uuid: str
    user_id: Optional[str]
    name: str
    is_public: bool
    type: str
    seed_track_id: Optional[int]
    fork_id: Optional[str] = None
    forked_at: Optional[str] = None
    fork_count: int = 0
    created_at: str

    class Config:
        from_attributes = True


class AdminPlaylistListResponse(BaseModel):
    """Response schema for admin playlist list."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[PlaylistEntity] = Field(..., description="List of playlist entries")
    pagination: PaginationMeta = Field(..., description="Pagination information")


class AdminBatchDeleteRequest(BaseModel):
    """Request schema for batch delete operation."""
    ids: List[int] = Field(..., description="List of playlist IDs to delete", min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "ids": [1, 2, 3, 4, 5]
            }
        }


class AdminBatchDeleteResponse(BaseModel):
    """Response schema for batch delete operation."""
    success: bool = Field(True, description="Always true for successful responses")
    deleted_count: int = Field(..., description="Number of items deleted")
    message: str = Field(..., description="Success message")


class AdminDeleteResponse(BaseModel):
    """Response schema for delete operations."""
    success: bool = Field(True, description="Always true for successful responses")
    data: Dict[str, str] = Field(..., description="Delete result data")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "message": "Playlist deleted successfully"
                }
            }
        }


class AdminPlaylistExportRequest(BaseModel):
    """Request schema for playlist export."""
    format: str = Field("csv", description="Export format (only csv supported)")
    page: int = Field(1, ge=1, description="Page number (not used in export)")
    page_size: int = Field(30, ge=1, le=100, description="Items per page (not used in export)")
    search: Optional[str] = Field(None, description="Search term")
    search_column: Optional[str] = Field(None, description="Column to search in: id, uuid, name")
    is_public: Optional[str] = Field(None, description="Filter by visibility: 0 (private), 1 (public)")
    type: Optional[str] = Field(None, description="Filter by type: custom, similarity, waiting_segments")
    date_from: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    sort_by: str = Field("id", description="Column to sort by: id, created_at")
    sort_order: str = Field("desc", description="Sort order: asc or desc")


class AdminPlaylistExportResponse(BaseModel):
    """Response schema for playlist export."""
    success: bool = Field(True, description="Always true for successful responses")
    download_url: str = Field(..., description="URL to download the exported file")
    filename: str = Field(..., description="Name of the exported file")
    expires_at: str = Field(..., description="ISO timestamp when the download link expires")


# Admin Playlist Detail Schemas
class SeedTrackDetail(BaseModel):
    """Schema for seed track details."""
    id: int
    uuid: str
    title: str
    artists: List[str]
    duration_sec: float
    bpm: Optional[int]
    musical_key: Optional[str]
    genre: Optional[str]
    label: Optional[str]
    year: Optional[int]


class TrackDetail(BaseModel):
    """Schema for track details in playlist."""
    id: int
    uuid: str
    title: str
    artists: List[str]
    duration_sec: float
    file_size: int
    type: str
    genre: Optional[str]
    label: Optional[str]
    album: Optional[str]
    year: Optional[int]
    bpm: Optional[int]
    musical_key: Optional[str]
    file_path: str
    preview_path: Optional[str]
    created_at: str


class PlaylistTrackDetail(BaseModel):
    """Schema for track with position in playlist."""
    position: Decimal  # DECIMAL(12,6) for high precision reordering
    score: Optional[float]
    track: TrackDetail


class PlaylistDetailInfo(BaseModel):
    """Schema for playlist basic info."""
    id: int
    uuid: str
    user_id: Optional[str]
    name: str
    is_public: bool
    type: str
    seed_track_id: Optional[int]
    fork_id: Optional[str] = None
    forked_at: Optional[str] = None
    fork_count: int = 0
    created_at: str
    track_count: int


class PlaylistDetailData(BaseModel):
    """Schema for complete playlist detail data."""
    playlist: PlaylistDetailInfo
    seed_track: Optional[SeedTrackDetail]
    tracks: List[PlaylistTrackDetail]


class AdminPlaylistDetailResponse(BaseModel):
    """Response schema for admin playlist detail."""
    success: bool = Field(True, description="Always true for successful responses")
    data: PlaylistDetailData = Field(..., description="Complete playlist details")


class AdminPlaylistVisibilityRequest(BaseModel):
    """Request schema for changing single playlist visibility."""
    is_public: bool = Field(..., description="true for public, false for private")

    class Config:
        json_schema_extra = {
            "example": {
                "is_public": True
            }
        }


class AdminBatchVisibilityRequest(BaseModel):
    """Request schema for batch visibility change."""
    ids: List[int] = Field(..., description="Array of playlist IDs to update", min_length=1)
    is_public: bool = Field(..., description="true for public, false for private")

    class Config:
        json_schema_extra = {
            "example": {
                "ids": [123, 456, 789],
                "is_public": False
            }
        }


class AdminPlaylistVisibilityResponse(BaseModel):
    """Response schema for single playlist visibility change."""
    success: bool = Field(..., description="Operation success status")
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Playlist made public successfully"
            }
        }


class AdminBatchVisibilityResponse(BaseModel):
    """Response schema for batch visibility change."""
    success: bool = Field(True, description="Always true for successful responses")
    updated_count: int = Field(..., description="Number of playlists updated")
    message: str = Field(..., description="Success message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "updated_count": 3,
                "message": "Successfully updated 3 playlists"
            }
        }

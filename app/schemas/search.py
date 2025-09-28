"""
Search Schemas
==============

This module contains Pydantic schemas for track search functionality.
It defines request and response models for text-based searches, advanced filtering,
and search result formatting with comprehensive validation and error handling.

Provides schemas for search queries, filter options, result pagination,
and detailed search operations across tracks, artists, albums, and metadata.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Request schema for track search."""
    query: str = Field(..., description="Search term to find matching tracks", min_length=1, max_length=200)
    mode: Optional[Literal["artist", "title", "both"]] = Field("both", description="Search mode: 'artist' (search only artists), 'title' (search only titles), 'both' (search both)")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "electronic music",
                "mode": "both"
            }
        }


class SearchTrackResult(BaseModel):
    """Schema for individual track search result."""
    id: str = Field(..., description="Track database ID (MongoDB ObjectId)")
    artist: str = Field(..., description="Artist name")
    duration: float = Field(..., description="Track duration in seconds with decimal precision")
    title: str = Field(..., description="Track title")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "artist": "Electronic Artist",
                "duration": 245,
                "title": "Electronic Track"
            }
        }


class SearchResponse(BaseModel):
    """Response schema for track search."""
    tracks: List[SearchTrackResult] = Field(..., description="List of matching tracks")

    class Config:
        json_schema_extra = {
            "example": {
                "tracks": [
                    {
                        "id": "507f1f77bcf86cd799439011",
                        "artist": "Electronic Artist",
                        "duration": 245,
                        "title": "Electronic Track"
                    },
                    {
                        "id": "507f1f77bcf86cd799439012",
                        "artist": "Techno Producer",
                        "duration": 180,
                        "title": "Techno Beat"
                    }
                ]
            }
        }


class SearchSuccessResponse(BaseModel):
    """Success response wrapper for track search."""
    success: bool = Field(True, description="Always true for successful responses")
    data: SearchResponse = Field(..., description="Search results")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "tracks": [
                        {
                            "id": "507f1f77bcf86cd799439011",
                            "artist": "Electronic Artist",
                            "duration": 245,
                            "title": "Electronic Track"
                        }
                    ]
                }
            }
        }


class SearchErrorResponse(BaseModel):
    """Error response schema for search operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Search service temporarily unavailable"
            }
        }


# Extended search schemas for advanced functionality
class AdvancedSearchRequest(BaseModel):
    """Advanced search request with filters."""
    query: str = Field(..., description="Search term", min_length=1, max_length=200)
    artist_filter: Optional[str] = Field(None, description="Filter by artist name", max_length=100)
    duration_min: Optional[float] = Field(None, description="Minimum duration in seconds", ge=0)
    duration_max: Optional[float] = Field(None, description="Maximum duration in seconds", ge=0)
    limit: Optional[int] = Field(20, description="Maximum number of results", ge=1, le=100)

    class Config:
        json_schema_extra = {
            "example": {
                "query": "electronic",
                "artist_filter": "Daft Punk",
                "duration_min": 180,
                "duration_max": 300,
                "limit": 10
            }
        }


class SearchFilters(BaseModel):
    """Schema for search filters."""
    artist: Optional[str] = Field(None, description="Artist name filter")
    genre: Optional[str] = Field(None, description="Genre filter")
    year_min: Optional[int] = Field(None, description="Minimum year filter", ge=1900, le=2030)
    year_max: Optional[int] = Field(None, description="Maximum year filter", ge=1900, le=2030)
    duration_min: Optional[float] = Field(None, description="Minimum duration in seconds", ge=0)
    duration_max: Optional[float] = Field(None, description="Maximum duration in seconds", ge=0)


class SearchOptions(BaseModel):
    """Schema for search options and configuration."""
    sort_by: Optional[str] = Field("relevance", description="Sort field (relevance, duration, artist, filename)")
    sort_order: Optional[str] = Field("desc", description="Sort order (asc, desc)")
    limit: Optional[int] = Field(20, description="Maximum results", ge=1, le=100)
    offset: Optional[int] = Field(0, description="Results offset", ge=0)


class DetailedSearchRequest(BaseModel):
    """Detailed search request with full options."""
    query: str = Field(..., description="Search term", min_length=1, max_length=200)
    filters: Optional[SearchFilters] = Field(None, description="Search filters")
    options: Optional[SearchOptions] = Field(None, description="Search options")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "electronic",
                "filters": {
                    "artist": "Daft Punk",
                    "duration_min": 180,
                    "duration_max": 300
                },
                "options": {
                    "sort_by": "duration",
                    "sort_order": "asc",
                    "limit": 10
                }
            }
        }


class SearchMetadata(BaseModel):
    """Schema for search result metadata."""
    total_results: int = Field(..., description="Total number of matching results")
    results_returned: int = Field(..., description="Number of results in this response")
    search_time_ms: Optional[int] = Field(None, description="Search execution time in milliseconds")
    query_processed: str = Field(..., description="The processed search query")


class DetailedSearchResponse(BaseModel):
    """Detailed search response with metadata."""
    tracks: List[SearchTrackResult] = Field(..., description="List of matching tracks")
    metadata: SearchMetadata = Field(..., description="Search metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "tracks": [
                    {
                        "id": "507f1f77bcf86cd799439011",
                        "artist": "Electronic Artist", 
                        "duration": 245,
                        "title": "Electronic Track"
                    }
                ],
                "metadata": {
                    "total_results": 50,
                    "results_returned": 1,
                    "search_time_ms": 25,
                    "query_processed": "electronic"
                }
            }
        }


# Internal schemas for service layer
class MongoSearchQuery(BaseModel):
    """Internal schema for MongoDB search queries."""
    mongo_query: dict = Field(..., description="MongoDB query object")
    limit: int = Field(20, description="Query limit")
    sort: Optional[dict] = Field(None, description="Sort criteria")


class SearchServiceConfig(BaseModel):
    """Configuration schema for search service."""
    mongodb_uri: Optional[str] = Field(None, description="MongoDB connection URI")
    database_name: str = Field("Data", description="Database name")
    collection_name: str = Field("Tracks", description="Collection name")
    default_limit: int = Field(20, description="Default search limit")
    max_limit: int = Field(100, description="Maximum search limit")
    search_timeout_seconds: int = Field(30, description="Search timeout in seconds") 
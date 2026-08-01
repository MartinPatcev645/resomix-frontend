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

from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator
from app.schemas.similarity import SimilarityByIdResponse, PlaylistInfo
import re
import unicodedata
from decimal import Decimal


# Request Schemas
#: Upper bound on a playlist name, in characters. The column is VARCHAR(150), so this leaves
#: headroom for anything we might append ourselves later.
PLAYLIST_NAME_MAX_LENGTH = 120

#: Characters that must never survive into a name.
#:
#: C0/C1 controls (newlines, tabs, NUL…) break single-line rendering and log output. The bidi
#: overrides let a name paint itself right-to-left and impersonate another one — the only genuinely
#: deceptive class of invisible character here.
#:
#: Note what is deliberately NOT here: ZWJ (U+200D) is required to build emoji families like
#: 👨‍👩‍👧, and ZWNJ (U+200C) is required for correct Persian and Arabic text. Blanket-blocking
#: format characters would break real names.
_CONTROL_CHARS = re.compile(r"[\x00-\x1F\x7F-\x9F]")
_BIDI_OVERRIDES = re.compile(r"[\u202A-\u202E\u2066-\u2069]")
_WHITESPACE_RUN = re.compile(r"\s+")


def normalize_playlist_name(value: str) -> str:
    """Clean and validate a playlist name, returning the value to store.

    Accepts text in any language — letters with accents, non-Latin scripts, punctuation, emoji.
    Validation is on the SHAPE of the string, not on an allowlist of characters.

    The old rule was `^[a-zA-Z0-9\\s\\-_.'(),]+$`, which rejected most of the world's writing
    systems along with `&`, `!` and the curly apostrophe that macOS and iOS auto-insert. That was
    not merely restrictive, it was self-contradictory: playlists are auto-named "Artist - Title"
    from catalogue metadata, so the product generated names it then refused to let anyone re-enter
    ("Sigur Rós - Hoppípolla" could not be renamed to itself).

    Raises:
        ValueError: with a message written for a person, not a validator.
    """
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Enter a name for the playlist.")

    # NFC first: "é" typed as e + combining accent becomes the single precomposed character, so
    # equal-looking names compare equal and the length below counts what the user sees.
    cleaned = unicodedata.normalize("NFC", value)
    # Controls become a SPACE, not nothing: pasting "Artist\nTitle" should read "Artist Title"
    # rather than "ArtistTitle". The collapse below tidies up any doubles that creates.
    cleaned = _CONTROL_CHARS.sub(" ", cleaned)
    # Bidi overrides are deleted outright — they carry no textual content, only direction.
    cleaned = _BIDI_OVERRIDES.sub("", cleaned)
    # Collapse runs of whitespace so a name can't be padded out with invisible width.
    cleaned = _WHITESPACE_RUN.sub(" ", cleaned).strip()

    if not cleaned:
        raise ValueError("Enter a name for the playlist.")

    if len(cleaned) > PLAYLIST_NAME_MAX_LENGTH:
        raise ValueError(
            f"Playlist name is too long — keep it to {PLAYLIST_NAME_MAX_LENGTH} characters or fewer."
        )

    return cleaned


class PlaylistRenameRequest(BaseModel):
    """Request schema for renaming a playlist."""
    playlist_id: str = Field(..., description="Playlist UUID")
    new_name: str = Field(
        ...,
        description="New playlist name — any language, punctuation or emoji",
        min_length=1,
        max_length=PLAYLIST_NAME_MAX_LENGTH,
    )

    @validator('new_name')
    def validate_new_name(cls, v):
        return normalize_playlist_name(v)

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
                "new_name": "Sigur Rós - Hoppípolla 🎧"
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
                    "similar_tracks": [
                        {
                            "rank": 1,
                            "score": 0.98,
                            "id": "3bc43c719b3444caa2b19f0e",
                            "label": "Global Underground",
                            "duration": 475,
                            "artist": "Sasha",
                            "title": "Xpander",
                            "year": 1999
                        }
                    ],
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


class UserPlaylistsFilters(BaseModel):
    """Filter schema for user playlists query."""
    search: Optional[str] = Field(None, description="Free-text search over playlist name OR uuid (case-insensitive, partial)")
    play_time: Optional[str] = Field(None, description="Play time filter: 'lt1h', '1-3h', '3-6h', '6-9h', 'gt9h'")
    num_tracks: Optional[int] = Field(None, description="Minimum number of tracks (>=): 10, 20, 50, or 100")
    start_date: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    is_public: Optional[bool] = Field(None, description="Visibility filter: true for public, false for private")
    own_favorites: Optional[bool] = Field(None, description="Show only favorites owned by user (true/false)")
    all_favorites: Optional[bool] = Field(None, description="Show all favorited playlists including ones user doesn't own (true/false)")

    @validator('search')
    def validate_search(cls, v):
        """Trim search; treat blank as no filter."""
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v

    @validator('play_time')
    def validate_play_time(cls, v):
        """Validate play_time filter value."""
        if v is not None and v not in ['lt1h', '1-3h', '3-6h', '6-9h', 'gt9h']:
            raise ValueError("play_time must be one of: 'lt1h', '1-3h', '3-6h', '6-9h', 'gt9h'")
        return v

    @validator('num_tracks')
    def validate_num_tracks(cls, v):
        """Validate num_tracks filter value (used as a minimum: >= v)."""
        if v is not None and v not in [10, 20, 50, 100]:
            raise ValueError("num_tracks must be one of: 10, 20, 50, 100")
        return v
    
    @validator('start_date', 'end_date')
    def validate_date(cls, v):
        """Validate date format (YYYY-MM-DD)."""
        if v is not None:
            import re
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
                raise ValueError("Date must be in YYYY-MM-DD format")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "play_time": "1-3h",
                "num_tracks": 20,
                "start_date": "2025-01-01",
                "end_date": "2025-12-31",
                "is_public": True,
                "own_favorites": False,
                "all_favorites": False
            }
        }


class UserPlaylistsResponse(BaseModel):
    """Response schema for user's playlists list."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[PlaylistInfo] = Field(..., description="List of user's playlists")
    total: int = Field(0, description="Total number of playlists owned by the user")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "My Playlist",
                        "is_public": False,
                        "fork_id": "",
                        "is_favorite": False,
                        "is_following": False
                    },
                    {
                        "id": "660e8400-e29b-41d4-a716-446655440001",
                        "name": "Public Playlist",
                        "is_public": True,
                        "fork_id": "original-playlist-uuid",
                        "is_favorite": False,
                        "is_following": False
                    }
                ],
                "total": 123
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
    # Creator's username when the playlist belongs to a registered user; None for guests.
    creator_username: Optional[str] = None
    # Hashed guest visitor id when the playlist was created anonymously; None for users.
    guest_visitor_id: Optional[str] = None
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
    guest_visitor_id: Optional[str] = None
    name: str
    is_public: bool
    type: str
    seed_track_id: Optional[int]
    fork_id: Optional[str] = None
    forked_at: Optional[str] = None
    fork_count: int = 0
    created_at: str
    track_count: int


class PlaylistCreator(BaseModel):
    """Who created the playlist. ``type`` is 'user', 'guest', or 'unknown'; the remaining fields
    are populated per type (registered-user identity vs. guest visitor id + best-effort IP)."""
    type: str
    # Registered-user fields
    id: Optional[int] = None
    uuid: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
    is_email_verified: Optional[bool] = None
    created_at: Optional[str] = None
    # Guest fields
    visitor_id: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    seen_at: Optional[str] = None


class PlaylistDetailData(BaseModel):
    """Schema for complete playlist detail data."""
    playlist: PlaylistDetailInfo
    creator: Optional[PlaylistCreator] = None
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

"""
Track Schemas
=============

This module contains Pydantic schemas for track-related operations.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class AudioFileBase(BaseModel):
    asset_class: str
    original_filename: str
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None

class AudioFileResponse(AudioFileBase):
    id: int
    track_id: int
    stored_path: str
    
    model_config = ConfigDict(from_attributes=True)


class TrackContributorBase(BaseModel):
    person_id: int
    role: str
    royalty_type: str
    ownership_share: Optional[float] = None
    sequence_num: Optional[int] = 1

class TrackContributorResponse(TrackContributorBase):
    id: int
    track_id: int
    
    model_config = ConfigDict(from_attributes=True)


class TrackBase(BaseModel):
    uuid: str
    party_id: Optional[str] = None
    isrc: str
    title: str
    version_title: Optional[str] = None
    display_artist: Optional[str] = None
    duration_ms: Optional[int] = None
    duration: Optional[float] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    key_signature: Optional[str] = None
    audio_language: Optional[str] = "xx"
    language_of_lyrics: Optional[str] = None
    genre: Optional[str] = None
    sub_genre: Optional[str] = None
    price_cents: Optional[int] = 99
    mix_name: Optional[str] = "Original Mix"
    track_type: Optional[str] = "electrobuzz"
    is_explicit: Optional[bool] = False
    is_instrumental: Optional[bool] = False
    is_active: Optional[bool] = True

class TrackCreate(TrackBase):
    pass

class TrackResponse(TrackBase):
    id: int
    created_at: datetime
    updated_at: datetime

    # Nested schemas
    audio_files: List[AudioFileResponse] = []
    recording_contributors: List[TrackContributorResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# User library schemas (a user's own uploaded tracks)
# ---------------------------------------------------------------------------


class TrackErrorResponse(BaseModel):
    """Standard error envelope for library track endpoints."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Human-readable error message")


class UserTrackSummary(BaseModel):
    """Lightweight track representation for the library list view."""
    uuid: str
    title: str
    version_title: Optional[str] = None
    display_artist: Optional[str] = None
    mix_name: Optional[str] = None
    isrc: Optional[str] = None
    duration_ms: Optional[int] = None
    duration: Optional[float] = Field(None, description="Duration in seconds")
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    genre: Optional[str] = None
    sub_genre: Optional[str] = None
    track_type: Optional[str] = None
    price_cents: Optional[int] = None
    is_explicit: Optional[bool] = None
    is_instrumental: Optional[bool] = None
    is_active: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserTracksListResponse(BaseModel):
    """Paginated list of the authenticated user's own uploaded tracks."""
    success: bool = Field(True, description="Always true for successful responses")
    data: List[UserTrackSummary] = Field(..., description="Tracks on this page")
    total: int = Field(0, description="Total uploaded tracks owned by the user")
    page: int = Field(1, description="Current page number (1-based)")
    page_size: int = Field(20, description="Items per page")
    total_pages: int = Field(0, description="Total number of pages")


class AudioFileMeta(BaseModel):
    """Safe audio-file metadata (no internal storage path or checksums)."""
    asset_class: Optional[str] = None
    asset_subtype: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[int] = None
    audio_codec: Optional[str] = None
    sample_rate: Optional[int] = None
    bit_depth: Optional[int] = None
    channels: Optional[int] = None
    bitrate_kbps: Optional[int] = None
    created_at: Optional[str] = None


class TrackContributorMeta(BaseModel):
    """Contributor credit for a track (library detail view)."""
    name: Optional[str] = None
    role: Optional[str] = None
    royalty_type: Optional[str] = None
    ownership_share: Optional[float] = None
    sequence_num: Optional[int] = None


class UserTrackDetail(UserTrackSummary):
    """Full metadata for a single owned track (view action)."""
    key_signature: Optional[str] = None
    audio_language: Optional[str] = None
    language_of_lyrics: Optional[str] = None
    p_line_year: Optional[int] = None
    p_line_text: Optional[str] = None
    parental_warning: Optional[str] = None
    audio_files: List[AudioFileMeta] = []
    contributors: List[TrackContributorMeta] = []


class UserTrackDetailResponse(BaseModel):
    """Response envelope for the single-track view."""
    success: bool = Field(True, description="Always true for successful responses")
    data: UserTrackDetail


class TrackDeleteData(BaseModel):
    uuid: str
    is_active: bool = False


class TrackDeleteResponse(BaseModel):
    """Response envelope for a soft-delete operation."""
    success: bool = Field(True, description="Always true for successful responses")
    data: TrackDeleteData
    message: str = Field("Track deleted successfully", description="Result message")

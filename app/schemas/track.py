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

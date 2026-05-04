"""
Release Schemas
===============

This module contains Pydantic schemas for release-related operations.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ReleaseContributorResponse(BaseModel):
    id: int
    person_id: int
    role: str
    sequence_num: Optional[int] = 1
    
    model_config = ConfigDict(from_attributes=True)


class ReleaseTrackResponse(BaseModel):
    id: int
    track_id: int
    track_number: Optional[int] = None
    disc_number: Optional[int] = 1
    sequence_num: Optional[int] = None
    display_title_override: Optional[str] = None
    release_context: Optional[str] = "Original"
    is_bonus_track: Optional[bool] = False
    is_hidden_track: Optional[bool] = False
    
    model_config = ConfigDict(from_attributes=True)


class ReleaseBase(BaseModel):
    party_id: str
    title: str
    version_title: Optional[str] = None
    display_artist: Optional[str] = None
    release_type: Optional[str] = "Album"
    upc: Optional[str] = None
    catalog_number: Optional[str] = None
    total_tracks: Optional[int] = None
    total_discs: Optional[int] = 1
    p_line: Optional[str] = None
    c_line: Optional[str] = None
    original_release_date: Optional[datetime] = None
    digital_release_date: Optional[datetime] = None
    label_id: Optional[int] = None
    message_id: Optional[int] = None
    cover_image: Optional[str] = None
    is_active: Optional[bool] = True

class ReleaseCreate(ReleaseBase):
    pass

class ReleaseResponse(ReleaseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    # Nested schemas
    release_track_assocs: List[ReleaseTrackResponse] = []
    contributor_assocs: List[ReleaseContributorResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

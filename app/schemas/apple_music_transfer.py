"""
Apple Music Transfer Schemas
============================

This module contains Pydantic schemas for Apple Music playlist transfer operations.
It defines request and response models for transferring Resomix playlists to Apple Music
with comprehensive validation and error handling.

Version: 3.0.1
Init Date: December 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class AppleMusicDeveloperTokenResponse(BaseModel):
    """Response schema for Apple Music developer token generation."""
    token: str = Field(..., description="Apple Music developer token (JWT)")
    expires_at: int = Field(..., description="Token expiration timestamp in milliseconds")


class AppleMusicTransferRequest(BaseModel):
    """Request schema for transferring a playlist to Apple Music."""
    playlist_id: str = Field(..., description="Resomix playlist UUID to transfer")
    music_user_token: str = Field(..., description="Apple Music User Token from MusicKit.authorize()")
    developer_token: Optional[str] = Field(None, description="Developer token (optional, backend will generate if missing)")
    playlist_name: Optional[str] = Field(None, description="Custom name for the Apple Music playlist")

    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate playlist ID format."""
        if not v or not v.strip():
            raise ValueError('Playlist ID cannot be empty')
        return v.strip()

    @validator('music_user_token')
    def validate_user_token(cls, v):
        """Validate user token format."""
        if not v or not v.strip():
            raise ValueError('Music user token cannot be empty')
        return v.strip()

    @validator('playlist_name')
    def validate_playlist_name(cls, v):
        """Validate playlist name if provided."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                raise ValueError('Playlist name cannot be empty if provided')
            if len(v) > 100:
                raise ValueError('Playlist name cannot exceed 100 characters')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
                "music_user_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ij...",
                "developer_token": None,
                "playlist_name": "My Resomix Playlist"
            }
        }


class AppleMusicTransferResponse(BaseModel):
    """Response schema for Apple Music playlist transfer operation."""
    success: bool = Field(..., description="Transfer success status")
    message: Optional[str] = Field(None, description="Transfer result message")
    data: Optional[Dict[str, Any]] = Field(None, description="Transfer result data")
    error: Optional[str] = Field(None, description="Error message if transfer failed")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Playlist transferred to Apple Music",
                "data": {
                    "created_playlist_id": "p.abc123xyz",
                    "created_playlist_name": "My Resomix Playlist",
                    "storefront": "us",
                    "matched": 22,
                    "unmatched": 3,
                    "unmatched_examples": [
                        {"title": "Track Title", "artist": "Artist Name"}
                    ]
                }
            }
        }


class AppleMusicTransferErrorResponse(BaseModel):
    """Error response schema for Apple Music transfer operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error description")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Failed to create Apple Music playlist",
                "details": {
                    "apple_error": "Invalid user token"
                }
            }
        }


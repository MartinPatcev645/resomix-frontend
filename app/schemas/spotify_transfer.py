"""
Spotify Transfer Schemas
========================

This module contains Pydantic schemas for Spotify playlist transfer operations.
It defines request and response models for transferring Resomix playlists to Spotify
with comprehensive validation and error handling.

Provides schemas for Spotify OAuth integration, playlist transfer requests,
and detailed transfer response formatting.

Version: 3.0.1
Init Date: July 19, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class SpotifyTransferRequest(BaseModel):
    """Request schema for transferring a playlist to Spotify."""
    playlist_id: str = Field(..., description="Playlist UUID to transfer")
    access_token: str = Field(..., description="Spotify OAuth access token")
    playlist_name: Optional[str] = Field(None, description="Custom name for the Spotify playlist")

    @validator('playlist_id')
    def validate_playlist_id(cls, v):
        """Validate playlist ID format."""
        if not v or not v.strip():
            raise ValueError('Playlist ID cannot be empty')
        return v.strip()

    @validator('access_token')
    def validate_access_token(cls, v):
        """Validate access token format."""
        if not v or not v.strip():
            raise ValueError('Access token cannot be empty')
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
                "access_token": "BQC4YqJ...",
                "playlist_name": "My Resomix Playlist"
            }
        }


class SpotifyTransferResponse(BaseModel):
    """Response schema for Spotify playlist transfer operation."""
    success: bool = Field(..., description="Transfer success status")
    data: Optional[Dict[str, Any]] = Field(None, description="Transfer result data")
    message: str = Field(..., description="Transfer result message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "spotify_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
                    "spotify_playlist_url": "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
                    "spotify_playlist_name": "My Resomix Playlist",
                    "total_tracks": 25,
                    "tracks_added": 22,
                    "tracks_not_found": 3,
                    "not_found_tracks": [
                        "Artist Name - Track Title",
                        "Another Artist - Another Track"
                    ]
                },
                "message": "Playlist transferred successfully to Spotify"
            }
        }


class SpotifyTransferErrorResponse(BaseModel):
    """Error response schema for Spotify transfer operations."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error description")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Failed to create Spotify playlist",
                "details": {
                    "spotify_error": "Invalid access token"
                }
            }
        }

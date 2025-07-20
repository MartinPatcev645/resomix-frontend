"""
Tidal Transfer Schemas
======================

This module contains Pydantic schemas for Tidal playlist transfer operations.
It defines request and response models for transferring ResomiX playlists to Tidal
with comprehensive validation and error handling.

Provides schemas for Tidal OAuth integration, playlist transfer requests,
and detailed transfer response formatting.

Version: 3.0.1
Init Date: July 20, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class TidalTransferRequest(BaseModel):
    """Request schema for transferring a playlist to Tidal."""
    playlist_id: str = Field(..., description="Playlist UUID to transfer")
    access_token: str = Field(..., description="Tidal OAuth access token")
    playlist_name: Optional[str] = Field(None, description="Custom name for the Tidal playlist")

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
                "playlist_name": "My ResomiX Playlist"
            }
        }


class TidalTransferResponse(BaseModel):
    """Response schema for Tidal playlist transfer operation."""
    success: bool = Field(..., description="Transfer success status")
    data: Optional[Dict[str, Any]] = Field(None, description="Transfer result data")
    message: str = Field(..., description="Transfer result message")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "tidal_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
                    "tidal_playlist_url": "https://listen.tidal.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
                    "tidal_playlist_name": "My ResomiX Playlist",
                    "total_tracks": 25,
                    "tracks_added": 22,
                    "tracks_not_found": 3,
                    "not_found_tracks": [
                        "Artist Name - Track Title",
                        "Another Artist - Another Track"
                    ],
                    "transfer_time_seconds": 45.2
                },
                "message": "Playlist transferred successfully to Tidal"
            }
        }


class TidalTransferErrorResponse(BaseModel):
    """Error response schema for Tidal playlist transfer operation."""
    success: bool = Field(False, description="Transfer success status (always false for errors)")
    error: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Invalid or expired Tidal access token",
                "details": {
                    "error_code": "INVALID_TOKEN",
                    "platform": "Tidal"
                }
            }
        }


class TidalAuthRequest(BaseModel):
    """Request schema for Tidal OAuth authorization URL generation."""
    redirect_uri: str = Field(..., description="OAuth redirect URI")
    code_challenge: str = Field(..., description="PKCE code challenge")

    @validator('redirect_uri', 'code_challenge')
    def validate_not_empty(cls, v):
        """Validate that fields are not empty."""
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "redirect_uri": "http://localhost:3000/callback",
                "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
            }
        }


class TidalTokenRequest(BaseModel):
    """Request schema for exchanging authorization code for access token."""
    code: str = Field(..., description="Authorization code from Tidal")
    redirect_uri: str = Field(..., description="OAuth redirect URI")
    code_verifier: str = Field(..., description="PKCE code verifier")

    @validator('code', 'redirect_uri', 'code_verifier')
    def validate_not_empty(cls, v):
        """Validate that fields are not empty."""
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "code": "authorization_code_from_tidal",
                "redirect_uri": "http://localhost:3000/callback",
                "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
            }
        }


class TidalTokenResponse(BaseModel):
    """Response schema for Tidal token exchange."""
    access_token: str = Field(..., description="Tidal access token")
    token_type: str = Field(..., description="Token type (Bearer)")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    refresh_token: Optional[str] = Field(None, description="Refresh token")
    scope: Optional[str] = Field(None, description="Granted scopes")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "BQC4YqJ...",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": "AQC4YqJ...",
                "scope": "playlists.read playlists.write"
            }
        }


class TidalPlaylistInfo(BaseModel):
    """Schema for Tidal playlist information."""
    id: str = Field(..., description="Tidal playlist ID")
    name: str = Field(..., description="Playlist name")
    description: Optional[str] = Field(None, description="Playlist description")
    url: str = Field(..., description="Tidal playlist URL")
    public: bool = Field(False, description="Whether playlist is public")
    track_count: int = Field(0, description="Number of tracks in playlist")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "37i9dQZF1DX0XUsuxWHRQd",
                "name": "My ResomiX Playlist",
                "description": "Transferred from ResomiX",
                "url": "https://listen.tidal.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
                "public": False,
                "track_count": 25
            }
        }


class TidalTrackInfo(BaseModel):
    """Schema for Tidal track information."""
    id: str = Field(..., description="Tidal track ID")
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist name")
    album: Optional[str] = Field(None, description="Album name")
    duration: Optional[int] = Field(None, description="Track duration in seconds")
    url: str = Field(..., description="Tidal track URL")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123456789",
                "title": "Sample Track",
                "artist": "Sample Artist",
                "album": "Sample Album",
                "duration": 240,
                "url": "https://listen.tidal.com/track/123456789"
            }
        } 
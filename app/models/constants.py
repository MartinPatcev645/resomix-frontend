"""
Model Constants
===============

This module defines constants used across the Resomix models.
It provides standardized values for track types, status values,
and other enumerated fields to ensure consistency throughout the application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""



class TrackType:
    """Constants for track type values."""
    ELECTROBUZZ = "electrobuzz"  # Default type for existing tracks from ElectroBuzz
    UPLOAD = "upload"            # Type for user-uploaded tracks
    OPEN = "open"                # Type for open tracks pipeline

    # List of all valid track types
    ALL_TYPES = [ELECTROBUZZ, UPLOAD, OPEN]

    @classmethod
    def is_valid(cls, track_type: str) -> bool:
        """Check if a track type is valid."""
        return track_type in cls.ALL_TYPES


class ServiceProvider:
    """External music-service providers a user can link/export to.

    Stored as the ``provider`` value on ``user_service_connections``. Kept as string constants
    (not a DB ENUM) so adding a provider needs NO migration — just a new value here plus that
    provider's transfer logic.
    """
    APPLE_MUSIC = "apple_music"
    SPOTIFY = "spotify"
    TIDAL = "tidal"
    REKORDBOX = "rekordbox"
    BEATPORT = "beatport"
    DEEZER = "deezer"

    ALL = [APPLE_MUSIC, SPOTIFY, TIDAL, REKORDBOX, BEATPORT, DEEZER]

    @classmethod
    def is_valid(cls, provider: str) -> bool:
        """Check if a provider code is recognised."""
        return provider in cls.ALL


class PlaylistType:
    """Constants for playlist type values."""
    CUSTOM = "custom"
    SIMILARITY = "similarity"
    WAITING_SEGMENTS = "waiting_segments"


class RatingValue:
    """Constants for rating values."""
    DISLIKE = 0
    LIKE = 1
    
    # Playlist ratings (0-3 stars)
    PLAYLIST_MIN = 0
    PLAYLIST_MAX = 3

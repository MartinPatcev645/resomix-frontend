"""
HLS Utilities
=============

This module provides utility functions for HLS (HTTP Live Streaming) playlist generation.
It handles URL signing for secure media access and M3U8 playlist creation with proper
HLS formatting including EXTINF tags and discontinuity markers.

Provides secure URL generation and M3U8 playlist formatting for audio streaming
in the ResomiX application.

Version: 3.0.1
Init Date: September 16, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import time
import hmac
import hashlib
import base64
import math
from typing import List, Dict, Any
from app.core.config import settings


def sign_track_url(track_uuid: str, expires_in_sec: int = None) -> str:
    """
    Generate a signed URL for a track with expiration.
    
    Args:
        track_uuid: The UUID of the track
        expires_in_sec: URL expiration time in seconds (defaults to config value)
        
    Returns:
        Signed URL for the track
    """
    if expires_in_sec is None:
        expires_in_sec = settings.hls_url_expires_seconds
    
    exp = int(time.time()) + expires_in_sec
    payload = f"{track_uuid}.{exp}".encode("utf-8")
    sig = hmac.new(
        settings.hls_signing_secret.encode("utf-8"), 
        payload, 
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")
    
    # Generate signed URL
    return f"{settings.hls_media_base_url}?uuid={track_uuid}"


def generate_m3u8_playlist(tracks: List[Dict[str, Any]]) -> str:
    """
    Generate an M3U8 playlist from a list of tracks.
    
    Args:
        tracks: List of track dictionaries with keys:
            - uuid: Track UUID
            - duration_sec: Track duration in seconds
            - title: Track title (optional)
            - artist: Track artist (optional)
            
    Returns:
        M3U8 playlist content as string
    """
    if not tracks:
        raise ValueError("No tracks provided for playlist")
    
    # Calculate target duration (ceiling of max duration)
    max_duration = max(float(track.get("duration_sec", 0)) for track in tracks)
    target_duration = int(math.ceil(max_duration))
    
    lines = []
    lines.append("#EXTM3U")
    lines.append("#EXT-X-VERSION:7")
    lines.append("#EXT-X-INDEPENDENT-SEGMENTS")
    lines.append(f"#EXT-X-TARGETDURATION:{target_duration}")
    lines.append("#EXT-X-MEDIA-SEQUENCE:0")
    
    for i, track in enumerate(tracks):
        duration = float(track.get("duration_sec", 0))
        track_uuid = track.get("uuid", "")
        
        # Create track title for EXTINF (optional metadata)
        track_title = ""
        if track.get("title") and track.get("artist"):
            track_title = f"{track['artist']} - {track['title']}"
        elif track.get("title"):
            track_title = track['title']
        
        # Add EXTINF line with duration and optional title
        lines.append(f"#EXTINF:{duration:.3f},{track_title}")
        
        # Add signed URL for the track
        track_url = sign_track_url(track_uuid)
        lines.append(track_url)
        
        # Add discontinuity between tracks (except after the last track)
        if i < len(tracks) - 1:
            lines.append("#EXT-X-DISCONTINUITY")
    
    lines.append("#EXT-X-ENDLIST")
    
    return "\n".join(lines) + "\n"

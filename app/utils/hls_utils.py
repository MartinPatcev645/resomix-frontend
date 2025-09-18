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


def create_track_segments(track_uuid: str, duration_sec: float, segment_duration: float = 10.0) -> List[Dict[str, Any]]:
    """
    Create HLS segments for a track, splitting it into chunks of specified duration.
    
    Args:
        track_uuid: The UUID of the track
        duration_sec: Total track duration in seconds
        segment_duration: Duration of each segment in seconds (default: 10.0)
        
    Returns:
        List of segment dictionaries with duration, uuid, and segment number
    """
    segments = []
    current_time = 0.0
    segment_num = 0
    
    while current_time < duration_sec:
        # Calculate remaining time
        remaining_time = duration_sec - current_time
        
        # Use full segment duration or remaining time, whichever is smaller
        actual_duration = min(segment_duration, remaining_time)
        
        segments.append({
            "duration": actual_duration,
            "uuid": track_uuid,
            "segment": segment_num,
            "url": f"{settings.hls_media_base_url}segment/?uuid={track_uuid}&seg={segment_num}"
        })
        
        current_time += actual_duration
        segment_num += 1
    
    return segments


def generate_m3u8_playlist(tracks: List[Dict[str, Any]]) -> str:
    """
    Generate an M3U8 playlist from a list of tracks with 10-second segments.
    
    Args:
        tracks: List of track dictionaries with keys:
            - uuid: Track UUID
            - duration_sec: Track duration in seconds
            
    Returns:
        M3U8 playlist content as string with segmented tracks
    """
    if not tracks:
        raise ValueError("No tracks provided for playlist")
    
    # Use 10-second segments as target duration (plus 1 for safety margin)
    target_duration = 11
    
    lines = []
    lines.append("#EXTM3U")
    lines.append("#EXT-X-VERSION:7")
    lines.append("#EXT-X-INDEPENDENT-SEGMENTS")
    lines.append(f"#EXT-X-TARGETDURATION:{target_duration}")
    lines.append("#EXT-X-MEDIA-SEQUENCE:0")
    lines.append("#EXT-X-PLAYLIST-TYPE:VOD")
    
    for i, track in enumerate(tracks):
        duration = float(track.get("duration_sec", 0))
        track_uuid = track.get("uuid", "")
        
        # Create segments for this track
        segments = create_track_segments(track_uuid, duration)
        
        # Add each segment
        for segment in segments:
            # Add EXTINF line with segment duration and track UUID
            lines.append(f"#EXTINF:{segment['duration']:.3f},{segment['uuid']}")
            # Add segment URL
            lines.append(segment['url'])
        
        # Add discontinuity between tracks (except after the last track)
        if i < len(tracks) - 1:
            lines.append("#EXT-X-DISCONTINUITY")
    
    lines.append("#EXT-X-ENDLIST")
    
    return "\n".join(lines) + "\n"

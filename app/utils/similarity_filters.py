"""
Similarity Filters
==================

Utility functions for filtering and processing track metadata in similarity responses.
Handles title filtering, response filtering, and metadata sanitization.

Extracted from SimilarityService to improve code organization.
"""

from typing import Dict, List, Any
from app.services.metadata_service import MetadataService


def filter_track_title(title: str) -> str:
    """
    Filter track title by removing specified strings and stopping at certain markers.
    
    Processing order:
    1. Apply meta regex check (if entire title matches domain/URL pattern, return empty string)
    2. Apply title stopper strings (truncate at first occurrence)
    3. Apply title removal strings (remove completely)
    
    Args:
        title: Original track title
        
    Returns:
        Filtered track title
    """
    return MetadataService._filter_title_field(title)

def apply_response_filtering(tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Apply metadata filtering to track data returned from database.
    This ensures existing tracks get filtered even if they weren't filtered during upload.
    
    Args:
        tracks: List of track dictionaries from database
        
    Returns:
        List of tracks with filtered metadata
    """
    filtered_tracks = []
    
    for track in tracks:
        filtered_track = track.copy()
        
        # Apply filtering to relevant fields
        if "title" in filtered_track and filtered_track["title"]:
            filtered_track["title"] = MetadataService._filter_title_field(filtered_track["title"])
        
        if "artist" in filtered_track and filtered_track["artist"]:
            filtered_track["artist"] = MetadataService._filter_metadata_field(filtered_track["artist"], "Artist")
        
        if "label" in filtered_track and filtered_track["label"]:
            filtered_track["label"] = MetadataService._filter_metadata_field(filtered_track["label"], "Label")
        
        # Note: Album and Genre are not typically returned in similarity responses,
        # but we can add them if needed in the future
        
        filtered_tracks.append(filtered_track)
    
    return filtered_tracks

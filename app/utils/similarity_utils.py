"""
Similarity Utilities
===================

Utility functions for similarity processing including audio processing,
data normalization, deduplication, and background task handling.

Extracted from SimilarityService to improve code organization.
"""

import os
import re
import io
import httpx
import asyncio
from typing import Dict, List, Any, Optional
from mutagen import File as MutagenFile, MutagenError


def get_duration_from_bytes_sync(audio_bytes: bytes) -> Optional[int]:
    """
    Calculates the duration of audio from bytes using mutagen.
    
    Args:
        audio_bytes: The raw bytes of the audio file
        
    Returns:
        Duration in seconds (rounded to int) or None if can't be determined
    """
    try:
        file_like_object = io.BytesIO(audio_bytes)
        audio = MutagenFile(file_like_object)
        if audio and audio.info and hasattr(audio.info, 'length') and audio.info.length is not None:
            return int(round(audio.info.length))
    except MutagenError:
        print("MutagenError: Could not load audio from bytes to get duration.")
    except Exception as e:
        print(f"Error getting duration from bytes: {e}")
    return None  # Return None if duration can't be determined


def normalize_artist_name(artist_name: str) -> str:
    """
    Normalize artist name to handle variations in formatting.
    
    Examples:
    - "Jacob Stone" -> "jacob stone"
    - "jacob-stone" -> "jacob stone"  
    - "JACOB    STONE" -> "jacob stone"
    - "Artist A & Artist B" -> "artist a artist b"
    
    Args:
        artist_name: Raw artist name
        
    Returns:
        Normalized artist name
    """
    if not artist_name:
        return ""
    
    # Convert to lowercase
    normalized = artist_name.lower()
    
    # Replace common separators with spaces
    # Handle: hyphens, underscores, various types of dashes
    separators = ['-', '_', '–', '—', '•']
    for sep in separators:
        normalized = normalized.replace(sep, ' ')
    
    # Replace common connecting words/symbols with spaces for more aggressive matching
    # Handle: &, feat, ft, featuring, vs, x, +
    connectors = [' & ', ' feat ', ' feat. ', ' ft ', ' ft. ', ' featuring ', ' vs ', ' vs. ', ' x ', ' + ']
    for connector in connectors:
        normalized = normalized.replace(connector, ' ')
    
    # Normalize whitespace: multiple spaces to single space, strip ends
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized


def deduplicate_tracks(tracks: List[Dict[str, Any]], target_count: int, reference_track: Optional[Dict[str, Any]] = None, filter_title_func = None) -> List[Dict[str, Any]]:
    """
    Removes duplicate tracks based on:
    1. Filename (without extension) and duration (existing logic)
    2. Artist set and title combination (enhanced for multiple artists per track with robust normalization)
    3. Reference track exclusion (for track selection similarity)
    
    Then sorts by score, re-ranks, and returns up to target_count tracks.
    
    Args:
        tracks: List of track dictionaries to deduplicate
        target_count: Maximum number of tracks to return
        reference_track: Optional reference track to exclude from results
        filter_title_func: Optional function to filter track titles before deduplication
    """
    # STEP 0: Apply title filtering BEFORE deduplication to normalize titles
    # This ensures tracks like "Junior Gee" and "Junior Gee (Original Mix)" are seen as duplicates
    preprocessed_tracks = []
    for track in tracks:
        # Create a copy to avoid modifying the original
        processed_track = track.copy()
        
        # Apply title filtering if title exists and filter function provided
        if "title" in processed_track and processed_track["title"] and filter_title_func:
            processed_track["title"] = filter_title_func(processed_track["title"]).strip()
        
        preprocessed_tracks.append(processed_track)
    
    # First layer: Filename-based deduplication (existing logic)
    seen_filename_tracks = set()
    filename_deduplicated_list = []
    
    for track in preprocessed_tracks:
        filename_full = track.get("filename", "")
        # Remove extension from filename for the key
        filename_base, file_extension = os.path.splitext(filename_full)
        duration = track.get("duration", -1)
        track_key = (filename_base.lower().strip(), duration)  # Use lowercased base filename
        
        if track_key not in seen_filename_tracks:
            filename_deduplicated_list.append(track)
            seen_filename_tracks.add(track_key)
    
    # Second layer: Artist set and title-based deduplication (enhanced for multiple artists)
    seen_artist_title_tracks = set()
    final_deduplicated_list = []
    
    # Prepare reference track normalization if provided
    reference_normalized_key = None
    if reference_track:
        # Apply title filtering to reference track as well for consistent comparison
        ref_title = reference_track.get("title", "").strip()
        if ref_title and filter_title_func:
            ref_title = filter_title_func(ref_title).strip().lower()
        else:
            ref_title = ref_title.lower()
        
        ref_all_artists = reference_track.get("all_artists", [])
        
        # If no all_artists field, fall back to primary artist field
        if not ref_all_artists:
            ref_primary_artist = reference_track.get("artist", "").strip()
            ref_all_artists = [ref_primary_artist] if ref_primary_artist else []
        
        # Create normalized reference key if we have title and artists
        if ref_title and ref_all_artists:
            ref_normalized_artists = []
            for artist in ref_all_artists:
                normalized_artist = normalize_artist_name(artist)
                if normalized_artist:
                    ref_normalized_artists.append(normalized_artist)
            
            if ref_normalized_artists:
                ref_normalized_artists_tuple = tuple(sorted(ref_normalized_artists))
                reference_normalized_key = (ref_normalized_artists_tuple, ref_title)
    
    for track in filename_deduplicated_list:
        # Exclude the reference/queried track itself based on UUID equality before any further checks
        if reference_track and track.get("id") and reference_track.get("id") and track.get("id") == reference_track.get("id"):
            continue
        # Title is already filtered, just need to normalize case and trim
        title = track.get("title", "").strip().lower()
        
        # Get all artists for this track
        all_artists = track.get("all_artists", [])
        
        # If no all_artists field, fall back to primary artist field
        if not all_artists:
            primary_artist = track.get("artist", "").strip()
            all_artists = [primary_artist] if primary_artist else []
        
        # Skip tracks with empty title or no artists to avoid false positives
        if not title or not all_artists:
            final_deduplicated_list.append(track)
            continue
        
        # Create a normalized, sorted set of artists with robust normalization
        normalized_artists = []
        for artist in all_artists:
            normalized_artist = normalize_artist_name(artist)
            if normalized_artist:  # Only add non-empty normalized names
                normalized_artists.append(normalized_artist)
        
        # Sort the normalized artists and convert to tuple for hashing
        normalized_artists_tuple = tuple(sorted(normalized_artists))
        
        # Create a key from normalized artist set and title
        artist_title_key = (normalized_artists_tuple, title)
        
        # Skip this track if its normalized key matches that of the reference track.
        # This ensures consistency between track-to-track and reference track deduplication (both use normalized artist set and filtered title).
        if reference_normalized_key and artist_title_key == reference_normalized_key:
            continue
        
        if artist_title_key not in seen_artist_title_tracks:
            final_deduplicated_list.append(track)
            seen_artist_title_tracks.add(artist_title_key)
        # else: this track has the same artist set and title as a previous track, so skip it
    
    # Sort by score in descending order (higher score is better)
    # Ensure score exists and is a number, default to 0 or a very low number if missing/invalid
    final_deduplicated_list.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x.get("score"), (int, float, str)) and str(x.get("score")).replace('.', '', 1).isdigit() else 0, reverse=True)
    
    # Re-rank the sorted list
    reranked_list = []
    for i, track_item in enumerate(final_deduplicated_list):
        track_item["rank"] = i + 1
        reranked_list.append(track_item)
    
    # Title filtering is now done BEFORE deduplication, so just return the tracks
    # Limited to target_count
    return reranked_list[:target_count]


async def execute_playlist_peaks_request(target_url: str, payload: Dict[str, Any]) -> None:
    """
    Execute the playlist peaks request in the background.
    
    Args:
        target_url: The full URL to send the request to
        payload: The request payload
    """
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.post(target_url, json=payload)
            print(f"Playlist peaks request completed with status: {response.status_code}")
        except httpx.HTTPStatusError as e:
            print(f"HTTP error in playlist peaks request: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            print(f"Request error in playlist peaks request: {e}")
        except Exception as e:
            print(f"Unexpected error in playlist peaks request: {e}")


async def send_playlist_peaks_request(similarity_server_url: str, reference_track_uuid: str, similar_tracks: List[Dict[str, Any]]) -> None:
    """
    Sends a playlist peaks request to the similarity server (fire and forget).
    This is a background request that triggers processing on the similarity server.
    
    Args:
        reference_track_uuid: UUID of the reference/queried track
        similar_tracks: List of similar track dictionaries
    """
    if not similarity_server_url:
        print("Warning: SIMILARITY_SERVER_URL is not set, skipping playlist peaks request")
        return

    try:
        # Collect all track UUIDs including the reference track
        track_uuids = [reference_track_uuid]  # Start with reference track
        
        # Add similar track UUIDs
        for track in similar_tracks:
            track_uuid = track.get("id")
            if track_uuid:
                track_uuids.append(track_uuid)
        
        if len(track_uuids) <= 1:  # Only reference track, no similar tracks
            print("No similar tracks found, skipping playlist peaks request")
            return
        
        # Prepare the request
        target_url = f"{similarity_server_url.rstrip('/')}/playlist_peaks"
        payload = {"track_uuids": track_uuids}
        
        print(f"Sending playlist peaks request to {target_url} with {len(track_uuids)} tracks")
        
        # Fire and forget request - don't await the response
        asyncio.create_task(execute_playlist_peaks_request(target_url, payload))
        
    except Exception as e:
        print(f"Error preparing playlist peaks request: {e}")
        # Don't fail the main request if this background task fails

def generate_playlist_name_from_seed_track(seed_track_data: Dict[str, Any]) -> str:
    """
    Generate a playlist name based on the seed track's artist and title information.
    
    Format:
    - Single artist: "Artist - Title"
    - Multiple artists (up to max_artists): "Artist1, Artist2, Artist3 - Title"
    - More than max_artists: "VA - Title"
    
    Args:
        seed_track_data: Dictionary containing seed track information with 'artist' and 'title' keys
        
    Returns:
        Generated playlist name string
    """
    from app.core.config import settings
    
    if not seed_track_data:
        return "Playlist"
    
    title = seed_track_data.get("title", "Unknown")
    artist_string = seed_track_data.get("artist", "Unknown")
    
    # Handle empty or unknown values
    if not title or title.lower() in ["unknown", "n/a", ""]:
        title = "Unknown"
    if not artist_string or artist_string.lower() in ["unknown", "n/a", ""]:
        return "Playlist"
    
    # Split artists by comma and clean them up
    artists = [artist.strip() for artist in artist_string.split(",") if artist.strip()]
    
    # Remove duplicates while preserving order
    unique_artists = []
    seen = set()
    for artist in artists:
        if artist.lower() not in seen:
            unique_artists.append(artist)
            seen.add(artist.lower())
    
    if not unique_artists:
        return "Playlist"
    
    # Determine artist part of the name
    max_artists = settings.default_similarity_playlist_max_artists
    
    if len(unique_artists) == 1:
        artist_part = unique_artists[0]
    elif len(unique_artists) <= max_artists:
        artist_part = ", ".join(unique_artists)
    else:
        artist_part = "VA"  # Various Artists
    
    # Generate the final playlist name
    playlist_name = f"{artist_part} - {title}"
    
    # Ensure the name doesn't exceed the database limit (150 characters for playlist names)
    if len(playlist_name) > 150:
        # Truncate the title part if needed, keeping the artist part intact
        max_title_length = 150 - len(artist_part) - 3  # 3 for " - "
        if max_title_length > 10:  # Ensure we have at least some title
            truncated_title = title[:max_title_length-3] + "..."
            playlist_name = f"{artist_part} - {truncated_title}"
        else:
            # If artist part is too long, just use a simple format
            playlist_name = f"{artist_part[:140]}... - {title[:5]}..."
    
    return playlist_name

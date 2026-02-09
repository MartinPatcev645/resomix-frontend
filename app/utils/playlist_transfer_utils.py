"""
Playlist Transfer Utilities
===========================

This module contains utility functions for playlist transfer operations that are shared
between different music platform services (Spotify, Tidal, etc.).
It provides common functionality to avoid code duplication.

Includes track search query cleaning, similarity scoring, and common transfer operations.

Version: 3.0.1
Init Date: July 20, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import re
import asyncio
from typing import List, Tuple, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def clean_search_query(title: str, artist: str) -> str:
    """
    Clean track title and artist for search queries.
    
    Args:
        title: Track title
        artist: Artist name
        
    Returns:
        Cleaned search query string
    """
    # Remove common patterns that might interfere with search
    patterns_to_remove = [
        r'\(.*?remix.*?\)',  # Remove remix info in parentheses
        r'\[.*?remix.*?\]',  # Remove remix info in brackets
        r'\(feat\..*?\)',    # Remove featuring info
        r'\(ft\..*?\)',      # Remove ft. info
        r'\[feat\..*?\]',    # Remove featuring info in brackets
        r'\[ft\..*?\]',      # Remove ft. info in brackets
        r'\(original.*?\)',  # Remove original mix info
        r'\[original.*?\]',  # Remove original mix info
        r'\(radio.*?\)',     # Remove radio edit info
        r'\[radio.*?\]',     # Remove radio edit info
        r'\(club.*?\)',      # Remove club mix info
        r'\[club.*?\]',      # Remove club mix info
        r'\(extended.*?\)',  # Remove extended mix info
        r'\[extended.*?\]',  # Remove extended mix info
        r'\(vocal.*?\)',     # Remove vocal mix info
        r'\[vocal.*?\]',     # Remove vocal mix info
        r'\(instrumental.*?\)',  # Remove instrumental info
        r'\[instrumental.*?\]',  # Remove instrumental info
        r'\(dirty.*?\)',     # Remove dirty version info
        r'\[dirty.*?\]',     # Remove dirty version info
        r'\(clean.*?\)',     # Remove clean version info
        r'\[clean.*?\]',     # Remove clean version info
        r'\(explicit.*?\)',  # Remove explicit info
        r'\[explicit.*?\]',  # Remove explicit info
    ]
    
    # Clean title
    cleaned_title = title
    for pattern in patterns_to_remove:
        cleaned_title = re.sub(pattern, '', cleaned_title, flags=re.IGNORECASE)
    
    # Remove extra whitespace and special characters
    cleaned_title = re.sub(r'\s+', ' ', cleaned_title).strip()
    cleaned_title = re.sub(r'[^\w\s\-\'\"&]', '', cleaned_title)
    
    # Clean artist
    cleaned_artist = artist
    if cleaned_artist:
        # Remove featuring artists (keep only main artist)
        cleaned_artist = re.split(r'\s+(?:feat\.?|ft\.?|featuring|vs\.?|x|&)\s+', cleaned_artist, flags=re.IGNORECASE)[0]
        cleaned_artist = re.sub(r'[^\w\s\-\'\"&]', '', cleaned_artist)
        cleaned_artist = re.sub(r'\s+', ' ', cleaned_artist).strip()
    
    # Combine title and artist
    if cleaned_artist:
        query = f"{cleaned_artist} {cleaned_title}"
    else:
        query = cleaned_title
    
    return query.strip()


def calculate_similarity_score(search_title: str, search_artist: str, 
                             result_title: str, result_artist: str) -> float:
    """
    Calculate similarity score between search query and result.
    
    Args:
        search_title: Original search title
        search_artist: Original search artist
        result_title: Result title from platform
        result_artist: Result artist from platform
        
    Returns:
        Similarity score between 0.0 and 1.0
    """
    def normalize_string(s: str) -> str:
        """Normalize string for comparison"""
        return re.sub(r'[^\w\s]', '', s.lower()).strip()
    
    def word_similarity(s1: str, s2: str) -> float:
        """Calculate word-based similarity"""
        words1 = set(normalize_string(s1).split())
        words2 = set(normalize_string(s2).split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    # Calculate individual similarities
    title_similarity = word_similarity(search_title, result_title)
    artist_similarity = word_similarity(search_artist, result_artist)
    
    # Weight artist similarity more heavily as it's usually more reliable
    overall_similarity = (title_similarity * 0.6) + (artist_similarity * 0.4)
    
    return overall_similarity


async def search_tracks_concurrently(search_function, track_data: List[Tuple[int, str, str]], 
                                   max_concurrent: int = 2) -> List[Tuple[int, Optional[str]]]:
    """
    Search for tracks concurrently on a music platform.
    
    Args:
        search_function: Async function to search for a single track
        track_data: List of tuples (track_id, title, artist)
        max_concurrent: Maximum number of concurrent searches
        
    Returns:
        List of tuples (track_id, platform_track_id) where platform_track_id is None if not found
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def search_single_track(track_info: Tuple[int, str, str]) -> Tuple[int, Optional[str]]:
        """Search for a single track with semaphore control"""
        track_id, title, artist = track_info
        
        async with semaphore:
            try:
                result = await search_function(title, artist)
                return (track_id, result)
            except Exception as e:
                logger.error(f"Error searching for track {track_id} ({artist} - {title}): {str(e)}")
                return (track_id, None)
    
    # Create tasks for all tracks
    tasks = [search_single_track(track_info) for track_info in track_data]
    
    # Execute all tasks concurrently
    results = await asyncio.gather(*tasks)
    
    return results


def format_transfer_response(platform_name: str, playlist_data: Dict[str, Any], 
                           transfer_stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a standardized transfer response.
    
    Args:
        platform_name: Name of the target platform (e.g., "Spotify", "Tidal")
        playlist_data: Playlist information from the platform
        transfer_stats: Transfer statistics
        
    Returns:
        Formatted response dictionary
    """
    return {
        f"{platform_name.lower()}_playlist_id": playlist_data.get('id'),
        f"{platform_name.lower()}_playlist_url": playlist_data.get('url'),
        f"{platform_name.lower()}_playlist_name": playlist_data.get('name'),
        "total_tracks": transfer_stats.get('total_tracks', 0),
        "tracks_added": transfer_stats.get('tracks_added', 0),
        "tracks_not_found": transfer_stats.get('tracks_not_found', 0),
        "not_found_tracks": transfer_stats.get('not_found_tracks', []),
        "transfer_time_seconds": transfer_stats.get('transfer_time_seconds', 0)
    }


def format_success_message(platform_name: str, tracks_added: int, tracks_not_found: int) -> str:
    """
    Format a success message for playlist transfer.
    
    Args:
        platform_name: Name of the target platform
        tracks_added: Number of tracks successfully added
        tracks_not_found: Number of tracks not found
        
    Returns:
        Formatted success message
    """
    return (
        f"Successfully transferred playlist to {platform_name}. "
        f"{tracks_added} tracks added, {tracks_not_found} tracks not found."
    )


def validate_track_data(track_data: List[Tuple[int, str, str]]) -> List[Tuple[int, str, str]]:
    """
    Validate and filter track data for transfer.
    
    Args:
        track_data: List of tuples (track_id, title, artist)
        
    Returns:
        Filtered list of valid track data
    """
    valid_tracks = []
    
    for track_id, title, artist in track_data:
        # Skip tracks with missing essential information
        if not title or not title.strip():
            logger.warning(f"Skipping track {track_id}: missing title")
            continue
            
        if not artist or not artist.strip():
            logger.warning(f"Skipping track {track_id}: missing artist")
            continue
        
        valid_tracks.append((track_id, title.strip(), artist.strip()))
    
    return valid_tracks


def batch_list(items: List[Any], batch_size: int) -> List[List[Any]]:
    """
    Split a list into batches of specified size.
    
    Args:
        items: List of items to batch
        batch_size: Maximum size of each batch
        
    Returns:
        List of batches
    """
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]


def get_platform_error_message(platform_name: str, error_message: str) -> str:
    """
    Get a user-friendly error message for platform-specific errors.
    
    Args:
        platform_name: Name of the platform
        error_message: Original error message
        
    Returns:
        User-friendly error message
    """
    error_lower = error_message.lower()
    
    # Common authentication errors
    if any(keyword in error_lower for keyword in ['token', 'auth', 'unauthorized', 'forbidden']):
        return f"Invalid or expired {platform_name} access token. Please re-authenticate."
    
    # API limit errors
    if any(keyword in error_lower for keyword in ['rate limit', 'too many requests', 'quota']):
        return f"{platform_name} API rate limit exceeded. Please try again later."
    
    # Network errors
    if any(keyword in error_lower for keyword in ['network', 'connection', 'timeout']):
        return f"Network error connecting to {platform_name}. Please check your internet connection."
    
    # Generic error
    return f"An error occurred while connecting to {platform_name}. Please try again."


def log_transfer_progress(logger_instance, step: str, current: int, total: int, details: str = ""):
    """
    Log transfer progress in a consistent format.
    
    Args:
        logger_instance: Logger instance to use
        step: Current step description
        current: Current progress number
        total: Total items
        details: Additional details to log
    """
    percentage = (current / total * 100) if total > 0 else 0
    message = f"{step}: {current}/{total} ({percentage:.1f}%)"
    if details:
        message += f" - {details}"
    
    logger_instance.info(message)

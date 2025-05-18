"""
Search Module
===========

This module provides functionality for searching tracks by name, artist, or other criteria.

Functions:
- search_tracks: Searches for tracks based on a query string.

Author: AI Assistant
Date: May 2023
"""

from typing import Dict, List, Any


async def search_tracks(query: str) -> Dict[str, Any]:
    """
    Search for tracks based on the provided query string.
    
    In a production environment, this would:
    1. Connect to a database
    2. Execute a search query (e.g., text search on track titles, artists, etc.)
    3. Return matching tracks
    
    Args:
        query: The search term/query string
        
    Returns:
        Dict containing list of tracks matching the search criteria
    """
    # In a real implementation, this would query a database
    # For now, we return mock data based on the query
    
    print(f"Searching for tracks matching: {query}")
    
    # Convert query to lowercase for case-insensitive comparison
    query_lower = query.lower()
    
    # Mock database of tracks
    all_tracks = [
        {
            "id": 1,
            "title": "Sunny Days",
            "artist": "Alex Johnson",
            "duration": 195,
            "genre": "Pop",
            "bpm": 118,
            "imageUrl": "https://example.com/images/track1.jpg"
        },
        {
            "id": 2,
            "title": "Night Drive",
            "artist": "The Melodies",
            "duration": 210,
            "genre": "Electronic",
            "bpm": 128,
            "imageUrl": "https://example.com/images/track2.jpg"
        },
        {
            "id": 3,
            "title": "Mountain High",
            "artist": "Nature Sounds",
            "duration": 180,
            "genre": "Ambient",
            "bpm": 90,
            "imageUrl": "https://example.com/images/track3.jpg"
        },
        {
            "id": 4,
            "title": "Urban Jungle",
            "artist": "City Beats",
            "duration": 225,
            "genre": "Hip Hop",
            "bpm": 95,
            "imageUrl": "https://example.com/images/track4.jpg"
        },
        {
            "id": 5,
            "title": "Ocean Waves",
            "artist": "Nature Sounds",
            "duration": 300,
            "genre": "Ambient",
            "bpm": 60,
            "imageUrl": "https://example.com/images/track5.jpg"
        }
    ]
    
    # Filter tracks based on query (search in title and artist)
    # In a real database, you would use a proper text search feature
    if query:
        filtered_tracks = [
            track for track in all_tracks 
            if query_lower in track["title"].lower() or 
               query_lower in track["artist"].lower() or
               query_lower in track["genre"].lower()
        ]
    else:
        # If no query provided, return all tracks (limited to first 10)
        filtered_tracks = all_tracks[:10]
    
    # Return structured response
    return {
        "tracks": filtered_tracks
    }

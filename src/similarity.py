"""
Similarity Module
===============

This module provides functionality for calculating audio similarity by interacting with a dedicated similarity microservice.

Functions:
- calculate_similarity_for_upload: Processes an uploaded audio file and returns similar tracks.
- get_similarity_by_path: Gets similar tracks for a given server-side file path.

Author: AI Assistant
Date: May 2023 (Updated for microservice integration)
"""

import os
import httpx
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# It's good practice to manage MongoDB client in one place, e.g., search.py or a dedicated db module.
# For now, we might need a way to fetch track details based on paths returned by similarity server.
# This is a placeholder for where you might import such a function.
# from .search import fetch_track_details_by_paths # Example import

load_dotenv()

SIMILARITY_SERVER_URL = os.getenv("SIMILARITY_SERVER_URL")

async def _fetch_track_details_from_db_by_path(track_paths: List[str]) -> List[Dict[str, Any]]:
    """
    Placeholder: Fetches full track details from MongoDB based on a list of file paths.
    You need to implement this, possibly reusing or extending logic from src/search.py
    or creating a new database interaction function.
    
    Args:
        track_paths: A list of file paths returned by the similarity server.
        
    Returns:
        A list of dictionaries, where each dictionary contains the full track details
        matching the frontend's expected format.
    """
    print(f"[Placeholder] Need to fetch details for {len(track_paths)} tracks from MongoDB.")
    # Example structure - replace with actual DB query and data mapping
    detailed_tracks = []
    for i, path in enumerate(track_paths):
        # This is mock data. You would query MongoDB using the path.
        detailed_tracks.append({
            "id": str(i + 100), # Replace with actual ID from DB
            "title": f"Title for {os.path.basename(path)}",
            "artist": "Artist from DB",
            "duration": 200 + i,
            "genre": "Genre from DB",
            "bpm": 120 + i,
            "key": "C Major",
            "imageUrl": f"https://example.com/image_{i}.jpg",
            "previewUrl": f"https://example.com/preview_{i}.mp3"
        })
    return detailed_tracks

async def _call_similarity_server(endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
    """Helper function to call the similarity server."""
    if not SIMILARITY_SERVER_URL:
        print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
        return None

    target_url = f"{SIMILARITY_SERVER_URL.rstrip('/')}{endpoint}"
    print(f"Calling similarity server: {target_url}")

    async with httpx.AsyncClient(timeout=60.0) as client: # Increased timeout for potential processing
        try:
            if files:
                response = await client.post(target_url, files=files, data=data)
            else:
                response = await client.post(target_url, json=data)
            
            response.raise_for_status() # Raises an exception for 4XX/5XX responses
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error calling similarity server {target_url}: {e.response.status_code} - {e.response.text}")
            # Try to parse error from similarity server's known format
            try:
                error_data = e.response.json()
                return {"status": "error", "message": error_data.get("message", "Unknown error from similarity service"), "results": []}
            except:
                return {"status": "error", "message": f"Similarity service HTTP error: {e.response.status_code}", "results": []}
        except httpx.RequestError as e:
            print(f"Request error calling similarity server {target_url}: {e}")
            return {"status": "error", "message": f"Could not connect to similarity service: {e}", "results": []}
        except Exception as e:
            print(f"Generic error calling similarity server {target_url}: {e}")
            return {"status": "error", "message": f"An unexpected error occurred while contacting similarity service: {e}", "results": []}

async def calculate_similarity_for_upload(audio_file_path: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Sends an uploaded audio file to the similarity server and returns enriched similar tracks.
    """
    if not os.path.exists(audio_file_path):
        return {"success": False, "error": "Temporary audio file not found for similarity processing."}

    # Prepare file for upload
    with open(audio_file_path, "rb") as f:
        files = {"file": (os.path.basename(audio_file_path), f, "application/octet-stream")}
        data = {"top_k": top_k}
        
        similarity_response = await _call_similarity_server("/query-by-upload/", data=data, files=files)

    if not similarity_response or similarity_response.get("status") == "error":
        error_message = similarity_response.get("message", "Failed to get response from similarity server or an error occurred.") if similarity_response else "No response from similarity server."
        return {"success": False, "error": error_message}

    # Assuming similarity_response["results"] is a list of items, potentially just paths or simple dicts
    # Example: results = [{"path": "path1", "score": 0.9}, {"path": "path2", "score": 0.8}]
    # We need to extract the identifiers (e.g., paths) to fetch full details.
    raw_results = similarity_response.get("results", [])
    
    # Extract paths (or other identifiers) from raw_results
    # This depends on the exact structure of `raw_results` from your similarity server.
    # Assuming each item in raw_results is a dict with a 'path' key for this example:
    track_identifiers = [res.get("path") for res in raw_results if res.get("path")]
    # Or if it's just a list of paths: track_identifiers = raw_results

    if not track_identifiers:
        enriched_similar_tracks = []
    else:
        enriched_similar_tracks = await _fetch_track_details_from_db_by_path(track_identifiers)
    
    # Mock duration of the uploaded track for now. 
    # In a real scenario, extract from file metadata (e.g., using ffprobe again or a library like mutagen)
    # For example, you could call ffprobe on audio_file_path here if needed.
    mock_duration_uploaded = 180 
    if os.path.exists(audio_file_path):
        try:
            # This is a very rough estimation, replace with actual duration extraction
            mock_duration_uploaded = int(os.path.getsize(audio_file_path) / (160 * 1024)) # Assuming roughly 160kbps stereo
            if mock_duration_uploaded < 10: mock_duration_uploaded = 10 # min duration
        except:
            pass # ignore if fails

    return {
        "duration": mock_duration_uploaded, # Duration of the uploaded track
        "similar_tracks": enriched_similar_tracks
    }

async def get_similarity_by_path(server_track_path: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Gets similar tracks for a given server-side file path by calling the similarity server.
    """
    payload = {"file_path": server_track_path, "top_k": top_k}
    similarity_response = await _call_similarity_server("/query-by-path/", data=payload)

    if not similarity_response or similarity_response.get("status") == "error":
        error_message = similarity_response.get("message", "Failed to get response from similarity server or an error occurred.") if similarity_response else "No response from similarity server."
        return {"success": False, "error": error_message}

    raw_results = similarity_response.get("results", [])
    track_identifiers = [res.get("path") for res in raw_results if res.get("path")]

    if not track_identifiers:
        enriched_similar_tracks = []
    else:
        enriched_similar_tracks = await _fetch_track_details_from_db_by_path(track_identifiers)

    # Duration for the *queried* path (server_track_path)
    # This would also ideally come from fetching its details from DB
    # For now, if we have its details in enriched_similar_tracks (if it's among them) or query separately
    duration_of_queried_track = 0 # Placeholder
    queried_track_details = await _fetch_track_details_from_db_by_path([server_track_path])
    if queried_track_details and queried_track_details[0].get("duration"):
        duration_of_queried_track = queried_track_details[0]["duration"]
    else: # Fallback rough estimate if not found or no duration
        if os.path.exists(server_track_path): # This path is on the *similarity server*, not main server
            # We can't directly get its size here. The similarity server or DB should provide duration.            
            duration_of_queried_track = 200 # Default placeholder for path based query

    return {
        "duration": duration_of_queried_track, # Duration of the track specified by server_track_path
        "similar_tracks": enriched_similar_tracks
    }

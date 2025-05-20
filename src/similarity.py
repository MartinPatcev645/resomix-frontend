"""
Similarity Module
===============

This module provides functionality for calculating audio similarity by interacting with a dedicated similarity microservice.

Functions:
- calculate_similarity_for_upload: Processes an uploaded audio file (bytes) and returns similar tracks.
- get_similarity_by_path: Gets similar tracks for a given server-side file path.

Author: AI Assistant
Date: May 2023 (Updated for microservice integration, byte-based uploads, and improved response handling)
"""

import os
import httpx
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import re # For path prefix removal

# Import the MongoDB collection getter from the search module
# This assumes src/search.py and src/similarity.py are in the same directory (src)
from .search import get_db_collection 

load_dotenv()

SIMILARITY_SERVER_URL = os.getenv("SIMILARITY_SERVER_URL")
# Define the prefix to remove from similarity server paths
PATH_PREFIX_TO_REMOVE = "/home/usman/data/"

async def _fetch_track_details_from_db_by_path(track_paths_from_similarity_server: List[str]) -> List[Dict[str, Any]]:
    """
    Fetches full track details from MongoDB based on a list of file paths 
    returned by the similarity server, after transforming the paths.

    Required fields in MongoDB: id, file.filename, file.size, info.album, info.length, info.title, file.path
    (assuming file.path stores the queryable path like 'veggera/public_html/...')
    
    Args:
        track_paths_from_similarity_server: A list of absolute file paths 
                                            (e.g., /home/usman/data/veggera/public_html/audio.mp3)
                                            returned by the similarity server.
        
    Returns:
        A list of dictionaries, where each dictionary contains the track details
        for the requested fields.
    """
    if not track_paths_from_similarity_server:
        return []

    # Transform paths by removing the defined prefix
    transformed_paths = []
    for p in track_paths_from_similarity_server:
        if p.startswith(PATH_PREFIX_TO_REMOVE):
            transformed_paths.append(p[len(PATH_PREFIX_TO_REMOVE):])
        else:
            # If path doesn't have the prefix, maybe log a warning or use as is?
            # For now, we'll assume paths from similarity server *should* have this prefix.
            # If not, they likely won't match anything in DB if DB paths don't have it.
            print(f"Warning: Path '{p}' from similarity server does not start with expected prefix '{PATH_PREFIX_TO_REMOVE}'. It might not match in DB.")
            transformed_paths.append(p) # Add it anyway, or choose to skip
    
    if not transformed_paths:
        return []

    print(f"Transformed paths for DB query: {transformed_paths}")

    collection = await get_db_collection()
    if collection is None:
        print("Fetch_track_details: MongoDB collection is not available.")
        return []

    # Query MongoDB for documents where 'file.path' is in the list of transformed_paths
    # Please confirm 'file.path' is the correct field in your MongoDB containing 'veggera/public_html/...'
    mongo_query = {"file.path": {"$in": transformed_paths}}
    
    detailed_tracks = []
    try:
        cursor = collection.find(mongo_query)
        async for doc in cursor:
            duration = 0
            if doc.get("info") and doc["info"].get("length"):
                try:
                    duration = int(float(doc["info"]["length"])) 
                except (ValueError, TypeError):
                    duration = 0 # Default to 0 if conversion fails
            
            track_data = {
                "id": str(doc.get("_id")),
                "filename": doc.get("file", {}).get("filename", "N/A"),
                "size": doc.get("file", {}).get("size", 0),
                "album": doc.get("info", {}).get("album", "N/A"),
                "duration": duration, # Using consistent field name "duration"
                "title": doc.get("info", {}).get("title", "N/A")
                # Removed original fields like genre, bpm, key, imageUrl, previewUrl as per new requirement
            }
            detailed_tracks.append(track_data)
        
        print(f"MongoDB: Fetched details for {len(detailed_tracks)} out of {len(transformed_paths)} requested transformed paths.")
        
    except Exception as e:
        print(f"Error during MongoDB fetch for track details: {e}")
        # Optionally, re-raise or handle more gracefully depending on desired behavior
        return [] # Return empty list on error
        
    return detailed_tracks

async def _call_similarity_server(endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None) -> Dict[str, Any]:
    """Helper function to call the similarity server. Returns the JSON response directly or a structured error."""
    if not SIMILARITY_SERVER_URL:
        print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
        return {"status": "error", "message": "Similarity server URL not configured on main server.", "results": []}

    target_url = f"{SIMILARITY_SERVER_URL.rstrip('/')}{endpoint}"
    print(f"Calling similarity server: {target_url} with data: {data}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            if files:
                response = await client.post(target_url, files=files, data=data)
            else:
                response = await client.post(target_url, json=data)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error calling similarity server {target_url}: {e.response.status_code} - {e.response.text}")
            try:
                error_data = e.response.json()
                if "detail" in error_data:
                    return {"status": "error", "message": str(error_data["detail"]), "results": []}
                return {
                    "status": error_data.get("status", "error"), 
                    "message": error_data.get("message", f"Similarity service HTTP error: {e.response.status_code}"), 
                    "results": error_data.get("results", [])
                }
            except ValueError:
                return {"status": "error", "message": f"Similarity service HTTP error: {e.response.status_code}. Non-JSON response: {e.response.text[:200]}", "results": []}
        except httpx.RequestError as e:
            print(f"Request error calling similarity server {target_url}: {e}")
            return {"status": "error", "message": f"Could not connect to similarity service: {e}", "results": []}
        except Exception as e:
            print(f"Generic error calling similarity server {target_url}: {e}")
            return {"status": "error", "message": f"An unexpected error occurred: {e}", "results": []}

async def calculate_similarity_for_upload(audio_bytes: bytes, original_filename: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Sends uploaded audio bytes to the similarity server and returns enriched similar tracks.
    Args:
        audio_bytes: The raw bytes of the audio file.
        original_filename: The original filename, used for context/logging and passed to server.
        top_k: Number of similar tracks to return.
    """
    if not audio_bytes:
        # This is a validation on the main server side, return our standard format
        return {"success": False, "error": "Audio data is empty for similarity processing."}

    files_data = {"file": (original_filename, audio_bytes, "application/octet-stream")}
    request_data = {"top_k": top_k}    
    similarity_response = await _call_similarity_server("/query-by-upload/", data=request_data, files=files_data)

    # Check the status from the similarity server's response
    if similarity_response.get("status") == "success":
        raw_results = similarity_response.get("results", [])
        track_identifiers = [res.get("path") for res in raw_results if res.get("path")]
        
        enriched_similar_tracks = []
        if track_identifiers:
            enriched_similar_tracks = await _fetch_track_details_from_db_by_path(track_identifiers)
        
        # TODO: Get actual duration of uploaded track, ideally from similarity_response if provided by that server
        # For now, using a placeholder. If similarity_response includes it, use that.
        mock_duration_uploaded = similarity_response.get("processed_track_duration") 
        if mock_duration_uploaded is None:
             mock_duration_uploaded = int(len(audio_bytes) / 16000) # Fallback placeholder
             if mock_duration_uploaded < 5: mock_duration_uploaded = 5

        return {
            "success": True, # Main server operation success
            # "original_message": similarity_response.get("message"), # Optionally pass server message
            "data": { # This matches the expected format for the frontend via format_response
                 "duration": mock_duration_uploaded, 
                 "similar_tracks": enriched_similar_tracks
            }
        }
    else:
        # Error reported by the similarity server or connection issue handled by _call_similarity_server
        error_message = similarity_response.get("message", "Unknown error during similarity processing.")
        return {"success": False, "error": error_message}

async def get_similarity_by_path(server_track_path: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Gets similar tracks for a given server-side file path by calling the similarity server.
    """
    payload = {"file_path": server_track_path, "top_k": top_k}
    similarity_response = await _call_similarity_server("/query-by-path/", data=payload)

    # Fetch duration of the queried track from our DB first (if possible)
    # This is independent of similarity server success for *finding similar tracks*
    duration_of_queried_track = 0
    try:
        queried_track_details_list = await _fetch_track_details_from_db_by_path([server_track_path])
        if queried_track_details_list and queried_track_details_list[0].get("duration") is not None:
            duration_of_queried_track = queried_track_details_list[0]["duration"]
        else:
            # If not in DB or no duration, use a default or indicate it's unknown
            # The similarity server itself does not return the duration of the source track for path queries.
            duration_of_queried_track = 0 # Or a specific value like -1 to indicate unknown
            print(f"Warning: Duration for queried path '{server_track_path}' not found in local DB.")
    except Exception as e:
        print(f"Error fetching duration for queried path '{server_track_path}' from DB: {e}")
        duration_of_queried_track = 0 # Default on error

    if similarity_response.get("status") == "success":
        raw_results = similarity_response.get("results", [])
        track_identifiers = [res.get("path") for res in raw_results if res.get("path")]
        
        enriched_similar_tracks = []
        if track_identifiers:
            # Exclude the queried track itself from the similar tracks list if it appears
            # This assumes track_identifiers contains paths that are comparable to server_track_path
            filtered_identifiers = [tid for tid in track_identifiers if tid != server_track_path]
            if filtered_identifiers:
                 enriched_similar_tracks = await _fetch_track_details_from_db_by_path(filtered_identifiers)

        return {
            "success": True,
            "data": {
                "duration": duration_of_queried_track, 
                "similar_tracks": enriched_similar_tracks
            }
        }
    elif similarity_response.get("status") == "not_found":
        # Path not found on similarity server, but we might still have its duration from our DB.
        # Return success=True because the API call to main server was fine, but data reflects the finding.
        return {
            "success": True, 
            "data": {
                "duration": duration_of_queried_track, 
                "similar_tracks": [],
                "message": similarity_response.get("message", f"Track '{server_track_path}' not processed by similarity server.")
            }
        }
    else:
        # Error from similarity server
        error_message = similarity_response.get("message", "Unknown error from similarity server.")
        return {"success": False, "error": error_message}

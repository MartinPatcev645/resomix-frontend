"""
Similarity Module
===============

This module provides functionality for calculating audio similarity by interacting with a dedicated similarity microservice.

Functions:
- calculate_similarity_for_upload: Processes an uploaded audio file (bytes) and returns similar tracks.
- get_similarity_by_path: Gets similar tracks for a given server-side file path, including details of the queried track.
- _fetch_track_details_from_db_by_path: Fetches and maps track details from MongoDB based on paths.

Author: AI Assistant
Date: May 2023 (Updated for path removal in responses and queried track details)
"""

import os
import httpx
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import re # For path prefix removal
import asyncio # For to_thread
import io # For BytesIO
from mutagen import File as MutagenFile, MutagenError # For duration calculation

# Import the MongoDB collection getter from the search module
# This assumes src/search.py and src/similarity.py are in the same directory (src)
from .search import get_db_collection 

load_dotenv()

SIMILARITY_SERVER_URL = os.getenv("SIMILARITY_SERVER_URL")
PATH_PREFIX_TO_REMOVE = "/home/usman/data/" # Ensured this is the exact prefix.

async def _fetch_track_details_from_db_by_path(track_paths_from_similarity_server: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Fetches full track details from MongoDB based on a list of absolute file paths 
    returned by the similarity server. Transforms paths and maps results by relative path.

    Args:
        track_paths_from_similarity_server: A list of absolute file paths 
                                            (e.g., /home/usman/data/veggera/public_html/audio.mp3).
        
    Returns:
        A dictionary mapping relative_path to track_details_dict.
        Track_details_dict contains: id, filename, album, duration, artist.
    """
    if not track_paths_from_similarity_server:
        return {}

    relative_paths_to_query = set() # Use a set to automatically handle duplicate inputs mapping to same relative path
    for p in track_paths_from_similarity_server:
        if p and p.startswith(PATH_PREFIX_TO_REMOVE):
            relative_paths_to_query.add(p[len(PATH_PREFIX_TO_REMOVE):])
        elif p: # Path does not have the prefix, add as is or log warning
            print(f"Warning: Path '{p}' from similarity server does not start with expected prefix '{PATH_PREFIX_TO_REMOVE}'. Will be queried as is.")
            relative_paths_to_query.add(p)
    
    if not relative_paths_to_query:
        return {}

    collection = await get_db_collection()
    if collection is None:
        print("Fetch_track_details: MongoDB collection is not available.")
        return {}

    mongo_query = {"file.path": {"$in": list(relative_paths_to_query)}}
    
    details_map: Dict[str, Dict[str, Any]] = {}
    try:
        cursor = collection.find(mongo_query)
        async for doc in cursor:
            mongo_relative_path = doc.get("file", {}).get("path")
            if not mongo_relative_path: # Should not happen if query is correct and data exists
                continue

            duration = 0
            if doc.get("info") and doc["info"].get("length"):
                try:
                    duration = int(float(doc["info"]["length"])) 
                except (ValueError, TypeError):
                    duration = 0
            
            track_data = {
                "id": str(doc.get("_id")),
                "filename": doc.get("file", {}).get("filename", "N/A"),
                "album": doc.get("info", {}).get("album", "N/A"),
                "duration": duration,
                "artist": doc.get("info", {}).get("artist", "N/A") # Added artist
            }
            details_map[mongo_relative_path] = track_data
        
        print(f"MongoDB: Fetched details for {len(details_map)} out of {len(relative_paths_to_query)} unique relative paths.")
        
    except Exception as e:
        print(f"Error during MongoDB fetch for track details: {e}")
        return {} 
        
    return details_map

def _get_duration_from_bytes_sync(audio_bytes: bytes) -> Optional[int]:
    """Calculates the duration of audio from bytes using mutagen."""
    try:
        file_like_object = io.BytesIO(audio_bytes)
        audio = MutagenFile(file_like_object)
        if audio and audio.info and hasattr(audio.info, 'length') and audio.info.length is not None:
            return int(round(audio.info.length))
    except MutagenError:
        print("MutagenError: Could not load audio from bytes to get duration.")
    except Exception as e:
        print(f"Error getting duration from bytes: {e}")
    return None # Return None if duration can't be determined

def _deduplicate_tracks(tracks: List[Dict[str, Any]], target_count: int) -> List[Dict[str, Any]]:
    """
    Removes duplicate tracks based on filename and duration, sorts by score,
    re-ranks, and then returns up to target_count tracks.
    """
    seen_tracks = set()
    deduplicated_list = []
    for track in tracks:
        filename_full = track.get("filename", "")
        # Remove extension from filename for the key
        filename_base, file_extension = os.path.splitext(filename_full)
        duration = track.get("duration", -1)
        track_key = (filename_base.lower().strip(), duration) # Use lowercased base filename
        
        if track_key not in seen_tracks:
            deduplicated_list.append(track)
            seen_tracks.add(track_key)
    
    # Sort by score in descending order (higher score is better)
    # Ensure score exists and is a number, default to 0 or a very low number if missing/invalid
    deduplicated_list.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x.get("score"), (int, float, str)) and str(x.get("score")).replace('.', '', 1).isdigit() else 0, reverse=True)
    
    # Re-rank the sorted list
    reranked_list = []
    for i, track_item in enumerate(deduplicated_list):
        track_item["rank"] = i + 1
        reranked_list.append(track_item)
        
    # Return up to target_count tracks
    return reranked_list[:target_count]

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

async def calculate_similarity_for_upload(audio_bytes: bytes, original_filename: str, top_k: int = 10, similarity_duplication_threshold: int = 0) -> Dict[str, Any]:
    """
    Sends uploaded audio bytes to the similarity server and returns enriched similar tracks.
    Args:
        audio_bytes: The raw bytes of the audio file.
        original_filename: The original filename, used for context/logging and passed to server.
        top_k: Number of similar tracks to request from similarity server (already includes duplication threshold).
        similarity_duplication_threshold: The threshold for removing duplicates before returning.
    """
    if not audio_bytes:
        return {"success": False, "error": "Audio data is empty for similarity processing."}

    # Concurrently get duration and call similarity server
    duration_task = asyncio.to_thread(_get_duration_from_bytes_sync, audio_bytes)

    files_data = {"file": (original_filename, audio_bytes, "application/octet-stream")}
    request_data = {"top_k": top_k}
    similarity_response_task = _call_similarity_server("/query-by-upload/", data=request_data, files=files_data)

    # Await both tasks
    calculated_duration, similarity_response = await asyncio.gather(
        duration_task,
        similarity_response_task
    )

    # Check the status from the similarity server's response
    if similarity_response.get("status") == "success":
        raw_results = similarity_response.get("results", [])
        abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]
        
        mongo_details_map = {}
        if abs_paths_from_server:
            mongo_details_map = await _fetch_track_details_from_db_by_path(abs_paths_from_server)

        enriched_similar_tracks = []
        for res_item in raw_results:
            abs_path = res_item.get("path")
            if not abs_path: continue

            relative_path = ""
            if abs_path.startswith(PATH_PREFIX_TO_REMOVE):
                relative_path = abs_path[len(PATH_PREFIX_TO_REMOVE):]
            else:
                relative_path = abs_path # Should have prefix
            
            details = mongo_details_map.get(relative_path)
            if details:
                enriched_similar_tracks.append({
                    "rank": res_item.get("rank"),
                    "score": res_item.get("score"),
                    "id": details.get("id"),
                    "filename": details.get("filename"),
                    "album": details.get("album"),
                    "duration": details.get("duration"),
                    "artist": details.get("artist")
                })
            # else: track details not found in DB for this path, so it's omitted from results

        # Deduplicate tracks before returning
        # The target count should be the original requested amount (top_k - threshold)
        target_count_after_deduplication = top_k - similarity_duplication_threshold
        if target_count_after_deduplication < 0: 
            target_count_after_deduplication = 0 # Ensure not negative
        deduplicated_enriched_tracks = _deduplicate_tracks(enriched_similar_tracks, target_count_after_deduplication)

        # Use the locally calculated duration
        final_duration = calculated_duration if calculated_duration is not None else 0 # Default to 0 if None

        return {
            "original_filename": original_filename,
            "duration": final_duration, 
            "similar_tracks": deduplicated_enriched_tracks
        }
    else:
        # Error reported by the similarity server or connection issue handled by _call_similarity_server
        error_message = similarity_response.get("message", "Unknown error during similarity processing.")
        return {"success": False, "error": error_message}

async def get_similarity_by_path(server_track_path: str, top_k: int = 10, similarity_duplication_threshold: int = 0) -> Dict[str, Any]:
    """
    Gets similar tracks for a given server-side file path by calling the similarity server.
    Args:
        server_track_path: The absolute path to the track file on the server.
        top_k: Number of similar tracks to request from similarity server (already includes duplication threshold).
        similarity_duplication_threshold: The threshold for removing duplicates before returning.
    """
    queried_track_data: Optional[Dict[str, Any]] = None
    try:
        details_map_for_queried_track = await _fetch_track_details_from_db_by_path([server_track_path])
        queried_relative_path = server_track_path[len(PATH_PREFIX_TO_REMOVE):] if server_track_path.startswith(PATH_PREFIX_TO_REMOVE) else server_track_path
        queried_track_data = details_map_for_queried_track.get(queried_relative_path)
        if not queried_track_data:
            print(f"Warning: Details for queried path '{server_track_path}' (relative: '{queried_relative_path}') not found in local DB.")
    except Exception as e:
        print(f"Error fetching details for queried path '{server_track_path}' from DB: {e}")

    payload = {"file_path": server_track_path, "top_k": top_k}
    similarity_response = await _call_similarity_server("/query-by-path/", data=payload)

    if similarity_response.get("status") == "success":
        raw_results = similarity_response.get("results", [])
        abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]

        mongo_details_map = {}
        if abs_paths_from_server:
            mongo_details_map = await _fetch_track_details_from_db_by_path(abs_paths_from_server)

        enriched_similar_tracks = []
        for res_item in raw_results:
            abs_path = res_item.get("path")
            if not abs_path or abs_path == server_track_path: continue # Exclude queried track
            
            relative_path = ""
            if abs_path.startswith(PATH_PREFIX_TO_REMOVE):
                relative_path = abs_path[len(PATH_PREFIX_TO_REMOVE):]
            else:
                relative_path = abs_path # Should have prefix based on user info
            
            details = mongo_details_map.get(relative_path)
            if details:
                enriched_similar_tracks.append({
                    "rank": res_item.get("rank"),
                    "score": res_item.get("score"),
                    "id": details.get("id"),
                    "filename": details.get("filename"),
                    "album": details.get("album"),
                    "duration": details.get("duration"),
                    "artist": details.get("artist")
                })
            # else: track details not found in DB for this path, so it's omitted
        
        # Deduplicate tracks before returning
        # The target count should be the original requested amount (top_k - threshold)
        target_count_after_deduplication = top_k - similarity_duplication_threshold
        if target_count_after_deduplication < 0: 
            target_count_after_deduplication = 0 # Ensure not negative
        deduplicated_enriched_tracks = _deduplicate_tracks(enriched_similar_tracks, target_count_after_deduplication)

        return {
            "queried_track": queried_track_data, 
            "similar_tracks": deduplicated_enriched_tracks
        }
    elif similarity_response.get("status") == "not_found":
        # Path not found on similarity server, but we might still have its duration from our DB.
        # Return success=True because the API call to main server was fine, but data reflects the finding.
        return {
            "queried_track": queried_track_data,
            "similar_tracks": [],
            "message": similarity_response.get("message", f"Track '{server_track_path}' not processed by similarity server.")
        }
    else:
        # Error from similarity server
        error_message = similarity_response.get("message", "Unknown error from similarity server.")
        return {"success": False, "error": error_message}

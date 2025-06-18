"""
Monthly Pipeline Service
========================

This service handles monthly pipeline track processing functionality.
It coordinates embedding preview generation with the similarity server
and manages the workflow for monthly pipeline tracks.

Provides methods for generating embedding previews and managing
the monthly pipeline track processing workflow.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import httpx
from typing import Dict, Any, Optional

from app.core.config import settings


class MonthlyPipelineService:
    """
    Service for handling monthly pipeline track processing.
    """
    
    def __init__(self):
        """Initialize monthly pipeline service."""
        self.similarity_server_url = os.getenv("SIMILARITY_SERVER_URL")

    async def generate_embedding_preview(
        self, 
        audio_bytes: bytes, 
        original_filename: str, 
        track_uuid: str,
        path: str
    ) -> Dict[str, Any]:
        """
        Generate embedding preview for monthly pipeline tracks.
        
        Args:
            audio_bytes: The raw bytes of the audio file
            original_filename: The original filename
            track_uuid: The UUID of the track
            path: The file path for the track
            
        Returns:
            Dictionary containing success status or error information
        """
        if not audio_bytes:
            return {"success": False, "error": "Audio data is empty for embedding preview generation."}

        try:
            # Prepare data for similarity server
            files_data = {"file": (original_filename, audio_bytes, "application/octet-stream")}
            request_data = {"track_uuid": track_uuid, "path": path}
            
            # Call similarity server's generate_embedding_preview endpoint
            response = await self._call_similarity_server(
                "/generate_embedding_preview", 
                data=request_data, 
                files=files_data
            )
            
            # Check response status
            if response.get("status") == "success":
                return {"success": True, "message": response.get("message", "Embedding preview generated successfully")}
            else:
                error_message = response.get("message", "Unknown error from similarity server")
                return {"success": False, "error": f"Failed to generate embedding preview: {error_message}"}
                
        except Exception as e:
            print(f"Error generating embedding preview: {e}")
            return {"success": False, "error": f"An unexpected error occurred while generating embedding preview: {e}"}

    async def _call_similarity_server(self, endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Helper function to call the similarity server for monthly pipeline operations.
        Returns the JSON response directly or a structured error.
        """
        if not self.similarity_server_url:
            print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
            return {"status": "error", "message": "Similarity server URL not configured on main server.", "results": []}

        target_url = f"{self.similarity_server_url.rstrip('/')}{endpoint}"
        print(f"Calling similarity server for monthly pipeline: {target_url} with data: {data}")

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
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

from sqlalchemy import text


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

    # -------------------------------------------------------------------------
    #  Update Embeddings (bulk)
    # -------------------------------------------------------------------------

    async def update_embeddings(self, db) -> Dict[str, Any]:
        """Generate a UUID↔path NDJSON mapping for every track and send to the
        similarity server's /update_embeddings endpoint.

        Args:
            db: Async SQLAlchemy session

        Returns:
            JSON response from the similarity server or structured error dict.
        """
        import json
        import tempfile
        import subprocess
        import os

        # Step 1: Fetch uuid and file_path for all tracks
        try:
            result = await db.execute(text("SELECT uuid, file_path FROM tracks"))
            rows = result.fetchall()
        except Exception as e:
            print(f"Error querying tracks for update_embeddings: {e}")
            return {"success": False, "error": f"Database query failed: {e}"}

        # Short-circuit if nothing returned
        if not rows:
            return {"success": False, "error": "No tracks found in database."}

        # Log the number of tracks found
        print(f"[UPDATE_EMBEDDINGS] Found {len(rows)} tracks in database")

        # Step 2: Write NDJSON mapping to a temporary file
        abs_prefix = "/home/usman/data/"
        try:
            with tempfile.NamedTemporaryFile(mode="w+", suffix=".ndjson", delete=False) as tmp_file:
                for uuid_val, rel_path in rows:
                    abs_path = abs_prefix + rel_path.lstrip("/") if rel_path else ""
                    record = {"uuid": uuid_val, "path": abs_path}
                    tmp_file.write(json.dumps(record) + "\n")
                tmp_file_path = tmp_file.name
        except Exception as e:
            print(f"Error writing NDJSON file for update_embeddings: {e}")
            return {"success": False, "error": f"Failed to write NDJSON file: {e}"}

        # Step 3: Log file size before sending
        try:
            file_size = os.path.getsize(tmp_file_path)
            print(f"[UPDATE_EMBEDDINGS] NDJSON file created: {tmp_file_path}")
            print(f"[UPDATE_EMBEDDINGS] File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
            print(f"[UPDATE_EMBEDDINGS] Number of entries: {len(rows)}")
        except Exception as e:
            print(f"Error getting file size: {e}")

        # Step 4: Transfer file via SCP
        filename = os.path.basename(tmp_file_path)
        remote_path = f"/home/ubuntu/usman/resomix-similarity/data/all_tracks/{filename}"
        
        try:
            print("[UPDATE_EMBEDDINGS] Transferring file via SCP...")
            scp_command = [
                "scp", "-i", "/etc/pem/resomix22tbserver-key.pem", "-P", "8522",
                tmp_file_path, f"ubuntu@65.21.116.184:{remote_path}"
            ]
            
            result = subprocess.run(scp_command, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                print(f"SCP transfer failed: {result.stderr}")
                return {"success": False, "error": f"SCP transfer failed: {result.stderr}"}
            
            print(f"[UPDATE_EMBEDDINGS] File transferred successfully to: {remote_path}")
            
        except subprocess.TimeoutExpired:
            print("SCP transfer timed out")
            return {"success": False, "error": "SCP transfer timed out"}
        except Exception as e:
            print(f"Error during SCP transfer: {e}")
            return {"success": False, "error": f"SCP transfer failed: {e}"}

        # Step 5: Send request to similarity server with file path
        try:
            print("[UPDATE_EMBEDDINGS] Sending file path to similarity server...")
            request_data = {"file_path": remote_path}
            response = await self._call_similarity_server("/monthly-pipeline/update_embeddings", data=request_data)
        except Exception as e:
            print(f"Error sending file path to similarity server: {e}")
            return {"success": False, "error": f"Failed to send file path to similarity server: {e}"}

        # Clean up local temp file
        try:
            os.unlink(tmp_file_path)
            print(f"[UPDATE_EMBEDDINGS] Cleaned up local temp file: {tmp_file_path}")
        except Exception as e:
            print(f"Warning: Could not clean up temp file {tmp_file_path}: {e}")

        # Pass through raw response but mark success boolean for consistency
        if response.get("status") == "success":
            return {"success": True, "data": response}
        return {"success": False, "error": response.get("message", "Unknown error from similarity server")}

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

        async with httpx.AsyncClient(timeout=300.0, headers={"Origin": "https://bserver.resomix.com"}) as client:
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

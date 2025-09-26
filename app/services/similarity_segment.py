"""
Similarity Segment Service
==========================

This service handles segment preview functionality for the similarity system.
It provides methods for calling segment preview endpoints, saving responses,
and managing the segment preview workflow.

This is separated from the main similarity service for better organization
and maintainability of segment-related operations.

Version: 3.0.1
Init Date: September 26, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import json
import httpx
import asyncio
import time
from typing import Dict, List, Any
from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies.database import get_database_session


class SimilaritySegmentService:
    """
    Service for handling segment preview functionality in the similarity system.
    """
    
    def __init__(self, similarity_server_url: str):
        """
        Initialize segment service.
        
        Args:
            similarity_server_url: URL of the similarity server
        """
        self.similarity_server_url = similarity_server_url
        self.playlist_repository = PlaylistRepository()
    
    async def call_segment_preview_endpoint(self, uuids: List[str], playlist_id: str) -> None:
        """
        Call the segment preview endpoint and save the response to a log file.
        This runs in the background and doesn't affect the main similarity response.
        
        Args:
            uuids: List of track UUIDs to process
            playlist_id: Playlist identifier for logging
        """
        if not self.similarity_server_url:
            print("ERROR: SIMILARITY_SERVER_URL is not set, skipping segment preview request")
            return
        
        # Ensure log directory exists first
        log_dir = settings.segment_requests_log_dir
        os.makedirs(log_dir, exist_ok=True)
        
        target_url = f"{self.similarity_server_url.rstrip('/')}/previews-segment/"
        payload = {"uuids": uuids}
        
        print(f"[SEGMENT] Calling segment preview endpoint for playlist {playlist_id} with {len(uuids)} UUIDs")
        
        try:
            start_ts = time.perf_counter()
            async with httpx.AsyncClient(timeout=settings.segment_requests_timeout) as client:
                response = await client.post(target_url, json=payload)
                response.raise_for_status()
                response_data = response.json()

                elapsed = time.perf_counter() - start_ts

                # Save response to log file
                await self.save_segment_response(playlist_id, response_data)

                # Log summary
                summary = response_data.get("summary", {})
                remaining = summary.get("remaining", 0)
                processed = summary.get("total_processed", 0)
                print(
                    f"[SEGMENT] Playlist {playlist_id}: Processed={processed}, "
                    f"Successful={summary.get('successful', 0)}, Errors={summary.get('errors', 0)}, Already Existed={summary.get('already_existed', 0)}, Skipped Range={summary.get('skipped_range', 0)}, Remaining={remaining}"
                )

                if remaining and processed:
                    per_track = elapsed / processed
                    wait_time = per_track * remaining * 1.5  # safety factor
                    print(f"[SEGMENT] Waiting ~{wait_time:.1f}s for remaining segment jobs before marking playlist ready")
                    asyncio.create_task(self._delayed_mark_ready(playlist_id, wait_time))
                else:
                    # No remaining tasks – mark ready immediately
                    await self._mark_playlist_ready(playlist_id)
                
        except Exception as e:
            print(f"[SEGMENT] Error calling segment preview endpoint for playlist {playlist_id}: {e}")
            # Save error log
            error_data = {
                "status": "error",
                "error": str(e),
                "playlist_id": playlist_id,
                "uuids_count": len(uuids)
            }
            await self.save_segment_response(playlist_id, error_data)

            # Even on error, mark playlist ready to unblock polling
            await self._mark_playlist_ready(playlist_id)

    async def save_segment_response(self, playlist_id: str, response_data: Dict[str, Any]) -> None:
        """
        Save segment response data to a log file.
        
        Args:
            playlist_id: Playlist identifier for the log file name
            response_data: Response data to save
        """
        try:
            # Ensure log directory exists
            log_dir = settings.segment_requests_log_dir
            os.makedirs(log_dir, exist_ok=True)
            
            # Create log file path
            log_file = os.path.join(log_dir, f"{playlist_id}.json")
            
            # Save response
            with open(log_file, 'w') as f:
                json.dump(response_data, f, indent=2)
                
            print(f"[SEGMENT] Response saved to {log_file}")
            
        except Exception as e:
            print(f"[SEGMENT] Error saving response for playlist {playlist_id}: {e}")

    async def handle_segment_preview_workflow(
        self, 
        uuids: List[str], 
        playlist_id: str, 
        deduplicated_enriched_tracks: List[Dict]
    ) -> None:
        """
        TEMPORARY FEATURE: Handle segment preview workflow.
        This method orchestrates steps 9,10,11 in background and waits for segment response.
        Remove this entire method and its calls to disable the feature.
        
        Args:
            uuids: List of track UUIDs to process
            playlist_id: Playlist identifier
            deduplicated_enriched_tracks: List of enriched track data
        """
        if not settings.segment_requests_enabled:
            return
            
        try:
            # Wait for segment preview response (main blocking operation)
            await self.call_segment_preview_endpoint(uuids, playlist_id)
        except Exception as e:
            print(f"[SEGMENT] Error in segment preview workflow: {e}")

    async def _mark_playlist_ready(self, playlist_uuid: str) -> None:
        """Update playlist type to similarity once segment processing done."""
        try:
            # Obtain new DB session (cannot reuse FastAPI dep here easily)
            async for db in get_database_session():
                # Fetch playlist via UUID then update
                playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
                if playlist:
                    playlist.type = "similarity"
                    await db.commit()
                break
        except Exception as e:
            print(f"[SEGMENT] Error marking playlist ready: {e}")

    async def _delayed_mark_ready(self, playlist_id: str, delay: float):
        """Sleep for delay seconds then mark playlist ready."""
        try:
            await asyncio.sleep(delay)
        finally:
            await self._mark_playlist_ready(playlist_id)

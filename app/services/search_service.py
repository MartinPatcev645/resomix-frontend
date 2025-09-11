"""
Search Service
==============

This service provides comprehensive track search functionality across multiple criteria.
It handles text-based searches, artist/album/genre filtering, BPM range queries,
and musical key searches using MariaDB repositories.

Coordinates with track repository to perform complex queries and format results
for API consumption with proper error handling and data validation.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import re
import time
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.track_repository import TrackRepository
from app.utils.elasticsearch_utils import get_es_client


class SearchService:
    """
    Service for searching tracks using MariaDB instead of MongoDB.
    Maintains the same API interface as the original MongoDB-based search.
    """
    
    def __init__(self):
        """Initialize search service."""
        self.track_repository = TrackRepository()
    
    async def search_tracks(self, db: AsyncSession, query: str, limit: int = 20) -> Dict[str, Any]:
        """
        Search for tracks via Elasticsearch first, then fetch full details from MariaDB.
        """
        if not query or not query.strip():
            return {"tracks": []}

        query_clean = query.strip()
        es_client = get_es_client()
        overall_start = time.perf_counter()

        # Build ES body (simplified to mirror previous logic)
        tokens_list = query_clean.split()

        if len(tokens_list) <= 2:
            es_body = {
                "collapse": {"field": "dedupe"},
                "query": {
                    "function_score": {
                    "query": {
                        "bool": {
                        "should": [
                            { "multi_match": {
                                "query": query_clean,
                                "fields": ["artists^2","title^1.5"],
                                "type": "best_fields",
                                "operator": "and",
                                "fuzziness": "AUTO"
                            }},
                            { "match": {
                                "all_text": {
                                "query": query_clean, "operator": "and",
                                "fuzziness": "AUTO", "boost": 0.5
                            }}},
                            { "match_phrase_prefix": { "title":    {"query": query_clean, "slop": 2, "boost": 0.7} }},
                            { "match_phrase_prefix": { "all_text": {"query": query_clean, "slop": 2, "boost": 0.5} }}
                        ],
                        "minimum_should_match": 1
                        }
                    },
                    "functions": [
                        {"filter": {"term": {"type": "electrobuzz"}}, "weight": 2.0}
                    ],
                    "score_mode": "sum", "boost_mode": "sum"
                    }
                },
                "size": limit
            }
        else:
            es_body = {
                "collapse": {"field": "dedupe"},
                "query": {
                    "bool": {
                    "must": [
                        { "match": { "all_text": {
                            "query": query_clean, "operator": "and", "fuzziness": "AUTO"
                    }}} ],
                    "should": [
                        { "match_phrase_prefix": { "all_text": {"query": query_clean, "slop": 2, "boost": 0.5} }},
                        { "term": { "type": "electrobuzz" } }
                    ]
                    }
                },
                "size": limit
            }

        es_failed = False
        try:
            es_start = time.perf_counter()
            es_resp = es_client.search(index="tracks-*", body=es_body)
            hits = es_resp.get("hits", {}).get("hits", [])
            print(f"[Timing] Elasticsearch query took {(time.perf_counter()-es_start):.3f}s and returned {len(hits)} hits")
            # Display all provided details for first two hits
            for i, hit in enumerate(hits[:2]):
                print(f"Hit {i+1}:")
                print(hit)
            uuids = [h["_source"].get("uuid") for h in hits if h.get("_source")]
        except Exception as e:
            print(f"Elasticsearch query failed: {e}. Will fallback to DB-only search.")
            es_failed = True
            uuids = []

        formatted_results: List[Dict[str, Any]] = []

        if uuids:
            db_start = time.perf_counter()
            tracks = await self.track_repository.async_get_tracks_by_uuids(db, uuids)
            print(f"[Timing] DB enrichment for {len(uuids)} uuids took {(time.perf_counter()-db_start):.3f}s")

            # Map uuid -> track object for quick lookup to retain ES order
            track_map = {t.uuid: t for t in tracks}

            for uuid in uuids:
                track_obj = track_map.get(uuid)
                if not track_obj:
                    continue

                artist_name = (
                    track_obj.track_artists[0].artist.name if track_obj.track_artists else "N/A"
                )

                formatted_results.append({
                    "id": uuid,
                    "artist": artist_name,
                    "duration": track_obj.duration_sec or 0,
                    "title": track_obj.title
                })
        elif es_failed:
            # Fallback only when ES errored out
            db_fallback_start = time.perf_counter()
            db_results = await self.track_repository.async_search_tracks(db, query_clean, limit)
            print(f"[Timing] Fallback DB text search took {(time.perf_counter()-db_fallback_start):.3f}s and returned {len(db_results)} tracks")
            for track_data in db_results:
                formatted_results.append({
                    "id": track_data.get("id"),
                    "artist": track_data.get("artist", "N/A"),
                    "duration": track_data.get("duration", 0),
                    "title": track_data.get("title", "N/A")
                })
        else:
            # No ES hits and ES succeeded: return empty results
            print("[Timing] Elasticsearch returned 0 hits; not falling back to DB.")

        print(f"[Timing] Total search_tracks execution time: {(time.perf_counter()-overall_start):.3f}s")
        return {"tracks": formatted_results}

    async def get_track_path_by_id(self, db: AsyncSession, track_id: str) -> Optional[str]:
        """
        Fetches the file path of a track by its UUID.
        
        Maintains the same API interface as the original MongoDB get_track_path_by_id function.
        
        Args:
            db: Database session
            track_id: The UUID of the track (equivalent to MongoDB ObjectId)
            
        Returns:
            The file path if found, else None
        """
        if not track_id or not track_id.strip():
            print(f"Invalid track_id format: {track_id}")
            return None
        
        try:
            file_path = await self.track_repository.async_get_track_path_by_uuid(db, track_id.strip())
            if file_path:
                print(f"Path found for track_id {track_id}: {file_path}")
                return file_path
            else:
                print(f"Track with ID '{track_id}' not found.")
                return None
        except Exception as e:
            print(f"Error fetching track path for ID {track_id}: {e}")
            return None

    def validate_search_query(self, query: str) -> bool:
        """
        Validate search query to prevent potential issues.
        
        Args:
            query: Search query string
            
        Returns:
            True if query is valid, False otherwise
        """
        if not query or not isinstance(query, str):
            return False
        
        # Remove leading/trailing whitespace
        query = query.strip()
        
        # Check minimum length
        if len(query) < 1:
            return False
        
        # Check maximum length to prevent excessive queries
        if len(query) > 100:
            return False
        
        return True 
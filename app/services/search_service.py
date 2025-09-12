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
import unicodedata
import time
from typing import Dict, Any, Optional, List
from app.core.config import settings
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
    
    async def search_tracks(self, db: AsyncSession, query: str) -> Dict[str, Any]:
        """
        Search for tracks via Elasticsearch first, then fetch full details from MariaDB.
        """
        # Set default limits
        limit = settings.es_search_limit

        if not query or not query.strip():
            return {"tracks": []}

        # Pre-process query
        raw_q = query.strip()
        query_clean = self.clean_for_text(raw_q)   # for multi_match / match
        tokens_lower = self.normalize_for_keyword(raw_q)  # for terms_set

        if not query_clean:
            return {"tracks": []}

        es_client = get_es_client()
        overall_start = time.perf_counter()

        # Build ES body (simplified to mirror previous logic)
        tokens_list = query_clean.split()

        tokens_lower = [t.lower() for t in tokens_list if t]

        if len(tokens_list) <= 2:
            es_body = self.build_short_query_es_body(query_clean, tokens_lower, limit)
        else:
            es_body = self.build_long_query_es_body(query_clean, tokens_lower, limit)

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
            # Collect uuid, all_text, and score for deduplication
            hit_items = [
                {
                    "uuid": h.get("_source", {}).get("uuid"),
                    "all_text": h.get("_source", {}).get("all_text", ""),
                    "score": h.get("_score", 0.0),
                }
                for h in hits if h.get("_source")
            ]
            # Deduplicate based on punctuation-stripped all_text
            uuids = self.deduplicate_results_punctuation(hit_items)
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
    
    def build_short_query_es_body(self, query_text: str, tokens_kw: list[str], limit: int = 20):
        # Require 1 token if 1 given, else require both tokens when 2 are given
        msm_script = {"source": "params.num_terms <= 1 ? 1 : 2"}

        # Per-token artist boosts via function_score filters (works on keyword field)
        artist_token_functions = [
            {"filter": {"term": {"artists": tok}}, "weight": 2.0}  # gentle per-token bump
            for tok in tokens_kw
        ]

        es_body = {
            "collapse": {"field": "dedupe"},
            "query": {
                "function_score": {
                    "query": {
                        "bool": {
                            "should": [
                                # 1) Artist presence gate (non-scoring query, but ensures recall)
                                {
                                    "terms_set": {
                                        "artists": {
                                            "terms": tokens_kw,
                                            "minimum_should_match_script": msm_script,
                                        }
                                    }
                                },
                                # 2) Title match (slightly stronger than all_text)
                                {
                                    "multi_match": {
                                        "query": query_text,
                                        "fields": ["title^2.2"],
                                        "type": "best_fields",
                                        "operator": "and",
                                        "fuzziness": "AUTO"
                                    }
                                },
                                # 3) Phrase on title (nice precision when two tokens given)
                                {
                                    "match_phrase": {
                                        "title": {"query": query_text, "slop": 2, "boost": 3.0}
                                    }
                                },
                                # 4) All text (broad safety net; lower weight)
                                {
                                    "match": {
                                        "all_text": {
                                            "query": query_text,
                                            "operator": "and",
                                            "fuzziness": "AUTO",
                                            "boost": 0.6
                                        }
                                    }
                                }
                            ],
                            "minimum_should_match": 1
                        }
                    },
                    "functions": [
                        # Stronger boost when ALL artist tokens are present
                        {
                            "filter": {
                                "terms_set": {
                                    "artists": {
                                        "terms": tokens_kw,
                                        "minimum_should_match_script": msm_script
                                    }
                                }
                            },
                            "weight": 6.0
                        },
                        # Gentle bumps for any single-token artist hits
                        *artist_token_functions,
                        # Keep your existing source boost
                        {"filter": {"term": {"type": "electrobuzz"}}, "weight": 2.0}
                    ],
                    "score_mode": "sum",
                    "boost_mode": "sum"
                }
            },
            "_source": ["uuid", "type", "artists", "title"],
            "size": limit
        }
        return es_body

    
    def build_long_query_es_body(self, query_text: str, tokens_kw: list[str], limit: int = 20):
        """
        Long query (>= 3 tokens): emphasize precise title matches while still allowing recall via all_text,
        and gently prioritize artist presence when full/partial artist tokens appear.
        Expects:
        - query_text from clean_for_text(raw_q)
        - tokens_kw  from normalize_for_keyword(raw_q)
        """
        # Require 1 token if 1 given, else require both when 2+ are given
        msm_script = {"source": "params.num_terms <= 1 ? 1 : 2"}

        artist_token_functions = [
            {"filter": {"term": {"artists": tok}}, "weight": 1.5}  # gentle per-token bump
            for tok in tokens_kw
        ]

        es_body = {
            "collapse": {"field": "dedupe"},
            "query": {
                "function_score": {
                    "query": {
                        # Use dis_max so the best field dominates, with a small tie-break
                        "dis_max": {
                            "tie_breaker": 0.2,
                            "queries": [
                                # Strong precision when phrase is in the title
                                {"match_phrase": {"title": {"query": query_text, "slop": 2, "boost": 3.2}}},
                                # Solid exact-ish title match with fuzziness
                                {"match": {"title": {"query": query_text, "operator": "and", "fuzziness": "AUTO", "boost": 2.2}}},
                                # Broad recall safety net
                                {"match": {"all_text": {"query": query_text, "operator": "and", "fuzziness": "AUTO", "boost": 0.9}}}
                            ]
                        }
                    },
                    "functions": [
                        # Prefer docs where all artist tokens are present (for queries like "vinicius honorio locust")
                        {
                            "filter": {
                                "terms_set": {
                                    "artists": {
                                        "terms": tokens_kw,
                                        "minimum_should_match_script": msm_script
                                    }
                                }
                            },
                            "weight": 4.5
                        },
                        # Small bumps for any single-token artist hits
                        *artist_token_functions,
                        # Keep your source/type boost
                        {"filter": {"term": {"type": "electrobuzz"}}, "weight": 2.0}
                    ],
                    "score_mode": "sum",
                    "boost_mode": "sum"
                }
            },
            "_source": ["uuid", "type", "artists", "title"],
            "size": limit
        }
        return es_body



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

    def normalize_for_keyword(self, q: str) -> list[str]:
        """
        Mimics ES keyword normalizer: lowercase + asciifolding + strip punctuation.
        Returns token list for terms_set queries.
        """
        # Step 1: lowercase + ascii folding (remove accents)
        nfkd = unicodedata.normalize("NFKD", q)
        folded = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
        lowered = folded.lower()

        # Step 2: remove punctuation (replace with spaces)
        no_punct = re.sub(r"[^0-9a-z]+", " ", lowered)

        # Step 3: collapse multiple spaces
        cleaned = re.sub(r"\s+", " ", no_punct).strip()

        return cleaned.split() if cleaned else []


    def clean_for_text(self, q: str) -> str:
        """
        Light clean for ES text fields: just trim and collapse spaces.
        ES analyzer handles lowercase, asciifolding, punctuation.
        """
        return re.sub(r"\s+", " ", q.strip())

    # ---------------------------------------------------------------------
    # Helper utilities
    # ---------------------------------------------------------------------

    def deduplicate_results_punctuation(self, items: List[dict]) -> List[str]:
        """Deduplicate ES hit list by stripping punctuation from *all_text*.

        Args:
            items: A list of dicts with keys ``uuid``, ``all_text`` and ``score``.

        Returns:
            Ordered list of UUIDs after deduplication. If two or more items
            normalise to the same *all_text*, keep the one with the highest
            ``score``. If scores tie, keep whichever appears first.  The
            original ordering of non-duplicate items is preserved.
        """
        import unicodedata

        def strip_punct(text: str) -> str:
            # Remove any char whose Unicode *category* starts with 'P' (punctuation)
            # while leaving letters (including accents), numbers, symbols, & spaces.
            return "".join(ch for ch in text if not unicodedata.category(ch).startswith("P"))

        best_index_for_key: dict[str, int] = {}
        cleaned_keys: List[str] = []  # same length as output list for quick access
        output_items: List[dict] = []

        for idx, it in enumerate(items):
            uuid = it.get("uuid")
            if not uuid:
                continue  # skip malformed
            print(f"all_text: {it.get('all_text', '')}")
            key = strip_punct(it.get("all_text", "")).lower().strip()
            print(f"after strip: {key}")
            score = it.get("score", 0.0)

            # If key becomes empty (e.g. all_text missing) fall back to uuid so it is unique
            if not key:
                key = uuid  # guarantees uniqueness across hits

            prev_idx = best_index_for_key.get(key)
            if prev_idx is None:
                # first time we see this key
                best_index_for_key[key] = len(output_items)
                cleaned_keys.append(key)
                output_items.append({"uuid": uuid, "score": score})
            else:
                # duplicate – keep the one with higher score (or existing if tie)
                if score > output_items[prev_idx]["score"]:
                    output_items[prev_idx] = {"uuid": uuid, "score": score}
                # else: keep existing (ties resolved in favour of first)

        # Preserve the order in which unique keys first appeared
        return [item["uuid"] for item in output_items]

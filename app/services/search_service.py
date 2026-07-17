"""
Search Service
==============

This service provides comprehensive track search functionality across multiple criteria.
It handles text-based searches, artist/album/genre filtering, BPM range queries,
and musical key searches using MariaDB repositories.

Coordinates with track repository to perform complex queries and format results
for API consumption with proper error handling and data validation.

For artist and title specific query: https://chatgpt.com/share/68d8d31f-ae08-8012-8985-29e93da8da6d

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import re
import unicodedata
import time
from typing import Dict, Any, Optional, List, Literal
from app.core.config import settings
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
    
    async def search_tracks(self, db: AsyncSession, query: str, mode: Optional[Literal["artist", "title", "auto"]] = "auto", partner_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Search for tracks via Elasticsearch first, then fetch full details from MariaDB.
        If DEMO_MODE is enabled, search only OPEN tracks directly from MariaDB.
        
        Now includes partner_id scoping for tenant isolation.
        """
        # Set default limits
        limit = settings.es_search_limit

        if not query or not query.strip():
            return {"tracks": []}

        # Pre-process query
        raw_q = query.strip()
        query_clean = self.clean_for_text(raw_q)   # for multi_match / match

        if not query_clean:
            return {"tracks": []}
        
        # DEMO MODE LOGIC
        if settings.demo_mode:
            print(f"[SEARCH] DEMO MODE ENABLED: Searching only OPEN tracks for '{query_clean}'")
            try:
                # Direct DB search for OPEN tracks
                # We'll use a simple LIKE query on title or artist
                # Note: This is a basic implementation for demo purposes
                from sqlalchemy import select, or_, and_
                from app.models.track import Track
                from app.models.track_contributor import TrackContributor
                from app.models.contributor import Contributor
                from app.models.constants import TrackType
                
                # Join with contributors to search by artist name
                stmt = (
                    select(Track)
                    .outerjoin(TrackContributor)
                    .outerjoin(Contributor)
                    .where(and_(
                        Track.track_type == TrackType.OPEN,
                        Track.track_type != TrackType.UPLOAD
                    ))
                    .where(
                        or_(
                            Track.title.ilike(f"%{query_clean}%"),
                            Contributor.full_name.ilike(f"%{query_clean}%")
                        )
                    )
                    .limit(limit)
                    .distinct()
                )
                
                result = await db.execute(stmt)
                tracks = result.scalars().all()
                
                formatted_results = []
                for track_obj in tracks:
                    # Get all artist names
                    # Note: We need to handle async loading of relationships if not eager loaded
                    # But assuming track_repository patterns, we might need to be careful.
                    # For simplicity in this direct query, we'll try to access what we can.
                    # Ideally we should use repository methods but we need a custom query here.
                    
                    # Re-fetch with eager loading to be safe or rely on lazy loading if session is open
                    # Let's try to use the object directly as session is active
                    artist_names = [tc.contributor.full_name for tc in track_obj.recording_contributors]
                    artist_display = ", ".join(artist_names) if artist_names else "N/A"
                    
                    formatted_results.append({
                        "id": track_obj.uuid,
                        "artist": artist_display,
                        "duration": float(track_obj.duration_sec) if track_obj.duration_sec is not None else 0.0,
                        "title": track_obj.title
                    })
                
                print(f"[SEARCH] Demo mode found {len(formatted_results)} tracks")
                return {"tracks": formatted_results}
                
            except Exception as e:
                print(f"[SEARCH] Demo mode search failed: {e}")
                return {"tracks": []}


        # NORMAL MODE
        # When Elasticsearch is disabled (ELASTICSEARCH_ENABLED=false), or if any ES
        # error occurs, we transparently fall back to the MariaDB LIKE search so search
        # never hard-fails. Flip ELASTICSEARCH_ENABLED=true once the index is built.
        if not settings.elasticsearch_enabled:
            return await self._db_search(db, query_clean, limit, partner_id)

        overall_start = time.perf_counter()

        # Keyword tokens are folded/lowercased the same way the `artists` field's
        # `lower_kw` normalizer folds values at index time, so term/terms_set match.
        tokens_kw = self.normalize_for_keyword(raw_q)
        tokens_list = query_clean.split()

        # Build ES body based on the requested mode (artist / title / auto).
        if mode == "artist":
            es_body = self.build_artist_query(query_clean, tokens_kw, limit)
        elif mode == "title":
            es_body = self.build_title_query(query_clean, tokens_kw, limit)
        else:  # "auto": short queries lean on artist/phrase; long queries on precise title
            if len(tokens_list) <= 2:
                es_body = self.build_short_query_es_body(query_clean, tokens_kw, limit)
            else:
                es_body = self.build_long_query_es_body(query_clean, tokens_kw, limit)

        try:
            es_client = get_es_client()
            es_resp = es_client.search(index=settings.es_index_alias, body=es_body)
            hits = es_resp.get("hits", {}).get("hits", [])
            hit_items = [
                {
                    "uuid": h.get("_source", {}).get("uuid"),
                    "dedupe": (h.get("fields", {}).get("dedupe") or [""])[0],
                    "score": h.get("_score", 0.0),
                }
                for h in hits if h.get("_source")
            ]
            uuids = self.deduplicate_results_punctuation(hit_items)
        except Exception as e:
            print(f"[SEARCH] Elasticsearch query failed ({e}); falling back to DB search.")
            return await self._db_search(db, query_clean, limit, partner_id)

        # ES succeeded with zero hits is a real answer — don't fall back.
        if not uuids:
            print(f"[SEARCH] ES returned 0 hits for '{query_clean}' (mode={mode}) in "
                  f"{(time.perf_counter()-overall_start):.3f}s")
            return {"tracks": []}

        # Hydrate the winning UUIDs from MariaDB for fresh, authoritative display data.
        # async_get_tracks_by_uuids re-applies partner scoping + hides inactive/uploaded
        # tracks, so a stale ES doc (e.g. since-retired track) can never surface.
        tracks = await self.track_repository.async_get_tracks_by_uuids(
            db, uuids, partner_id=partner_id, exclude_uploads=True
        )
        track_map = {t.uuid: t for t in tracks}

        formatted_results: List[Dict[str, Any]] = []
        for uuid in uuids:  # preserve ES relevance ordering
            track = track_map.get(uuid)
            if not track:
                continue
            formatted_results.append({
                "id": track.uuid,
                "artist": track.display_artist or "N/A",
                "duration": float(track.duration_ms) / 1000.0 if track.duration_ms is not None else 0.0,
                "title": track.title,
            })

        print(f"[SEARCH] ES found {len(formatted_results)} tracks for '{query_clean}' "
              f"(mode={mode}) in {(time.perf_counter()-overall_start):.3f}s")
        return {"tracks": formatted_results}

    async def _db_search(self, db: AsyncSession, query_clean: str, limit: int,
                         partner_id: Optional[int]) -> Dict[str, Any]:
        """MariaDB LIKE search — used when ES is disabled or unavailable."""
        overall_start = time.perf_counter()
        db_results = await self.track_repository.async_search_tracks(
            db, query_clean, limit, partner_id=partner_id
        )
        print(f"[DB Search] Found {len(db_results)} tracks in {(time.perf_counter()-overall_start):.3f}s")
        return {
            "tracks": [
                {
                    "id": r.get("id"),
                    "artist": r.get("artist", "N/A"),
                    "duration": r.get("duration", 0.0),
                    "title": r.get("title", "N/A"),
                }
                for r in db_results
            ]
        }

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
            "docvalue_fields": ["dedupe"],
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
            "docvalue_fields": ["dedupe"],
            "_source": ["uuid", "type", "artists", "title"],
            "size": limit
        }
        return es_body


    def build_artist_query(self, query_text: str, tokens_kw: list[str], limit: int = 20):
        # tokens_kw already lowercased in your caller; each token must match artists in some way
        # Strategy:
        # - For each token: (prefix OR wildcard) on artists => token must match (minimum_should_match=1 inside token-clause)
        # - Boost if the entire phrase (query_text) appears in a single artist value via wildcard
        # - Keep your electrobuzz source boost
        must_per_token = [
            {
                "bool": {
                    "should": [
                        {"prefix":   {"artists": tok}},             # starts-with
                        {"wildcard": {"artists": f"*{tok}*"}}       # contains (slower but effective on keyword)
                    ],
                    "minimum_should_match": 1
                }
            }
            for tok in tokens_kw if tok
        ]

        phrase_wildcard = {"wildcard": {"artists": f"*{query_text}*"}} if query_text else None

        es_body = {
            "collapse": {"field": "dedupe"},
            "query": {
                "function_score": {
                    "query": {
                        "bool": {
                            "must": must_per_token or [{"wildcard": {"artists": f"*{query_text}*"}}]
                        }
                    },
                    "functions": [
                        # Extra boost when the whole phrase lands inside a single artist value
                        *( [{"filter": phrase_wildcard, "weight": 3.5}] if phrase_wildcard else [] ),

                        # Your existing source/type boost
                        {"filter": {"term": {"type": "electrobuzz"}}, "weight": 2.0}
                    ],
                    "score_mode": "sum",
                    "boost_mode": "sum"
                }
            },
            "docvalue_fields": ["dedupe"],
            "_source": ["uuid", "type", "artists", "title"],
            "size": limit
        }
        return es_body

    def build_title_query(self, query_text: str, tokens_kw: list[str], limit: int = 20):
        es_body = {
            "collapse": {"field": "dedupe"},
            "query": {
                "function_score": {
                    "query": {
                        "dis_max": {
                            "tie_breaker": 0.2,
                            "queries": [
                                # Autocomplete on the last token in the phrase
                                {"match_phrase_prefix": {"title": {"query": query_text, "boost": 2.6}}},

                                # Strong precision when the phrase occurs in order (with small slop)
                                {"match_phrase": {"title": {"query": query_text, "slop": 2, "boost": 3.0}}},

                                # Fuzzy full-text title match for minor typos
                                {"match": {"title": {"query": query_text, "operator": "and", "fuzziness": "AUTO", "boost": 2.0}}}
                            ]
                        }
                    },
                    "functions": [
                        {"filter": {"term": {"type": "electrobuzz"}}, "weight": 2.0}
                    ],
                    "score_mode": "sum",
                    "boost_mode": "sum"
                }
            },
            "docvalue_fields": ["dedupe"],
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
        """Deduplicate ES hit list by stripping punctuation from *dedupe*.

        Args:
            items: A list of dicts with keys ``uuid``, ``dedupe`` and ``score``.

        Returns:
            Ordered list of UUIDs after deduplication. If two or more items
            normalise to the same *dedupe*, keep the one with the highest
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
            key = strip_punct(it.get("dedupe", "")).lower().strip()
            score = it.get("score", 0.0)

            # If key becomes empty (e.g. dedupe missing) fall back to uuid so it is unique
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

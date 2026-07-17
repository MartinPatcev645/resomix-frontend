"""
Elasticsearch Index Definition & Helpers
========================================

Single source of truth for the *tracks* search index: its settings/mappings, the
document shape, and the alias-swap machinery used for zero-downtime rebuilds.

Design (tuned for the resource-constrained Alwyzon single node):
  * One concrete index per rebuild (``tracks_v<UTC-stamp>``) fronted by a stable
    alias (``tracks_search``). The app *only* ever queries the alias. A rebuild
    creates a brand-new index, bulk-loads it, then atomically repoints the alias
    and drops the old index — so search never sees a half-built index and there
    is no downtime.
  * ``number_of_shards: 1`` (the whole catalogue is < 1 GB) and
    ``number_of_replicas: 0`` (single node — a replica can never be allocated and
    only turns the cluster yellow while wasting disk).
  * Strict mappings so a stray field can never silently bloat the index.

Document shape (matches the query builders in ``search_service.py``):
  uuid       keyword                     — the track UUID (also the _id)
  type       keyword                     — always "electrobuzz" for now
  artists    keyword[] (lower_kw norm)   — individual artist names, for exact/term boosts
  title      text (folding_text)         — fuzzy/phrase title matching + display
  title_norm text (folding_text)         — reserved (kept for template parity; unused)
  all_text   text (folding_text)         — "<artists...> <title>" broad recall net
  dedupe     keyword (lower_kw norm)     — "<norm artists...>|<title>" for collapse/dedup

Init Date: July 17, 2026
Author: Muhammad Usman Naeem
"""

from __future__ import annotations

import re
import time
import unicodedata
from typing import Any, Dict, List, Optional

from app.core.config import settings

# ---------------------------------------------------------------------------
# Names
# ---------------------------------------------------------------------------

#: Stable alias the application searches against. Never query a concrete index.
ALIAS = settings.es_index_alias

#: Prefix for the concrete, versioned indices that the alias points at.
INDEX_PREFIX = f"{ALIAS}_v"


def new_index_name() -> str:
    """Return a fresh, time-stamped concrete index name (UTC, seconds resolution)."""
    return f"{INDEX_PREFIX}{time.strftime('%Y%m%d%H%M%S', time.gmtime())}"


# ---------------------------------------------------------------------------
# Settings / mappings
# ---------------------------------------------------------------------------

def index_body(refresh_interval: str = "30s") -> Dict[str, Any]:
    """Full create-index body (settings + strict mappings).

    ``refresh_interval`` is set to ``-1`` during a bulk load (no per-doc refresh
    overhead) and flipped back to a sane value once the load finishes.
    """
    return {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "refresh_interval": refresh_interval,
            "analysis": {
                "analyzer": {
                    "folding_text": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase", "asciifolding"],
                    }
                },
                "normalizer": {
                    "lower_kw": {
                        "type": "custom",
                        "filter": ["lowercase", "asciifolding"],
                    }
                },
            },
        },
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "uuid": {"type": "keyword"},
                "type": {"type": "keyword"},
                "artists": {"type": "keyword", "normalizer": "lower_kw"},
                "title": {"type": "text", "analyzer": "folding_text"},
                "title_norm": {"type": "text", "analyzer": "folding_text"},
                "all_text": {"type": "text", "analyzer": "folding_text"},
                "dedupe": {"type": "keyword", "normalizer": "lower_kw"},
            },
        },
    }


# ---------------------------------------------------------------------------
# Document building
# ---------------------------------------------------------------------------

# Separators that denote *distinct* artists inside a single display_artist string.
# Conservative on purpose: only unambiguous joiners, so a single multi-word artist
# name ("Mihai Popoviciu", "B feat. C") stays intact rather than being mangled. The
# individual words are still fully searchable via the analyzed `all_text` field.
_ARTIST_SPLIT_RE = re.compile(r"\s*(?:,|;|&|/)\s*")


def split_artists(display_artist: Optional[str]) -> List[str]:
    """Split a denormalized ``display_artist`` into individual artist names.

    Mirrors the old Logstash pipeline's array-of-names shape (it split a
    ``GROUP_CONCAT(... SEPARATOR ', ')`` on ", "). Order-preserving, de-duplicated,
    empties dropped.
    """
    if not display_artist:
        return []
    parts = [p.strip() for p in _ARTIST_SPLIT_RE.split(display_artist)]
    seen: set[str] = set()
    out: List[str] = []
    for p in parts:
        if p and p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return out


def _norm_kw(s: str) -> str:
    """Lowercase + ascii-fold + strip non-alphanumerics to spaces (dedupe key part).

    Matches ``SearchService.normalize_for_keyword`` so index-time dedupe keys line
    up with what the client-side dedup logic produces.
    """
    nfkd = unicodedata.normalize("NFKD", s)
    folded = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    lowered = folded.lower()
    no_punct = re.sub(r"[^0-9a-z]+", " ", lowered)
    return re.sub(r"\s+", " ", no_punct).strip()


def build_track_doc(uuid: str, title: str, display_artist: Optional[str],
                    track_type: str = "electrobuzz") -> Dict[str, Any]:
    """Build the ES document for one track row (matches the strict mappings)."""
    title = (title or "").strip()
    artists = split_artists(display_artist)

    norm_arts = [_norm_kw(a) for a in artists]
    dedupe = "|".join([p for p in norm_arts] + [title]).strip("|")
    all_text = " ".join(artists + [title]).strip()

    return {
        "uuid": uuid,
        "type": track_type or "electrobuzz",
        "artists": artists,
        "title": title,
        "all_text": all_text,
        "dedupe": dedupe or uuid,  # never empty — guarantees a stable collapse key
    }


# ---------------------------------------------------------------------------
# Alias management (zero-downtime swap)
# ---------------------------------------------------------------------------

def swap_alias(es, alias: str, new_index: str) -> List[str]:
    """Atomically point ``alias`` at ``new_index``, detaching every other index.

    Returns the list of previously-aliased indices (so the caller can delete them).
    The remove+add happens in a single ``_aliases`` call, so a searcher always sees
    exactly one index behind the alias.
    """
    old_indices: List[str] = []
    if es.indices.exists_alias(name=alias):
        old_indices = list(es.indices.get_alias(name=alias).keys())

    actions: List[Dict[str, Any]] = []
    for idx in old_indices:
        if idx != new_index:
            actions.append({"remove": {"index": idx, "alias": alias}})
    actions.append({"add": {"index": new_index, "alias": alias}})

    es.indices.update_aliases(body={"actions": actions})
    return [i for i in old_indices if i != new_index]

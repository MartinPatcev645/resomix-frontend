#!/usr/bin/env python3
"""Partner API smoke test: prove an ingested catalogue is actually queryable.

Written for the Electrobuzz ingestion test (see docs/PARTNER_INGESTION_TEST_PLAN.md).
A batch reaching READY only says our own pipeline finished. This asks the question a
partner actually cares about: can I authenticate, find my tracks, and get similarity
back for them?

Every check is independent and reported on its own line, so a partial pass is visible
rather than collapsing into one pass/fail. Nothing here writes: it is safe to run
against production, and safe to re-run.

Usage::

    export RESOMIX_PARTNER_KEY='rmx_...'
    python scripts/partner_api_smoke.py --expected 29

    # against a different host
    python scripts/partner_api_smoke.py --base https://bserver.resomix.com

The key is read from the environment by default so it never lands in shell history
or in this file. It is never printed: only a masked form appears in the output.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:  # pragma: no cover
    print("This script needs `requests` (pip install requests).", file=sys.stderr)
    raise SystemExit(2)

OK = "  OK  "
FAIL = " FAIL "
INFO = "  ..  "
WARN = " WARN "

DEFAULT_BASE = "https://bserver.resomix.com"


class Result:
    """Tally of independent checks, so one failure does not hide the rest."""

    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.warned = 0

    def ok(self, msg: str) -> None:
        print(f"{OK} {msg}")
        self.passed += 1

    def fail(self, msg: str) -> None:
        print(f"{FAIL} {msg}")
        self.failed += 1

    def warn(self, msg: str) -> None:
        print(f"{WARN} {msg}")
        self.warned += 1

    @staticmethod
    def info(msg: str) -> None:
        print(f"{INFO} {msg}")


def _mask(key: str) -> str:
    """Enough to identify which key was used, not enough to use it."""
    return f"{key[:12]}…{key[-4:]}" if len(key) > 20 else "…"


def _call(
    method: str,
    base: str,
    path: str,
    key: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: float = 60.0,
) -> Tuple[Optional[int], Any, float]:
    """One API call. Returns (status_code, parsed_body_or_text, elapsed_seconds).

    Sends the key as a Bearer token, which is what the partner docs specify. A
    status of None means the request never completed.
    """
    url = f"{base.rstrip('/')}{path}"
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    started = time.monotonic()
    try:
        resp = requests.request(
            method, url, headers=headers, params=params, json=body, timeout=timeout
        )
    except Exception as exc:  # noqa: BLE001
        return None, f"{type(exc).__name__}: {exc}", time.monotonic() - started
    elapsed = time.monotonic() - started
    try:
        return resp.status_code, resp.json(), elapsed
    except ValueError:
        return resp.status_code, resp.text[:400], elapsed


def _unwrap(payload: Any) -> Any:
    """Unwrap the ``{"success": true, "data": {...}}`` envelope when present."""
    if isinstance(payload, dict) and "data" in payload and isinstance(
        payload.get("data"), (dict, list)
    ):
        return payload["data"]
    return payload


def _find_list(payload: Any, *keys: str) -> List[Any]:
    """First list found under any of ``keys``, at the top level or inside ``data``."""
    for candidate in (payload, _unwrap(payload)):
        if isinstance(candidate, list):
            return candidate
        if isinstance(candidate, dict):
            for k in keys:
                if isinstance(candidate.get(k), list):
                    return candidate[k]
    return []


def _track_id(track: Dict[str, Any]) -> Optional[str]:
    """Similarity keys on the track UUID; different views name it differently."""
    for k in ("track_uuid", "uuid", "track_id", "id", "_id"):
        v = track.get(k)
        if v:
            return str(v)
    return None


def _label(track: Dict[str, Any]) -> str:
    title = track.get("title") or track.get("name") or "?"
    artist = (
        track.get("display_artist")
        or track.get("artist")
        or track.get("artist_name")
        or "?"
    )
    return f"{artist} - {title}"


# ----------------------------------------------------------------------------------
# Checks
# ----------------------------------------------------------------------------------
def check_auth(base: str, key: str, r: Result) -> Optional[Dict[str, Any]]:
    """`/partner/me` is the documented way to verify a key works."""
    print("\n1. Authentication")
    status, body, secs = _call("GET", base, "/api/v1/partner/me", key)

    if status is None:
        r.fail(f"could not reach {base}: {body}")
        return None
    if status in (401, 403):
        r.fail(f"key rejected (HTTP {status}): {json.dumps(body)[:200]}")
        return None
    if status != 200:
        r.fail(f"HTTP {status}: {json.dumps(body)[:200]}")
        return None

    me = _unwrap(body) or {}
    r.ok(f"key accepted ({secs:.2f}s)")
    for field, pretty in (
        ("id", "partner id"),
        ("display_name", "partner"),
        ("partner_uuid", "uuid"),
        ("service_mode", "service mode"),
        ("tier", "tier"),
        ("is_active", "active"),
        ("country_code", "country"),
    ):
        if isinstance(me, dict) and me.get(field) not in (None, "", []):
            r.info(f"{pretty:<13}: {me[field]}")
    return me if isinstance(me, dict) else None


def check_unauthenticated_is_rejected(base: str, r: Result) -> None:
    """A key-protected endpoint must not answer without a key.

    Cheap, but it is the difference between "my key works" and "this endpoint is
    open to the world", and only one of those is acceptable.
    """
    print("\n2. Unauthenticated request is refused")
    url = f"{base.rstrip('/')}/api/v1/partner/me"
    try:
        resp = requests.get(url, timeout=30)
    except Exception as exc:  # noqa: BLE001
        r.fail(f"request failed: {type(exc).__name__}: {exc}")
        return
    if resp.status_code in (401, 403):
        r.ok(f"rejected without a key (HTTP {resp.status_code})")
    else:
        r.fail(f"answered HTTP {resp.status_code} with NO key, expected 401/403")


def check_search(
    base: str, key: str, r: Result, queries: List[str]
) -> List[Dict[str, Any]]:
    """Search the partner's own catalogue. Returns whatever tracks were found."""
    print("\n3. Search")
    found: List[Dict[str, Any]] = []
    for q in queries:
        status, body, secs = _call(
            "GET", base, "/api/v1/search_tracks/", key, params={"query": q, "mode": "auto"}
        )
        if status != 200:
            r.fail(f"query {q!r}: HTTP {status} {json.dumps(body)[:160]}")
            continue
        tracks = _find_list(body, "tracks", "results", "items", "data")
        if tracks:
            r.ok(f"query {q!r}: {len(tracks)} result(s) in {secs:.2f}s")
            for t in tracks[:3]:
                if isinstance(t, dict):
                    r.info(f"  {_label(t)}")
            found.extend(t for t in tracks if isinstance(t, dict))
        else:
            r.warn(f"query {q!r}: 0 results ({secs:.2f}s)")
    if not found:
        r.fail("no query returned anything; the catalogue is not searchable")
    return found


def check_similarity(
    base: str, key: str, r: Result, seed: Dict[str, Any], top_sk: int
) -> None:
    """The real proof for a similarity-only partner: neighbours from the FAISS index."""
    print("\n4. Similarity by track id")
    tid = _track_id(seed)
    if not tid:
        r.fail(f"no usable id on the seed track: {list(seed)[:8]}")
        return

    r.info(f"seed: {_label(seed)}")
    r.info(f"id  : {tid}")
    status, body, secs = _call(
        "POST",
        base,
        "/api/v1/similarity/search",
        key,
        body={"track_id": tid, "top_sk": top_sk},
        timeout=180.0,
    )
    if status != 200:
        r.fail(f"HTTP {status}: {json.dumps(body)[:300]}")
        return

    neighbours = _find_list(body, "similar_tracks", "results", "tracks", "items", "data")
    if not neighbours:
        r.fail(f"200 OK but no neighbours returned ({secs:.2f}s): {json.dumps(body)[:250]}")
        return

    r.ok(f"{len(neighbours)} neighbour(s) in {secs:.2f}s")

    # A track being its own nearest neighbour is the classic sign the index holds the
    # vector we think it does; its absence is worth flagging but is not a failure,
    # since some engines deliberately drop the seed.
    ids = {_track_id(n) for n in neighbours if isinstance(n, dict)}
    if tid in ids:
        r.info("seed returned as its own neighbour (index contains it)")

    shown = 0
    for n in neighbours:
        if not isinstance(n, dict) or shown >= 5:
            continue
        score = n.get("score") or n.get("similarity") or n.get("distance")
        score_s = f"{score:.4f}" if isinstance(score, (int, float)) else str(score or "?")
        r.info(f"  {score_s:>8}  {_label(n)}")
        shown += 1

    scored = [
        n.get("score") or n.get("similarity")
        for n in neighbours
        if isinstance(n, dict) and isinstance(n.get("score") or n.get("similarity"), (int, float))
    ]
    if scored and all(s == 0 for s in scored):
        r.fail("every score is 0, which means the vectors are not being compared")


def check_top_sk(base: str, key: str, r: Result, seed: Dict[str, Any]) -> None:
    """`top_sk` is documented as 10/20/50/100. Check it is honoured and validated."""
    print("\n5. top_sk handling")
    tid = _track_id(seed)
    if not tid:
        r.warn("skipped, no seed id")
        return

    status, body, _ = _call(
        "POST", base, "/api/v1/similarity/search", key,
        body={"track_id": tid, "top_sk": 10}, timeout=180.0,
    )
    if status == 200:
        n = len(_find_list(body, "similar_tracks", "results", "tracks", "items", "data"))
        # A small catalogue can legitimately return fewer than asked for.
        if n <= 10:
            r.ok(f"top_sk=10 returned {n}, within the requested bound")
        else:
            r.fail(f"top_sk=10 returned {n}, more than requested")
    else:
        r.fail(f"top_sk=10: HTTP {status}")

    status, body, _ = _call(
        "POST", base, "/api/v1/similarity/search", key,
        body={"track_id": tid, "top_sk": 7}, timeout=180.0,
    )
    if status in (400, 422):
        r.ok(f"invalid top_sk=7 rejected (HTTP {status})")
    elif status == 200:
        r.warn("top_sk=7 accepted; the docs say only 10/20/50/100 are valid")
    else:
        r.warn(f"top_sk=7 returned HTTP {status}")


def check_bad_track_id(base: str, key: str, r: Result) -> None:
    """A made-up id must 404, not 500 and not silently return someone else's tracks."""
    print("\n6. Unknown track id")
    status, body, _ = _call(
        "POST", base, "/api/v1/similarity/search", key,
        body={"track_id": "00000000-0000-4000-8000-000000000000", "top_sk": 10},
        timeout=60.0,
    )
    if status in (400, 404, 422):
        r.ok(f"unknown id rejected (HTTP {status})")
    elif status == 200:
        n = len(_find_list(body, "similar_tracks", "results", "tracks", "items", "data"))
        if n:
            r.fail(f"unknown id returned {n} tracks; check catalogue scoping")
        else:
            r.warn("unknown id returned 200 with an empty list, expected 404")
    else:
        r.fail(f"unknown id returned HTTP {status}: {json.dumps(body)[:200]}")


# ----------------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default=os.getenv("RESOMIX_API_BASE", DEFAULT_BASE))
    ap.add_argument("--key", default=os.getenv("RESOMIX_PARTNER_KEY", ""))
    ap.add_argument("--expected", type=int, default=None,
                    help="Track count the catalogue should hold, for reporting.")
    ap.add_argument("--top-sk", type=int, default=20, choices=(10, 20, 50, 100))
    ap.add_argument("--query", action="append", default=[],
                    help="Search term. Repeatable. Defaults to a broad sweep.")
    ap.add_argument("--track-uuid", action="append", default=[],
                    help="Seed similarity from these track UUIDs instead of relying on "
                         "search. Repeatable. Needed while search is ES-backed and a "
                         "freshly ingested catalogue is not yet in the index (F14).")
    args = ap.parse_args()

    if not args.key:
        print("No API key. Set RESOMIX_PARTNER_KEY or pass --key.", file=sys.stderr)
        return 2

    queries = args.query or ["original mix", "remix", "a", "mix"]

    print(f"Partner API smoke test")
    print(f"  base : {args.base}")
    print(f"  key  : {_mask(args.key)}")
    if args.expected:
        print(f"  catalogue expected to hold {args.expected} track(s)")

    r = Result()

    me = check_auth(args.base, args.key, r)
    if me is None:
        print("\nAuthentication failed, so nothing downstream can be checked.")
        return 1

    check_unauthenticated_is_rejected(args.base, r)
    tracks = check_search(args.base, args.key, r, queries)

    # Search is the documented way to obtain a track_id, but it is ES-backed and a freshly
    # ingested catalogue is not in that index (F14). --track-uuid lets similarity still be
    # proven independently of search rather than being skipped along with it.
    seed: Optional[Dict[str, Any]] = None
    if args.track_uuid:
        seed = {"track_uuid": args.track_uuid[0], "title": "(supplied)", "artist": ""}
    elif tracks:
        seed = tracks[0]

    if seed:
        check_similarity(args.base, args.key, r, seed, args.top_sk)
        check_top_sk(args.base, args.key, r, seed)
    else:
        print("\n4-5. Similarity: skipped, no seed track.")
        print("     Search returned nothing and no --track-uuid was given.")

    check_bad_track_id(args.base, args.key, r)

    print(f"\n{'-' * 62}")
    print(f"{r.passed} passed, {r.failed} failed, {r.warned} warning(s)")
    return 1 if r.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Enrich a similarity-run JSON with track metadata
================================================

Takes the JSON produced by the media server's similarity script in ``resomix-similarity-open`` (a list of
results with ``uuid``/``score``/``filename``) and fills in **title**, **artist** and **duration**
for each track by looking them up in the Alwyzon ``tracks`` table (by UUID).

Run from the repo root with the venv (so it uses the app's DB settings/.env):

    .venv/bin/python scripts/enrich_similarity_json.py slipslide_top100.json
    .venv/bin/python scripts/enrich_similarity_json.py results.json --out enriched.json

By default it writes ``<input>.enriched.json`` next to the input and prints a table. Existing keys
in each result are preserved; ``title``, ``artist``, ``version_title``, ``duration_ms`` and a
formatted ``duration`` are added.
"""

import argparse
import json
import os
import sys

# Run from repo root so `database`/`app` imports and the app's .env resolve.
sys.path.append(os.getcwd())

from sqlalchemy import text, bindparam  # noqa: E402
from database.connection import engine  # noqa: E402


def _fmt_duration(ms):
    """Milliseconds -> 'm:ss' (or None)."""
    if ms is None:
        return None
    total = int(ms) // 1000
    return f"{total // 60}:{total % 60:02d}"


def _fetch_meta(uuids):
    """Return {uuid: {title, version_title, artist, duration_ms}} for the given UUIDs."""
    meta = {}
    stmt = text(
        "SELECT uuid, title, version_title, display_artist, duration_ms "
        "FROM tracks WHERE uuid IN :uuids"
    ).bindparams(bindparam("uuids", expanding=True))
    # Chunk to keep the IN list sane even for large inputs.
    with engine.connect() as conn:
        for i in range(0, len(uuids), 1000):
            chunk = uuids[i:i + 1000]
            for row in conn.execute(stmt, {"uuids": chunk}).mappings():
                meta[row["uuid"]] = {
                    "title": row["title"],
                    "version_title": row["version_title"],
                    "artist": row["display_artist"],
                    "duration_ms": row["duration_ms"],
                }
    return meta


def main():
    ap = argparse.ArgumentParser(description="Enrich a similarity JSON with title/artist/duration.")
    ap.add_argument("json_file", help="Path to the similarity script's output JSON")
    ap.add_argument("--out", default=None, help="Where to write the enriched JSON (default: <input>.enriched.json)")
    args = ap.parse_args()

    if not os.path.isfile(args.json_file):
        sys.exit(f"File not found: {args.json_file}")

    with open(args.json_file, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    results = data.get("results")
    if not isinstance(results, list) or not results:
        sys.exit("No 'results' array found in the JSON.")

    uuids = [r["uuid"] for r in results if r.get("uuid")]
    if not uuids:
        sys.exit("No UUIDs found in the results.")

    meta = _fetch_meta(uuids)

    matched = 0
    for r in results:
        m = meta.get(r.get("uuid"))
        if m:
            r["title"] = m["title"]
            r["version_title"] = m["version_title"]
            r["artist"] = m["artist"]
            r["duration_ms"] = m["duration_ms"]
            r["duration"] = _fmt_duration(m["duration_ms"])
            matched += 1
        else:
            # Keep the shape consistent even when a UUID isn't in the catalogue anymore.
            r.setdefault("title", None)
            r.setdefault("artist", None)
            r.setdefault("duration_ms", None)
            r.setdefault("duration", None)

    out_path = args.out or (os.path.splitext(args.json_file)[0] + ".enriched.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    # Console table.
    print(f"\nEnriched {matched}/{len(results)} results (by UUID) → {out_path}\n")
    print(f"{'#':>4}  {'score':>8}  {'dur':>6}  {'artist':<28}  title")
    print("-" * 100)
    for r in results:
        rank = r.get("rank", "")
        score = r.get("score")
        score_s = f"{score:.4f}" if isinstance(score, (int, float)) else ""
        artist = (r.get("artist") or "—")[:28]
        title = r.get("title") or f"(not found: {r.get('uuid')})"
        if r.get("version_title"):
            title = f"{title} ({r['version_title']})"
        print(f"{rank:>4}  {score_s:>8}  {str(r.get('duration') or '—'):>6}  {artist:<28}  {title}")

    if matched < len(results):
        print(f"\nNote: {len(results) - matched} UUID(s) were not found in the tracks table.", file=sys.stderr)


if __name__ == "__main__":
    main()

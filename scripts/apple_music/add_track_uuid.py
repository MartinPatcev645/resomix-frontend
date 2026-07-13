"""
Script A of the old-catalogue → new-DB migration.

Writes the canonical **track_uuid** onto every record in ``apple_matches.jsonl`` (matched or not) so
the DB rows line up with the media-server assets WITHOUT any renaming. The uuid is computed the SAME
way as the media backfill (``resomix-similarity-open/scripts/run_maest_backfill.py::uuid_for``):

    track_uuid = uuid5(RESOMIX_NS, object_id)   # deterministic — same old id → same uuid, always

Because it's deterministic, this is idempotent by construction (re-running yields identical uuids),
and it works for the not-yet-matched tracks too, whenever you run those.

Outputs (next to the input):
  * ``apple_matches.migrate.jsonl`` — every input record + a top-level ``"track_uuid"``.
  * ``uuid_map.tsv``               — ``old_uuid <TAB> track_uuid <TAB> is_match`` (small; convenience).

Usage:  python add_track_uuid.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT = os.path.join(SCRIPT_DIR, "apple_matches.jsonl")
OUTPUT = os.path.join(SCRIPT_DIR, "apple_matches.migrate.jsonl")
UUID_MAP = os.path.join(SCRIPT_DIR, "uuid_map.tsv")

# MUST match run_maest_backfill.py exactly, or DB uuids won't match the on-disk assets.
RESOMIX_NS = uuid.UUID("5f7e3a2c-9b1d-4e6a-8c0f-2d4b6a8e1f3c")

PROGRESS_EVERY = 100_000
FSYNC_EVERY = 2_000


def uuid_for(object_id: str) -> str:
    return str(uuid.uuid5(RESOMIX_NS, object_id))


def _truncate_partial_tail(path: str) -> int:
    """Drop a half-written trailing line from a prior kill; return the count of COMPLETE lines."""
    if not os.path.exists(path):
        return 0
    complete, last_good_end = 0, 0
    with open(path, "rb") as f:
        for raw in f:
            if raw.endswith(b"\n"):
                try:
                    json.loads(raw)
                except Exception:
                    break
                complete += 1
                last_good_end += len(raw)
            else:
                break
    with open(path, "rb+") as f:
        f.truncate(last_good_end)
    return complete


def main() -> None:
    if not os.path.exists(INPUT):
        sys.exit(f"Input not found: {INPUT}")

    done = _truncate_partial_tail(OUTPUT)
    map_lines = []
    if done and os.path.exists(UUID_MAP):
        with open(UUID_MAP, "r", encoding="utf-8") as mf:
            map_lines = mf.readlines()[:done]
    print(f"Resuming: {done} record(s) already done.", flush=True)

    out = open(OUTPUT, "a", encoding="utf-8")
    mp = open(UUID_MAP, "w", encoding="utf-8")
    mp.writelines(map_lines)

    processed, written = done, 0
    try:
        with open(INPUT, "r", encoding="utf-8") as fin:
            for i, line in enumerate(fin):
                if i < done:
                    continue
                line = line.rstrip("\n")
                if not line:
                    continue
                rec = json.loads(line)
                old = rec.get("uuid") or ""
                track_uuid = uuid_for(old) if old else None
                rec["track_uuid"] = track_uuid
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                mp.write(f"{old}\t{track_uuid or ''}\t{rec.get('is_match', '')}\n")
                processed += 1
                written += 1
                if written % FSYNC_EVERY == 0:
                    out.flush(); os.fsync(out.fileno())
                    mp.flush(); os.fsync(mp.fileno())
                if processed % PROGRESS_EVERY == 0:
                    print(f"  {processed} done…", flush=True)
    finally:
        out.flush(); os.fsync(out.fileno()); out.close()
        mp.flush(); os.fsync(mp.fileno()); mp.close()

    print(f"Done. {processed} total (+{written} this run).\n  -> {OUTPUT}\n  -> {UUID_MAP}", flush=True)


if __name__ == "__main__":
    main()

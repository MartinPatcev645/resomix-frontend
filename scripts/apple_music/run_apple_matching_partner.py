#!/usr/bin/env python3
"""
Run the UNCHANGED Apple matcher over a partner-ingested export.

``run_apple_matching.py`` is the algorithm that was tuned against the client baseline and then
run over the 2.35M catalogue. It is deliberately not edited here. Its input/output paths and
the ETA scale are module-level constants that ``run()`` reads at call time, so this wrapper
just imports it, points those constants at the partner files, and calls ``run()``.

Why separate files: the matcher's defaults (``tracks_input.jsonl`` / ``apple_matches.jsonl``
in this folder) still hold the old catalogue's 10k staging data. The matcher resumes by uuid
from its output file, so appending a new run to the old file would work but would leave two
unrelated catalogues interleaved in one file. This wrapper refuses to write there.

Everything the original does still applies: checkpoint per line, fsync every 500, resume by
uuid on restart, adaptive rate limiter, safe to kill and re-run.

USAGE (on Alwyzon, repo root, venv active; APPLE_* in the environment)

    # 1. export (see export_partner_tracks_jsonl.py)
    python scripts/apple_music/export_partner_tracks_jsonl.py

    # 2. check the resolved config, run nothing
    python scripts/apple_music/run_apple_matching_partner.py --dry-run

    # 3. run under nohup, resumable
    nohup python scripts/apple_music/run_apple_matching_partner.py \\
        > scripts/apple_music/console/run_partner6.log 2>&1 &
    tail -f scripts/apple_music/console/run_partner6.log
"""

from __future__ import annotations

import argparse
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

DEFAULT_IN = os.path.join(SCRIPT_DIR, "tracks_input.partner6.jsonl")
DEFAULT_OUT = os.path.join(SCRIPT_DIR, "apple_matches.partner6.jsonl")
LEGACY_OUT = os.path.join(SCRIPT_DIR, "apple_matches.jsonl")


def count_lines(path: str) -> int:
    n = 0
    with open(path, "r", encoding="utf-8") as f:
        for _ in f:
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default=DEFAULT_IN)
    ap.add_argument("--output", default=DEFAULT_OUT)
    ap.add_argument("--scale", type=int, default=None,
                    help="Track count used for the ETA line (default: lines in --input).")
    ap.add_argument("--workers", type=int, default=None, help="Override WORKERS.")
    ap.add_argument("--start-rps", type=float, default=None, help="Override START_RPS.")
    ap.add_argument("--max-rps", type=float, default=None, help="Override MAX_RPS.")
    ap.add_argument("--process-limit", type=int, default=None,
                    help="Cap tracks processed this run (PROCESS_LIMIT).")
    ap.add_argument("--dry-run", action="store_true", help="Print the resolved config and exit.")
    args = ap.parse_args()

    if os.path.abspath(args.output) == os.path.abspath(LEGACY_OUT):
        print(f"Refusing to write to {LEGACY_OUT}: that is the OLD catalogue's match file. "
              f"Use a different --output.", file=sys.stderr)
        return 2
    if not os.path.exists(args.input):
        print(f"Input not found: {args.input}\nRun export_partner_tracks_jsonl.py first.",
              file=sys.stderr)
        return 2

    import run_apple_matching as rm  # noqa: E402  (imports apple_music_test, reads APPLE_* env)

    rm.INPUT_JSONL = os.path.abspath(args.input)
    rm.OUTPUT_JSONL = os.path.abspath(args.output)
    rm.FULL_SCALE = args.scale if args.scale is not None else count_lines(args.input)
    if args.workers is not None:
        rm.WORKERS = args.workers
    if args.start_rps is not None:
        rm.START_RPS = args.start_rps
    if args.max_rps is not None:
        rm.MAX_RPS = args.max_rps
    if args.process_limit is not None:
        rm.PROCESS_LIMIT = args.process_limit

    already = len(rm.load_done(rm.OUTPUT_JSONL)) if os.path.exists(rm.OUTPUT_JSONL) else 0
    print(f"input        : {rm.INPUT_JSONL}  ({rm.FULL_SCALE:,} track(s))")
    print(f"output       : {rm.OUTPUT_JSONL}  ({already:,} already matched, will be skipped)")
    print(f"workers      : {rm.WORKERS}   adaptive={rm.ADAPTIVE_RATE} "
          f"start={rm.START_RPS}/s max={rm.MAX_RPS}/s   process_limit={rm.PROCESS_LIMIT}")
    print(f"storefront   : {rm.amt.STOREFRONT}   team={'set' if rm.amt.TEAM_ID else 'MISSING'} "
          f"key={'set' if rm.amt.KEY_ID else 'MISSING'}   p8={rm.amt.PRIVATE_KEY_PATH} "
          f"({'found' if os.path.exists(rm.amt.PRIVATE_KEY_PATH) else 'NOT FOUND'})")
    if args.dry_run:
        return 0
    if not rm.amt.TEAM_ID or not rm.amt.KEY_ID or not os.path.exists(rm.amt.PRIVATE_KEY_PATH):
        print("Apple credentials incomplete (APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY_PATH).",
              file=sys.stderr)
        return 2
    rm.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

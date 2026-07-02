"""
Production Apple-Music matcher for the FULL catalogue (staged 10k, then 2.35M).

Reuses the EXACT matching algorithm from apple_music_test.py (imported, not duplicated) and wraps it
in a scale-ready harness:

  * INPUT  : tracks_input.jsonl  (from export_tracks_jsonl.py) — streamed line by line, never all in
             memory.
  * OUTPUT : apple_matches.jsonl — append-only, one JSON object per track. Primary field is
             apple_song_id (the accepted id, or "" when we have no confident match).
  * CHECKPOINT / RESUME : safe for `nohup ... &` + kill. Each result is written and flushed
             immediately; on restart we drop any half-written trailing line and skip every uuid
             already done, continuing exactly where we stopped.
  * ESTIMATES : periodic progress with throughput, ETA for the full 2.35M, and Apple rate-limit
             counters (429s, backoff seconds) — that's the whole point of the 10k staging run.

Run:  nohup python run_apple_matching.py > console/run.log 2>&1 &
"""
import os
import sys
import json
import time
from concurrent.futures import ThreadPoolExecutor, wait, as_completed, FIRST_COMPLETED

import apple_music_test as amt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- configure ----
INPUT_JSONL = os.path.join(SCRIPT_DIR, "tracks_input.jsonl")
OUTPUT_JSONL = os.path.join(SCRIPT_DIR, "apple_matches.jsonl")
PROCESS_LIMIT = None            # cap tracks processed this run (None = all in the input file)
PROGRESS_EVERY = 200            # log progress every N processed tracks
FULL_SCALE = 2_350_000          # for ETA extrapolation
FSYNC_EVERY = 500               # force flush to disk every N writes (durability vs speed)

# Concurrency: WORKERS parallel Apple requests. Sequential (WORKERS=1) is ~1/latency (~2.7/s here);
# raise WORKERS to push harder and find Apple's rate ceiling (429s). Matching is network-bound, so
# throughput ~= WORKERS / latency until Apple throttles.
WORKERS = 8
# Optional global pace: minimum seconds between REQUEST submissions (0 = unlimited). Set this once
# you know Apple's ceiling to pin a safe rate (e.g. 0.05 ~= 20 submissions/s).
SUBMIT_MIN_INTERVAL = 0.0
# -------------------


def load_done(path):
    """Collect uuids already written, and truncate a half-written trailing line so appends stay
    valid. Returns the set of done keys (uuid, or file_path when uuid is empty)."""
    done = set()
    if not os.path.exists(path):
        return done
    good_bytes = 0
    with open(path, "r", encoding="utf-8") as f:
        while True:
            line = f.readline()
            if not line:
                break
            if not line.endswith("\n"):
                break  # partial final line — stop; we'll truncate here
            try:
                rec = json.loads(line)
                done.add(rec.get("uuid") or rec.get("file_path"))
            except json.JSONDecodeError:
                pass
            good_bytes = f.tell()
    # drop any trailing partial line left by a kill mid-write
    if good_bytes != os.path.getsize(path):
        os.truncate(path, good_bytes)
    return done


def build_task(rec):
    """Mirror apple_music_test.process_tracks: DB metadata AS-IS, with the Unknown-artist filename
    fallback, then build the search query."""
    path = rec.get("file_path", "")
    artists = (rec.get("artists") or "").strip()
    title = (rec.get("title") or "").strip()
    if not artists or artists.lower() == "unknown":
        artists, title = amt.parse_from_filename(path)
    return {
        "query": amt.build_search_query(artists, title),
        "path": path,
        "uuid": rec.get("uuid") or "",
        "q_artist": artists,
        "q_title": title,
        "db_title": title,
        "db_duration_sec": rec.get("duration_sec"),
    }


def match_one(task, token):
    """Run the first-pass search + (inline) N/A retries and return the final result dict."""
    db_ms = int(float(task["db_duration_sec"]) * 1000) if task["db_duration_sec"] is not None else None
    low = (task["db_title"] or "").lower()
    is_ext = amt.is_extended(task["db_title"])
    is_radio = "radio edit" in low

    res = amt.eval_query(task["query"], task["q_artist"], task["q_title"], db_ms, is_ext, is_radio, token)
    if not res["found"] and amt.RETRY_NA:
        for _label, alt in amt.retry_queries(task):
            r2 = amt.eval_query(alt, task["q_artist"], task["q_title"], db_ms, is_ext, is_radio, token)
            if r2["is_match"] is True:
                res = r2
                break
    return res, db_ms


def output_record(task, res, rec):
    """The saved row. All of OUR DB metadata lives under `in_house`; everything from Apple lives
    under `apple_music` (populated ONLY for an accepted match). `apple_song_id` is a top-level
    convenience = the accepted id, or "" when we had no confident match. `review` keeps the best
    candidate even when we rejected it, so nothing Apple returned is lost."""
    best = res.get("best")
    im = res.get("is_match")
    is_match = {True: "True", False: "False", None: "N/A"}[im]

    # Our in-house metadata, straight from the DB (passed through from the input JSONL).
    in_house = {
        "title": rec.get("title", ""),
        "artists": rec.get("artists", ""),
        "album": rec.get("album"),
        "album_cover": rec.get("album_cover"),
        "album_release_date": rec.get("album_release_date"),
        "genre": rec.get("genre"),
        "label": rec.get("label"),
        "label_website": rec.get("label_website"),
        "duration_sec": rec.get("duration_sec"),
        "year": rec.get("year"),
        "bpm": rec.get("bpm"),
        "musical_key": rec.get("musical_key"),
        "file_size": rec.get("file_size"),
        "preview_path": rec.get("preview_path"),
        "type": rec.get("type"),
    }

    # Everything Apple returned for the ACCEPTED match. (NOTE: Apple's song attributes do not include
    # a record label, so there is no apple_music.label — keep using our in-house label.)
    apple = None
    if im is True and best:
        apple = {
            "song_id": best.get("id"),
            "isrc": best.get("isrc"),
            "name": best.get("name"),
            "artist": best.get("artist"),
            "album": best.get("albumName"),
            "genres": best.get("genres"),
            "release_date": best.get("releaseDate"),
            "duration_ms": best.get("durationInMillis"),
            "duration": best.get("durationFormatted"),
            "artwork_url": best.get("artwork_url"),      # cover image
            "preview_url": best.get("preview"),          # audio preview
            "deep_link_url": best.get("url"),            # opens in Apple Music
            "song_url": best.get("constructed_url"),
        }

    review = {
        "best_candidate_id": best.get("id") if best else "",
        "best_candidate_name": best.get("name") if best else "",
        "best_candidate_artist": best.get("artist") if best else "",
        "best_candidate_duration_ms": best.get("durationInMillis") if best else "",
        "match_score": round(res["score"], 1) if res.get("score") is not None else "",
        "chosen_rank": res.get("rank") or "",
        "matched_query": res.get("query", ""),
    }

    return {
        "uuid": task["uuid"],
        "file_path": task["path"],
        "is_match": is_match,
        "apple_song_id": (best.get("id") if im is True and best else ""),
        "in_house": in_house,
        "apple_music": apple,
        "review": review,
    }


def fmt_hms(seconds):
    seconds = int(seconds)
    return f"{seconds//3600:d}h{(seconds%3600)//60:02d}m{seconds%60:02d}s"


def process_one(rec, token):
    """Worker (runs in a thread): match one input record and return its output dict. Any error is
    caught and turned into an N/A row (with the error noted) so a single bad track never kills a
    multi-day run."""
    try:
        task = build_task(rec)
        res, _db_ms = match_one(task, token)
        return output_record(task, res, rec)
    except Exception as e:  # noqa: BLE001 — deliberately swallow to keep the run alive
        task = {"uuid": rec.get("uuid", ""), "path": rec.get("file_path", "")}
        res = {"query": "", "found": False, "best": None, "is_match": None, "score": None, "rank": None}
        rec_out = output_record(task, res, rec)
        rec_out["review"]["error"] = f"{type(e).__name__}: {e}"
        return rec_out


def run():
    if not os.path.exists(INPUT_JSONL):
        sys.exit(f"INPUT_JSONL not found: {INPUT_JSONL} (run export_tracks_jsonl.py first)")

    done = load_done(OUTPUT_JSONL)
    print(f"Resuming: {len(done)} tracks already matched.  WORKERS={WORKERS}", flush=True)

    print("Generating Developer Token...", flush=True)
    token = amt.generate_developer_token()

    start = time.time()
    state = {"processed": 0, "accepted": 0}

    def write_result(out, recout):
        out.write(json.dumps(recout, ensure_ascii=False, default=str) + "\n")
        out.flush()
        state["processed"] += 1
        if recout["is_match"] == "True":
            state["accepted"] += 1
        p = state["processed"]
        if p % FSYNC_EVERY == 0:
            os.fsync(out.fileno())
        if p % PROGRESS_EVERY == 0:
            elapsed = time.time() - start
            rate = p / elapsed if elapsed else 0.0
            eta_full = FULL_SCALE / rate if rate else 0
            s = amt.STATS
            print(f"[{len(done)+p}] +{p} this run | {rate:.2f} tracks/s | "
                  f"accepted {state['accepted']}/{p} | reqs={s['requests']} "
                  f"429s={s['rate_limited']} net_err={s['network_errors']} "
                  f"backoff={int(s['backoff_seconds'])}s | ETA(2.35M) ~{fmt_hms(eta_full)}", flush=True)

    max_inflight = max(1, WORKERS * 2)   # bounded submission window (never all futures in memory)
    submitted = 0
    last_submit = 0.0
    with open(OUTPUT_JSONL, "a", encoding="utf-8") as out, \
            ThreadPoolExecutor(max_workers=WORKERS) as ex:
        inflight = set()
        for line in open(INPUT_JSONL, "r", encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = rec.get("uuid") or rec.get("file_path")
            if key in done:
                continue
            if PROCESS_LIMIT is not None and submitted >= PROCESS_LIMIT:
                break

            if SUBMIT_MIN_INTERVAL:
                delta = time.time() - last_submit
                if delta < SUBMIT_MIN_INTERVAL:
                    time.sleep(SUBMIT_MIN_INTERVAL - delta)
                last_submit = time.time()

            inflight.add(ex.submit(process_one, rec, token))
            submitted += 1
            if len(inflight) >= max_inflight:
                completed, inflight = wait(inflight, return_when=FIRST_COMPLETED)
                for f in completed:
                    write_result(out, f.result())

        for f in as_completed(inflight):   # drain the tail
            write_result(out, f.result())

    elapsed = time.time() - start
    processed = state["processed"]
    rate = processed / elapsed if elapsed else 0.0
    s = amt.STATS
    print("\n==== run complete ====")
    print(f"processed this run : {processed}  (accepted {state['accepted']})")
    print(f"total done         : {len(done)+processed}")
    print(f"wall time          : {fmt_hms(elapsed)}  ({rate:.2f} tracks/s, WORKERS={WORKERS})")
    if processed:
        print(f"apple requests     : {s['requests']}  (avg {s['requests']/processed:.2f}/track)")
    print(f"rate-limit (429)   : {s['rate_limited']}   server 5xx: {s['server_errors']}   "
          f"network err: {s['network_errors']}")
    print(f"total backoff wait : {int(s['backoff_seconds'])}s")
    if rate and processed:
        print(f"EXTRAPOLATION -> full {FULL_SCALE:,} tracks ~ {fmt_hms(FULL_SCALE / rate)} "
              f"and ~{int(s['requests']/processed*FULL_SCALE):,} requests")


if __name__ == "__main__":
    run()

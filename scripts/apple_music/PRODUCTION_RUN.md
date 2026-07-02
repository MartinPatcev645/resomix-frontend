# Apple-Music matching — production run (staged 10k → full 2.35M)

The evaluation tool (`apple_music_test.py`, the `results_*.csv` + `compare_results.py` flow) is for
tuning against the client baseline. For the real catalogue use the two scripts below — they reuse
the SAME matching algorithm but stream, checkpoint, and resume.

## Flow

```
DB  --export_tracks_jsonl.py-->  tracks_input.jsonl  --run_apple_matching.py-->  apple_matches.jsonl
```

- `tracks_input.jsonl` : one track per line with ALL our in-house metadata
  `{id, uuid, file_path, title, artists, album, album_cover, album_release_date, genre, label,
  label_website, duration_sec, year, bpm, musical_key, file_size, preview_path, type}`.
  The ONLY DB step.
- `apple_matches.jsonl`: one result per line, structured so our data and Apple's never mix:
  ```
  {
    "uuid", "file_path",
    "is_match": "True" | "False" | "N/A",
    "apple_song_id": "<accepted id>" | "",     # convenience; empty when no confident match
    "in_house":   { title, artists, album, album_cover, album_release_date, genre, label,
                    label_website, duration_sec, year, bpm, musical_key, file_size, preview_path, type },
    "apple_music": { song_id, isrc, name, artist, album, genres, release_date, duration_ms,
                     duration, artwork_url (cover), preview_url, deep_link_url, song_url } | null,
    "review":     { best_candidate_id, best_candidate_name, best_candidate_artist,
                    best_candidate_duration_ms, match_score, chosen_rank, matched_query }
  }
  ```
  `apple_music` is populated only for an accepted match (`is_match=True`), else `null`. Apple's song
  attributes don't include a record LABEL, so there's no `apple_music.label` — use the in-house label.
  `review` keeps the best candidate even when we rejected it, so nothing Apple returned is lost.

## Stage 1 — 10k (to measure time + Apple rate limits)

1. In `export_tracks_jsonl.py` keep `LIMIT = 10000`, then:
   ```
   python export_tracks_jsonl.py          # writes tracks_input.jsonl (10k rows)
   ```
2. Run the matcher under nohup:
   ```
   nohup python run_apple_matching.py > console/run_10k.log 2>&1 &
   ```
3. Watch it: `tail -f console/run_10k.log`. Every 200 tracks it prints throughput, accepted count,
   request count, **429s**, backoff seconds, and an **ETA for the full 2.35M**. The final summary
   extrapolates total time + total requests.

Use the 10k numbers to judge Apple's real ceiling — especially whether 429s appear and how much
backoff time accrues (bursts are tolerated, but there may be a per-hour/per-day cap). If 429s are
frequent, set `REQUEST_MIN_INTERVAL` (e.g. `0.05` = ~20 req/s) in `run_apple_matching.py` to pace.

Note on speed: this runner is single-threaded ON PURPOSE for the 10k — sequential throughput is
just 1 / request-latency (≈5–10 tracks/s), and the point is to measure Apple's true latency + rate
ceiling before parallelising. Parallelism only helps until you hit 429s, so once the 10k tells us
the latency and the throttling point, we add a small thread pool (N workers under one rate budget)
for the full run. Don't guess the worker count before measuring.

## Stage 2 — full 2.35M

1. Set `LIMIT = None` in `export_tracks_jsonl.py` and re-run it (it RESUMES after the largest id
   already exported, so the 10k rows are kept and it appends the rest).
2. Re-run the matcher the same way (`nohup ... &`). It RESUMES: skips every uuid already in
   `apple_matches.jsonl` and continues.

## Kill / resume (safe with nohup)

Each result is written and flushed immediately (fsync every 500). If you `kill` the process:
- a half-written trailing line is dropped automatically on the next start,
- every already-matched uuid is skipped,
- it continues exactly where it stopped — no duplicates, no lost work.

Just re-run the same `nohup python run_apple_matching.py ...` command.

## Knobs (top of run_apple_matching.py)

- `WORKERS`            — parallel Apple requests. **The main speed knob.** 1 = sequential (~1/latency);
  8 ≈ 15–20 tracks/s here. Raise to push harder / probe the ceiling; if 429s appear, that's the wall
  — dial it back or set `SUBMIT_MIN_INTERVAL`.
- `SUBMIT_MIN_INTERVAL`— min seconds between request submissions (0 = unlimited). Use once you know
  Apple's ceiling to pin a safe global rate (e.g. `0.05` ≈ 20/s).
- `PROCESS_LIMIT`      — cap tracks this run (None = all in the input).
- `PROGRESS_EVERY`     — progress log cadence.
- `FULL_SCALE`         — total catalogue size, for the ETA extrapolation (2,350,000).

Writes stay serial and safe regardless of `WORKERS` (workers only do the network calls; the main
thread does all file writes), so checkpoint/resume is unaffected by concurrency.

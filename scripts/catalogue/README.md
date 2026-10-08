# Master catalogue

`build_master_catalogue.py` builds one SQLite file holding every Electrobuzz track Resomix has
ingested, in production or not, with everything known about it: its ids, the original file on
Electrobuzz, our metadata, the Apple Music match, its state in production and where its audio lives
on the media box.

It is the reference for the whole catalogue: identifying a track, matching it against an outside
store (Traxsource, Bandcamp), or finding its files. Rebuild it after an ingest run; otherwise it does
not change.

## What is in it (October 2026)

| `source` | Tracks | What |
|---|---|---|
| `old_catalogue` | 2,350,642 | The original catalogue, `resomix_db` on Alwyzon. About 1.99M are in production on partner 1; the rest were never imported because Apple Music did not match them |
| `ingest_2026_09` | 146,046 | Files added up to 31 October 2025, ingested September 2026 (runs 18, 19, 20). 87,593 live on partner 1, the rest parked on partner 6 |

Not included on purpose: the 4,967 partner-pipeline test tracks (runs 11, 12, 13, 16), the retired
open catalogue and user uploads.

The key is `track_uuid`, the id production and the media server use. For the old catalogue it is
`uuid5(RESOMIX_NS, old object id)`, so a track that never reached production still has the id it
would get.

## Building

On Alwyzon, from the repo root with the venv active. Production is only read.

```bash
python scripts/catalogue/build_master_catalogue.py build            # ~15 min, writes ~/usman/catalogue/master_catalogue.sqlite
python scripts/catalogue/build_master_catalogue.py report           # totals of an existing build
python scripts/catalogue/build_master_catalogue.py build --force    # rebuild over an existing file
```

The file is written under a temporary name and only replaces the previous one when the build
finishes, so a failed build never leaves a half-made catalogue behind.

## Inside the file

- `catalogue`: one row per track. Every column is described in `COLUMNS` at the top of the script,
  and the same descriptions are stored in the file (`SELECT value FROM build_meta WHERE key = 'columns'`).
- `build_meta`: when it was built, from which input files (size and date), totals, and the report.
- `build_issues`: every track that did not reconcile, by kind:
  - `matched_not_in_production`: Apple matched it but production has no such track (deleted since).
  - `prod_track_not_in_catalogue`: a production Electrobuzz track neither source explains.
  - `prod_pipeline_test_excluded`: the 4,967 test tracks, listed so the exclusion is visible.
  - `sept_not_apple_checked`: September tracks the Apple run never saw (not embedded at the time).

Examples:

```sql
-- everything about one track
SELECT * FROM catalogue WHERE track_uuid = '2554987c-bf81-589c-8380-ef662baffe90';
-- tracks Apple never matched, which therefore are not playable in the app
SELECT COUNT(*) FROM catalogue WHERE apple_status <> 'matched';
-- the original file and both previews for a production track
SELECT file_path, legacy_preview_path, media_preview_path FROM catalogue WHERE prod_track_id = 5296;
```

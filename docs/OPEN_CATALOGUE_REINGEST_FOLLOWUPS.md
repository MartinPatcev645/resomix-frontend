# Open catalogue re-ingest, follow-ups

Written 17 September 2026, right after the promotion into partner 1 finished. The plan and the
as-run history are in `OPEN_CATALOGUE_REINGEST_PLAN.md`. This file is the to-do list for what is
left, with enough context to pick any item up cold.

## Where things stand

| Stage | Result |
|---|---|
| Ingested into partner 6 | Runs 18, 19 and 20 (batches 0, 1 and 2) |
| Checked against Apple Music | 144,765 embedded tracks, 126,358 accepted, 2h07m at 18.9 tracks/s |
| Promoted into partner 1 | 87,593 tracks, active, each with an Apple row and preview |
| Partner 1 FAISS index, both engines | 1,980,438 to 2,068,031 vectors |
| Elasticsearch | 1,980,421 to 2,068,014 documents, exactly 87,593 more |

Nothing was deleted. Every track that was not promoted is still on partner 6, and its reason is in
the parked file.

| Parked reason | Tracks | Meaning |
|---|---|---|
| `already_live` | 19,572 | The same recording is already live in partner 1 |
| `duplicate_copy` | 17,672 | Another copy of a promoted track, usually a DJ chart or VA compilation |
| `no_match` | 11,707 | Apple has no match |
| `unsure_match` | 6,700 | The matcher could not decide |
| `already_live_different_version` | 735 | Matched a live Apple song, but it is a different mix |
| `different_version_rematch` | 626 | A different mix of a promoted track, matched to the same Apple song |
| `apple_version_mismatch` | 160 | Apple's version and length both disagree with ours |

## Files and code

| What | Where |
|---|---|
| Apple match output | Alwyzon, `~/usman/basic_fastapi_server_resomix/scripts/apple_music/apple_matches.partner6.jsonl` |
| Promotion plan, the 87,593 | Alwyzon, same folder, `promote_partner6.plan.jsonl` |
| Parked tracks with reasons | Alwyzon, same folder, `promote_partner6.parked.jsonl` |
| Plan summary | Alwyzon, same folder, `promote_partner6.summary.json` |
| Media job record | Media box, `/srv/sftp/partners/000000000000/internal/promotions/partner6-to-partner1.*` |
| Promotion, media side | `resomix-similarity-open/app/services/partner_promotion.py`, tests in `tests/test_partner_promotion.py` |
| Promotion, Alwyzon side | `scripts/apple_music/promote_partner6.py` (plan, media, db, verify, selftest) |

## To do

- [ ] **Monthly pipeline runbook.** George wants the monthly run to go straight into partner 1's
  SFTP with the new tracks inactive, instead of through a scratch partner, and to switch them on
  once they are matched. Write one runbook that names the box and prompt for every step, based on
  what ran this time. Upload and ingest, embeddings, Apple matching, planning, the media job, the
  database move and the search rebuild. The current promotion code moves tracks between partners,
  so the new flow needs an "activate in place" variant, which is a design question to settle first.

- [ ] **Bring the plan document up to date.** Its PROGRESS section stops at 10 September. Record
  batch 2 (run 20, 35 tracks not embedded), Steps C and D, and the timings. Apple matching took 2h07m
  for 144,765 tracks. The media job took 40 minutes for 87,593 tracks, about 60 vectors a second per
  engine, with index saves of 9 and 22 seconds. The search rebuild took about 4.5 minutes. Move "the
  vector merge into the main index" from not proven to proven.

- [ ] **Fix the stale progress label.** In `partner_promotion.py` the `phase` field keeps the first
  engine's save message while the second engine is adding vectors. Set the phase when each engine
  starts. Cosmetic only, the counts were always right.

- [ ] **Tracks that never got embeddings.** Run 18 lost 1,245, run 19 lost 1 and run 20 lost 35,
  mostly to GPU segfaults, so they were never matched or promoted. List them from the database, where
  partner 6 tracks in runs 18 to 20 have an `embedding_status` other than completed. Re-run the
  embeddings job for those runs with skip-existing, then export, match and promote only those tracks,
  into new files with a new job id. Genuinely broken files will crash the GPU again, and
  `maest-discogs-ccreplica/scripts/find_poison_tracks.py` names the likely ones from the GPU log.

- [ ] **Re-match the held-back tracks, if George wants them.** 1,521 tracks matched an Apple song
  that is a different version of the recording (the last three rows of the parked table). Promoting
  them as they are would play the wrong preview. They need a stricter re-match that requires the
  same remixer and a length within 3 seconds.

- [ ] **Unmatched tracks, parked by George's decision.** 18,407 tracks have no reliable Apple match.
  Catalogue tracks play through Apple previews, so these cannot play in the app. Revisit only if a
  non-Apple playback path is ever wanted.

- [ ] **Partner 1's paused processing job 2.** The state file is
  `/srv/sftp/partners/000000000000/internal/processing/2.json` on the media box, and it was already
  paused before the promotion. Find out what it was, then resume it from admin or close it. It no
  longer has to wait on anything.

- [ ] **Partner 6 leftovers, optional.** Six partner API smoke-test playlists (ids 1583 to 1586,
  1632 and 1633) still point at tracks that are now on partner 1. Partner 6's FAISS index and
  catalogue still contain the promoted tracks too. The audio and vector files are hardlinks, so
  emptying partner 6 later never removes partner 1's copies.

- [ ] **Pipeline hardening offered earlier, not approved yet.** Batch the partner catalogue save on
  the embedding path, which is O(n) per track. Flag a job that Alwyzon still shows as running after a
  media restart. Save a job as paused when the media service is stopped. Strip leading spaces from
  filenames in the uploader. Test the SFTP login before the 25-minute scan. Reject MP3s over 50 MB
  before upload. Give the partner API a catalogue count. Worth folding into the runbook work.

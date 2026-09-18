# Similarity model selection (Sound only / Genre only / PYXIS-1)

Status: proposed, not started. Written 2026-09-18.

Give the user a choice of three similarity models instead of the single blended engine that runs
today.

| User-facing name | What it uses | Engine code |
|---|---|---|
| Sound only | Discogs/EffNet index (1280-d) | `E2` |
| Genre only | MAEST index (768-d) | `E1` |
| Pro model (PYXIS-1) | the blend that already runs in production | `E4` (or `E6`, see open decisions) |

The headline finding is that almost none of this is new machine learning work. The six engines,
the two indexes and the `engine` parameter all exist already. The engine switch was built and then
deliberately disabled in Alwyzon. What is missing is product plumbing, which is gating,
provenance, the repeat-search key, and UI.

---

## 1. What already exists

### 1.1 Hetzner media box (`resomix-similarity-open`)

Six strategies are implemented and dispatched by name in
`app/services/similarity_service.py::_combined_search` (line 72).

| Code | Behaviour |
|---|---|
| E1 | MAEST index only |
| E2 | Discogs index only |
| E3 | MAEST top 500, re-ranked by Discogs cosine |
| E4 | 0.7 MAEST + 0.3 Discogs, **the current production default** |
| E5 | rank fusion |
| E6 | rank fusion that searches both indexes |

Both endpoints already accept the parameter. `POST /similarity/query-by-uuid/` reads
`request_data.engine` (`app/api/similarity.py:76`) and `POST /similarity/query-by-upload/` reads an
`engine` form field defaulting to `E4` (`app/api/similarity.py:163`).

### 1.2 The indexes do not need to be loaded separately

Each partner has two FAISS files, both `IndexIDMap2(IndexHNSWFlat(dim, 32, METRIC_INNER_PRODUCT))`,
under `partners/{id}/indexes/faiss_{engine}_{id}.index`. For partner 1 that is 6.2 GB of MAEST
(768-d) and 10 GB of Discogs (1280-d, 2,088,796 vectors). Both must be fully RAM resident because
FAISS cannot usefully memory-map an HNSW graph (see `server-backups/docs/PROGRESS.md` issue 106).

Both are already resident today. The default engine E4 searches the MAEST index and pulls the
Discogs halves of its candidates straight out of the Discogs index through
`partner_faiss_repository.reconstruct_vectors` (line 293), which was the fix for the old
500-`.npy`-reads-per-query problem. `SimilarityService.preload()` also loads the global indexes
when they are configured.

So Genre only searches an index that is already in memory, and Sound only searches the other one
that is already in memory. Production media box has 62 GB with roughly 25 GB in use, and that does
not change. No rebuild, no re-embedding, no new model, no GPU work. Uploads already produce both
vectors in one call (`embedding_service.generate_dual_embeddings_from_bytes`), and catalogue tracks
already have both `.npy` sets on disk.

### 1.3 Alwyzon

The whole `engine` chain exists, from `SimilarityByIdRequest.engine` through
`similarity_controller` to `similarity_service`, which forwards it to the media box only when it is
truthy (`app/services/similarity_service.py:170`).

It is then thrown away at three call sites in `app/api/routers/similarity.py`, each passing
`engine=""` with the comment "engine parameter is intentionally ignored ... preserved for potential
future use when re-enabling engine selection". The lines are 116 (blocking upload), 161 (async
upload) and 238 (by-id selection).

### 1.4 Frontend (`resomix-web`)

There is no model concept, but there is an exact template to copy in the track-count control.

* State lives in `usePlayerStore` as `topSk`.
* `packages/hooks/src/Entitlements/useTrackCountOptions.ts` turns entitlements into options with a
  per-option `locked` flag plus a tier-correct upgrade nudge.
* `apps/webapp/src/sections/desktop/Workspace/DepthControl.tsx` renders it, with `LockNudge` and
  `useEntitlementCta` for the CTA.
* Three surfaces consume it, which are the desktop Workspace panel, `desktop/Upload/UploadOne.tsx`
  and `mobile/Upload/UploadOne.tsx`.

The two request functions that need to carry the choice are `getSimilarityForSelectedTrack` and
`getSimilarTracks` in `packages/api-client/src/similarity.ts`, called from
`packages/hooks/src/Similarity/useSelection.ts` and `useUpload.ts`.

---

## 2. What needs building

### 2.1 Hetzner, small

1. Validate the engine strictly. An unknown value currently logs a warning and silently falls back
   to E4, so a typo would look like a working feature that ignores the user.
2. Return the engine actually used in the response, so Alwyzon can record it rather than assume it.
3. Raise HNSW `efSearch` on partner index load. The FAISS default is 16, and the repo's own
   `scripts/discogs_similarity.py:53` says that is too low for top-100. Sound only will be the first
   production path that *searches* the Discogs index rather than reading vectors out of it by id,
   and Genre only will search MAEST directly for up to 100 results instead of taking the top 500
   candidates E4 asks for. Measure recall and latency before and after.
4. Check that both indexes cover the same tracks. E2 maps result ids back through the MAEST
   catalogue (`e2_helper.py`, `catalog.id64_to_uuid`), so any track present in Discogs but missing
   from MAEST is silently dropped from results.

### 2.2 Alwyzon, the bulk

1. Stop ignoring the parameter at the three call sites. Map product names to engine codes on the
   server so the wire format stays `sound` / `genre` / `pro` and E-codes never reach the browser.
2. Fall back to the Pro model when the seed track has no Discogs vector. On the by-uuid path,
   `query_by_uuid_for_partner` leaves `discogs_vec` as `None` when the `.npy` is missing, and E2
   then returns an empty list, which would reach the user as an empty playlist.
3. Gate the Pro model with a real entitlement. Add a feature key to
   `app/core/entitlement_keys.py`, seed it per plan in `app/services/entitlement_seed.py`, and
   enforce it in the controller next to the existing `DROPDOWN_MAX_TRACKS` clamp. UI greying is
   convenience, never the guard.
4. Record which model produced a playlist. `playlists` has no such column today
   (`app/models/playlist.py:18`), so add `similarity_engine`, an alembic migration, the write path,
   and the field in the playlist payload.
5. Put the engine in the repeat-search dedupe key. `_find_repeat_playlist`
   (`app/controllers/similarity_controller.py:1491`) and
   `playlist_repository.find_same_day_similarity` (line 150) key on seed track plus owner within
   24 hours. Without the engine, a user who runs Pro and then Sound only on the same track is handed
   the Pro playlist back and the feature looks broken.
6. Decide the metering rule, which is whether re-running the same seed under a different model
   consumes another search credit.

### 2.3 Frontend

1. Add `engine` to `usePlayerStore` alongside `topSk`, persisted the same way.
2. Add `useModelOptions` mirroring `useTrackCountOptions`, including the `locked` flag and the
   tier-correct CTA.
3. Add a `ModelControl` component and wire it into the three surfaces listed in 1.4.
4. Thread the choice through `useSelection`, `useUpload` and the two api-client functions.
5. Show which model made a playlist, plus one line of copy per model so the names mean something.

### 2.4 QA and rollout

Three models across both entry points (catalogue track and upload), for guest, free and paid, on
staging. Record latency per model. Ship `demo` to `main` per the branching workflow. The only data
change is the new column, and the media box needs a restart only if the `efSearch` change lands.

---

## 3. Estimate

| Area | Work | Hours |
|---|---|---|
| Hetzner | strict validation, echo engine back, `efSearch` tuning with recall and latency check, index coverage check | 3 to 4 |
| Alwyzon | stop ignoring engine, product-name mapping, empty-result fallback | 2 to 3 |
| Alwyzon | entitlement key, plan seeding, server-side gate | 2 to 3 |
| Alwyzon | `similarity_engine` column, migration, write and read paths | 2 to 3 |
| Alwyzon | engine in the repeat-search dedupe key, metering decision | 1 to 2 |
| Frontend | store state, `useModelOptions`, `ModelControl` on three surfaces | 4 to 6 |
| Frontend | pass-through in hooks and api-client, model badge and copy | 2 to 4 |
| QA and deploy | three models x two entry points x three tiers on staging, latency, demo to main | 3 to 4 |
| **Total** | | **19 to 30** |

A stripped version with no gating, no provenance and no dedupe fix is roughly 8 to 12 hours, but it
ships the dedupe collision described in 2.2.5, which will read as a bug.

Optional extra work is an engine comparison run to decide what PYXIS-1 should be, at 2 to 3 hours.

---

## 4. Open decisions

1. **Which engine is PYXIS-1.** E4 is today's default, so naming it Pro means existing users see no
   change at all. E6 fuses ranks from both indexes and may be better, but it has never been
   benchmarked against E4 on the live catalogue.
2. **Is the Pro model paid-only**, or available to everyone with the other two offered as simpler
   alternatives. This decides whether the entitlement work in 2.2.3 is in scope.
3. **Does switching models re-charge a search credit** for the same seed inside the 24 hour window.
4. **Naming.** PYXIS-1 is a product name. Internal codes stay E1, E2 and E4, and the API should
   speak product names so the engine lineup can change without a frontend release.

---

## 5. Risks

* Single-model results will be visibly worse than the blend for some queries, which is the point of
  the tiering but will produce "results got worse" reports. Keep Pro as the default selection.
* Discogs search at the default `efSearch` may return poor top-100 recall, which would be read as
  the model being bad rather than as a tuning gap. Item 2.1.3 is not optional.
* A model choice that is not persisted on the playlist makes support questions unanswerable after
  the fact, since nothing in the row says how it was built.

---

## 6. Verification commands

Confirm both indexes exist and the box has headroom, on the production media box.

```bash
ssh ubuntu@135.181.218.143 "sudo find /srv/sftp/partners -name '*.index' -exec ls -lh {} \; ; free -g | head -2"
```

Compare vector counts between the two engines for partner 1, which is the coverage check behind
item 2.1.4. Run on the media box with the service's virtualenv.

```bash
python -c "import faiss; [print(e, faiss.read_index(f'/srv/sftp/partners/1/indexes/faiss_{e}_1.index').ntotal) for e in ('maest','discogs')]"
```

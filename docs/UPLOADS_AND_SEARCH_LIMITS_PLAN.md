# Uploads, Search Limits & Analysis-as-an-Artifact — Plan

**Status:** IN PROGRESS (design agreed 2026-07). Implementing Phases A–D together.
**Progress:**
- Phase A ✅ DONE (rename + split counting + fork disabled + migration `a2b3c4d5e6f7`; backend
  suite 454 passed / 3 pre-existing playback failures; frontend api-client + hooks renamed &
  typecheck-clean). Also fixed an upload double-count (removed the stray `playlist_create`
  record in `similarity_service.calculate_similarity_for_upload`).
- Phase B ✅ DONE. Analysis service: optional caller-owned `analysis_id` + `X-Internal-Key`
  guard on the create route (`internal_api_key`, open when unset). Alwyzon: `analysis_server_url`
  + `analysis_internal_api_key` settings; `app/services/analysis_service.py` client
  (create/status/result/wait, structured errors, `is_configured`); `app/tasks/analysis_tasks.py`
  sibling job (spool → ship → wait → Phase-C persist hook); upload orchestration enqueues the
  sibling on both success paths (guarded: consumer + logged-in + configured; no re-count). Inert
  until `analysis_server_url` is set. Tests added on both sides.
- Phase C ✅ DONE.
  - **C1 (Alwyzon DB):** `track_analysis_results` model + migration `b3c4d5e6f7a8` (round-trip
    tested; the key column is `music_key`, and `partner_id` was ADDED so the tenancy failsafe
    scopes it). `TrackAnalysisResultRepository` + `TrackAnalysisResultService` (canonical→summary
    mapping, idempotent upsert keyed on `analysis_uuid`, read helpers). The sibling task's
    `_persist_summary` now writes the row on completion.
  - **C2 (retrieval + token):** `generate_analysis_token`/`verify_analysis_token` in
    `edge_auth.py` (scope="analysis", embeds `analysis`, IP-locked). Consumer endpoints
    `GET /analysis/{id}` (summary, owner-or-public) + `POST /analysis/{id}/token` (mint,
    owner-or-public) via `AnalysisResultController` + `app/api/routers/analysis.py`. On the
    analysis service (co-located on Hetzner, owns the result cache): a **dependency-free stdlib
    HS256 verifier** (`app/utils/edge_token.py`) + public **`GET /analysis/{id}?token=…`**
    (`analysis_retrieval.py`) that serves the cached JSON. Cross-verified: an Alwyzon jose-minted
    token validates with the stdlib verifier (and all rejection cases hold).
  - **Retrieval-placement decision:** the tokenized `GET /analysis/{id}?token=` was implemented on
    the **analysis service** (which already owns/serves the `ResultStore` cache and runs on the
    Hetzner box), NOT the production similarity/HLS media server — avoids touching that sensitive
    prod surface while still satisfying "`GET https://<hetzner>/analysis/{id}?token=`". The served
    cache is the same `var/results/{id}.json` the worker writes, so no extra write step is needed.
- Phase D (frontend) — api-client layer DONE; UI wiring pending browser verification.
  - **DONE (compile-verified):** `@resomix/api-client` `analysis.ts` — `getAnalysisSummary(uuid)`
    + `mintAnalysisToken(uuid)` (typed `AnalysisSummary`/`AnalysisRetrievalToken`), `ANALYSIS`
    endpoint in `config.ts`, exported from `index.ts`, package rebuilt. The mint returns
    `{token, expires_in, retrieval_path}`; the webapp composes
    `${analysisMediaBase}${retrieval_path}?token=${token}` to fetch the full cached JSON.
  - **PENDING (needs the browser, per the standing "don't drive the frontend" rule — hand off):**
    (1) route both upload intents through Alwyzon in `useTrackAnalysis.ts` (retire the direct
    `VITE_ANALYSIS_ENDPOINT` for prod behind a dev flag; poll Alwyzon for fresh results);
    (2) library "Show playlist" + "Get analysis" buttons reading generated results via the
    summary + token→cache flow; (3) show the summary in lists, full page from the cached JSON;
    (4) separated upload-vs-search quota messaging using `uploadsPerMonth`/`searchPlaylistsPerMonth`
    from `useEntitlements`.
**Part of:** the frontend plans/entitlements initiative — companion to
`docs/FRONTEND_PLANS_AND_GUEST_ENFORCEMENT_IMPLEMENTATION.md` (add a Progress row there).
**Rule (unchanged):** frontend/consumer (System Partner 1 + guests) only — **never touch B2B**.

---

## 1. Why

Old model = two monthly limits: `playlists_per_month` (gated all playlist creation) and
`analysis_per_month` (seeded but never wired). Product change: an **upload** now yields
**both** an analysis and a similarity playlist, so a user is limited by **uploads**, not
separately by analyses or upload-playlists. Catalog-only ("search") playlists keep their own
limit. And analysis becomes a **first-class, user-owned, cached, tokenized artifact** —
attached to Alwyzon properly (no direct frontend→analysis call in prod).

## 2. Model (agreed decisions)

- **Upload** = a user submits an audio file. Counts **1** vs `uploads_per_month`, **per upload
  action**. Gated by `can_similarity_upload` + `uploads_per_month`. **Login-only** (guests can't
  upload → an upload always has a real user + track owner).
- **Every upload produces BOTH** a similarity playlist and an analysis result, linked to the
  uploaded **library track**. Intent (similarity-first vs analysis-first) picks foreground vs a
  **background job run before the audio is deleted**. The sibling does **not** re-count.
- **Library**: each uploaded track shows free **"Show playlist"** + **"Get analysis"** (both
  already generated at upload).
- **Search playlists** (catalog-only) → `search_playlists_per_month`.
- **Alwyzon = single upload front-door** and the only caller of the analysis service. Analysis
  runs **on the Hetzner box** and is called by Alwyzon over a configurable public URL + internal
  key (mirrors the similarity service). Direct `VITE_ANALYSIS_ENDPOINT` stays behind a dev flag
  only.
- **Analysis is a user-owned artifact** (like a playlist): the DB row carries `user_id` +
  `is_public`, so we can later gate "only the owner sees it unless made public" — deferred, but
  **scaffolded now**.
- **Enforcement is server-authoritative** (frontend check for UX; Alwyzon gate + analysis-service
  internal key = no bypass).

## 3. Feature renames + seed

| old key | new key | name | window |
|---|---|---|---|
| `analysis_per_month` | **`uploads_per_month`** | "Uploads per month" | monthly |
| `playlists_per_month` | **`search_playlists_per_month`** | "Search playlists per month" | monthly |

`entitlement_keys.py`: `PLAYLISTS_PER_MONTH → SEARCH_PLAYLISTS_PER_MONTH`, `ANALYSIS_PER_MONTH →
UPLOADS_PER_MONTH` (update all refs). Seed defaults are **admin-set from the DB** (placeholders
only): `can_similarity_upload` guest✗/rest✓; `uploads_per_month` guest 0 / free 5 / basic 30 /
pro 100 / max 300; `search_playlists_per_month` 5/15/100/300/1000. Signup bonus → search playlists.

## 4. Analysis storage & retrieval architecture

Three copies, each with a purpose:

1. **Analysis service local cache** (`var/results/{id}.json`) — keep as-is (the producer's cache).
2. **Hetzner served cache** (co-located with the analysis service on the Hetzner box) — the
   **full result JSON**, exposed for **return-visit retrieval** by the frontend, gated by an
   Alwyzon-minted **edge token** (exactly like HLS playback).
3. **Alwyzon DB `track_analysis_results`** — the **single-value summary** + linkage (fast library
   lists, ownership, future visibility).

**Analysis id is owned by Alwyzon.** Alwyzon generates the UUID and passes it to the analysis
service (`POST /v1/analyses` gains an optional `analysis_id`); the service **uses it** instead of
minting its own, and caches under it. Alwyzon stores it as `track_analysis_results.analysis_uuid`.

**Retrieval flows:**
- **Fresh (during an upload):** frontend polls **Alwyzon** → Alwyzon polls the analysis service →
  returns the result live. Alwyzon writes the summary row; the full JSON lands in the Hetzner
  cache.
- **Return visit (existing result):** frontend asks Alwyzon for an **analysis token** — a signed
  `edge_auth`-style JWT that **embeds the `analysis_id`** plus user/ip/exp/`scope="analysis"`. Then
  `GET https://<hetzner>/analysis/{id}?token=…`; Hetzner (a) verifies signature+ip+exp+scope, (b)
  checks the **`{id}` query-param equals the `analysis_id` embedded in the token** (authorization —
  a token minted for analysis X can't be replayed to fetch analysis Y), then serves the cached JSON
  **located by the query-param id** (the token's id is used only for the equality check, never for
  lookup). This id-in-token match is what makes **share/public analysis** safe: Alwyzon mints a
  token for analysis X **only when the requester is allowed** (owner, or `is_public` + logged-in),
  so authorization happens at mint time and Hetzner just enforces the match. Same "boarding pass"
  model as `edge_auth.generate_edge_token` / the `?token=` HLS URLs.
- **Library list:** served from `track_analysis_results` (no full JSON fetch needed).

## 5. `track_analysis_results` table (Alwyzon DB)

Name chosen to read as *analysis results*, not metadata/metatags. One row per analysed track.

| column | type | source (canonical analysis JSON) |
|---|---|---|
| `id` | PK | |
| `track_id` | FK → tracks | the uploaded library track |
| `analysis_uuid` | String(36), unique, indexed | Alwyzon-minted `analysis_id` |
| `user_id` | FK → users | owner (from the track) — for future visibility |
| `is_public` | bool, default false | future "share analysis" (mirrors `playlists.is_public`) |
| `bpm` | float | `rhythm.bpm` |
| `key` / `scale` / `camelot` | str | `tonality.*` |
| `loudness_lufs` | float | `technical.integrated_loudness_lufs` |
| `top_genre` | str | `semantics.genre_top[0].label` (top-1 of the top-7) |
| `top_style` | str | `semantics.style_maest_top[0].label` |
| `top_mood` | str | `semantics.mood_theme_top[0].label` |
| `top_instrument` | str | `semantics.instrument_top[0].label` |
| `danceability` | float | `semantics.danceability` |
| `valence` / `arousal` | float | `semantics.valence` / `.arousal` |
| `voice_score` | float | `semantics.voice_score` |
| `voice_instrumental` | str | `semantics.voice_instrumental` |
| `duration_ms` | float | `identity.duration_ms` |
| `sample_rate_hz` | int | `identity.sample_rate_hz` (44.1 kHz) |
| `bit_rate` | int | `identity.bit_rate` (320 kbps) |
| `channels` | int | `identity.channel_count` (stereo/mono) |
| `codec` | str | `identity.codec` |
| `created_at` / `updated_at` | datetime | UTC-naive |

Rule: **single-value only**; for any list (e.g. genre top-7) keep **only the top one**. "Vibe" is
the valence/arousal pair (no separate scalar) — see open item. Alwyzon parses the analysis JSON and
writes this row when a fresh analysis completes.

---

## 6. Phases

### Phase A — entitlement rename + split counting
- `entitlement_keys.py` + `entitlement_seed.py`: rename the two constants/keys + set new plan values.
- **Migration** `<rev>`: rename `features.key`/`name`/`description` (guarded, bound params, backtick
  `` `key` ``), re-point the `operation_limits` bridge, **bump `entitlements_version`**; round-trip
  tested.
- `operation_limit_evaluator.py`: `playlist_create` → split into `search_playlist_create →
  search_playlists_per_month` and route uploads → `uploads_per_month`.
- `similarity_controller.similarity_upload`: gate/record `uploads_per_month` (keep
  `can_similarity_upload`). Search path: gate `search_playlists_per_month`.
- `playlist_controller` **fork endpoint → DISABLED for now**: short-circuit to a
  `feature_unavailable` response (403/`reason`), **keep the code** (may be reworked/re-enabled later),
  and it counts against no quota. Removes the fork↔playlist-counter coupling entirely.
- Frontend `api-client` keys/types; separated messaging; remaining uploads vs search playlists.
- Backend suite (~454) green + new split coverage.

### Phase B — attach analysis to Alwyzon (the front-door)
- `config.py`: `analysis_server_url` (public URL, plug in Hetzner IP) + `analysis_internal_api_key`
  (mirror `similarity_server_url` / `hetzner_internal_api_key`).
- New `app/services/analysis_service.py` (async httpx client, base URL + `X-Internal-Key`): mirrors
  the frontend contract — `create_analysis(file, analysis_id) → id`, `get_status(id)`,
  `get_result(id)`; foreground (return+poll) and background (fire+store) modes.
- **`resomix-analysis-service`**: (a) accept an optional `analysis_id` on `POST /v1/analyses` and use
  it; (b) **require `analysis_internal_api_key`** on the create route (and optionally reads) → only
  Alwyzon can trigger uploads (the backend anti-bypass check).
- Upload orchestration (Alwyzon): the upload endpoint(s) take `file` + `intent`. **Gate
  `uploads_per_month` ONCE.** Then: foreground the requested side (similarity via Hetzner OR analysis
  via the client with an Alwyzon-minted `analysis_id`), and **enqueue the sibling** (Celery) →
  generate + persist before the track audio is deleted. Sibling jobs are internal → **no re-count**.

### Phase C — analysis storage & retrieval
- **C1 (Alwyzon DB):** migration for `track_analysis_results` (§5). On fresh-analysis completion,
  Alwyzon parses the result and writes/updates the summary row (`track_id`, `analysis_uuid`,
  `user_id`, `is_public=false`, the scalars). Repository + service + read endpoints.
- **C2 (Hetzner served cache + token):** the analysis service (co-located on Hetzner) writes the full
  JSON to the served cache location; Hetzner media server adds `GET /analysis/{id}?token=…` that
  validates the edge token (signature + ip + exp + `scope="analysis"`) and returns the JSON. Alwyzon
  adds an **analysis-token mint** endpoint (mirror the playback-token path) that checks ownership/
  visibility before signing.

### Phase D — frontend
- Route **both** upload intents through Alwyzon (retire the direct `VITE_ANALYSIS_ENDPOINT` for prod;
  keep behind a dev flag). Poll Alwyzon for fresh results.
- **Library** screen: "Show playlist" + "Get analysis" (free) reading generated results; fetch cached
  analysis via the Alwyzon token → Hetzner flow.
- Show the analysis **summary** (bpm/key/genre/loudness/…) from `track_analysis_results` in lists;
  full page from the cached JSON.

### Admin
- The entitlement editor is feature/DB-driven → renamed features + new per-plan numbers appear
  automatically (admin sets uploads/search numbers). No new admin surface required for A–D. (Future:
  an "analysis visibility" toggle if we productise sharing.)

## 7. Ownership & visibility (scaffold now, enforce later)
`track_analysis_results.user_id` + `is_public` are stored from day one. A later phase adds the gate
(owner-only unless `is_public`) at the Alwyzon read + token-mint endpoints — identical to how
playlists gate on `is_public`. Not enforced in A–D.

## 8. Cross-service auth
- **Alwyzon → analysis service:** `analysis_internal_api_key` header; the analysis service validates
  it and rejects otherwise (its only "gate").
- **Alwyzon → Hetzner media:** existing edge-token model, extended with `scope="analysis"`.
- No analysis-service → Alwyzon callbacks: Alwyzon orchestrates both siblings, so the analysis
  service stays a pure worker.

## 9. Rollout / flags / open items
- Order: A (rename) → B (front-door + generate-both) → C (storage/retrieval) → D (frontend). Migration
  first each time; `entitlements_version` bump on the rename.
- Dev flag keeps the direct frontend→analysis call until the Alwyzon front-door is verified on staging.
- **Decided (green-lit 2026-07):**
  1. **Fork** → endpoint **disabled** ("feature unavailable"), code kept; counts nothing.
  2. **"Vibe"** → stored as `valence` + `arousal` scalars only (no derived label for now).
  3. Table name → **`track_analysis_results`**.
  4. Exact per-plan numbers = admin-set (non-blocking).
  5. Analysis token **embeds `analysis_id`**; Hetzner enforces query-id == token-id (authz only).

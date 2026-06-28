# Resomix — Service Overview & Single Source of Truth

> **Status:** Working draft / rough sketch. Not final.
> **Audience:** Internal (Resomix team). This document records *both* the public
> narrative we present to users and partners **and** the underlying technical
> reality. Sections marked **🔒 INTERNAL — DO NOT DISCLOSE** are not to leave the
> company. Everything else is fair game for partner conversations and a
> future polished public/partner edition.
> **Purpose:** Give us one place that answers "what is Resomix, who is it for,
> how does it actually work, and what do we say vs. what we keep to ourselves."
> **Last updated:** 2026-06-27

---

## 1. What Resomix Is

Resomix is a music **similarity and discovery** service built for the people who
actually dig through music for a living — DJs first, and serious listeners after
them. You give us a track, we hand you a playlist of tracks that *sound* like it.
Not "fans also bought," not "same genre tag," not "this artist is trending" —
similarity that comes purely from the **audio itself**.

That last part is the whole point. Recommendation on most platforms is driven by
popularity, editorial, and collaborative-filtering signals. All of those quietly
bury anything that isn't already popular. Resomix listens to the sound, so a
twenty-year-old B-side can surface right next to a release from last week if they
genuinely belong together sonically.

**What we stand for:**

- **The audio is the truth.** Discovery should be earned by how a track sounds,
  not by how much marketing money is behind it.
- **Dead catalog deserves a second life.** Most catalogs have enormous tails of
  tracks generating almost nothing. Pure-audio similarity is how those tracks get
  found again.
- **Professional-grade, not toy.** We're building for working DJs and for labels
  doing real due diligence, which means the engineering, the security, and the
  catalog quality all have to hold up to scrutiny.

We run this as a real product today on our own curated catalog, and we're opening
it up to partners (labels, distributors, shops) who want their catalog in front of
the right ears.

---

## 2. Who Resomix Is For

### 2.1 General users — DJs and music lovers

The primary user is a **DJ**: someone building sets, hunting for the next track
that mixes well, looking for alternatives to an overplayed record, or trying to
fill a specific energy slot. Secondary users are anyone **passionate about music**
who wants to explore by sound rather than by chart.

Two ways they use it:

1. **Similarity by search** — they pick a track from our catalog and get a
   similarity playlist back (10 / 20 / 50 / 100 tracks). Fast, because everything
   is already analyzed. ~1–2 seconds.
2. **Similarity by upload** — they upload *any* electronic track in the world,
   even an unreleased promo or their own bounce, and we return the closest matches
   from our catalog. Slower, because we analyze the file on the fly. ~10–15 seconds
   depending on load.

### 2.2 Partners — labels, distributors, shops

Partners give us their catalog. In return they get one of two things (see §6 for
detail):

- **Discovery + referral traffic** — we host, analyze, and surface their tracks,
  show their branding, give a short preview, and send buyers back to *their* store
  to complete the sale. We bring them traffic and revive their dormant catalog.
- **API / SaaS** — they run similarity and analysis against our API from their own
  product, on fixed-rate packages.

The pitch to a partner is simple: *your hidden catalog becomes visible and
discoverable by sound, and we either drive buyers to you or power your own
features — your choice.*

---

## 3. What We Offer (the two products)

### 3.1 Track Similarity Playlists

The core product. Given a seed track (from search or upload), return an ordered
list of the most sonically similar tracks, with similarity scores, sized to the
user's request (10/20/50/100).

### 3.2 Track Analysis

For a given track we expose an **audio analysis** — the musical characteristics we
derive from the file (tempo/BPM, key, energy, brightness, rhythmic and timbral
descriptors, structure, etc.). This is presented as the "fingerprint" view of a
track and is also offered to partners via API.

> **Note on framing:** Publicly, both similarity *and* analysis are described as
> products of the **PYXIS-1** engine and its feature set (see §4). The analysis we
> *display* is real, audio-derived descriptive data; how it ties into similarity
> is the part we keep proprietary.

---

## 4. The PYXIS-1 Engine

PYXIS-1 is our proprietary similarity and audio-analysis engine. It is the brand
name for "the thing that makes Resomix work," and **PYXIS-1 is the only name that
should appear in any external material.**

> **Naming note:** the engine had older internal names (e.g. "R-BeatNet") in early
> docs. Those are **deprecated**. **PYXIS-1** is the official name — use it
> everywhere going forward and treat any older name as the same thing.

### 4.1 The public narrative (✅ disclosable)

This is what we tell users, partners, and rights holders:

> PYXIS-1 is a proprietary audio-analysis engine. For every track we extract
> **75+ low-level audio features** using a stack of established open audio-analysis
> tools — **librosa, madmom, FFmpeg, aubio, pyAudioAnalysis, and the
> Python soundfile/SciPy signal stack** — spanning timbral, rhythmic, harmonic,
> spectral, and structural attributes. Representative features include:
>
> - **Spectral:** centroid (brightness), bandwidth, contrast, flatness
>   (noisiness), rolloff, spectral flux, and mel-spectrogram statistics.
> - **Energy & rhythm:** RMS energy (intensity), zero-crossing rate
>   (percussiveness), tempo/BPM, beat positions, onset strength/density, and
>   rhythmic regularity.
> - **Timbre:** 13 MFCC coefficients (the textural fingerprint) plus their
>   delta and delta-delta coefficients.
> - **Harmony:** chroma (pitch-class distribution), Tonnetz (harmonic
>   relationships), estimated musical key, and harmonic/percussive balance.
>
> We also segment each track structurally (e.g. intro → drop → outro) so
> similarity is computed on comparable sections rather than whole-file averages.
> From these features PYXIS-1 builds a unique **fingerprint** per track, and
> compares fingerprints to produce ranked similarity. **How these features are
> weighted, combined, and compared is proprietary** and the result of a year of
> tuning against licensed and openly-licensed (CC BY 4.0) test material.

This narrative is true in spirit — we *do* run this tooling and we *do* surface
these descriptors as the analysis view — and it gives partners a credible,
inspectable story without exposing the actual mechanism.

### 4.2 🔒 INTERNAL — DO NOT DISCLOSE: how it actually works

The similarity ranking is **not** computed from hand-crafted librosa/madmom
features. The real pipeline is:

1. **Neural embeddings.** Each track is run through open-source pretrained
   audio models to produce dense vector **embeddings** — currently **MAEST**
   (Music Audio Efficient Spectrogram Transformer, **768-D**) and a
   **Discogs-EffNet** embedding (**1280-D**). These are computed on a dedicated
   **GPU embedding server** (separate box; see §7), which exposes endpoints like
   `/get_maest` / `/get_all_embeddings` returning raw float32 vectors.
2. **Vector index.** Embeddings are stored as `.npy` per track and indexed with
   **FAISS** — one index per engine (`maest`, `discogs`), per partner. A catalog
   JSON maps UUID ↔ FAISS slot.
3. **Fusion + cosine similarity.** Similarity is FAISS **cosine similarity** over
   those embedding vectors, combined across the two engines via one of six
   strategies (E1 MAEST-only, E2 Discogs-only, E3 simple average, **E4 weighted
   combination — default**, E5 rank fusion, E6 score-normalized fusion). That's
   it. The "75+ features" are not what drives the ranking.

The librosa/madmom/FFmpeg feature extraction is real but serves the
**analysis/display** layer and metadata (BPM, key, etc.) — it is the public-facing
"fingerprint." The embeddings + FAISS are the actual similarity brain, and the
specific models, weighting, and post-processing are the trade secret we never put
in writing externally.

**Rule:** never name MAEST, Discogs-EffNet, FAISS, "embedding," or "cosine
similarity" in any partner-facing document, contract, or sales deck. Externally it
is always "PYXIS-1 and its proprietary feature fingerprint."

---

## 5. Our Own Catalog

We operate Resomix today on our **own curated catalog of ~2.5M tracks** sourced
from **Apple Music**. This is what powers the live demo experience and what new
users explore against.

- **Playback:** for our own catalog, the frontend sends users to **Apple Music**
  for full playback. We surface the metadata, artwork, waveform, and similarity;
  Apple handles the actual listening. This keeps the experience legitimate and
  high-quality without us hosting full licensed audio for those tracks. (This is
  different from partner-delivered tracks, which we play back ourselves via our own
  30s HLS previews — see §6/§7.)
- **Why it matters for the pitch:** because the catalog is curated and broad, the
  similarity results are genuinely good out of the box. When we approach
  **Volumo** and **Beatport**, the demo has to feel professional and the matches
  have to be convincing — this catalog is what makes that possible.

> 🔒 **Internal — how the catalog actually breaks down.** Our own catalog is
> internally branded **ElectroBuzz** and is modeled as a partner record
> (`partner_id = 4`, `service_mode = similarity_only`) — but it is **our own
> catalog, not a third party**. Track type is `electrobuzz`.
>
> - Full catalog is **~3M tracks**. Of those, **~2.35M** are the legacy backlog we
>   already had; they were missing **MAEST** embeddings (the old system had only
>   Discogs vectors + previews), so a multi-day **backfill is currently running** to
>   generate MAEST and migrate everything onto the new UUID + FAISS layout. The
>   remaining tracks are then run through normal **ingestion**.
> - We only **display** tracks we can match to **Apple Music**, because the public
>   story is "catalog from Apple Music" and we use **Apple Music playback** for
>   them. A meaningful chunk of the 3M won't be found on Apple Music — those are
>   **filtered out / not shown**. The Apple-matched subset is the basis for the
>   "**~2.5M**" figure (an estimate; the exact displayable count firms up after the
>   backfill + ingestion complete).
> - So: **~3M processed internally → ~2.5M Apple-matched and shown** with Apple
>   Music playback. Keep the external number as "~2.5M from Apple Music."

---

## 6. The Partner Model (in depth)

Partners deliver their catalog to us; we make it discoverable by sound. There are
two commercial shapes, and a partner can be on either.

### 6.1 Delivery — how partners get tracks to us

- Partners send us the **audio files** plus a **CSV manifest** carrying the
  metadata for those tracks (ISRC, title, artist, mix name, BPM, genre, etc.).
- We run a proper **SFTP** setup with **automatic ingestion**: the partner uploads
  audio + `manifest.csv` into their locked-down SFTP home, drops an empty `.done`
  marker last, and that triggers validation + ingestion automatically. No manual
  step required on their side.
- The manifest is validated row-by-row; bad rows are reported back with per-row
  errors. (Full operator detail lives in the partner onboarding runbook — see
  References.)

### 6.2 Offer A — Discovery + referral traffic (we send them buyers)

The "just send us your tracks" offer:

- We display **metadata + ~30s preview playback** for their tracks inside Resomix.
- We do **not** sell on their behalf. When a user wants the full track, we send
  them to the **partner's own store** to buy/download. We are a discovery and
  traffic channel — we drive sales *to them*, we don't take the transaction.
- Their **branding** is shown on their tracks, so discovery reinforces their store.
- The big hook: **dormant / dead-catalog revival.** Normal discovery ranks by
  popularity, recency, or genre, so older tracks never resurface. Resomix ranks by
  pure audio, so a 20-year-old track that barely generates revenue can appear in a
  similarity playlist on equal footing with new releases. We turn dead catalog into
  a discovery surface again.

Under the hood we still fully process their tracks (embeddings, FAISS index, HLS
previews, peaks, artwork) — see §7.

### 6.3 Offer B — API / SaaS

For partners who want to build on top of us rather than send users to our frontend:

- We expose **similarity** and **track analysis** via API, authenticated with a
  per-partner API key (scoped, e.g. `similarity:read`, `metadata:read`,
  `playback:read`).
- Pricing is **fixed-rate packages** — the partner pays for a tier, and we map that
  tier to quotas (storage, rate limits). Tiers today: `sandbox` / `starter` /
  `growth` / `enterprise`.
- They can run it from their own servers/product; the engine and catalog stay ours.

---

## 7. Technical Architecture

### 7.1 Shape of the system

- **Frontend:** React, hosted on **Cloudflare** with a CF-managed domain. Talks
  only to the Alwyzon server, and to three media endpoints on Hetzner (segments,
  covers, peaks).
- **Three backend hosts** (two VPS + one GPU box), all **FastAPI**, behind
  **nginx + certbot (TLS)**. Proper layered architecture (router → controller →
  service → repository) with schemas, utils, etc. The two main servers are a
  **split stack**: Alwyzon is the "brain" (API, DB, auth), Hetzner is the
  "muscle" (audio processing, FAISS, storage).
- **Separate processing scripts** run outside the request path for our own
  catalog ingestion pipeline.

#### Alwyzon — entry point / API gateway (`bserver.resomix.com`, port 8001)

- Single point of contact for the frontend.
- **MariaDB** = source of truth: ~2.3–2.5M track records + metadata, user accounts
  & auth, playlists, favorites, partners, API keys, quotas, usage logs.
- **Elasticsearch** for search.
- Handles **auth**: JWT for logged-in users, API keys for partner/service calls.
- On upload it runs the **safety gate** (see §8) and metadata extraction, creates
  the DB record + UUID, then hands the track to Hetzner for similarity work.
- Stack: Python 3.12, FastAPI, MariaDB 11.3+, SQLAlchemy 2.0.

#### Hetzner — storage & compute (`media.resomix.com`, port 8004)

- **22TB** of audio, covers, peaks, HLS segments.
- Runs the **FAISS** vector indexes (per §4.2 — MAEST + Discogs; internal only).
- Does all heavy audio work with **FFmpeg** (previews, HLS segments) and
  **audiowaveform** (peaks); metadata via **Mutagen**.
- **Not** directly reachable from the frontend except **three** endpoints: audio
  segments (playback), cover images, audio peaks (waveform). Everything else is
  strictly restricted.
- When it needs embeddings for new tracks it calls the external **GPU embedding
  server**.
- Stack: Python 3.8+, FastAPI, FAISS, FFmpeg, Mutagen 1.47, audiowaveform.

#### GPU embedding server (`46.4.100.18:8005`)

- Separate box (single **RTX 4000 SFF Ada**) running the `maest-discogs-ccreplica`
  service.
- Sole job: turn audio into embeddings — `POST /get_maest` (raw 768×float32) and
  `/get_all_embeddings` (MAEST 768-D + Discogs-EffNet 1280-D).
- Only the Hetzner box talks to it; it's not public-facing.

### 7.2 Per-track processing (what happens to a track)

1. Track enters at **Alwyzon** → safety gate (virus scan, empty-file check, FFmpeg
   "is this really audio") → metadata extraction → DB record + **36-char UUID**.
2. Alwyzon sends it to **Hetzner**.
3. Hetzner transcodes the original to a **128 kbps MP3** working copy and from then
   on works off that copy, generating:
   - HLS **segments** for streamed playback,
   - a **peaks** JSON (waveform),
   - **cover** art,
   - a **profile/embedding** used for similarity.
4. Similarity is computed from the profile/embedding and ranked UUIDs + scores are
   returned to Alwyzon, which re-hydrates them with full metadata from MariaDB and
   returns to the frontend.

**UUID convention:** every artifact for a track is named by its UUID
(`<uuid>.json`, `<uuid>.mp3`, …), which makes lookups trivial across servers.
Uploaded user tracks are stored **separately** from our own catalog.

**File layout on Hetzner** (`/mnt/data/OPEN_TRACKS/`): `RAW/`, `PREVIEWS/`,
`SEGS/`, `AUDIO_PEAKS/`, `COVERS/`, plus `UPLOADS/`, `UPLOADS_RAW/`,
`SEG_UPLOADS/` for user-uploaded tracks.

**Track types:** `electrobuzz` (premium catalog from the monthly pipeline — our
own ~2.35M set, §5), `upload` (user-uploaded), `open` (open-source tracks via
local extraction scripts). *(Earlier docs used `label` for the premium type;
`electrobuzz` is the current value.)*

### 7.3 Performance

- Similarity **by search**: ~1–2s (no extraction; Alwyzon proxies to Hetzner,
  Hetzner compares existing profiles, Alwyzon hydrates and returns).
- Similarity **by upload**: ~10–15s (full pre-process + profile first), load-dependent.

---

## 8. Security & Compliance

This section is what partners and rights holders actually ask about. **Be honest
internally about what's shipped vs. roadmap** — the worst outcome is promising a
label something we haven't built. Items are tagged **[live]** / **[partial]** /
**[roadmap]**.

### 8.1 Ingestion safety gate — [live]

Every file entering Alwyzon passes, before anything else:

- **ClamAV** virus/malware scan (run as a service).
- **Empty-file** rejection.
- **FFmpeg** validation that the file is genuinely decodable audio (not a renamed
  payload).

Only after passing all three does a track proceed to processing.

### 8.2 Transport & network — [live]

- **TLS** on all public endpoints (nginx + certbot).
- **CORS** locked to known origins (e.g. `https://resomix.com`,
  `https://beta.resomix.com`).
- Hetzner exposes only **3** media endpoint types to the world (segments, covers,
  peaks) plus an **IP-whitelist** for server-to-server calls; everything else is
  internal-only.
- **nginx rate limiting** (Alwyzon): `api_rl` 3 r/s (API/search), `global_rl`
  5 r/s (catch-all), `admin_rl` 10 r/min (admin), `perip_conn` 30 max concurrent
  connections/IP.
- **fail2ban** jails: `nginx-4xx-5xx` 40/2min → 2h; `nginx-404` 25/3min → 3h;
  `nginx-admin-abuse` 6/5min → 12h; `recidive` 5 bans/day → 7d.

### 8.3 Authentication & access — [live]

- **JWT** for users, scoped **API keys** for partners/services.
- Per-partner **SFTP lockdown**: list-only root, no directory creation, only
  approved file types (`.flac/.wav/.aiff/.mp3/.zip/.csv/.done`), internal folders
  hidden, per-tier storage quota.

### 8.4 Copyright / legal safeguards — [live]

These are **implemented and live** on the media server and are our strongest
talking points for rights holders (they map to the EU "temporary reproduction
exception").

- **0-hour raw-audio retention.** For user uploads, the original file is **deleted
  immediately** after feature extraction + preview generation. We don't host
  user-uploaded source audio at all.
- **30-second preview hard cap.** All previews and their HLS streams are
  hard-limited to 30s, **enforced at the FFmpeg segmentation level** — full tracks
  can never be streamed. (This is also what keeps us out of "distribution service"
  territory.)
- **Session-bound upload profiles.** The numerical profiles/embeddings from an
  *uploaded* track live only for the user's session; on track-delete or
  session-end they're purged.
- **No caching.** HLS manifests for removable tracks set
  `#EXT-X-ALLOW-CACHE:NO` so no residual playback cache survives a delete.
- **Tamper-proof audit logs.** Legally sensitive events (`source_file_deleted`,
  `preview_fragment_created`, `preview_fragment_deleted`) are signed with **ECDSA
  (SECP256R1)**. We ship a standalone `scripts/verify_audit_log.py` + public key so
  a rights holder can **independently verify** the logs are authentic and
  untampered. This is a genuinely differentiating compliance feature — lead with it.

### 8.5 Stream / asset protection — [live] (valet-key tokens)

Media access uses a **valet-key (boarding-pass) pattern**, and it's live and
enforced end-to-end across both servers:

- **Mint (Alwyzon).** When an authenticated user/partner needs media, Alwyzon
  mints a **short-lived JWT** — `POST /partner/playback-token` →
  `generate_playback_token()` (per-playlist variant: `generate_edge_token()`).
  The token is HS256-signed with a shared secret (`EDGE_JWT_SECRET`) and carries
  `scope="playback"`, the owning `partner_id`, the client `ip`, and an `exp`
  (TTL = `edge_token_ttl_seconds`). Hetzner never sees the user's credentials or
  the partner API key.
- **Attach (frontend).** The client attaches this token (`?token=…`) to **every**
  request it makes to Hetzner for assets — HLS segments, 30s previews, waveform
  peaks, and cover art.
- **Verify (Hetzner).** Every asset endpoint (`audio`, `segment`, `peaks`,
  `cover`) is guarded by the `require_partner_id` / `require_edge_token`
  dependency, which on each request verifies the **signature**, rejects **expired**
  tokens (`exp` is required), and — with `EDGE_VERIFY_IP` (default on) — checks the
  request IP against the token's `ip` claim. Anything that fails → **403**.
- **Partner isolation.** For external clients the `partner_id` is taken from the
  **verified token claim**, not from the URL, so a client can't reach another
  partner's assets by tampering with query params. Token propagates to the
  `.ts` segments because the client carries it on every segment request — each
  segment fetch is individually authorized.
- **Server-to-server.** Alwyzon's internal calls come from **allowlisted IPs** and
  pass an explicit `partner_id`, bypassing the token so platform plumbing isn't
  affected.

This supersedes the older "HMAC/Fernet links are commented out" note — that
placeholder approach was replaced by the JWT valet-key scheme above, which is the
one actually running.

**Deliberately out of scope (not on the roadmap):**

- **AES-128 encrypted HLS** — segments themselves are **not** encrypted at rest
  (no `#EXT-X-KEY`). The valet token protects *access and delivery*, but a holder
  of a valid token within the TTL could still capture the (≤30s) segments. We've
  decided this is **low priority / not planned** for now — the hard 30s cap makes
  the residual risk small — and may revisit it later if a specific partner requires
  it. Don't present it as upcoming work.

> Externally: "PYXIS-1 media is delivered via short-lived, IP-bound, signed
> access tokens minted per authenticated session." That's an accurate, confident
> statement — the token layer is real. Don't volunteer the AES-128 point unless a
> partner explicitly asks about at-rest segment encryption.

### 8.6 Backups & disaster recovery — [roadmap]

⚠️ The industry **3-2-1** is **not yet implemented**: no offsite backups, no
Storage-Box snapshots, no Restic/Borg dedup. Today we have RAID on Hetzner only
(*RAID is not a backup*). Target:

- Copy 1: live data on Hetzner.
- Copy 2: local snapshot to a separate Hetzner Storage Box.
- Copy 3: immutable, deduplicated **offsite** backup (Restic/Borg → Backblaze B2),
  with **encryption keys held in the EU** so the offsite provider can't read
  plaintext (satisfies EU "supplementary measures").
- DR/RTO story for 22TB includes physical-transport restore (e.g. Backblaze
  Fireball) to hit an RTO measured in days, not weeks.

> Don't quote any RTO/backup numbers to a partner until at least Copy 3 exists.

### 8.7 High availability & network isolation — [gap / roadmap]

Two related gaps here, both **TODO**:

**a) Single point of failure.** The split-stack is a SPoF — if either Alwyzon or
Hetzner dies, the service is down. Target HA story for enterprise partners:
**floating IPs + keepalived/HAProxy** at the edge, **MariaDB clustering** (Galera
for RPO=0, or async + Orchestrator for read-heavy).

**b) Inter-server traffic is on the public network — and not all of it is
encrypted.** All three hosts talk to each other over **public IPs**, not a private
network:

- Alwyzon ↔ Hetzner — over public domains (HTTPS exists there).
- Hetzner → **GPU embedding server** — this is a **separate Hetzner box**, and
  these calls go **straight to its public IP over plain HTTP with no TLS/HTTPS**.
  Embedding payloads (and the request flow) currently cross the public network
  **unencrypted**. This is the weakest link.

What it would take to close this:

1. **Encrypt the GPU hop now (quick win):** put the GPU service behind TLS — either
   a reverse proxy (nginx/Caddy) with a cert, or a self-signed/internal CA cert
   with pinning — so Hetzner → GPU stops being plaintext. Lowest-effort, highest
   value of the items here.
2. **Private network across all three hosts:** since the boxes span **different
   providers/accounts** (Alwyzon ≠ Hetzner; the GPU is yet another Hetzner server),
   a native Hetzner vSwitch won't cover everything — stand up a **WireGuard mesh**
   between Alwyzon, Hetzner, and the GPU box, re-point server-to-server calls to the
   VPN IPs, and lock the internal/asset/GPU ports to the VPN interface.
3. **Default-deny firewalls** so internal services (DB :3306, the GPU endpoint, the
   Hetzner internal API) only accept connections from the VPN peers, never the
   public internet.

> Today's mitigations: IP allowlist on server-to-server calls + the valet-key edge
> tokens on public asset endpoints. Those cover access control, but **do not**
> encrypt the GPU hop — item (1) is the one to prioritize. Leaving this as a
> tracked gap; no launch decision recorded yet.

### 8.8 EU / regulatory — [partial / roadmap]

We launch in **Europe**, so:

- **Data residency** is a strength: compute/storage on **Hetzner (Germany)** and
  **Alwyzon (Austria)**, both EU. Any US service (CDN, backup) needs SCCs +
  EU-held encryption keys (post-Schrems II).
- **GDPR** applies to user data (DJ profiles, listening history) and some
  artist/songwriter identifiers — handle accordingly.
- **Article 17 / OCSSP — ACR not in place.** Because we host and surface
  copyrighted audio, rights holders may expect **Automated Content Recognition
  (ACR)** at ingestion (Audible Magic or ACRCloud) with a stay-down blocklist. We
  **do not have this yet**. ⚠️ **Do not raise ACR with a partner proactively** —
  only address it if they explicitly ask, and then frame it as planned. Internally
  this is the biggest copyright-compliance gap before a major label.
- **DDEX / ERN ingestion — not used.** DDEX/ERN (machine-to-machine, DPID
  identity) is what large distributors eventually expect, but we **don't have it**
  and aren't building it for launch. Our delivery path is **CSV manifest + SFTP**
  (§6.1), which is what we go to market with for the first partners.

### 8.9 What we disclose vs. what we keep

- ✅ **Disclose freely:** architecture shape, split-stack design, TLS/CORS/fail2ban
  + rate limits, ClamAV + FFmpeg ingestion gate, SFTP lockdown, HLS streaming, the
  **live legal safeguards** (§8.4 — 0-hour retention, 30s cap, no-cache, ECDSA
  audit logs — lead with these), the **valet-key media tokens** (§8.5), EU
  residency, and the **PYXIS-1 feature narrative** (§4.1).
- 🤐 **Don't raise unless asked:** ACR, AES-128 segment encryption, DDEX. If a
  partner asks, answer honestly (ACR/DDEX = not in place; AES-128 = not planned,
  mitigated by the 30s cap) — but don't put them on the table ourselves. Backups
  and HA are framed as **roadmap** if they come up.
- 🔒 **Never disclose:** that similarity is **MAEST / Discogs-EffNet embeddings +
  FAISS cosine** with E1–E6 fusion (§4.2); the 768-D/1280-D dimensions; the GPU
  embed server; the words "model / deep learning / training / embedding"; the
  specific weights and tuning; internal admin endpoints, internal API keys, or
  server-to-server auth details. **Frame current gaps (§8.6–8.7, plus AES-128 in
  §8.5) as "roadmap," never volunteer "currently missing/bypassed."**

---

## 9. Decisions & Open Items

### Settled

- **Engine name** — **PYXIS-1** is the official name; older names (e.g.
  "R-BeatNet") are retired.
- **AES-128 segment encryption** — **not planned** for now (low priority; may
  revisit if a partner requires it). Mitigated by the hard 30s cap. Don't present
  as upcoming.
- **ACR** — not in place. Treat as a known internal gap; **don't raise with
  partners unless they explicitly ask.**
- **DDEX/ERN** — not used and not being built for launch; we go to market on
  **CSV manifest + SFTP**.
- **Catalog** — ElectroBuzz **is our own catalog** (~3M processed → ~2.5M
  Apple-matched and shown). External story stays "~2.5M from Apple Music." (§5)
- **Partner-facing edition** — owner will produce it separately; this doc just
  flags what to keep out of partner-facing material (§8.9).

### Still open

- **Backups/DR** — 3-2-1 is **not** in place (RAID only). Stand up at least one
  offsite copy before quoting any RTO to a partner. (§8.6)
- **Inter-server encryption / private networking** — server-to-server traffic runs
  over public IPs, and the **Hetzner → GPU embedding-server hop is plain HTTP with
  no TLS**. TODO: (1) put TLS on the GPU hop now, (2) WireGuard mesh across Alwyzon
  + Hetzner + GPU, (3) default-deny firewalls. IP allowlist + edge tokens mitigate
  *access* but not *encryption* of the GPU hop. No launch decision recorded. (§8.7)

---

## Reference Material

- [docs/reference/PARTNER_ONBOARDING.md](reference/PARTNER_ONBOARDING.md) — full operator runbook for onboarding a partner (DB record, API key, SFTP, ingestion, embeddings, FAISS).
- [docs/reference/APPLICATION_OVERVIEW.md](reference/APPLICATION_OVERVIEW.md) — backend layered architecture.
- [docs/reference/1.Digital_suuply_chain.md](reference/1.Digital_suuply_chain.md) … [6.Example_questions.md](reference/6.Example_questions.md) — DDEX, copyright/Article 17, HLS delivery, HA, backups, and drafted rights-holder Q&A.
- [docs/technical/prompt.md](technical/prompt.md) — original system briefing (uses the deprecated "R-BeatNet" name).
- [docs/PROCESSING_PIPELINE_RUNBOOK.md](PROCESSING_PIPELINE_RUNBOOK.md) — pipeline operations.

### Media-server repo (`resomix-similarity-open/`)

- `Technical Overview.txt` — the canonical **public** engine narrative + the rule "don't say model/deep learning/training."
- `docs/reference/SIMILARITY_FLOW_OVERVIEW.md` — full technical reference: three servers, MAEST/Discogs dims, E1–E6 strategies, endpoints, asset generation. 🔒 internal.
- `docs/reference/legal_compliance_summary.md` — the **live** legal safeguards (0-hour retention, 30s cap, no-cache, ECDSA audit logs). Disclosable.
- `docs/reference/hetzner_server.md` — honest **gap matrix** (what's followed vs. not) for label-readiness. 🔒 internal.
- `docs/reference/ELECTROBUZZ_BACKFILL_LIVE_STATE.md` — the running ~2.35M catalog backfill / our own catalog reality. 🔒 internal.

# rekordbox export — research, facts & implementation plan

**Status:** Research complete. **No code written.** Awaiting a decision on which routes to build.
**Date:** 2026‑07‑24
**Scope:** How Resomix playlists can reach a DJ's rekordbox library; how to reconcile a DJ's own
catalogue against ours; how to run similarity restricted to (or seeded from) that catalogue.
**Out of scope:** Spotify (explicitly excluded by product decision).

---

## 0. TL;DR — the five facts that decide everything

1. **rekordbox has no API.** No REST, no OAuth, no webhooks, no SDK, no partner programme. The
   entire official "developer" surface is *one XML file format imported by hand*. Export to
   rekordbox can only ever mean **producing a file the DJ opens**.
2. **rekordbox has no catalogue of its own.** It is a library manager over the DJ's own files. It
   *integrates* six streaming services — and **Apple Music is one of them (since March 2025)**.
3. **Our Apple Music export therefore already lands in rekordbox today.** A DJ exports a Resomix
   playlist to Apple Music, opens rekordbox 7.1.0+, and it is sitting in the Streaming tree. Zero
   new backend work — it needs a UI affordance only.
4. **The rekordbox XML format has no ISRC field.** Matching a DJ's rekordbox library against our
   catalogue is **metadata‑based, not ISRC‑based**. (ISRC *does* work for Apple / Spotify / TIDAL /
   Beatport inputs — see §5.1.)
5. **Restricted similarity is not new work.** `search_e3()` already loads an arbitrary candidate
   set's vectors from disk and cosines them. Scoping similarity to a subset is the second half of
   an engine already running in production.

---

## 1. What rekordbox is

**rekordbox is not a music service.** It is the library‑management + performance application for
DJs, made by **AlphaTheta** (the company formerly branded Pioneer DJ).

### Platforms

| Platform | Status |
| --- | --- |
| macOS / Windows desktop | ver. 7 current — the real product |
| iOS / Android | companion apps |
| **Web app** | **does not exist** |
| **Public cloud API** | **does not exist** |

### The two modes

| Mode | Purpose |
| --- | --- |
| **EXPORT** | Prepare the library → write to **USB stick / SD card** → plug into CDJ‑3000s / XDJ in the club booth |
| **PERFORMANCE** | DJ directly from the laptop with a controller |

### The workflow a DJ actually lives in

1. Acquire audio files (Beatport purchases, promo pools, own productions, rips).
2. Drag into rekordbox → it **analyses**: BPM, beatgrid, musical key, waveform.
3. Set **hot cues, memory cues, loops**, colour tags, My Tag, comments.
4. Organise into **playlists / folders / crates** — per gig, per genre, per energy level.
5. **Export to USB.** Plug into the booth CDJs; every cue point and beatgrid travels with it.

Step 5 is why rekordbox matters: it is the de‑facto standard for club booths worldwide. The product
is about **preparation**, not listening.

### Plans (approximate — verify current pricing before quoting to users)

| Plan | ~Price / month |
| --- | --- |
| Free | $0 |
| Core | ~$12 |
| Creative | ~$18 |
| Professional | ~$36 |

Annual billing ≈ 12 months for the price of 10.

> **Important for us: the Free plan already covers library prep, playlist import, and USB export to
> CDJs.** Our file‑based export routes therefore require **no rekordbox subscription at all**.

---

## 2. Streaming integrations (rekordbox owns no music)

rekordbox ver. 7 has a **Streaming** section in the left‑hand tree view, integrating:

- **Apple Music** — added **March 2025**, requires rekordbox **7.1.0+** (part of Apple's
  *"DJ with Apple Music"* programme, which also covers Serato DJ Pro, Engine DJ, djay Pro)
- **Beatport Streaming** (the DJ / electronic one)
- **Beatsource**
- **TIDAL**
- **SoundCloud Go+ / DJ**
- **Spotify** — re‑added December 2025

The DJ logs into a service inside rekordbox and **their own playlists from that service appear in the
tree**, draggable straight onto a deck. rekordbox can have all of them active simultaneously, unlike
some rivals.

### Hard limitations on streaming tracks

These are blocks, not preferences:

| Limitation | Detail |
| --- | --- |
| ❌ **No USB / SD export** | Streaming tracks can never reach a CDJ. No LINK EXPORT either. |
| ❌ **No recording** | Disabled for copyright. |
| ❌ **No metadata editing** | |
| ⚠️ **No offline storage — Apple Music & Spotify** | Beatport has an Offline Locker (~1000 tracks on top tier); TIDAL / SoundCloud partial with 30‑day limits. |
| ⚠️ **Apple Music ToS is non‑commercial only** | Using streamed Apple tracks at a *paid* gig violates Apple's terms. |

**Conclusion:** streaming inside rekordbox is for **discovery, practice, and home sets**.
Professional booth work still runs on owned files.

---

## 3. Is there an API? — No.

Verified thoroughly. The answer is unambiguous.

- AlphaTheta's entire **"rekordbox for Developers"** page documents exactly one thing: an XML format
  imported manually via `File → Preferences → Bridge → Imported Library`.
- ❌ No REST API, no OAuth, no webhooks, no SDK.
- ❌ No partner or developer programme to apply to.
- ❌ No cloud endpoint. **Cloud Library Sync** is rekordbox syncing its own encrypted database
  through the *user's* Dropbox / Google Drive — proprietary, not addressable by us.
- ❌ The local library (`master.db`) is **SQLCipher‑encrypted**. `pyrekordbox` can decrypt and read
  it, but its own documentation warns that **adding new rows is unsupported and can corrupt the
  library**, because nobody knows how rekordbox generates its UUIDs. Viable only for an installed
  desktop app (which is what **Lexicon** is) — never for a web service.

### The clinching proof

**Soundiiz**, which supports 45 music services, lists rekordbox as **source only** — the user
exports an M3U8 *out of* rekordbox and uploads it. Not one major transfer service can push *into*
rekordbox. If it were possible, they would have done it.

---

## 4. The rekordbox XML format (authoritative spec)

Pulled from AlphaTheta's own `xml_format_list.pdf`.

### Structure

```
DJ_PLAYLISTS (Version)
├── PRODUCT (Name, Version, Company)
├── COLLECTION (Entries)
│   └── TRACK (attributes below)
│       ├── TEMPO (Inizio, Bpm, Metro, Battito)        ← beatgrid
│       └── POSITION_MARK (Name, Type, Start, End, Num) ← cue points
└── PLAYLISTS
    └── NODE (Type: 0=FOLDER 1=PLAYLIST, Name, Count/Entries, KeyType)
        └── TRACK (Key)
```

### Complete `TRACK` attribute list

```
TrackID, Name, Artist, Composer, Album, Grouping, Genre, Kind, Size,
TotalTime, DiscNumber, TrackNumber, Year, AverageBpm, DateModified,
DateAdded, BitRate, SampleRate, Comments, PlayCount, LastPlayed,
Rating, Location, Remixer, Tonality, Label, Mix, Colour
```

### Critical details

- **There is NO `ISRC` attribute.** rekordbox also explicitly ignores non‑standard metadata tags,
  and ISRC is not among the ~39 library columns it displays.
- **`Location`** — "Location of the file", URI formatted, spec says *"expected media to be located in
  `file://localhost/`"*. **Playlists point at local files on the DJ's own disk.**
- **`NODE.KeyType`** — `0` = key on `TrackID`, `1` = key on `Location`. Both internal to the file.
- All string fields UTF‑8 with XML entity encoding; numerics locale‑independent.

### Other import formats rekordbox accepts

**M3U, M3U8, PLS** via `File → Import → Import Playlist`. Also local‑file based.

### Relocation (makes the "we don't know your paths" case workable)

rekordbox has **Auto Relocate** (`Preferences → Advanced → Database → Auto Relocate Search Folders`).
The DJ registers their music folders and rekordbox reconnects missing files automatically. Caveat:
batch relocation handles one parent‑folder group at a time.

---

## 5. Matching: how do we know whether we have their tracks?

This is **catalogue reconciliation** — a problem entirely separate from similarity.

### 5.1 ⚠️ ISRC does NOT work for rekordbox XML

Because the XML has no ISRC attribute (§4), **matching a rekordbox library is metadata‑based, full
stop.** The DJ's *audio files* almost certainly carry ISRC in their ID3 tags, but we receive the
XML, not the files.

| Input | ISRC available? | Match quality |
| --- | --- | --- |
| **rekordbox XML** | ❌ never | fuzzy only |
| **Apple Music library** (we already hold their token) | ✅ via catalog lookup | **exact** |
| Spotify / TIDAL / Beatport export | ✅ | exact |
| CSV where the user pastes ISRCs | ✅ | exact |

> **Opportunity we are sitting on:** we already store a Music‑User‑Token per user in
> `user_service_connections`. With it we can call `GET /v1/me/library/songs` and
> `GET /v1/me/library/playlists`, resolve to catalog IDs, and read **ISRCs directly** — turning a
> messy fuzzy‑match problem into an exact join, for a fraction of the code the XML matcher needs.

### 5.2 Our side of the join is strong

`tracks.isrc` is **`NOT NULL` and indexed** — every row has one. We also carry `bpm`, `musical_key`,
`display_artist`, `mix_name`, `version_title`, `duration_ms`, `genre_id`, `p_line_year`, and label
via release — a near 1:1 map onto the rekordbox XML schema.

### 5.3 The three‑tier match ladder

**Tier 1 — ISRC exact.** Normalise (uppercase, strip hyphens/spaces → 12 chars `CCXXXYYNNNNN`), one
indexed lookup against `tracks.isrc`. Confidence `1.0`.

**Tier 2 — Deterministic fingerprint key.** Every normalisation primitive already exists and is
already used for dedup:

| Primitive | Location |
| --- | --- |
| `normalize_artist_name()` | `app/utils/similarity_utils.py:42` |
| `_artist_title_key()` ← *exactly the key we want* | `app/utils/similarity_utils.py:82` |
| `MetadataService._filter_title_field()` | strips URLs / domains / stopper junk |
| `split_artists()`, `_norm_kw()` | `app/utils/es_index.py:114` |

Key = `sorted(normalised_artists) ⊕ normalised_title ⊕ version ⊕ round(duration/5s)`.
Build once over our catalogue, hash‑join. Confidence ≈ `0.97`.

**Tier 3 — Fuzzy scored match via Elasticsearch.** The index we rebuilt is ideal — `folding_text`
analyzer, `fuzziness: AUTO`, `terms_set`, `multi_match`, `collapse` on `dedupe`. One `_msearch` with
200 bodies → top 5 candidates each → ~1–2 s total. Then score deterministically:

| Signal | Weight | Notes |
| --- | --- | --- |
| Artist token Jaccard | 0.35 | after normalisation |
| Title similarity (token‑set ratio) | 0.30 | version stripped out first |
| **Duration delta** | 0.20 | ≤3 s strong; **>15 s = hard veto** |
| BPM delta | 0.10 | ±1 strong |
| Version / mix match | 0.05 | see veto below |
| Year proximity | tie‑break | |

**Thresholds:** `≥0.90` auto‑accept · `0.75–0.90` surface for review · `<0.75` unmatched.

**Two hard vetoes** — a wrong match is worse than no match:

1. Duration differs by **>15 s** → reject. (This is what separates *Original Mix* from *Extended Mix*.)
2. Both sides name a **different remixer** → reject. `(Daniel Jaeger Remix)` and `(Original Mix)`
   are different recordings and a DJ notices instantly.

### 5.4 Text variation — what actually breaks

Worked example on a real filename:

**`04-Avocado, Moody Kablawi, Dave Dinger - Solina (Daniel Jaeger Remix)-electrobuzz.net.flac`**

| Problem | Fix |
| --- | --- |
| `04-` track‑number prefix | regex strip leading `\d{1,3}[-. ]` |
| 3 comma‑separated artists | `split_artists()` → sorted set, compare by Jaccard not equality |
| `(Daniel Jaeger Remix)` inline in the title | **parse parentheses into a separate `version` slot before comparing** — ours lives in `mix_name` / `version_title`, theirs is inline |
| `-electrobuzz.net` suffix | `_filter_title_field()` already strips this |

Other real cases:

| Variant | Handling |
| --- | --- |
| `Kölsch` vs `Kolsch` | NFKD unicode fold (ES `folding_text` does it; mirror in Python via `unicodedata`) |
| `A & B` / `A and B` / `A, B` | `normalize_artist_name()` collapses connectors |
| `feat.` / `ft.` / `featuring` / `pres.` / `vs.` | strip to a **secondary** artist list — present is a bonus, absent is not a penalty |
| `Original Mix` vs no suffix | treat empty version ≡ `original mix` |
| `Original Mix` vs `Extended Mix` | **different** — duration veto catches it (usually 2+ min apart) |
| `Vol. 2` vs `Volume 2`, `Pt.` vs `Part` | small alias table |
| `Don't` / `Dont` / `Don´t` | punctuation strip in `_norm_kw()` |
| Artist and title swapped in the tag | try both orientations, keep the better score |

**The rule that makes this tractable: never compare raw strings.** Decompose both sides into
`(artist_set, base_title, version, duration, bpm)` and compare each field on its own terms.
Comparing `"Avocado, Moody Kablawi, Dave Dinger - Solina (Daniel Jaeger Remix)"` to `"Solina"` as
strings gives garbage; comparing decomposed fields gives a confident match.

---

## 6. How our similarity works (grounding for restricted similarity)

Two embedding spaces, both L2‑normalised so **cosine == inner product**:

| Space | Dim | Stored |
| --- | --- | --- |
| **MAEST** | 768 | `maest_full_vectors_dir/{uuid}.npy` + global FAISS index |
| **Discogs / EffNet** | 1280 | `discogs_vectors_dir/{uuid}.npy` + global FAISS index |

Engines (`resomix-similarity-open/app/helpers/e1..e6_helper.py`):

| Engine | Strategy |
| --- | --- |
| **E1** | MAEST only |
| **E2** | EffNet/Discogs only |
| **E3** | Cascade — MAEST top‑500 → **load those candidates' `.npy` from disk → cosine → re‑rank** |
| **E4** | Weighted `0.7·maest + 0.3·discogs` over the same top‑500 candidate set |

### The key architectural finding

- `e3_helper.py:73‑95` **loads an arbitrary set of per‑track vectors off disk and cosines them.**
- `partner_faiss_repository.py` already builds **scoped, incremental `IndexIDMap2(IndexHNSWFlat)`
  indexes per partner**, with `add_vector()` for incremental insert.

> **"Compute similarity within a restricted subset" is not a new capability. It is literally the
> second half of E3, running in production today.** Given a list of UUIDs we load their vectors and
> matmul. For a few thousand tracks that is a single numpy operation — microseconds. FAISS is not
> needed below ~50k tracks; above that, reuse the `partner_faiss_repository` pattern.

---

## 7. "200 tracks and we only have 10" — the three modes

The 10 matched tracks are **seeds, not the deliverable**. Three genuinely different features:

### Mode A — "Enrich my crate" (open recommendation from seeds) ← the answer for 10/200

1. Take the matched tracks → load their MAEST + EffNet `.npy` vectors (**already on disk, zero compute**).
2. **Taste centroid**: mean of the L2‑normalised vectors, re‑normalise. Then k‑means into 2–3
   clusters so a DJ who plays both techno and disco isn't averaged into mud.
3. Query the global FAISS index with each centroid → top N.
4. **This is `search_e3()` with a synthetic query vector instead of an upload vector.** Nothing new.

**The 190 unmatched still earn their keep** — not as vectors, but as a **taste profile**. Their
metadata yields BPM distribution, key distribution, genre mix, year range, label affinity. That
becomes a re‑rank / filter layer over the FAISS results: *"your library is 122–126 BPM, 78% house,
mostly 2019–2024"* → boost candidates inside that envelope. Cheap, and the highest‑value use of
tracks we don't hold.

### Mode B — "Sequence my own library" (restricted similarity)

For *"I have 200 tracks, build me a 60‑minute set that flows"*:

- Load the matched vectors → **N×N cosine matrix, one numpy matmul**.
- Greedy nearest‑neighbour walk with BPM / key (Camelot) constraints for a mixable running order.
- No FAISS at all at this size.

⚠️ **Covers the matched subset only.** With 10/200 the output is thin. **Gate it: hide Mode B below
~30 matched tracks.**

### Mode C — Hybrid (recommended shipping default)

Matched tracks first, ordered for flow (Mode B), then gaps filled from our catalogue (Mode A):
*"8 tracks you already own that fit, plus 12 from our catalogue that extend the set."*

### The hard limit — state it plainly in the UI

**For unmatched tracks we have no embeddings and cannot create any.** We have never heard that
audio. Any "audio similarity" claim over them would be fabricated. Honest options only:

- **(a)** metadata‑only affinity (BPM / key / genre / year) — labelled as such;
- **(b)** let the DJ **upload** the ones they care about → straight into the existing
  upload → embed → similarity pipeline.

### Expected match rates — set expectations honestly

Our catalogue is ~1.98M Electrobuzz **electronic** tracks:

| DJ profile | Expected match rate |
| --- | --- |
| Electronic / house / techno, fuzzy XML matching | **~30–60%** |
| Mainstream / open‑format / wedding | **~5–15%** |
| Any DJ who connects **Apple Music** (ISRC path) | substantially higher, near‑exact |

**10/200 is not a bug** — for an open‑format DJ it is the expected result. The feature must be
designed so that outcome is still useful, which is why **Mode A matters more than Mode B**.

---

## 8. The four export routes, ranked

### 🟢 Route A — Streaming passthrough *(already built; undocumented to users)*

Our Apple Music export already lands in rekordbox. DJ exports to Apple Music → opens rekordbox
7.1.0+ → Streaming → Apple Music → the playlist is there, with automatic BPM/beatgrid analysis.

**Work required:** a UI affordance and a short instruction panel. Nothing else.
**Caveat:** those tracks cannot go to USB — home/practice path, not a booth path.

### 🟢 Route B — rekordbox XML download *(the real "Export to rekordbox")*

**B1 — metadata‑only / crate builder.** Full `COLLECTION` + `PLAYLISTS` with title, artist, BPM,
key, genre, label, year, mix, comments (+ our beatgrids/cues if available). `Location` points at a
predictable pseudo‑path; DJ uses **Auto Relocate** to bind their files.

**B2 — "match my library" ⭐.** DJ uploads their rekordbox collection XML. We match (§5) and return
an XML whose `Location` values are **their real file paths** — imports perfectly, zero relocation.

Requires **no API, no partner deal, no subscription, no approval from anyone.**

### 🟡 Route C — M3U8 / CSV download *(trivial; ship alongside B)*

rekordbox imports M3U/M3U8/PLS via `File → Import → Import Playlist`. The same M3U8 also works in
**Serato, Traktor, Engine DJ, VirtualDJ**, and Soundiiz accepts it — a free bridge to 45 other
services. CSV variant doubles as a buy‑list.

### 🔴 Route D — Beatport / TIDAL *(future, business‑gated)*

Beatport is the right genre fit (electronic store, matches our electrobuzz catalogue) and Beatport
playlists appear inside rekordbox for Beatport Streaming subscribers — and notably **you cannot
create Beatport playlists from inside rekordbox; they're managed on Beatport's side**, which is
exactly the gap an API would fill. **But the Beatport v4 OAuth API is partner‑gated** (apply and be
approved; historically non‑commercial‑only for outsiders). A BD conversation, not a sprint.

**TIDAL is the cheaper second streaming target:** self‑serve Open API, ISRC lookup, playlist
creation, and rekordbox reads TIDAL playlists.

### Route comparison

| | A (Apple) | B (XML) | C (M3U8/CSV) | D (Beatport) |
| --- | --- | --- | --- | --- |
| External keys we need | ✅ already have | **none** | **none** | partner approval |
| Approval process | done | **none** | **none** | yes, gated |
| DJ's rekordbox plan | any | **Free is enough** | **Free is enough** | any |
| DJ's paid subscription | ✅ Apple Music | **❌ none** | **❌ none** | ✅ Beatport Streaming |
| DJ needs the files | no | yes (B2) | yes | no |
| Works on CDJ via USB | ❌ never | ✅ yes | ✅ yes | ❌ never |
| Desktop only | no | desktop | desktop | no |

---

## 9. Field mapping — Resomix → rekordbox XML

| rekordbox attribute | Resomix source |
| --- | --- |
| `Name` | `tracks.title` (+ `version_title`) |
| `Artist` | `tracks.display_artist` |
| `Mix` | `tracks.mix_name` |
| `AverageBpm` | `tracks.bpm` |
| `Tonality` | `tracks.musical_key` (convert to rekordbox key notation) |
| `Genre` | `genres.name` via `genre_id` |
| `Label` | `labels` via release |
| `Year` | `tracks.p_line_year` |
| `TotalTime` | `tracks.duration_ms / 1000` |
| `Comments` | `"Resomix • ISRC {isrc}"` ← **smuggles ISRC into a field rekordbox does keep** |
| `Location` | matched local path (B2) or pseudo‑path (B1) |

> The `Comments` trick is worth doing: it is the only way ISRC survives into the DJ's library, and it
> makes round‑tripping (re‑importing their library later) far more reliable.

---

## 10. Implementation plan

### Backend — new files

| File | Purpose |
| --- | --- |
| `app/services/rekordbox_export_service.py` | Builds XML / M3U8 / CSV. Pure functions. |
| `app/services/library_match_service.py` | The three‑tier match ladder (§5.3). |
| `app/schemas/rekordbox_export.py` | Request/response + `MatchReport`. |
| `app/controllers/rekordbox_export_controller.py` | |
| `app/api/routers/rekordbox_export.py` | prefix `/rekordbox` |

### Endpoints

```
GET  /rekordbox/export/{playlist_id}/?format=xml|m3u8|csv
        → StreamingResponse, Content-Disposition attachment

POST /rekordbox/match-library/
        → upload collection XML (or pull from connected Apple Music), returns MatchReport + token

GET  /rekordbox/export/{playlist_id}/?match={token}
        → XML bound to their real file paths
```

### Similarity server — one new endpoint

```
POST /similarity/query-by-uuids/
  { uuids[], mode: "centroid" | "pairwise", top_k, exclude_uuids[] }
```

~40 lines: load vectors from `*_vectors_dir`, mean‑or‑matmul, reuse the existing E3 re‑rank tail.

### Persistence

New tables, following the provider‑agnostic shape of `user_service_connections`:

- `user_library_imports` — one row per upload (source, filename, counts, created_at)
- `user_library_tracks` — `track_id` **nullable** (unmatched rows kept), `confidence`,
  `match_tier`, `local_path`, raw parsed fields

Makes re‑runs instant, lets users correct bad matches, and those corrections become training data
for the scorer.

### Entitlements

`ServiceProvider.REKORDBOX` **already exists** in `app/models/constants.py`. Add `rekordbox` to the
`export_targets` CSV capability and an `"exportRekordbox"` action in `useAccess()`, mirroring the
existing `exportApple` special‑case exactly.

**No `user_service_connections` row is needed for rekordbox** — it is a fileless, connectionless
export. Substantially simpler than Apple.

### Frontend (`resomix-web`)

Follow the `AppleExportPanel` pattern (no connect step, no persisted connection, no user‑gesture
problem). Per repo conventions: logic in `packages/hooks`, render pieces in `components/` + barrel,
pages stay thin.

`RekordboxExportModal`:

```
  ○ rekordbox XML   — full metadata, BPM, key, cues        [recommended]
  ○ M3U8            — also works in Serato / Traktor / Engine DJ
  ○ CSV             — shopping list for buying the tracks

  [ Match my library ]  ← optional, unlocks perfect paths

  [ Download ]  [ Close ]        ← side by side, stacked on mobile
```

Below the buttons: the same themed log box the Apple modal uses —
`building playlist… → 24 tracks → matched 19 to your library → download ready`.

**Instruction panel (DJs will not guess this):**

> **XML:** rekordbox → `File → Preferences → Bridge → Imported Library` → select the file. Your
> playlist appears in the **Bridge** pane; drag it into your Collection.
> **M3U8:** rekordbox → `File → Import → Import Playlist`.

**Match report front and centre:** *"We recognised 47 of your 200 tracks."* Then the three actions,
with Mode B hidden when the match count is too low.

### Phasing

| Phase | Work |
| --- | --- |
| 1 | Ingest & normalise — parse rekordbox XML / Apple library / CSV into normalised records. Reuse `_filter_title_field`, `normalize_artist_name`, `split_artists`, `_norm_kw`. New: parenthetical version extraction, track‑number strip, NFKD fold. |
| 2 | Match — Tier 1 → Tier 2 → Tier 3 with the two vetoes. Emit `MatchReport` (`matched[] / review[] / unmatched[]`, confidence + reason per row). |
| 3 | Persist — the two tables above. |
| 4 | Recommend — `POST /similarity/query-by-uuids/`, modes A / B / C. |
| 5 | Export — matched tracks get **their real `Location` paths**; unmatched get pseudo‑path + Auto Relocate, or the CSV buy‑list. |
| 6 | UI — match report, three actions, instruction panel. |

---

## 11. Open questions / decisions needed

1. **Do we hold distribution rights to the Electrobuzz masters?** `audio_files.asset_class` supports
   `master`, but `tracks.source_file_path` is documented as *"the original file location on the
   **source** server… the only reference back to the master when the master isn't in our storage"* —
   suggesting we mostly hold previews/HLS, not masters. **If we can serve actual audio files, Route B
   becomes dramatically stronger**: files + XML with real paths + our own beatgrids and key data =
   a complete, booth‑ready crate in one click. If not, Route B is B2 (match their library) + B1
   (buy‑list).
2. **Which routes to build, and in what order?**
3. Whether to add the **Apple‑library import** path (recommended — see §5.1).

---

## 12. Recommendation

**Ship C + B together** (no external dependencies, no approvals, works for free‑plan rekordbox
users), **add the Route A affordance to the Apple modal for free**, and **defer Beatport** until a
partnership conversation makes sense.

**Route B2 — matching against the DJ's own library — is the part worth pushing hardest.** It is the
only one of these no competitor offers, it needs nothing from Apple, AlphaTheta, or Beatport, and it
is what turns Resomix from a browsing experience into a tool a working DJ opens before every gig.

**Suggested sequence:** Apple‑library import + matcher first (highest precision, least code) →
rekordbox XML matcher → export formats.

---

## 13. Sources

- [rekordbox for Developers](https://rekordbox.com/en/support/developer/)
- [rekordbox XML format spec (PDF)](https://cdn.rekordbox.com/files/20200410160904/xml_format_list.pdf)
- [rekordbox ver.7 streaming FAQ](https://rekordbox.com/en/support/faq/streaming-7/)
- [rekordbox streaming restrictions FAQ](https://rekordbox.com/en/support/faq/streaming-5/)
- [Apple Music support announcement (rekordbox, Mar 2025)](https://rekordbox.com/en/2025/03/apple-music-support/)
- [AlphaTheta — Apple Music support](https://alphatheta.com/en/information/apple-music-support-added-to-rekordbox-and-all-in-one-dj-systems-omnis-duo-and-xdj-az/)
- [rekordbox Spotify support (Dec 2025)](https://rekordbox.com/en/2025/12/rekordbox-for-ios-android-now-supports-spotify/)
- [DJ with Apple Music — CDM](https://cdm.link/dj-with-apple-music/)
- [Mixmag — Apple Music DJ support](https://mixmag.net/read/rekordbox-adds-apple-music-support-alphatheta-update-software-dj-tech)
- [rekordbox manual — importing external playlists](https://www.manualslib.com/manual/1135837/Pioneer-Rekordbox.html?page=37)
- [pyrekordbox](https://github.com/dylanljones/pyrekordbox)
- [Beatport API docs](https://oauth-api.beatport.com/)
- [Beatport API access thread](https://groups.google.com/g/beatport-api/c/3qR1Uj1HnUk)
- [TIDAL Developer — API overview](https://developer.tidal.com/documentation/api-sdk/api-sdk-overview)
- [Soundiiz — rekordbox (source only)](https://soundiiz.com/tutorial/rekordbox-to-spotify)
- [Lexicon — sync to rekordbox](https://www.lexicondj.com/manual/sync-rekordbox-xml.html)
- [rekordbox platforms](https://support.alphatheta.com/en-US/articles/4612410976665)
- [Beatport Streaming in rekordbox](https://rekordbox.com/en/connect/beatport/introducing-beatport-streaming/)

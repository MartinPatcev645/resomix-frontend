# Similarity Score Investigation — upload vs search (WIP)

**Symptom:** for the *same* track, `similarity by search` (query-by-uuid, stored vectors) scores ~85–100,
but `similarity by upload` (fresh GPU embedding) scores ~64–70. Regression ("scores were proper before").

**Scoring recap (media server E4):** `final = 0.7·MAEST + 0.3·Discogs`.
- MAEST term = FAISS **inner-product** → `‖maest_query‖ · cos(query, candidate)` (depends on query-vector norm).
- Discogs term = sklearn `cosine_similarity` → norm-invariant.
- Search feeds the track's **stored `.npy`** vectors; upload feeds **freshly-computed** GPU vectors.
- Upload path leaves MAEST **un-normalized** (code comment "MAEST usually raw"); `search_similar` is
  documented to expect "L2-normalised input".

Collecting 5 tracks. Analysis per track below; running hypothesis at the bottom.

---

## Track 1 — "Badder Than Bad" (Camille, Chez Damier, Nico Lahs)

DB: uuid `3f1c6ec9…`, apple `1780827171` / isrc `GBLV62411296`, apple_dur 401.97s. Source = a 435s MP3
(original mix; the Apple match is a shorter edit).

| Path | queried self | top-1 | top-20 | band width | example neighbours |
|------|-------------|-------|--------|-----------|--------------------|
| **Search** (uuid `61c27f8f`, a dup of the same Apple track) | 1.0 | **0.8498** | 0.8341 | ~0.016 | Jacques Renault, Save the Robots, Igor Gonya, S3A (house/nu-disco) |
| **Upload** (435s file) | 1.0 | **0.6541** | 0.6430 | ~0.011 | Save the Robots, Sam Ruffillo, MDA Grooves, Bondax, Moojo (house/afro/disco) |

**Observations**
- **Gap ≈ 0.19–0.20, and roughly CONSTANT across all 20 neighbours.** Both bands are extremely narrow
  (~0.01–0.016 spread). A near-uniform downward shift = a **multiplicative scaling of one term**, i.e. the
  MAEST inner-product being multiplied by a smaller query-vector norm — NOT random direction noise.
- **Upload results are still genre-appropriate** (house/nu-disco/afro), and neighbour sets **partially
  overlap** (both contain "From Me" / Save the Robots, "Why Wait For Tomorrow", "African Woman",
  "Mediterranea (Party Mix)"). So the direction is *similar*; the magnitude is what's off.
- The track's own duplicate twin doesn't appear in either list — **expected**, it's removed by the
  apple_song_id/ISRC de-dup (both copies share apple `1780827171`). Not diagnostic.
- Duration mismatch (435s file vs 401.97s Apple) is just the Apple match being a shorter edit; the
  catalogue embedding was built from the *same* in-house 435s file, so it doesn't explain the gap.

**Quantified prediction (norm hypothesis):** if `final = 0.7·N·cos_maest + 0.3·discogs` and the Discogs
term is ~equal on both paths (fresh Discogs is normalized + cosine), then the whole gap sits in the
MAEST term: `0.7·cos_maest·(N_search − N_upload) ≈ 0.20`. With cos_maest ~0.9 and N_search ≈ 1.0 (stored
vectors normalized), this predicts **N_upload ≈ 0.68** — i.e. the fresh upload MAEST vector is
under-normalized (norm ~0.68 vs ~1.0 stored). The raw-vector dump (`‖fresh‖`, `‖stored‖`, cosine) will
confirm this exact number.

---

## Track 2 — "Shango" (Addison Groove)

DB: uuid `56871751…`, apple `1207782004` / isrc `FR10S1780876`, dur 278s.

| Path | queried self | top-1 | top-20 | band width |
|------|-------------|-------|--------|-----------|
| **Search** | 1.0 | **0.9118** | 0.8913 | ~0.020 |
| **Upload** | 1.0 | **0.6656** | 0.6553 | ~0.010 |

**Gap ≈ 0.245**, again uniform + narrow bands. **This one is the clincher:** the two result *sets*
overlap heavily — at least **8 of the top-20 are the same tracks**, just rescaled and mildly reordered:

| Track | Search score / rank | Upload score / rank |
|-------|--------------------|--------------------|
| Moonlight (Alfa Mix) | 0.9118 / #1 | 0.6651 / #2 |
| Silence Has Come | 0.8915 / #17 | 0.6632 / #3 |
| Mei D Bonc | 0.8995 / #6 | 0.6607 / #5 |
| Simba (Will Alonso Remix) | 0.9087 / #3 | 0.6596 / #6 |
| Can You Relate | 0.8919 / #14 | 0.6580 / #9 |
| Lost Generation | 0.9116 / #2 | 0.6578 / #10 |
| Woodstep (Solomun) | 0.8994 / #7 | 0.6575 / #11 |
| Lutho (Eltonnick Remix) | 0.8927 / #12 | 0.6557 / #16 |

Same neighbours retrieved ⇒ the MAEST **direction is essentially the same**. Scores uniformly ~0.245
lower ⇒ the MAEST **magnitude** is scaled down. The mild reordering is expected: the 0.3·Discogs term is
NOT scaled, so shrinking the 0.7·MAEST term rebalances the two, reshuffling ranks inside the ultra-narrow
(~0.02) band. Both result sets are genre-appropriate (tribal/afro-house).

**Estimating the norm** from the shared "Moonlight" neighbour: search `= 0.7·cos_m + 0.3·d = 0.9118`,
upload `= 0.7·N_u·cos_m + 0.3·d = 0.6651` ⇒ `0.7·cos_m·(1−N_u) = 0.247` ⇒ **N_u ≈ 0.63–0.64**. Consistent
with Track 1's predicted ~0.68. The gap being *larger* for Track 2 (0.245) than Track 1 (0.195) also fits:
gap `= 0.7·cos_m·(1−N_u)` scales with cos_m, and Track 2's neighbours are more similar (higher cos_m).

**Note:** MAEST-full is a mean-pool over patch embeddings; a mean of near-unit vectors has norm ~0.6–0.7.
So `N_u ≈ 0.65` is exactly what you'd get if the GPU returns the **mean-pooled MAEST WITHOUT a final
L2-renormalization**, while the catalogue `.npy` were indexed **with** it (norm 1).

---

## Track 3 — "The Dumb Bedevilment" (Markus Masuhr) — deep techno

DB: uuid `bd51fccd…`, apple `1132856607` / isrc `CA5KR1526736`, dur 488s.

| Path | queried self | top-1 | top-20 | band width |
|------|-------------|-------|--------|-----------|
| **Search** | 1.0 | **0.8989** | 0.8675 | ~0.031 |
| **Upload** | 1.0 | **0.6617** | 0.6479 | ~0.014 |

**Gap ≈ 0.237**, same signature. ~9 shared neighbours across the two top-20s (The Rough Climb of His,
The Abnormality of Suggestion, Snvmi, Hiatus, White River, Varanasi, Arp 1, Skansbukta, Easy Go Easy
Death). Both genre-appropriate (deep/hypnotic techno).

**NEW & important — ranking quality degrades on upload, not just the numbers.** The query's own
**album-mates** (Markus Masuhr / "The Silent Trepidation": *The Rough Climb of His*, *The Abnormality of
Suggestion*) — which are the genuinely-most-similar tracks — rank **#1 and #3 in search** but fall to
**#9 and #14 in upload**. This is a direct consequence of the norm bug: shrinking the 0.7·MAEST term (via
the small query norm) under-weights the component that actually recognises the album siblings, so the
0.3·Discogs term dominates and the best matches sink. **⇒ Fixing the MAEST normalization will both raise
the scores AND restore ranking quality (album-mates back to the top).**

N_u from the shared "The Rough Climb of His": `0.7·cos_m·(1−N_u) = 0.8989 − 0.6537 = 0.245` ⇒ **N_u ≈
0.63–0.65**. Third independent estimate landing in the same 0.63–0.68 window.

---

## Track 4 — "Solina (Daniel Jaeger Remix)" (Dave Dinger & Avocado) — ⭐ THE DECISIVE ONE

DB: uuid `b852ca65…`, apple `1646206536` / isrc `DESH42100185`.
*(Note: the pasted blocks were label-swapped — the block titled "Upload" is `type:internal` = the SEARCH
result; the block titled "Search" is `type:upload` = the UPLOAD result. Analyzed correctly below.)*

| Path | top-1 | top-20 | band width |
|------|-------|--------|-----------|
| **Search** (catalogue "Solina" remix) | 0.9378 | 0.9230 | ~0.015 |
| **Upload** (uploaded remix audio) | **0.7250** | 0.6793 | ~0.046 |

**Why this track is decisive:** an upload has **no Apple metadata**, so the apple_song_id/ISRC de-dup
**can't strip the uploaded track's own catalogue twin**. Result: the upload found **its exact same
track** — `b852ca65`, "Solina …[Daniel Jaeger Remix]" — at **rank 1, score 0.7250**. This is a direct
**self-similarity of the same audio through the two pipelines.** (In Tracks 1–3 the twin was always
de-duped away, hiding this.)

**Direct measurement of the MAEST norm.** For a self-match the directions align, so `cos_maest ≈ 1` and
`cos_discogs ≈ 1`, leaving `final = 0.7·N_u·1 + 0.3·1 = 0.7·N_u + 0.3`. Solving `0.7250 = 0.7·N_u + 0.3`
gives **N_u ≈ 0.607** — a direct, assumption-light measurement, right in line with the 0.63–0.68 inferred
from Tracks 1–3.

**This proves it's magnitude, not direction.** The twin is found at **rank 1** and the self `cos ≈ 1`, so
the fresh MAEST vector points the **same way** as the stored one — it's just **~0.6× the length**. If the
query were normalized (N_u→1) the self-match would be `0.7·1 + 0.3 = 1.0`. The remix's other sibling
"Solina (feat. Moody Kablawi)" also appears in both: search **0.9293** vs upload **0.6840** (Δ 0.245),
consistent. Note too that at N_u≈0.6 the true self-match (0.725) barely clears the neighbour floor
(0.685) — **the bug also destroys separation between the real match and noise.**

---

## Track 5 — "Cuba Libre (Frederick Alonso Remix)" (Ben Weber) — deep house

DB: uuid `bdf504b8…`, apple `616477359` / isrc `DEBL60697056`.

| Path | top-1 | top-20 | band width |
|------|-------|--------|-----------|
| **Search** | 0.9227 | 0.9001 | ~0.023 |
| **Upload** | 0.6709 | 0.6594 | ~0.011 |

**Gap ≈ 0.252**, same signature; ~9 shared neighbours (Back to the Deep, Little Helper 75-5, Magic,
Samba Baby, Nobody in Sight, Art Official Intelligence, No Drama, The Night Back, Wax Machine). Both deep
house. Shared "Little Helper 75-5": search 0.9195 vs upload 0.6709 ⇒ N_u ≈ 0.63.

---

# ⛔ CORRECTION (post-deploy diagnostics) — the real cause is DISCOGS, not MAEST

The "MAEST norm" conclusion below was **wrong**. A direct vector diagnostic (fresh embedding vs the
stored twin `.npy`, same audio) showed:

```
fresh maest   norm = 1.00000
cos(fresh,stored) MAEST   = 0.9982     ← MAEST is essentially perfect (already unit + right direction)
cos(fresh,stored) DISCOGS = 0.0875     ← DISCOGS is nearly ORTHOGONAL
E4 self-score (unit query) = 0.7250    = 0.7·(1·0.998) + 0.3·0.0875   (exact)
```

The whole deficit is the **Discogs** term (0.026 instead of ~0.30). Root cause, proven:

```
cos( /get_all_embeddings.discogs , stored )      = 0.0875   ← uploads read this (WRONG)
cos( /get_embeddings(discogs_effnet) , stored )  = 1.0      ← catalogue built with this (RIGHT)
cos( all.discogs , single.discogs )              = 0.0875   ← the two GPU endpoints disagree
```

**The catalogue Discogs index is `/get_embeddings?model_name=discogs_effnet`, but uploads pulled Discogs
from `/get_all_embeddings`, whose discogs output regressed to a different (orthogonal) vector.** MAEST
from `/get_all_embeddings` is fine (cos 0.998). Why the earlier math misled me: I assumed the self-match
Discogs cos ≈ 1 (it's 0.09), so the 0.725 self-score looked like a MAEST-norm 0.61 — it wasn't.

**Fix (media server `resomix-similarity-open` → `embedding_service.generate_dual_embeddings`, no GPU
edit):** stop using `/get_all_embeddings` entirely; fetch each vector from the endpoint the catalogue
was built with — **MAEST from `/get_maest`** (full-track; same `generate_full_track_embedding`, cos ≈
0.998) and **Discogs from `/get_embeddings?model_name=discogs_effnet`** (cos ≈ 1.0). Two lean calls, no
wasted computation, no client-side normalize (both endpoints return pooled+normalized bytes; the earlier
MAEST `normalize_L2` was reverted — MAEST was never the issue). Verified: `DISCOGS cos 0.0875 → 1.0`,
`E4 self-score 0.725 → 0.999`. Real root cause is the GPU's `/get_all_embeddings.discogs` regression (fix
there if that endpoint is ever needed again). Everything from here down is the original (wrong) MAEST
theory, kept for the audit trail.

---

# ✅ FINAL FINDINGS — confirmed on 5 / 5 tracks

## The numbers

| Track | Search top | Upload top | Gap | N_u (fresh MAEST norm) |
|-------|-----------|-----------|-----|------------------------|
| 1 Badder Than Bad | 0.850 | 0.654 | 0.195 | ~0.68 |
| 2 Shango | 0.912 | 0.666 | 0.245 | ~0.63 |
| 3 The Dumb Bedevilment | 0.899 | 0.662 | 0.237 | ~0.64 |
| 4 Solina (Daniel Jaeger Rmx) | 0.938 | **0.725 (self-match!)** | — | **0.607 (measured directly)** |
| 5 Cuba Libre | 0.923 | 0.671 | 0.252 | ~0.63 |

Every track: **upload returns the same-genre, heavily-overlapping neighbours as search, uniformly shifted
down by ~0.2–0.25, in an ultra-narrow band.** Not one track returned off-genre/garbled results.

## Root cause (definitive)

**The freshly-computed MAEST vector is the right *direction* but ~0.61× the *length* it should be.** The
E4 score is `0.7·MAEST + 0.3·Discogs`, where the MAEST term is a **FAISS inner product** =
`‖maest_query‖ · cos`, and the MAEST index holds **L2-normalized** vectors. The catalogue's stored MAEST
`.npy` are ~unit-norm, but the live GPU/upload path emits the **mean-pooled MAEST without a final
L2-normalize** (norm ≈ 0.61 — exactly what an un-renormalized mean of near-unit patch vectors gives). So:

- **Search** (stored, normalized query) → MAEST term = `1·cos` → correct scores (0.85–0.94).
- **Upload** (fresh, norm-0.61 query) → MAEST term = `0.61·cos` → every score dragged down ~0.2–0.25,
  and the 0.3·Discogs term (un-scaled) takes over the ranking, demoting genuinely-similar tracks
  (e.g. Track 3's album-mates fell #1/#3 → #9/#14).

Track 4 is the clincher: an upload with no Apple metadata found **its own catalogue twin at rank 1 =
0.725**, and `0.725 = 0.7·N_u + 0.3 ⇒ N_u = 0.607`. Same audio, correct direction, only the magnitude is
wrong. This is **a normalization regression, NOT embedding drift → no re-index required.**

**Likely origin:** the GPU embedding/analysis split (`maest-discogs-ccreplica` commit `9b6fa7a`) — the
embedding endpoint's doc still claims "pooled, **normalized**", so the final L2-normalize on MAEST-full
was most likely dropped/bypassed there. (Confirm by diffing `generate_full_track_embedding` before/after
the split.)

## The fix

L2-normalize the MAEST vector so the query matches the normalized index — in the **media server**
(`resomix-similarity-open`), which already does exactly this for Discogs. Two complementary places:

1. **Primary (fixes uploads + persists a correct `.npy`)** — in
   `app/services/embedding_service.py` → `generate_dual_embeddings`, add the same `faiss.normalize_L2`
   that Discogs already gets, right after decoding MAEST:
   ```python
   maest_full = maest_full.reshape(1, -1)
   faiss.normalize_L2(maest_full)      # ← ADD: MAEST index is IP over unit vectors; the query must be unit too
   ```
   (Do it BEFORE `query_by_upload_full` saves the vector, so the stored upload `.npy` is also unit-norm.)

2. **Defensive (guarantees both paths + matches the contract)** — normalize the MAEST query inside the
   search, since `faiss_repository.search_similar` is already documented as "L2-normalised input". In
   `app/helpers/e4_helper.py` before `faiss_repository.search_similar(maest_vec, …)`, or at the top of
   `search_similar`, normalize a **copy** (don't mutate a caller's saved array).

**Why this is safe / no re-index:** normalizing an already-unit vector is a no-op, so the search path
(stored vectors, currently correct) is unchanged; only the under-normalized fresh query is corrected. The
catalogue index stays as-is.

**Expected result after fix:** upload self-match → ~1.0; upload neighbour scores rise to equal the search
scores (0.85–0.94); ranking quality restored (album-mates/true matches back near the top).

### ⚠️ Fix gotcha (found during deploy) — normalize a WRITABLE copy

The first attempt (`faiss.normalize_L2(maest_full)` directly) was a **silent no-op**: the upload
self-twin stayed at `0.72500656` byte-for-byte after deploy. Reason: `maest_full = np.frombuffer(…)`
returns a **read-only** array (a view over the immutable response bytes), and `faiss.normalize_L2`
writes **in place** — so on a read-only array it does nothing (no error). This also explains why Discogs
"looked normalized" for years: E4 scores Discogs with `cosine_similarity` (scale-invariant), so its norm
never mattered; MAEST is an inner product against the unit index, so its norm is everything. **Fix:**
`.copy()` to a writable array first — `maest_full = maest_full.reshape(1, -1).copy(); normalize_L2(…)`.

Confirmed the search-side is unit: the stored catalogue `.npy` are **exactly `norm = 1.00000`** (MAEST
768-d and Discogs 1280-d, all 4 sampled tracks) → so a unit upload query gives **exact parity** with
search, and the search path is left untouched.

## Verify before shipping (recommended)

For one of the Track source files, POST to the GPU `/get_all_embeddings`, decode `maest_full`, and print
`np.linalg.norm(maest_full)`. Expect **≈ 0.6** (confirms the bug). Also compare `cosine(fresh_maest,
stored_.npy)` → expect **≈ 1.0** (confirms direction is fine). Then apply the `normalize_L2`, re-run a
Track 4-style upload, and confirm the self-twin now scores ~1.0.

# Library, gating and discovery — plan

**Date:** 2026-08-13
**Scope:** `basic_fastapi_server_resomix` + `resomix-web` (webapp)
**Status:** For review. Seven items, investigated against live code. Decisions needed at the end.

Everything below was read out of the codebase, not recalled. File and line references are given so
each claim can be checked.

---

## Item 1 — Library shows the 5 **oldest** playlists, not the newest

### What happens today

`playlists.is_library_visible` is a **stored column, written once at creation** and never revisited:

```python
# app/repositories/playlist_repository.py:66
async def _resolve_library_visibility(self, db, *, user_id, cap) -> bool:
    ...
    return await self.count_library_visible(db, user_id) < cap
```

It is called from the create path ([`:237`](../app/repositories/playlist_repository.py)) and the
result is persisted ([`:250`](../app/repositories/playlist_repository.py)). The listing query then
filters on it:

```python
# app/repositories/playlist_repository.py:1997
conditions.append(Playlist.is_library_visible.is_(True))
```

So the first five playlists a free user creates are stamped `True` **forever**, and every later one
is stamped `False` **forever**. Creating a sixth does not demote the first. The Library therefore
shows the five *oldest*, which is the opposite of what anyone expects.

The comment at `:1994` describes the intent correctly — *"beyond the plan's cap a playlist is created
hidden… it is only absent from this listing"* — the flaw is that "which five" was decided at write
time.

### What it should be

Visibility is **derived at read time**: the N most recent by `created_at` are visible; everything
else is not. Create a sixth and the first drops out on the next read, with no write anywhere.

**`is_visible` controls the IDENTIFIERS, not the list.** This is the part to get right, and it is
easy to misread. The listing endpoint always returns **every** playlist the user owns. Visibility
decides only whether that row carries `id`, `uuid` and `seed_track_uuid`. Filtering, search, sorting
and pagination all continue to operate across the **full** set — a free user's filters must behave
exactly like a Pro user's. The frontend then renders rows with ids as active and rows without as
greyed.

**Favourites get no exemption** — a favourited playlist outside the recent 5 is greyed like any
other. Favouriting is a flag the user controls, so exempting it would let anyone opt out of the cap.

### How to build it

**Backend.**

1. Replace the stored filter with a derived rank. In the listing query, compute
   `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC)` over the user's non-deleted
   playlists, and mark `is_visible = rank <= cap`. Cap `< 0` (unlimited) marks everything visible.
2. **Stop filtering the list.** Return *all* the user's playlists, each carrying `is_visible`.
3. **Gatekeep the identifiers** on rows where `is_visible = false`: omit `id`, `uuid` and
   `seed_track_uuid`. Their absence is what makes the row un-openable — the client cannot construct
   a route to something it has no id for, so this is enforcement, not decoration.
4. `count_library_visible` (`:82`) currently powers both the creation decision **and** the usage
   chip on `/entitlements/me`. Once visibility is derived, it becomes `min(count_owned, cap)`. The
   docstring at `:84` warns that these two must never disagree — that warning still applies.

**Uploads tab.** `TrackService._serialize_track_summary` returns `playlist_uuid`
([`app/services/track_service.py:87`](../app/services/track_service.py)), and the comment at `:59`
is explicit that *"`playlist_uuid` / `analysis_uuid` themselves signal existence"*. So withholding
`playlist_uuid` for a track whose playlist is not visible automatically greys the Sonic Discovery
capsule — no new flag needed. It does mean the client can no longer distinguish "no playlist" from
"playlist you cannot open", so a sibling boolean (`playlist_locked`) is needed to pick the right
message.

**Frontend.**

- Render locked rows greyed but fully interactive.
- Any action on a locked row opens an upgrade modal rather than navigating.
- Same treatment for the Sonic Discovery capsule in the Uploads tab, with a message that names the
  reason: *"This playlist is outside your most recent 5."*

**Analysis is deliberately not gated** — it is already limited by showing only the summary to free
users.

### Risk

The one that matters: **the identifiers currently leak the whole library**. Anyone on free who has
ever had 6+ playlists has uuids for all of them in past API responses. Removing the uuid closes the
door going forward but does not retract what was already sent. Acceptable — nothing sensitive is
behind it — but worth knowing it is not a retroactive fix.

---

## Item 2 — Pagination is not in the URL

### What happens today

The **tab** is already synced to the URL ([`LibraryPage.tsx:205-216`](../../resomix-web/apps/webapp/src/pages/LibraryPage.tsx)):

```tsx
const tabParam = searchParams.get("tab");
```

The **page** is not. It lives in the Zustand store
([`packages/stores/src/useLibrary.ts:88,100`](../../resomix-web/packages/stores/src/useLibrary.ts)):

```ts
playlistsPage: number;
tracksPage: number;
```

Consequences: opening a playlist from page 3 and pressing Back returns you to page 1, and a link to
page 3 cannot be shared.

### How to build it

1. Make `useSearchParams` the single source of truth for both `tab` and `page`; the store keeps the
   value but is written *from* the URL, never independently.
2. Page changes use `setSearchParams` (push, not replace) so Back steps through pages.
3. Switching tabs resets `page` to 1 — the two tabs have different page counts, and carrying page 7
   into a two-page tab yields an empty screen.
4. Clamp on read: `?page=999` should land on the last page, not an empty list.
5. Scroll to top on page change — `window.scrollTo({ top: 0 })`, but **only when the page actually
   changed**, otherwise it fights the user on every re-render.

Result: `https://beta.resomix.com/library?tab=playlists&page=2`.

---

## Item 3 — Search-mode change closes the dropdown; no clear button

### What happens today

```tsx
// apps/webapp/src/components/upload/SearchComponent.tsx:45
const handleSearchModeChange = (e) => setSearchMode(e.target.value as ...);
```

Changing the mode updates the store, which re-runs `performSearch`
([`useWorkspaceSearch.ts:34`](../../resomix-web/apps/webapp/src/hooks/useWorkspaceSearch.ts)). The
results list is driven by `results.length`, so it empties and the panel collapses while the new
request is in flight — the dropdown appears to close.

There is no clear (`×`) control in the input.

### How to build it

1. **Separate "open" from "has results".** Introduce explicit `isOpen` state. Today the panel's
   visibility is implied by the results array, which is why an in-flight request closes it.
2. On a mode change, keep the panel open and render **"Searching…"** in place of the rows rather
   than emptying them.
3. **Close only when the input is cleared** — not on outside click. This is a deliberate departure
   from the usual dropdown convention, so it needs the Escape key as an escape hatch or the panel
   becomes a trap for keyboard users.
4. **Clear button:** a `×` inside the input's right edge. Needs `padding-right` on the input so the
   text never runs under it, a hover state, a tooltip ("Clear search"), `aria-label`, and a
   touch target of at least 44×44 on mobile — the visual glyph can stay small.
5. Clearing empties the query, closes the panel, and returns focus to the input.

---

## Item 4 — Elasticsearch always returns 100

### What happens today

```python
# app/services/search_service.py:76
limit = settings.es_search_limit
```

`ES_SEARCH_LIMIT=100` in `.env`, `.env.prod` and `.env.staging`. Every caller gets 100 regardless of
plan.

### The blocker

**The search route has no user.** It depends only on the partner:

```python
# app/api/routers/search.py:64
partner: Partner = Depends(get_public_partner)
```

So the endpoint cannot resolve a plan today. Making it plan-aware requires adding
`get_current_user_optional` and resolving the effective plan per request.

### How to build it

1. Add `current_user: User | None = Depends(get_current_user_optional)` to the route.
2. Resolve the cap from entitlements rather than hard-coding: a new feature key,
   `search_results_max`, sitting alongside the existing keys in `app/core/entitlement_keys.py`.
   Free → 30, Pro → 100. **Not** an `if plan == "pro"` branch — every other limit in this system is
   an entitlement, and a hard-coded one would be the only place a plan change does not take effect.
3. `ES_SEARCH_LIMIT` becomes the **ceiling**, not the value: `min(entitlement, settings.es_search_limit)`.
   Nothing can exceed the operational cap by editing a plan row.
4. Guests resolve to the guest plan, which already exists in the entitlement chain.

### Risk

`get_current_user_optional` raises on a **deactivated** account (`assert_active`). Search is
currently reachable without auth; adding the dependency means a deactivated user with a stale token
starts getting 403 from search where they previously got results. That is arguably correct, but it
is a behaviour change on a public endpoint and should be deliberate.

---

## Item 5 — Similarity shown as a percentage

### What happens today

```tsx
// apps/webapp/src/sections/desktop/Playlist/PlaylistTable.tsx:183
const bandPct = Math.max(0, Math.min(100, (track.score ?? 0) * 100));
const scorePctLabel = `${(track.score * 100).toFixed(2)}%`;
```

Rendered as a rail plus the number. The page already carries a hint that gives the game away
([`:517`](../../resomix-web/apps/webapp/src/sections/desktop/Playlist/PlaylistTable.tsx)):

> *"Score bars show the match outright; scores sit in a tight band by design"*

That is the real problem, and it is the same one off-beat.io writes about openly: raw cosine
similarities cluster tightly, so **64.1% and 62.9% are not meaningfully different**, but two decimal
places invite the user to believe they are. Publishing a precise number we cannot defend is also a
claims risk under the same rule that governs performance figures.

### Options

| | Approach | Reads as | Cost |
|---|---|---|---|
| **A** | **Named bands** — *Very close · Close · Related · Loose* | Honest about resolution; no false precision | Small — the rail stays, the label changes |
| **B** | **Rank only** — "#1 closest", "#2", … | Ordinal, which is what the engine is actually good at | Small |
| **C** | **Relative bar, no number** — longest bar = closest *in this result set* | Comparative, never absolute | Small |
| **D** | **Star / dot rating** — 5 dots, filled by band | Familiar, coarse by design | Small |

~~**Recommendation: A + C.**~~ Superseded by the research below.

---

## Item 5 — research findings (2026-08-14)

Tasks 73–74. Measured against the dev database and checked against how comparable services present
the same kind of score. **Awaiting a decision before anything is built.**

### The measurement

All 4,420 scored rows in `playlist_tracks`:

| | |
|---|---|
| Range | 46.2% – 94.7% — **nothing below 46% ever appears** |
| Mean / SD | 71.4% / 6.9 points |
| Inside 60–85% | **91% of all scores** |
| Above 90% | 5 rows (0.1%) |

Two findings decide this item.

**1. The bottom half of the scale is dead.** No result is ever below 46%, so the number is
systematically misread: a user sees "62%" and reads *barely similar*, when 62% is an entirely
ordinary result. The scale the user brings to a percentage does not match the scale the score
actually occupies.

**2. Two decimals are ~63× finer than the real signal.** The mean gap between adjacent ranks is
**0.63 points**, and **2,531 of 4,250 adjacent pairs (60%) differ by less than half a point**. A
real playlist, top of the list:

| Rank | Today | Gap to next |
|---|---|---|
| 1 | 80.93% | 5.16 |
| 2 | 75.77% | **0.09** |
| 3 | 75.69% | 1.97 |
| 4 | 73.71% | **0.11** |
| 5 | 73.60% | 0.78 |

The ordering of ranks 2 and 3 is noise. Two decimals present it as a fact.

**But the ordering itself is real.** Average top-to-bottom spread within one playlist is **15.7
points** (min 7.7, max 31.7). The information is in the *sequence*, not in the digits — which is
exactly what the presentation should carry.

### What the field says

The clustering is a property of high-dimensional embeddings, not a flaw in our model — in high
dimensions random vectors are near-orthogonal, so scores concentrate in a narrow band. The guidance
is direct: *"Cosine similarity scores are not probabilities. They are not percentages"*, and a score
of 0.80 does not mean 80% similar. The recommendation is to present **relative ranking and
position** rather than an absolute figure.
([Mixpeek — Embedding Space Geometry](https://mixpeek.com/guides/embedding-space-geometry))

Our closest commercial comparator, **Cyanite**, does show percentages. Worth knowing, and not
decisive: it is a B2B API surface where the number is machine-readable, rather than a claim made to
a DJ choosing a record.

### Options, re-scored against the data

| | Approach | Rank 2 vs 3 (0.09 pts apart) becomes | Verdict |
|---|---|---|---|
| **A** | Named bands — *Very close · Close · Related · Loose* | Both "Close" — the false distinction disappears | ✅ |
| **B** | Rank only — "#2", "#3" | Ordinal, no implied magnitude | ✅ |
| **C** | Relative bar, normalised to the result set | — | ❌ **already tried and reverted** |
| **D** | Dots — ●●●○○ | Coarse by design | viable |

**Option C is struck out on evidence, not taste.** `PlaylistTable.tsx:182` records that it was
built and reverted: *"Absolute fill: 0.8 → 80% of the rail. **NOT** normalised against the
shortlist's own min/max, which is what the old band width did — that made the top row look like
100%."* The original A + C recommendation was, in part, a proposal to redo something already
rejected.

### Recommendation: A + B

Keep the bar exactly as it is (absolute fill), replace the percentage with a band name, and let the
existing rank column carry the ordering. No backend change — `score` keeps flowing, the client stops
printing it.

Band cuts, tested against the real distribution so that no band is empty and the top one stays
scarce enough to mean something:

| Band | Cut | Share of real results |
|---|---|---|
| Very close | ≥ 82% | 3.2% |
| Close | 75–82% | 31.2% |
| Related | 65–75% | 44.9% |
| Loose | < 65% | 20.7% |

**Also fixed by this:** the tooltip at `:517` currently *apologises* for the tight band — *"scores
sit in a tight band by design"* — and can say something useful instead. And a two-decimal figure we
cannot defend carries the same claims risk as a published performance number.

### Open — needed before tasks 75–77

1. **Which option?** A + B, or another.
2. **Band names.** *Very close / Close / Related / Loose*, or George's wording — these are
   user-facing.
3. **Band cuts.** The four above, or shifted.

---

## Item 6 — "Liked tracks" tab

### What exists today

The table is there and already carries everything needed
([`app/models/rating.py:22`](../app/models/rating.py)):

```python
__tablename__ = "track_ratings"
user_id, track_id, playlist_id, rating (0/1), rated_at
```

Write, read-one, delete and stats endpoints all exist in `app/api/routers/ratings.py`. **What does
not exist is a "list my liked tracks" endpoint** — every route is keyed by a specific track or
playlist.

### How to build it

**Backend — one new endpoint.** `GET /ratings/tracks/mine` (paginated), returning tracks where
`user_id = me AND rating = 1`, newest first. Enrich with Apple metadata and artwork using the same
`async_get_track_display_meta_map` path the Library already uses, so the rows look identical to the
Uploads tab.

**Frontend — a third tab.**

- Reuses the existing tab and pagination machinery from Item 2 (`?tab=liked&page=2`).
- **No delete, no analysis** — one action only: *View chain discovery*.
- Empty state that explains how tracks get here, since a new user's tab is blank by default.

### Open questions

- A liked track may belong to a playlist that is **not visible** for a free user. Does *View chain
  discovery* gate the same way as Item 1, or is liking a track enough to keep access?
- Un-liking from the player currently removes the row. Should the tab offer un-like, given the
  "no delete" rule? Removing a like *is* the delete for this tab.

---

## Item 7 — Wrong message while an analysis is still running

### What happens today

The pending state is a **client-side guess based on age**:

```tsx
// apps/webapp/src/components/TrackArtifactChips.tsx:8-15
const RECENT_WINDOW_MS = 15 * 60 * 1000;
export const isTrackRecent = (t) => Date.now() - new Date(t.created_at).getTime() < RECENT_WINDOW_MS;
```

Three states follow from it ([`:181-195`](../../resomix-web/apps/webapp/src/components/TrackArtifactChips.tsx)):

- `analysis_uuid` present → **ready**
- absent **and** recent → **"Analyzing…"** with a spinner
- absent and **not** recent → **"Analyze"**, muted, `title="Analysis coming soon"`, and clicking
  fires `onComingSoon` → *"Analysis is coming soon!"*

So an analysis that takes longer than 15 minutes silently becomes *"coming soon"* — a message about
an unbuilt feature, shown for a feature that is running right now. That is the bug reported.

A poll already exists and is correctly self-terminating
([`LibraryPage.tsx:239-244`](../../resomix-web/apps/webapp/src/pages/LibraryPage.tsx)) — but it is
gated on the same 15-minute guess, so it stops polling exactly when the slow case needs it most.

### The underlying gap

> **Corrected 2026-08-14, during implementation.** This section originally named
> `track_processing_status` as the state to serialise. That was wrong, and the correction changed
> the shape of the work — recorded here rather than quietly fixed, because the wrong version is
> plausible enough that someone would land on it again.

`track_processing_status` looks like the answer and is not. It is the **partner SFTP ingestion**
state machine (transcode → embedding → peaks → segments → FAISS), constructed in exactly two
places, both inside the partner batch flow: `ingestion_persist.py:129` and
`ingestion_service.py:1038`. **A consumer upload never gets a row in it.** Measured on the dev
database:

```
uploads total                                20
uploads with a track_processing_status row    0
track_processing_status rows total          304   ← all partner tracks
```

The real gap is that **no table recorded a consumer upload's artifact state at all**. The analysis
writes a `track_analysis_results` row only on success, so its absence means queued *or* running
*or* produced-nothing *or* failed — the four states the client needed to tell apart, collapsed into
one absence. Same for the playlist.

The one precedent is `track_analysis_results.sibling_playlist_state`, which solved this in one
direction only (the analysis-upload path recording what happened to *its* playlist sibling), and
its own comment states the argument exactly:

> *"The client cannot infer this from `playlist_uuid` alone: a missing uuid means 'still running',
> 'failed' or 'ran but produced nothing' — three states that need different UI."*

It could not be extended to cover this, because a `track_analysis_results` row cannot exist before
an analysis id is minted, and the Library needs a state from the moment the upload is accepted.

### How it was built

**Backend.** A new table, `track_artifact_status` — one row per consumer upload, seeded in the same
transaction as the track (so an upload that commits is never missing one), carrying both siblings'
state: `pending` / `processing` / `ready` / `unavailable` / `failed`, each with an optional display
error.

`unavailable` is a real outcome, not a synonym for failure: an upload with no near neighbours in
the catalogue produces no playlist and nothing went wrong. Different copy, hence a different state.

Serialised into `my-tracks` as an `artifacts` block, batch-resolved — one query per page, verified
at +1 against the live dev database.

**Scope note.** The item as written covered the Analysis capsule. `isTrackRecent` drove **both**
capsules, so fixing only one would have left the Sonic Discovery capsule silently vanishing after
15 minutes — a failed playlist looking identical to one that was never attempted. Both are covered.

**Frontend.**

1. The capsule reads the real state; `isTrackRecent` and the 15-minute window are gone.
2. `pending`/`processing` → spinner, and the poll runs for as long as it genuinely takes.
3. `failed`/`unavailable` → a muted capsule that says what happened when clicked.
4. Poll every **5s**, terminating on the real state.
5. `onComingSoon` survives only for `unknown` — a track with no pipeline at all.

**Poll ceiling: 10 minutes.** A worker that dies without writing a terminal state would leave the
row on `pending` forever, and a poll keyed purely on that would never stop. After the ceiling the
page says *"taking longer than usual — we've stopped checking, use Refresh"*, and Refresh restores
the budget.

---

# Phases

Ordered so each phase ships independently and nothing depends on a later one.

### Phase 1 — Analysis status (Item 7)

Smallest, highest daily annoyance, and entirely self-contained.

- Backend: `analysis_status` in `my-tracks`, batch-resolved
- Frontend: capsule driven by real status; correct copy; 5s poll with a ceiling
- Tests: status mapping per stage combination; poll terminates on ready and on failed; a 20-row
  page costs one extra query, not twenty

### Phase 2 — URL pagination + scroll (Item 2)

No backend. Unblocks Item 6's tab.

- URL as source of truth for `tab` + `page`; push-not-replace; clamp; reset on tab switch
- Scroll to top only on real page change
- Tests: deep link lands on the right page; Back returns to the previous page; `?page=999` clamps

### Phase 3 — Search UX (Item 3)

No backend.

- Explicit `isOpen`; "Searching…" on mode change; close only on clear or Escape
- Clear button with padding, hover, tooltip, aria-label, 44×44 touch target
- Tests: mode change keeps the panel open; clear closes it and refocuses

### Phase 4 — Search result cap (Item 4)

Small backend change, but it touches a public endpoint.

- `search_results_max` entitlement; `get_current_user_optional` on the route; `min(entitlement, ES_SEARCH_LIMIT)`
- Tests: free 30 / pro 100 / guest 30; a plan claiming 500 is still capped at the operational limit

### Phase 5 — Library visibility (Item 1)

The biggest, and the one with real regression risk — it changes what every free user sees.

- Backend: derived rank, return all rows, withhold `id`/`uuid`/`seed_track_uuid`, add
  `playlist_locked` to the track summary
- Frontend: greyed rows, upgrade modal, Uploads-tab capsule gating
- Tests: the 6th playlist hides the 1st; unlimited plans mark everything visible; locked rows carry
  no uuid; the usage chip and the visible count agree

### Phase 6 — Liked tracks tab (Item 6)

Depends on Phase 2's pagination and Phase 5's gating decision.

- Backend: `GET /ratings/tracks/mine`, paginated, Apple-enriched
- Frontend: third tab, single action, empty state
- Tests: only `rating = 1` rows; newest first; pagination; a scrubbed/deleted track does not break
  the page

### Phase 7 — Score presentation (Item 5)

Deliberately last: it is a product decision, and shipping it early would mean redoing it if the
answer changes.

- Bands + bar, no number; update the tooltip
- Tests: band boundaries; no percentage string reaches the DOM

---

---

# Task checklist

The full build, as tickable items. **This is the authoritative list** — the analysis above explains
*why*, this says *what*. If a task is not here it is not being built; add it here first.

76 tasks, 7 phases. Ordered so no phase depends on a later one.

## Phase 1 — Analysis status *(Item 7)*

Smallest, highest daily annoyance, entirely self-contained.

✅ **Done 2026-08-14.** Scope grew during the build: the source table named below did not exist for
consumer uploads (see the corrected Item 7), and the 15-minute guess drove **both** capsules, not
just Analysis. Tasks 1a/2a and 9a–9c were added rather than done silently.

**Backend**
- [x] 1. Add an `artifacts` block to the track summary — `pending` / `processing` / `ready` / `unavailable` / `failed`, plus the display error
- [x] 1a. **New:** create `track_artifact_status` + migration. `track_processing_status` is the partner-ingestion pipeline; consumer uploads have no row in it (0 of 20 on dev)
- [x] 2. Batch-resolve it — one query per page, never one per row. Verified at +1 against the live dev DB
- [x] 2a. **New:** backfill every existing upload from what actually exists (`ready` / `unavailable`, never `pending`) — 20 rows, 0 mismatches
- [x] 3. Expose it on both `my-tracks` list and detail
- [x] 3a. **New:** write the state from every terminal path in both upload flows, including the ones that previously returned silently

**Frontend**
- [x] 4. Drive the capsule from the real status; delete the `isTrackRecent` 15-minute guess
- [x] 5. Processing copy on the spinner capsule
- [x] 6. Real failure state, instead of falling through to "coming soon"
- [x] 7. Poll `my-tracks` every **5s** while anything is processing (was: 10s, gated on the guess)
- [x] 8. Poll ceiling 10 min, then a *"taking longer than usual"* notice; Refresh restores the budget
- [x] 9. Keep `onComingSoon` **only** where there genuinely is no analysis pipeline (`unknown`)
- [x] 9a. **New:** same treatment for the Sonic Discovery capsule — it used the same guess and simply vanished after 15 minutes
- [x] 9b. **New:** `unknown` ≠ `pending`, so pre-existing rows never enter a poll nothing will terminate
- [x] 9c. **New:** the uuid outranks the state in both directions (lost write → still openable; `ready` with no uuid → not promised)

**Tests**
- [x] 10. Status mapping across every state, both siblings, both directions of uuid/state disagreement
- [x] 11. Poll terminates on every terminal state — pinned as a backend/frontend contract check so the two literals cannot drift
- [x] 12. A 20-row page costs one extra query, not twenty (and an empty page costs none)
- [x] 12a. **New:** the migration's raw SQL uses `tracks.type`, not the model's `track_type` attribute — the wrong one fails the whole statement
- [x] 12b. **New:** every early return in the analysis task writes a terminal state (30 tests; each verified to fail when its fix is reverted)

## Phase 2 — URL pagination *(Item 2)*

Frontend only. Unblocks Phase 6's tab.

✅ **Done 2026-08-14.** All page state moved into `apps/webapp/src/hooks/useLibraryUrlState.ts`;
the page no longer calls a loader or writes a search param directly (the one exception is the
artifact poll's silent refetch, which deliberately does not navigate).

- [x] 13. URL is the single source of truth for `tab` **and** `page`
- [x] 14. Page changes **push** (not replace), so Back steps through pages
- [x] 15. Switching tabs resets `page` to 1
- [x] 16. Clamp out-of-range: `?page=999` lands on the last page, not an empty list
- [x] 17. Scroll to top **only when the page actually changed** — and not on first paint either
- [x] 18. Applies to both the Playlists and Uploads tabs
- [x] 18a. **New:** filters/clear reset the URL to page 1, with a `reload` flag on `applyFilters` so
      the move and the filter do not both fire a fetch
- [x] 18b. **New:** cap the requested page at 10,000. `page` becomes a SQL `OFFSET` and the endpoint
      validates `ge=1` with **no upper bound**, so `?page=1e9` issued `OFFSET 19999999980`

**Tests** — `pnpm --filter webapp test:pure` (Node's own type stripping; no vitest, no jsdom)
- [x] 19. A deep link lands on the right page — and, crucially, is **not** clamped before the data arrives
- [x] 20. Back returns to the previous page (page changes push; corrections replace, so the clamp cannot trap Back)
- [x] 21. `?page=999` clamps — and the clamp terminates rather than ping-ponging
- [x] 21a. **New:** junk input (`abc`, `0`, `-3`, `1.5`, `1e99`) resolves rather than breaking the list
- [x] 21b. **New:** 18 tests, each verified to fail when its rule is reverted

⚠️ **Left alone, pre-existing:** deleting the last row on the last page leaves you on an empty page.
Not a regression — it behaved this way before — but the page number is now visible in the URL, so
it reads as more of a bug than it used to. Worth a follow-up.

## Phase 3 — Search UX *(Item 3)*

Frontend only.

✅ **Done 2026-08-14.** All in `WorkspaceSearchField.tsx`, which is the only live search field —
desktop and mobile both render it. (`SearchComponent`'s `variant="legacy"` path is dead code: its
only mounts are `UploadPage`/`UploadMobile`, which `App.tsx` never routes.)

> **The plan's diagnosis of this item was wrong.** It said the panel collapsed because the results
> array emptied while the new request was in flight. It does not — `performSearch` leaves the
> previous results in state and the panel renders "Searching…" over them. The actual cause was a
> document-level `pointerdown` listener that closed the panel on any click outside the field, and
> the Search Mode `<select>` is a **sibling** of the field, not a child. Clicking it read as
> clicking away. So tasks 23 and 25 turned out to be the same one-line change.

- [x] 22. Explicit `isOpen` state, separated from `results.length`
- [x] 23. Changing the search mode keeps the panel open
- [x] 24. Render *"Searching…"* rather than emptying the list — `isLoading` outranks a non-empty
      array too, so a mode change cannot show the old mode's matches as if they were current
- [x] 25. Close **only** when the input is cleared — not on outside click
- [x] 26. Escape also closes; with the panel already closed it clears the field instead, and on an
      empty field it is passed through rather than swallowed (or it would break Escape for any
      modal containing this component)
- [x] 27. Clear `×` button inside the input's right edge, shown only when there is something to clear
- [x] 28. `padding-right` on the input so text never runs under the button
- [x] 29. Hover state on the button
- [x] 30. Tooltip — *"Clear search"*
- [x] 31. `aria-label`
- [x] 32. 44×44 touch target (WCAG 2.5.5) — the field is exactly 44px tall, so it costs no layout
- [x] 33. Clearing empties the query, closes the panel, and returns focus to the input
- [x] 33a. **New:** `clearQuery` bumps the request id and empties synchronously — otherwise an
      in-flight search lands afterwards and repopulates a field the user just emptied
- [x] 33b. **New:** `onMouseDown` preventDefault on the button, so the input never blurs and
      refocuses — a visible flicker of the focus ring on a control the user never left

**Tests** — `pnpm --filter webapp test:pure`
- [x] 34. Mode change keeps the panel open — plus a source guard that the outside-click listener
      stays removed, since re-adding it looks like a fix and silently restores the reported bug
- [x] 35. Clear closes it and refocuses
- [x] 35a. **New:** 19 tests, each verified to fail when its rule is reverted. One did not: the
      tooltip assertion used a substring, so `data-title="…"` (which renders no tooltip) passed it.
      Tightened to a boundary match and re-verified.

## Phase 4 — Search result cap *(Item 4)*

Small backend change, but it touches a public endpoint.

✅ **Done 2026-08-14.** Built to a **different design than planned**, on the user's call, and the
difference is the point of the phase.

> **The plan's approach would have taxed every search.** It said to add `get_current_user_optional`
> and resolve entitlements per request — a token decode, a user read and a plan resolution in front
> of *every* search, including every guest's, on the hottest endpoint in the product, to answer a
> question with the same answer for all of them.
>
> Instead the cap keys off the **presence of a bearer token**:
>
> | Caller | Cost | Rows |
> |---|---|---|
> | Frontend, no `Authorization` header | **nothing at all** — no decode, no query | 30 |
> | Frontend, bearer from a paid plan | one user read + a cached entitlement map | 100 |
> | Frontend, bearer from a free plan | same lookup | 30 |
> | B2B partner | nothing | 100 (unchanged) |
>
> The client sends a token only when its plan earns more, which it learns from
> `limits.search_results_max` on `/entitlements/me`. Guests and free users search **exactly** as
> they do today, one number apart.

**Backend**
- [x] 36. New entitlement key `search_results_max`
- [x] 37. Seed values — guest 30, free 30, basic 100, pro 100, max 100
- [x] 38. ~~Add `get_current_user_optional` to the search route~~ → a purpose-built dependency that
      returns immediately when there is no bearer and **never raises**
- [x] 39. Resolve the cap per request: `min(entitlement, ES_SEARCH_LIMIT)`
- [x] 40. `ES_SEARCH_LIMIT` becomes a ceiling, not the value
- [x] 40a. **New:** `SEARCH_RESULTS_DEFAULT` (30) as a plain setting for the no-lookup path —
      resolving the guest plan's entitlement would mean a database round trip to learn a constant.
      Registered in config.py's env mapping, since `Settings` is a `BaseModel`: a field is a
      hard-coded constant until its env var is added there
- [x] 40b. **New:** B2B partners keep the ceiling. They hit the same route, and cutting them to the
      consumer default would be a silent regression in an API other companies integrate against
- [x] 40c. **New:** `search_results_max` published on `/entitlements/me`, so *which* plans earn the
      larger set stays a data question the admin can change without a frontend deploy

**Frontend**
- [x] 40d. **New:** `searchTracks(query, mode, { authenticated })`. Anonymous by default; the
      workspace hook opts in only when `search_results_max` beats the default. Read through a ref,
      not the closure — `performSearch` is a `useCallback([])` the debounce effect depends on, and
      adding the flag to its deps would re-arm the debounce and fire a second search the moment
      entitlements resolved

**Tests**
- [x] 41. guest/free 30 · basic/pro/max 100 · B2B unchanged
- [x] 42. A plan claiming 500 is still capped at the operational limit
- [x] 42a. **New:** the anonymous path is asserted to touch **nothing** — the guard against someone
      later putting a lookup back in front of every guest search
- [x] 42b. **New:** 19 tests, sabotage-verified. Three initially passed with their rule deleted: the
      dependency catches everything by design, so an exception raised from a mock is swallowed
      exactly like a real one and "never reached" is indistinguishable from "reached and failed".
      Rewritten to assert on call counts, plus one test proving the authenticated path resolves at
      all — without it every "returns None" assertion would also pass against a dependency that had
      stopped working entirely

✅ **The flagged side effect did not happen.** Deactivated accounts do **not** get 403 from search:
every failure in the dependency — expired token, refresh token, missing user, deactivated account —
degrades to the default result count. Decision 8 needs no answer.

## Phase 5 — Library visibility *(Item 1)*

The biggest, and the only one that changes what every existing free user sees.

✅ **Done 2026-08-14.** Verified against the dev database: a user owning 14 playlists gets **14
rows on both plans** — free locks 9 with zero identifier leaks, Pro locks none.

**Backend**
- [x] 43. Derive visibility by recency — a `LIMIT cap` query over the owner's playlists ordered
      `created_at DESC, id DESC`, rather than a window function. Same answer, one cheap query, and
      it composes with the existing filter/join logic instead of being embedded in it
- [x] 44. **Stop filtering the list** — always return every playlist the user owns
- [x] 45. Withhold `id`, `uuid` and `seed_track_uuid` on non-visible rows
- [x] 45a. **New:** `fork_id` too — it is a playlist uuid by another name, and leaving it would hand
      back the identifier the other three lines just removed
- [x] 46. Filters, search, sort and pagination keep operating over the **full** set
- [x] 47. **No favourite exemption**
- [x] 47a. **New:** playlists owned by *someone else* (reachable via `all_favorites`) are never
      locked — the allowance is over what you own
- [x] 48. Reconcile `count_library_visible` → `min(owned, cap)`; the cap is now a parameter, since
      the answer is meaningless without it
- [x] 49. Stop writing `is_library_visible` at creation. Column left in the schema (default 1) so
      this needs no migration and can be rolled back; written by nothing, read by nothing
- [x] 49a. **New:** removed the now-dead creation-time plumbing — `_resolve_library_visibility`,
      the `library_visible_max` kwarg, and `SimilarityService._library_cap`
- [x] 50. Withhold `playlist_uuid` on tracks whose playlist is not visible
- [x] 51. Add `playlist_locked` so the client can tell "no playlist" from "locked playlist"
- [x] 51a. **New:** `id DESC` tie-break on **both** the visible-set and the listing queries.
      `created_at` has one-second resolution and playlists are created in bursts, so ties are
      ordinary — without it the "visible five" differ between identical requests and a row can
      appear on two pages at once. Newly load-bearing because Phase 2 made pages shareable URLs

**Frontend**
- [x] 52. Locked playlists rendered dimmed but present, with name, counts, duration and date intact
- [x] 53. Every action on a locked row opens the upgrade modal instead of navigating
- [x] 53a. **New:** the `href` is dropped entirely on a locked row. An onClick guard does not run on
      a right-click or ⌘-click, so leaving `?id=` would let either bypass the gate
- [x] 53b. **New:** the dropdown menu is structurally unrenderable on a locked row, rather than
      merely unreachable via the guarded kebab
- [x] 54. Uploads tab: Sonic Discovery capsule locked when `playlist_locked`
- [x] 55. Modal copy naming the reason — *"outside your most recent 5"*, and saying explicitly that
      nothing has been deleted
- [x] 56. Filters, sort and pagination still work across everything

**Tests** — `pytest tests/unit` (backend) + `pnpm --filter webapp test:pure` (frontend)
- [x] 57. Creating a 6th playlist pushes the 1st out
- [x] 58. An unlimited plan locks nothing — and pays no query for it
- [x] 59. Locked rows carry no `id` / `uuid` / `seed_track_uuid` / `fork_id`
- [x] 60. The usage chip agrees with the visible count — and is asserted to use the **same**
      resolution of the plan as the limit it is displayed against, since resolving twice is how a
      chip ends up reading "6/5"
- [x] 61. Favourites get no exemption
- [x] 61a. **New:** a locked playlist still reports `ready`, not `unavailable` — existence and
      reachability are different questions, and only the second one the cap answers
- [x] 61b. **New:** every rule sabotage-verified. One did not fail: the pagination tie-break
      assertion was matching the *visible-set* query's identical `order_by`, so the listing's could
      be deleted unnoticed. Anchored to `base_query` and re-verified

## Phase 6 — Liked tracks tab *(Item 6)*

Depends on Phase 2's pagination.

✅ **Done 2026-08-14.** Verified against the dev database: a user with **6 like rows across 5
distinct tracks** gets 5 rows, newest first, paginating without overlap.

**Backend**
- [x] 62. `GET /ratings/tracks/mine` — paginated, `rating = 1`, newest first
- [x] 62a. **New:** `DELETE /ratings/tracks/mine/{uuid}` for un-liking. Both are registered **ahead
      of** `/tracks/{track_id}` — FastAPI matches in order, so a static path declared after a
      parameterised one is unreachable
- [x] 62b. **New:** one row per TRACK, not per rating. Ratings are keyed on (user, track,
      *playlist*), so liking the same track in three playlists is three rows
- [x] 63. Apple metadata + artwork enrichment, via the same path the Library already uses

**Frontend**
- [x] 64. Third tab, reusing Phase 2's pagination (`?tab=liked&page=2`)
- [x] 65. Single action — *Chain discovery*
- [x] 66. No delete, no analysis
- [x] 67. Un-liking allowed — and it clears the like in **every** playlist it was given in, or the
      row would stay on screen backed by the others and the click would appear to do nothing
- [x] 67a. **New:** an explicit thumbs-DOWN is left alone. It answers a different question, and
      clearing it here would silently discard feedback the user never revisited
- [x] 68. Empty state naming the gesture — *"open any Sonic Discovery playlist and give a track a
      thumbs up"* — since a new user's tab is blank and "nothing here yet" would not say where
- [x] 68a. **New:** the filter panel and Favorites toggle are hidden on this tab. It is a plain
      reverse-chronological list, and offering filters that do nothing is worse than offering none

**Tests**
- [x] 69. Only `rating = 1` rows appear
- [x] 70. Newest first — with an `id DESC` tie-break, since several likes in one session share a
      `rated_at` second
- [x] 71. Pagination — bounded, tenant-scoped, and `total` counts distinct **tracks** so the page
      count cannot disagree with the list under it
- [x] 72. A deleted track does not break the page — asserted against the FK's `ON DELETE CASCADE`,
      which is what makes the query safe without a filter
- [x] 72a. ⚠️ **The trap, and it shipped in the first version.** `is_active` reads as a soft-delete
      flag, so `is_active = 1` is the obvious filter — and it is wrong. **4,360 of the 4,420 tracks
      currently sitting in playlists have `is_active = 0`**, and the playlist screens list them
      happily. The blanket filter returned zero rows for a user with five liked tracks, and an empty
      tab is indistinguishable from a user who has liked nothing. Corrected to uploads only
- [x] 72b. **New:** 15 tests, sabotage-verified. Two needed fixing first: a `group by t.id`
      substring check that `GROUP BY t.id, r.playlist_id` also satisfied, and — after anchoring it —
      a regex that matched the duration lookup's *inner* `GROUP BY` instead of the outer one

✅ **No gating work.** Chain discovery *is* similarity-by-id — the same endpoint as search — and
`get_similarity_by_id` already resolves `DROPDOWN_MAX_TRACKS` and calls `peek_allowed` for the daily
allowance (`similarity_controller.py:1545`). Verified.

## Phase 7 — Score presentation *(Item 5)* — last, low priority

Deferred deliberately: it is a product decision, and building early means rebuilding.

- [x] 73. Research alternatives, including what comparable services do — **done 2026-08-14**, see
      *Item 5 — research findings* above
- [x] 74. Come back with options and examples **before building anything** — done; recommendation is
      **A + B** (named bands + rank), with C struck out because it was already built and reverted
- [x] 75. Implement the chosen approach — ✅ **DECIDED (George, 2026-08-14): ten round dots.**
      Options A/B/C were set aside; the brand review offered square segments, a level meter and a
      notched rail as more literal fits for a radius-0 system, and round dots were chosen anyway.
      **Every filled dot is the accent on every row**, not just rank 1 — the count already says
      which is best, so tinting one row said it twice and made the rest look inactive
- [x] 75a. **The mapping**, also approved: `≥0.95 → 10` · `0.46–0.95 → 3–10` · `<0.46 → 1–3`.
      Stretched rather than linear because `score × 10` would only ever use dots 5–9 — ten dots
      doing the work of five — and floored at 3 because nothing in the catalogue is genuinely a 1/10
- [x] 75b. **New:** applied on mobile as well, in a compact variant. The mobile table had its own
      copy of the percentage and would otherwise have kept it
- [x] 76. Update the tooltip that currently apologises for the tight band → *"Ten dots · how close
      each track is to your reference"*. There is nothing left to excuse

**Tests** — `pnpm --filter webapp test:pure`
- [x] 77. No percentage string reaches the DOM — asserted on both tables, matching the `* 100` /
      `formatPercentage` calls that actually built the string rather than the word "percent"
- [x] 77a. **New:** the scale is monotonic and every one of the ten values is reachable. A boundary
      edited in isolation silently costs the meter resolution — ten dots rendering six values
- [x] 77b. **New:** junk input (`null`, `NaN`, `Infinity`, negative, `42`) still renders a valid
      meter. `score` is optional on the track type and comes from the API
- [x] 77c. **New:** 14 tests, sabotage-verified. Two guards survived their own sabotage — a
      redundant `>= CEILING` early return and a redundant low-band clamp. Both were **removed**
      rather than papered over with a test: a branch no test can distinguish from its absence is
      code that cannot be verified, and an invitation to "simplify" it into something different

⚠️ **Out of scope, deliberately.** The analysis page's genre-confidence percentages
(`charts.tsx`, `AnalysisPage.tsx`) and the admin tables are untouched — different model output, and
in admin's case an internal surface where precision is appropriate. The same critique may apply to
the genre scores; that is its own decision.


---
# Decisions needed

| # | Question | My recommendation |
|---|---|---|
| 1 | **Which 5?** Most recent by `created_at`; should favourites be exempt? | ✅ **DECIDED — no exemption.** A favourite behaves exactly like any other playlist. My recommendation to pin favourites was overruled, correctly: an exemption would make the cap depend on a flag the user controls. |
| 2 | Does the cap count **search and upload playlists together**, or 5 of each? | Together — it is one Library. |
| 3 | **Guests** on search — 30 like free, or fewer? | 30. A guest who signs up should not see results get worse. |
| 4 | Item 5 — which presentation? | ⏸️ **DEFERRED — low priority, moved last.** Research alternatives (including what comparable services do) and come back with options before building anything. |
| 5 | Liked tracks — does *View chain discovery* need gating? | ✅ **DECIDED — no new work.** Chain discovery IS similarity-by-id, the same endpoint as search, and it already resolves `DROPDOWN_MAX_TRACKS` and calls `peek_allowed` for the daily allowance (`similarity_controller.py:1545`). It is not "opening a locked playlist" — it creates a new one — so the library-visibility gate does not apply. Verified. |
| 6 | Should the Liked tab allow **un-liking**? | Yes. "No delete" should mean no destroying data — removing your own like is not that. |
| 7 | Analysis poll ceiling before showing "taking longer than usual"? | 10 minutes. |
| 8 | Item 4 — accept that adding `get_current_user_optional` makes search **403 for deactivated accounts**? | Accept it; it is consistent with every other authenticated surface. |

---

# Cross-cutting notes

**One gating rule, not seven.** Items 1, 4 and 6 all ask "what may this plan see?". They should all
resolve through the entitlement layer, never through `if plan == 'free'`. There is already one
hard-coded limit (`ES_SEARCH_LIMIT`) and adding more would guarantee the day a plan change fails to
take effect somewhere.

**The uuid is the gate.** Withholding an identifier is real enforcement; greying a button is not.
Every gate here should withhold the id and let the UI follow, rather than the reverse.

**Existing free users will notice Phase 5.** Anyone who has been seeing their five oldest playlists
will see a different five. That is the fix working, but it will read as data loss to whoever it
happens to. Worth a one-line in-app note the first time it changes.

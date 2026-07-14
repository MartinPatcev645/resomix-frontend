# Playback Redesign — Apple Music previews for catalogue, HLS for uploads

**Status:** Locked (decisions final 2026‑07‑14). Implementation in progress.
**Scope:** PLAYBACK only. Similarity and analysis generation are **unchanged** — still computed on the
Hetzner media/embedding boxes and routed through Alwyzon exactly as today.

---

## 1. Background / why

Partner 1 (the public/frontend surface) is now **~1.97M electrobuzz catalogue tracks**, each **1:1 with an
`apple_music_tracks` row** — **Apple coverage is 100%, verified**. The old `type='open'` catalogue is
retired (`is_active=0`). There are 22 live user uploads (`type='upload'`).

Electrobuzz tracks have **no HLS segments and no server peaks** (`peaks_status`/`segments_status='pending'`,
never generated). Instead every catalogue track has an Apple 30s AAC **`preview_url`** served straight from
Apple's CDN. So catalogue playback moves to Apple previews; our HLS/peaks stack is kept but used **only for
the user's own uploaded tracks**.

---

## 2. The core shift

**Today:** the whole similarity playlist plays as **one combined HLS stream** — the media server stitches the
seed + all members into a single manifest (`/signed-audio/hls-m3u8/`), and `HlsPlaylistController` scrubs it as
one continuous timeline with server peaks.

**New model:** a **per‑track queue** on a single `<audio>` element. Per track, the engine is chosen by a
`playback` flag from the API:

| Track | `playback` | Engine | Waveform |
|---|---|---|---|
| User's own upload (`type='upload'`) | `"hls"` | hls.js on the seed's **full‑track** manifest | **Peaks.js waveform (kept, as now)** |
| Any catalogue track (playlist members + search‑query reference) | `"preview"` | `audio.src = preview_url` (Apple CDN, no auth, no media hop) | **Simple progress line, no waveform** |

Autoplay / prev / next / volume / media‑session are all preserved; they advance the queue by re‑pointing the
source. The HLS/peaks/segments code stays in place — just not requested for catalogue tracks.

---

## 3. Locked decisions

1. **HLS is used for exactly one thing:** `type='upload'`. Every catalogue track uses Apple preview (coverage
   is 100%, so **no fallback path is needed**).
2. **Upload seed = full track** — full HLS segments **and** full peaks, in both the playlist and analysis
   screens (previously a 30s window).
3. **Waveform is per‑track:** upload keeps its Peaks.js waveform (server peaks, displayed exactly as now);
   catalogue/preview tracks get a **simple progress line** (like the analysis page). A client‑side waveform lib
   for previews can be added later if desired.
4. **Preview scrubber = the preview's own duration.** The real full track length is shown only as **metadata**
   (from Apple's `duration_ms`).
5. **Player UI** = play/pause + volume + progress bar + an **Apple Music attribution banner** shown while
   previews are playing.
6. **Metadata merge:** `title` and `artist` come from in‑house `tracks`; `album`, `genre`, `year`,
   `duration_ms`, `isrc`, `artwork` come from `apple_music_tracks`, **falling back to `tracks`** when the Apple
   field is NULL.

---

## 4. Changes by repo

### Phase 1 — Alwyzon (`basic_fastapi_server_resomix`) — API *(prerequisite; do first)*
- `LEFT JOIN apple_music_tracks amt ON amt.track_id = t.id` in the track‑detail builders
  (`repositories/similarity_repository.py`, the playlist‑detail serializer, `services/track_service.py`
  my‑tracks, `services/similarity_service.py` enrichment).
- Per track send: `uuid` + existing fields, **plus** `preview_url`, `artwork_url`, `deep_link_url`,
  `apple_song_id`, `playback` (`"hls"` for uploads, else `"preview"`).
- **Do NOT** send a `has_apple` bool, and **do NOT** add any HLS‑reference fields to catalogue tracks.
- Apply the metadata merge (§3.6).
- Extend schemas `TrackDetail` / `SeedTrackDetail` (`schemas/playlist.py`) with the new Optional fields.
- **Playlist response schema cleanup:** remove **`fork_id`** and **`is_following`**; keep the favorite fields.

### Phase 2 — Media server (`resomix-similarity-open`) — full‑track uploads
- `app/services/segmentation_service.py`: uploads generate **full‑track** segments + peaks — flip `restricted`
  OFF for `source == "uploads"` (was a 30s window starting at 120s). Everything else untouched; catalogue
  tracks never touch this service.

### Phase 3 — Frontend (`resomix-web`) — player redesign *(the big lift)*
- `packages/stores/src/usePlaylist.ts` `Track` type: add `preview_url`, `artwork_url`, `deep_link_url`,
  `apple_song_id`, `playback`, `album`, `genre` (no `has_apple`); stop reading `fork_id`/`is_following`.
  **Rebuild the stores dist** (it loads from `dist`, not `src`).
- `packages/hooks/src/Player/HlsPlaylistController.ts` → a **queue controller** on one `<audio>` that branches
  on `track.playback`: hls.js for the upload seed, `audio.src = preview_url` for previews; autoplay/prev/next/
  volume/media‑session preserved.
- Playlist sections (`sections/**/Playlist/*`): keep the Peaks.js waveform for the upload seed; render a simple
  progress line for preview tracks; render `artwork_url` + merged metadata (title/artist in‑house); add the
  Apple Music banner. Don't request peaks/hls‑m3u8 for preview tracks.
- Analysis screen: uploaded‑track playback via the same upload→HLS branch (covers the from‑Library case with no
  local blob).

---

## 5. Explicitly unchanged
- Similarity search + analysis generation (Hetzner via Alwyzon).
- The HLS / peaks / segments media service (retained; used only for uploads).
- Autoplay, prev/next, volume, media‑session, favorites.

## 6. Order
1. Alwyzon API → 2. media server full‑track uploads → 3. frontend player redesign.

# My Library — Frontend Integration Guide

The library page has two sections, both scoped to the **logged-in user**:

1. **My Uploaded Tracks** — list, view full metadata, and delete (soft) the user's own uploads.
2. **My Playlists** — the user's own playlists (lightweight summaries) to render the playlists list.

This guide is the **single source of truth for the whole library page** — every track and playlist endpoint it needs is documented below. All endpoints require a user JWT and are scoped to the caller (System Partner 1); not-logged-in requests return `401`.

**Contents**
- [Part A — My Uploaded Tracks](#part-a--my-uploaded-tracks) (`/api/v1/tracks/my-tracks`)
- [Part B — My Playlists](#part-b--my-playlists) (`/api/v1/playlists/get-all-playlists/`)

---

# Part A — My Uploaded Tracks

## Authentication

**All three endpoints require a user JWT.** No token (or an invalid/expired one) → **`401`**.

```
Authorization: Bearer <access_token>
```

- The consumer frontend is System Partner 1; the token alone is enough (no API key needed).
- Results are always scoped to the caller's **own uploads** — another user's tracks and catalog tracks are never returned.

## Endpoints

| Action | Method & Path |
|---|---|
| List my uploaded tracks | `GET /api/v1/tracks/my-tracks/` |
| View one track | `GET /api/v1/tracks/my-tracks/{track_uuid}` |
| Delete one track | `DELETE /api/v1/tracks/my-tracks/{track_uuid}` |

> Legacy unversioned paths (`/tracks/my-tracks/...`) also resolve, but **new code should use `/api/v1/`**.

---

## 1. List My Uploaded Tracks

```
GET /api/v1/tracks/my-tracks/?page=1&page_size=20
```

### Query params
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | 1-based. Must be ≥ 1 |
| `page_size` | number | `20` | **Max 20.** A value > 20 returns `422` |

- Ordered **newest first**. Soft-deleted tracks are excluded.

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "uuid": "8f3c1e2a-...",
      "title": "My Track",
      "version_title": null,
      "display_artist": "Me",
      "mix_name": "Original Mix",
      "isrc": "USABC2600001",
      "duration_ms": 200000,
      "duration": 200.0,
      "bpm": 128,
      "musical_key": "8A",
      "genre": "Techno",
      "sub_genre": null,
      "track_type": "upload",
      "price_cents": 99,
      "is_explicit": false,
      "is_instrumental": false,
      "is_active": true,
      "created_at": "2026-07-03T10:30:00",
      "updated_at": "2026-07-03T10:30:00",
      "playlist_uuid": "1b9d...",
      "has_similarity": true,
      "has_analysis": false
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### List item fields
| Field | Type | Description |
|---|---|---|
| `uuid` | string | Track UUID — use for view/delete and as the React key |
| `title` | string | Track title |
| `version_title` | string\|null | Version/subtitle (e.g. remix label) |
| `display_artist` | string\|null | Artist string to display |
| `mix_name` | string\|null | Mix name (e.g. `"Original Mix"`) |
| `isrc` | string | ISRC code |
| `duration_ms` | number\|null | Duration in milliseconds |
| `duration` | number\|null | Duration in **seconds** (convenience) |
| `bpm` | number\|null | Beats per minute |
| `musical_key` | string\|null | Musical key (e.g. `"8A"`) |
| `genre` | string\|null | Genre name |
| `sub_genre` | string\|null | Sub-genre name |
| `track_type` | string | Always `"upload"` for library tracks |
| `price_cents` | number\|null | Price in cents |
| `is_explicit` | boolean | Explicit flag |
| `is_instrumental` | boolean | Instrumental flag |
| `is_active` | boolean | Active (not soft-deleted) — always `true` in this list |
| `created_at` / `updated_at` | string\|null | ISO timestamps |
| `playlist_uuid` | string\|null | UUID of the similarity playlist generated from this track, or `null` if none. Use it to open the playlist (`GET /api/v1/playlists/similarity/{uuid}`) |
| `has_similarity` | boolean | Whether a similarity playlist has been generated for this track (`true` ⇔ `playlist_uuid` is non-null) |
| `has_analysis` | boolean | Whether audio analysis has completed. **Always `false` for now** — the analysis feature isn't implemented yet and will be wired in later |

> **Dropdown state:** `has_similarity` + `playlist_uuid` tell the UI whether to show "Open playlist" vs "Generate playlist". `has_analysis` is a forward-looking flag that currently returns `false` for every track.

### Top-level pagination fields
| Field | Type | Description |
|---|---|---|
| `total` | number | Total uploaded tracks owned by the user |
| `page` | number | Current page |
| `page_size` | number | Items per page |
| `total_pages` | number | Total number of pages |

---

## 2. View a Track (full metadata)

```
GET /api/v1/tracks/my-tracks/{track_uuid}
```

Returns everything in the list item **plus** the fields below, including nested `audio_files[]` and `contributors[]`. Internal fields (storage path, checksums) are never exposed.

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "uuid": "8f3c1e2a-...",
    "title": "My Track",
    "display_artist": "Me",
    "duration": 200.0,
    "bpm": 128,
    "musical_key": "8A",
    "genre": "Techno",
    "track_type": "upload",
    "is_active": true,
    "key_signature": "Am",
    "audio_language": "en",
    "language_of_lyrics": null,
    "p_line_year": 2025,
    "p_line_text": "℗ 2025 Me",
    "parental_warning": "NotExplicit",
    "audio_files": [
      {
        "asset_class": "Master",
        "asset_subtype": "master",
        "original_filename": "track.wav",
        "mime_type": "audio/wav",
        "file_size_bytes": 40960000,
        "duration_seconds": 200,
        "audio_codec": "pcm_s16le",
        "sample_rate": 44100,
        "bit_depth": 16,
        "channels": 2,
        "bitrate_kbps": 1411,
        "created_at": "2026-07-03T10:30:00"
      }
    ],
    "contributors": [
      {
        "name": "Me",
        "role": "MainArtist",
        "royalty_type": "NeighboringRights",
        "ownership_share": 100.0,
        "sequence_num": 1
      }
    ]
  }
}
```

### Detail-only fields
| Field | Type | Description |
|---|---|---|
| `key_signature` | string\|null | Key signature |
| `audio_language` | string\|null | Audio language code |
| `language_of_lyrics` | string\|null | Lyrics language code |
| `p_line_year` | number\|null | ℗-line year |
| `p_line_text` | string\|null | ℗-line text |
| `parental_warning` | string\|null | e.g. `"NotExplicit"`, `"Explicit"` |
| `audio_files` | array | Per-file audio metadata (see example). Empty array if none |
| `contributors` | array | Contributor credits: `name`, `role`, `royalty_type`, `ownership_share`, `sequence_num`. Empty array if none |

### Errors
- **`404`** — track does not exist, is **not owned** by the caller, or was deleted. (Ownership is not distinguished from non-existence, so the UI should treat all `404`s as "not found".)
- **`401`** — not authenticated.

---

## 3. Delete a Track (soft delete)

```
DELETE /api/v1/tracks/my-tracks/{track_uuid}
```

**Soft delete + cascade** — sets `is_active=false`; the track immediately disappears from the library, catalog, search, and similarity. On delete the backend also:
1. **soft-deletes the similarity playlist** generated from this track (it disappears from the user's playlists too) — `data.playlists_deleted` tells you how many;
2. **purges the track's media-server assets in the background** — peaks, segments, embeddings (both similarity indexes), preview, cover, raw audio;
3. *(next sprint)* will soft-delete the track's audio-analysis record once analysis exists.

### Response (200 OK)
```json
{
  "success": true,
  "data": { "uuid": "8f3c1e2a-...", "is_active": false, "playlists_deleted": 1 },
  "message": "Track deleted successfully"
}
```

### Errors
- **`404`** — track does not exist, is not owned by the caller, or was **already deleted**. Delete is **idempotent**: a second delete returns `404`.
- **`401`** — not authenticated.

---

## Error envelope

Every non-2xx response uses the standard envelope:
```json
{ "success": false, "error": "Track not found" }
```
`422` validation errors additionally carry `data.details[]`.

---

## Frontend Examples

### JavaScript / TypeScript (Fetch)
```typescript
const API = "/api/v1/tracks/my-tracks";

async function listMyTracks(token: string, page = 1, pageSize = 20) {
  const res = await fetch(`${API}/?page=${page}&page_size=${pageSize}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || "Failed to load tracks");
  return body; // { data, total, page, page_size, total_pages }
}

async function getMyTrack(token: string, uuid: string) {
  const res = await fetch(`${API}/${uuid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (res.status === 404) return null;          // not found / not owned
  if (!res.ok || !body.success) throw new Error(body.error);
  return body.data;
}

async function deleteMyTrack(token: string, uuid: string) {
  const res = await fetch(`${API}/${uuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (res.status === 404) return false;         // already gone
  if (!res.ok || !body.success) throw new Error(body.error);
  return true;                                  // soft-deleted
}
```

### React Hook (list with pagination)
```typescript
import { useCallback, useEffect, useState } from "react";

export function useMyTracks(token: string, pageSize = 20) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await listMyTracks(token, page, pageSize);
      setTracks(body.data);
      setTotal(body.total);
      setTotalPages(body.total_pages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  // Optimistic remove after a successful soft-delete.
  const remove = useCallback(async (uuid: string) => {
    const ok = await deleteMyTrack(token, uuid);
    if (ok) {
      setTracks((prev) => prev.filter((t) => t.uuid !== uuid));
      setTotal((n) => Math.max(0, n - 1));
    } else {
      await load(); // 404 → out of sync, refetch
    }
    return ok;
  }, [token, load]);

  return { tracks, total, page, setPage, totalPages, loading, error, reload: load, remove };
}
```

---

# Part B — My Playlists

The playlists the user created, rendered as the "My Playlists" list on the library page. This returns **lightweight summaries only** (no embedded track lists), so it is cheap to page through.

## List My Playlists

```
GET /api/v1/playlists/get-all-playlists/?page=1&page_size=20
```

- **Requires JWT** (same `Authorization: Bearer <token>` as Part A). Not logged in → `401`.
- Returns **only the caller's own** playlists (public **and** private), **newest first**.
- The internal integer primary key (`pk`) is **never** returned — always key playlists by `uuid`.

### Query params (all optional except paging)
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | 1-based |
| `page_size` | number | `20` | Items per page |
| `play_time` | string | — | Total-runtime bucket: `lt1h`, `1-3h`, `3-6h`, `6-9h`, `gt9h` |
| `num_tracks` | number | — | Exact track count: `10`, `20`, `50`, or `100` |
| `start_date` | string | — | Created on/after (`YYYY-MM-DD`) |
| `end_date` | string | — | Created on/before (`YYYY-MM-DD`) |
| `is_public` | boolean | — | Visibility filter (`true` = public, `false` = private) |
| `own_favorites` | boolean | — | Only playlists the user owns **and** favorited |
| `all_favorites` | boolean | — | All playlists the user favorited (incl. ones they don't own) |

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Playlist",
      "is_public": false,
      "seed_track_title": "Whole Life (Original Mix)",
      "seed_track_type": "internal",
      "fork_id": "",
      "num_tracks": 10,
      "play_time": 3600,
      "created_at": "2026-07-03T10:30:00",
      "is_favorite": false,
      "is_following": false
    }
  ],
  "total": 123
}
```

### Item fields
| Field | Type | Description |
|---|---|---|
| `uuid` (`id`) | string | Playlist UUID — use for all references and as the React key (`id` is an alias) |
| `name` | string | Playlist name |
| `is_public` | boolean | Visibility (`true` = public, `false` = private) |
| `seed_track_title` | string\|null | Title of the seed/query track, if any |
| `seed_track_type` | string\|null | Seed track origin: `"upload"` (user-uploaded) or `"internal"` (catalog). `null` when there is no seed track |
| `fork_id` | string | Original playlist UUID if this is a fork the user owns; empty string otherwise |
| `num_tracks` | number | Number of tracks in the playlist (excludes the seed track) |
| `play_time` | number | Total runtime in **seconds** (includes the seed track's duration) |
| `created_at` | string\|null | ISO timestamp |
| `is_favorite` | boolean | Whether the user favorited it |
| `is_following` | boolean | Whether the user follows it |

### Top-level field
| Field | Type | Description |
|---|---|---|
| `total` | number | Total playlists matching the query for this user |

> **Need the full playlist (with its tracks)?** This summary endpoint intentionally omits them. To open a playlist, call `GET /api/v1/playlists/similarity/{uuid}` (see the main [integration guide](./frontend_api_integration_guide.md) §5.4).

### Errors
- **`401`** — not authenticated: `{ "success": false, "error": "Authentication required" }`

## Frontend Examples — Playlists

### JavaScript / TypeScript (Fetch)
```typescript
async function listMyPlaylists(token: string, page = 1, pageSize = 20, filters: Record<string, string | number | boolean> = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  for (const [k, v] of Object.entries(filters)) params.set(k, String(v));

  const res = await fetch(`/api/v1/playlists/get-all-playlists/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || "Failed to load playlists");
  return body; // { data: playlist[], total }
}
```

### React Hook (list with pagination + filters)
```typescript
import { useCallback, useEffect, useState } from "react";

export function useMyPlaylists(token: string, pageSize = 20) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await listMyPlaylists(token, page, pageSize, filters);
      setPlaylists(body.data);
      setTotal(body.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { playlists, total, page, setPage, totalPages, filters, setFilters, loading, error, reload: load };
}
```

## Share (Make Public) & Rename a Playlist

Both actions **require a logged-in user (JWT)** and are **owner-only**. A logged-out request returns `401`; acting on a playlist the caller doesn't own (or one that doesn't exist) returns `404` — never surface ownership details.

> Why login-only: a logged-out session's playlists are already public by default, so there is nothing to share/toggle. Restricting to owners also prevents anyone from flipping or renaming someone else's playlist by UUID.

### Share / make public (toggle visibility)
```
PUT /api/v1/playlists/visibility/
Body: { "playlist_id": "<uuid>", "is_public": true }   // false = make private again
```
- `200` → `{ "success": true, "message": "Playlist visibility changed to public successfully" }`
- `401` not logged in · `404` not found / not owned · `422` empty `playlist_id`

### Rename
```
PUT /api/v1/playlists/rename/
Body: { "playlist_id": "<uuid>", "new_name": "My New Name" }   // 1–150 chars
```
- `200` → `{ "success": true, "message": "Playlist renamed successfully", "old_name": "..." }`
- `401` not logged in · `404` not found / not owned · `422` invalid name/id

### Delete a playlist
```
DELETE /api/v1/playlists/{playlist_uuid}
```
- **Soft delete** — the playlist disappears from all the user's lists and **frees a slot** against the playlist quota; the row is retained server-side. Idempotent (second delete → `404`).
- `200` → `{ "success": true, "message": "Playlist deleted successfully" }`
- `401` not logged in · `404` not found / not owned / already deleted

> ⚠️ **Do not delete by unfollowing.** Earlier the frontend called `POST /playlist/unfollow/{id}` to make a playlist disappear — that only stops following; the playlist still exists and still counts against the quota. Use `DELETE /api/v1/playlists/{uuid}` for real deletion.

### Example (Fetch)
```typescript
const PL = "/api/v1/playlists";

async function setPlaylistPublic(token: string, uuid: string, isPublic: boolean) {
  const res = await fetch(`${PL}/visibility/`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ playlist_id: uuid, is_public: isPublic }),
  });
  const body = await res.json();
  if (res.status === 401) throw new Error("Please log in to share playlists.");
  if (res.status === 404) return false;            // not yours / gone
  if (!res.ok || !body.success) throw new Error(body.error);
  return true;
}

async function renamePlaylist(token: string, uuid: string, newName: string) {
  const res = await fetch(`${PL}/rename/`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ playlist_id: uuid, new_name: newName }),
  });
  const body = await res.json();
  if (res.status === 401) throw new Error("Please log in to rename playlists.");
  if (res.status === 404) return false;            // not yours / gone
  if (!res.ok || !body.success) throw new Error(body.error);
  return true;
}
```

**UI tip:** only show the Share/Rename controls for logged-in users on their own playlists; treat a `401` as "prompt to log in" and a `404` as "no longer available / not yours".

---

## Notes (whole library page)
- Always key and reference tracks **and** playlists by **`uuid`** — internal integer IDs (`pk`) are never exposed.
- Track `page_size` is hard-capped at **20**; the UI should not request more. The playlists list has no hard cap but defaults to `20`.
- After a track delete, prefer optimistic removal from the current list, and refetch if the server returns `404` (already deleted elsewhere).
- A `404` from track view/delete means "not found **or** not yours" — do not surface ownership details to the user.
- Both parts share the same JWT; a single logged-in session drives the whole page.

# "Playlist is Private" on a shared public playlist — investigation

**Status:** diagnosed, not yet fixed. Parked while the CORS outage is dealt with.
**Reported:** a public playlist is shared; a new visitor opens the link and sees
"Playlist is Private". Refreshing sometimes shows it, sometimes not. Affects mobile and desktop.

---

## 1. The headline: the message is not a privacy check

**"Playlist is Private" is the fallback for *any* failure to load.** It is not produced by a 403,
and it says nothing about visibility.

`apps/webapp/src/sections/desktop/Workspace/WorkspaceDiscoveryResults.tsx`:

```tsx
{playlistData ? (
  <><PlaylistHero /><PlaylistTable /></>
) : (
  <Error404
    loading={isResolving}
    eyebrow="Access"
    title="Playlist is Private"
    description="This playlist is private. Make it public or share it to view…"
  />
)}
```

with

```ts
const isResolving = isLoading || (hasId && !playlistData && !error);
```

`Error404` renders **only a spinner** while `loading` is true, so the "Private" text appears
exactly when `error` is set — and `usePlaylistLoader` sets it for every failure path:

```ts
} else {
  s.setError(resp.error || 'Failed to load playlist');   // any success:false
}
...
.catch(() => { s.setError('Failed to load playlist'); }); // any throw
```

The same block exists in **four** files, so desktop and mobile behave identically:

| File |
|---|
| `apps/webapp/src/sections/desktop/Workspace/WorkspaceDiscoveryResults.tsx` |
| `apps/webapp/src/sections/mobile/Workspace/WorkspaceDiscoveryResults.tsx` |
| `apps/webapp/src/pages/desktop/PlaylistPage.tsx` |
| `apps/webapp/src/pages/mobile/PlaylistMobile.tsx` |

### The server collapses causes too

`app/services/playlist_service.py::get_playlist_similarity_data`:

```python
except Exception as e:
    print(f"Error in playlist service get similarity data: {e}")
    return {"success": False, "error": "An error occurred while retrieving playlist data"}
```

Two problems:

1. **Every** exception — DB error, enrichment fault, anything — becomes one generic message that
   the UI then renders as "Playlist is Private".
2. It is `print`ed, not sent through `logging_service`, so it **never reaches `system_logs`**.
   There is no server-side record of what actually failed.

### The authorization logic itself is correct

`playlist_repository.async_get_playlist_similarity_data`:

```python
is_owner = user_id is not None and playlist.user_id == user_id
if not playlist.is_public and not allow_private and not is_owner:
    return {"error": "playlist_not_public"}
```

Public → allowed. Owner → allowed. Soft-deleted reads as "not found", not "private". Anonymous
visitors resolve to System Partner 1 via `get_public_partner`, so partner scoping does not block a
guest. **Nothing is wrong here.**

---

## 2. Decisive first check

A **real** 403 is logged (`get_playlist_similarity_data_forbidden`, status 403). If there are no
such rows for the playlist, this was never a visibility problem:

```sql
SELECT created_at, action, status_code,
       JSON_EXTRACT(metadata,'$.playlist_uuid') AS uuid, client_ip
FROM system_logs
WHERE action IN ('get_playlist_similarity_data_forbidden',
                 'get_playlist_similarity_data_success')
  AND created_at > NOW() - INTERVAL 7 DAY
ORDER BY created_at DESC
LIMIT 50;
```

---

## 3. Candidate causes, ranked

### 3.1 nginx per-IP rate limit — 429 with no CORS headers

`limit_req zone=api_rl burst=10 nodelay` = **3 r/s per IP** on `/(api|search|upload|v1|v2)/`.

A cold page load fires a burst: auth refresh, entitlements, the playlist itself, telemetry,
playback session, peaks. Every one is **preflighted** (the `X-Device-Hash` header makes each
request non-simple), so the request count against the limit is roughly **double** what it looks
like. Over the burst → 429 → `error` set → "Playlist is Private".

**Mobile is far more exposed**: carrier CGNAT puts many subscribers behind one public IP, so a
stranger's traffic counts against your visitor. Corporate and school NAT do the same.

> This is the same mechanism as the August 2026 CORS outage — see
> `docs/CORS_OUTAGE_AUG2026.md`. Fixing that rate limit likely fixes a share of this too.

### 3.2 Stale auth state rejecting the queued request

`packages/api-client/src/authClient.ts`: if `isAuthenticated` is persisted `true` but the refresh
cookie is dead, a 401 triggers a refresh, the refresh fails, and `processQueue(error)` **rejects
every queued request** — including the playlist. Hits returning visitors rather than true
first-timers, and a reload clears it, which matches "sometimes works on refresh".

### 3.3 Cloudflare serving a cached 403

If the playlist was private when someone first opened it, and any cache rule covers `/api/v1/*`,
that 403 can be replayed to later visitors. **No `Cache-Control` is set on API responses**, so
nothing instructs Cloudflare not to cache them. Different edge PoPs hold different copies, which
would explain two people seeing different results for the same link at the same moment, and
mobile (different carrier → different PoP) differing from desktop.

### 3.4 Mobile in-app browsers

Shared links are mostly opened inside WhatsApp / Instagram / Facebook webviews, where third-party
cookie policy and storage differ. `authClient` sets `withCredentials: true`, and its request
interceptor `await`s a device fingerprint that cannot be persisted to `localStorage` in some of
those contexts. Any failure there surfaces as — again — "Playlist is Private".

### 3.5 A genuinely private playlist, shared anyway

`apps/webapp/src/components/Modals/PlaylistShare.tsx` copies the link **even when the visibility
change failed**, and still shows "Copied!":

```tsx
const response = await changePlaylistVisibility(activeId, true);
if (response.success) {
    …
} else {
    setLink(BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);   // failed — link copied anyway
}
} catch (err) {
    console.error('Failed to change visibility', err);
    setLink(BASE_BETA_URL + `/sonic-discovery?id=${activeId}`);   // threw — link copied anyway
}
```

Not the reported case (that playlist was already public), but a live bug for anyone sharing a
private one.

---

## 4. Fixes, in order

1. **Make the error tell the truth.** Distinguish 403 from everything else; show
   "Something went wrong — try again" with a retry for the rest. Until this lands, every user
   report is unactionable, which is the reason this went undiagnosed for days.
2. **Log the server-side exception properly** — `logging_service` with the correlation id, not
   `print`. Without it there is no server-side trace of the real fault.
3. **Set `Cache-Control: no-store`** on visibility-dependent API responses. Cheap, and it removes
   §3.3 permanently.
4. **Fix the rate limit** (see the CORS outage doc) — shared benefit with §3.1.
5. **Do not copy a share link when the visibility change failed** — surface the failure instead.

## 5. What is NOT the problem

* The playlist authorization logic — verified correct.
* Partner scoping for guests — anonymous resolves to System Partner 1.
* Soft-deleted playlists — already read as "not found".
* The share URL shape — `/sonic-discovery?id=<uuid>`, with `/playlist` kept as a permanent
  redirect so older links keep working.

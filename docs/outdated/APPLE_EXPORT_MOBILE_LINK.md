# Apple Music export on mobile — "the playlist isn't in my account"

**Investigated and fixed 2026-08-18.** Reported by George (Greece, iPhone). Repo: alwyzon backend +
resomix-web.

**One-line summary:** the export was perfect; the link we handed back afterwards was broken in two
independent ways, and the visible symptom pointed at a region problem that did not exist.

---

## What was reported

George exported a 100-track playlist to Apple Music from his iPhone. The app reported success. The
playlist did not appear. Tapping **"Open in Apple Music"** opened the Music app and showed:

> **Item Not Available** — The item you've requested is not currently available in your country or
> region.

Playlist `4c08aa9e-a878-4460-a361-736f9b23f7c9` ("J Tijn — Cognitive Dissonance").

## What we suspected — and why it was wrong

A region problem. Our own notes flag the biggest trap in this integration as **Apple catalog song
IDs being storefront-specific**: the same song has a different ID in the US store than in the Greek
store. Our entire catalogue was matched against `/us/`; George is on `gr`. And Apple's error message
literally said *"not available in your country or region"*.

The theory: we were pushing US track IDs into a Greek library, Apple was accepting the request and
silently discarding the tracks, and George was left with an empty playlist.

**Every part of that was wrong.** Worth recording, because the error text actively pointed at it and
the same reasoning will look attractive again next time.

## What the logs proved (system_logs #53222–#53224, 18:29)

```
verified_tracks: 100    verified: true     storefront: "gr"
matched: 100            tracks_added: 100  unmatched: 0
transfer_time_seconds: 6.19
created_playlist_id: p.PkxVLAYH2X6JZXG
```

`verified_tracks` is not our own count — it is the playlist **read back off Apple's servers after
the write** (added 2026-08-10 for exactly this class of doubt, see `_verify_playlist`). Apple
confirmed it held all 100 tracks. Storefront detection returned `gr` correctly, every track
resolved, nothing was dropped.

George confirmed independently: **the playlist was in his Apple Music on desktop, complete.**

That eliminated matching, storefront resolution and the write path in one step, and left only the
returned URL.

## The four checks that isolated it

| # | Check | Result | What it proved |
|---|---|---|---|
| 1 | Open our link on mobile | "Item Not Available… your country or region" | Reproduced |
| 2 | Share the playlist from his own Music app | gave `…/gr/playlist/{slug}/**pl.u-**38oW9zbCPWqvlWy` | **A different kind of ID exists** |
| 3 | Paste our link into mobile Safari | redirected to `…/**gr**/library/playlist/p.…`, worked in browser | **Apple was correcting a missing country code** |
| 4 | Tap both links from WhatsApp, same phone, same minute | catalog link → opens **on the playlist**; library link → opens app, **no playlist** | Isolated the cause exactly |

Check 4 is the decisive one: same device, same account, same moment, only the *kind* of URL differs.

## Root cause — two independent faults

**Fault 1 — no storefront in the URL.** We returned
`https://music.apple.com/library/playlist/{id}`. With no country code Apple resolves the link
against the **US** storefront, where a Greek user's library playlist does not exist. Apple's message
was accurate; it just wasn't describing the problem we assumed.

**Fault 2 — a `/library/` link cannot deep-link into the iOS Music app, at all.** Apple's ceiling is
`/library`, nothing deeper — there is no route to an individual library playlist. Check 4 proved it
holds even with the country code corrected. Confirmed against Apple's developer forums.

**Why we could not simply use the good link.** The shareable `pl.u-…` ID (`playParams.globalId`)
is minted **only when a person taps Share, or enables "Show on My Profile and in Search", inside the
Music app**. There is no API for it. Our code was already reading `playParams.globalId` after every
export and finding nothing — on a playlist created seconds earlier it does not exist, and it never
appears on its own. Polling longer would not have helped.

**Why desktop always worked.** On a computer the link opens the **web player**, where a library URL
is a real page. On a phone, iOS claims `music.apple.com` as a universal link and hands it to the
Music app, which has no such page.

---

## The fix applied

### Backend — `app/services/apple_music_transfer_service.py`

`_get_created_playlist_url` (async, made an Apple request) → static
`_library_playlist_url(playlist_id, storefront)`:

```
https://music.apple.com/gr/library/playlist/p.PkxVLAYH2X6JZXG
```

- Storefront always present, lowercased.
- If storefront detection returns `None`, falls back to `settings.apple_storefront` rather than
  emitting an empty path segment — **an empty segment still resolves as US**, which would rebuild
  the same bug in a form much harder to spot.
- **The `globalId` lookup is removed entirely.** It cost one Apple request on every export and could
  never succeed on a fresh playlist. Exports now make one fewer network call and the URL cannot fail
  or add latency. The reasoning is in the docstring so it is not reinstated.

### Frontend — `apps/webapp/src/components/Modals/Transfer/AppleExportPanel.tsx`

The caption was **actively misleading**: it blamed a sync delay and said the playlist would appear
"in a few minutes". Waiting does nothing, and that is what sent George round in circles. It now
states the playlist is under **Library › Playlists**, and points at Share in Apple Music for sharing.

### Tests — `tests/unit/services/test_apple_export_verification.py`

Four added, all failing against the pre-fix code by construction (the old URL had no country
segment at all):

- the URL carries the user's storefront;
- a missing storefront falls back rather than emitting an empty segment;
- the storefront is lowercased;
- **building the URL issues no HTTP request** — so re-adding a `globalId` lookup has to confront the
  reasoning above rather than quietly undo it.

39 Apple tests pass; webapp build clean.

### Deploy

Backend restart — no migration, no new dependency. Frontend redeploy for the caption.

---

## What is still not possible (do not try to "fix" again)

On a phone, the link opens Apple Music **at the app's home screen**, not on the playlist. That is the
best that exists for a private library playlist. The only way to a deep link is a public `pl.u-…`
playlist, and only the user can create one, by hand, in the Music app. This is the same class of
limitation as the **byline** finding already recorded in the Apple export notes (a library playlist's
author is always the account holder and cannot be set to "Resomix").

## Two latent bugs found while chasing the wrong theory

Neither caused this incident — George's export hit neither — but both are real and still live. They
are tracked as items **22 and 23** in `docs/OPEN_TODOS.md`, summarised here for context:

1. **A cross-storefront track with no ISRC uses the US ID verbatim.** In
   `transfer_playlist_to_apple_music`, `if same_storefront or not m.get("isrc")` sends a
   no-ISRC track down the "use the stored ID directly" path even for a foreign user. Apple answers
   the add with `204` and silently drops it. Called "best-effort" in the comment; cross-storefront
   it is closer to a guaranteed miss.

2. **A failed storefront lookup silently becomes `us`.** `user_sf = (await
   self._get_user_storefront(...)) or catalogue_sf` — that one value decides between *use IDs
   directly* and *translate every ID*. A transient failure for a non-US user therefore drops the
   entire playlist, and the only trace is a `logger.warning`. A network blip and a genuine US user
   produce identical logs.

Both would present exactly as this incident first appeared — "export succeeded, playlist is empty" —
which is why they are worth closing even though they were not the cause this time.

## Lessons

- **The error message named the wrong subsystem.** "Not available in your country or region" was
  emitted by Apple's *storefront routing of a URL*, not by track matching. It cost the first hour.
- **`verified_tracks` earned its keep.** Added a week earlier for a different reason, it ended the
  region theory in one line. Reading back what you wrote is worth the request.
- **A caption that guesses is worse than no caption.** The old copy invented a sync delay, and
  because it sounded plausible it delayed the real diagnosis on the user's side.

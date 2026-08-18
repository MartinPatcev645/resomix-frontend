# Open TODOs — consolidated

**Written 2026-08-17**, at the end of the outage/hardening session. This is the single index of
everything known-and-not-done across all four repos. Each item says what it is, **why it matters**
(so a future reader can judge whether to skip it), where the detail lives, and rough effort.

Detailed write-ups referenced below:

| Doc | Repo | Covers |
|---|---|---|
| `docs/CORS_OUTAGE_AUG2026.md` | alwyzon | the 520 outage, root cause, nginx cleanup |
| `docs/RATE_LIMITING_ALIGNMENT.md` | alwyzon | nginx / fail2ban / app limits, CGNAT, security posture |
| `docs/SHARED_PLAYLIST_PRIVATE_ERROR.md` | alwyzon | the "Playlist is Private" investigation |
| `phase4_capacity_aug2026/docs/OPTIMISATION_BACKLOG.md` | stress-testing | everything phase 4 found and deliberately did not fix |
| `phase4_capacity_aug2026/docs/QUEUE_DESIGN.md` | stress-testing | the global queue design (deferred until real users) |
| `phase4_capacity_aug2026/docs/PHASE4_SUMMARY.md` | stress-testing | plain-language summary for George |
| `RUNBOOK.md` | maest-discogs-ccreplica | GPU deploy/restart procedure |

---

## P1 — do next

### 1. The other 26 endpoints using `get_current_user_optional`
**What:** `get_current_user_optional` returns **401 when a token is present but invalid/expired**.
Only `GET /playlists/similarity/{id}` was moved to `get_current_user_or_anonymous`.

**Why it matters:** this is the bug that made a **public** playlist show as "Playlist is Private"
to anyone with a stale session. **`play-session` and `segment-status` are on the same shared-link
path** — if a visitor's playlist now loads but playback 401s, the problem moved rather than got
fixed. Nobody has tested that flow end to end with an expired token.

**Do NOT change the dependency globally.** On endpoints where identity decides *what you may do*
(library, uploads, account), silently treating an expired session as a guest shows the user an
empty library, which is worse than an error. Decide per endpoint: does an anonymous caller have a
legitimate meaning here?

**Where:** `app/api/dependencies/auth.py` (both dependencies, with the reasoning),
`tests/api/test_shared_playlist_stale_token.py` (the pattern to copy — organised by *credential
state*, not by authorization outcome).
**Effort:** ~1h including tests.

### 2. Four uvicorn workers — three blockers first
**What:** Alwyzon runs **one uvicorn process on 6 cores**.

**Why it matters:** it is why four synchronous calls (ClamAV, ffprobe, mutagen, an uncached
`ffmpeg -version`) collapsed the whole API on 2026-08-14 — 75 s submits and a Redis-only endpoint
at a 1.56 s median. Any future blocking call anywhere on that box will cost the same.

**Blockers, all of which must land before raising the worker count:**

| # | Problem | Fix |
|---|---|---|
| a | `slowapi` uses `storage_uri="memory://"` | → `redis://`. Otherwise each worker keeps its own counters and every rate limit becomes 4× looser. The comment at `app/api/middlewares/rate_limit.py:55` already says "use Redis in production". |
| b | `session_cleanup`, `telemetry_flush`, `quota_sync` start per worker | make single-instance (Redis lock like the watchdog, or move to Celery beat). Otherwise 4 copies drain the same queue and 4 subscribers handle every session-expiry event. |
| c | clamd scan semaphore is **8 per process** | → 2. 4 × 8 = 32 concurrent scans against clamd's default `MaxThreads 12`. |

Then `DB_POOL_SIZE=5` / `DB_MAX_OVERFLOW=5`: 4 workers + 2 Celery at the current 10+20 would be
~180 connections against MariaDB's `max_connections=151`.

**Verified environment:** 15 GB RAM, `max_connections=151`, clamd `MaxThreads 12`, no `DB_POOL`
overrides in `.env`.
**Effort:** half a day, mostly (b).

### 3. Stripe: a test-mode webhook endpoint is hitting production
**What:** `/api/v1/webhooks/stripe` still logs `SignatureVerificationError` — but **some** events
verify fine (`Stripe event evt_… already processed → 200`).

**Why it matters:** a rejected webhook is a dropped subscription/payment event. The signature is
right for some deliveries and wrong for others, which means **two endpoints hitting the same URL**
— almost certainly a **test-mode** webhook aimed at production, signed with the test secret.

**Check:** Stripe Dashboard → toggle to **test mode** → Developers → Webhooks, look for an
endpoint pointing at `https://bserver.resomix.com/api/v1/webhooks/stripe`. Also confirm nothing is
running `stripe listen --forward-to`.

> The Aug 16 **520**s on webhooks were a different thing entirely — our malformed-header outage,
> now fixed. Stripe retried and the dashboard shows "Delivery recovered", so those events landed.
> Worth spot-checking that `maksalonica@hotmail.com` (`user_id: 4`) ended up on founding-monthly.

**Effort:** 15 min.

### 4. Verify the billing portal fix
**What:** `STRIPE_BILLING_PORTAL_CONFIG_ID` was pointing at a configuration in a **different
Stripe account** (`bpc_…10fhE8ows4` vs the live account's `…11a6teGMKY`), so every Pro user
clicking **Manage** got a 502. Replaced 2026-08-17.

**Why it matters:** paying customers cannot manage or cancel their subscription. Not yet confirmed
working after the change.

**Check:** click Manage as a Pro user. If it still fails, the admin Logs row will now name the
Stripe error directly (see item 8) instead of needing a `journalctl` dig.
**Effort:** 2 min.

---

## P2 — worth doing soon

### 5. Login rate limit is per-IP, not per-account
**What:** `@limiter.limit(auth_rate_limit("login"))` = **5/minute per IP**, on both the webapp and
admin login.

**Why it matters:** it is a *reliability* problem, not a security one — the security control
already exists and is correct (`login_max_failed_attempts=10` / `login_lockout_minutes=15`, keyed
on **user_id**, counting **failures only**, which is exactly what OWASP prescribes). The per-IP cap
adds little against credential stuffing (botnets have thousands of IPs) while reliably locking out
an office, a school, or a mobile carrier behind CGNAT. It is also why the stress suite has to sleep
60 s between account logins.

**Fix:** raise the per-IP limit to ~60/min as a "single host hammering" net; leave the account
lockout untouched. Next standard step after that is a challenge/CAPTCHA on repeated failure — not
a tighter IP cap.
**Where:** `RATE_LIMITING_ALIGNMENT.md` §Step 5.

### 6. `frontend_similarity_burst_per_min` is per-IP and unreachable from config
**What:** 30/min, **shared** between `similarity/search` and `similarity/upload`, keyed on IP.

**Why it matters:** ten people in one office share one budget of 30. It should key on the
`visitor_id` we already derive from `X-Device-Hash`. Separately, it is **not registered in
`config.py`'s env-mapping table**, so it cannot be changed from `.env` at all — changing it needs a
code edit and a restart.

### 7. Client should honour `Retry-After`
**What:** nginx now sends `Retry-After` on 429s; the frontend ignores it.
**Why it matters:** a client that can read a 429 backs off. One that cannot retries blindly and
makes the incident worse. Now that errors are readable cross-origin, this is cheap to add.

### 8. 39 `print()` calls in `except` blocks still need a judgement call
**What:** 131 of 170 were converted to `logger.error` on 2026-08-17. The remaining 39 were left
deliberately.

**Why it matters:** `print()` never reaches the logging system, so `ExceptionCaptureHandler` cannot
see it and the admin 5xx row stays detail-free. But a blanket conversion would be **wrong** — many
of the remainder are capability probes, not errors:

```python
except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
    print("[AntiVirus] clamscan command-line tool not found")   # expected, not an error
```

Logging that at ERROR creates permanent false alarms, and now that the watchdog exists, noise in
ERROR logs has a real cost. Each site needs a per-case `debug` / `info` / `warning` decision.
**Mostly:** `antivirus_service.py`, `audio_service.py`, `main.py` startup warnings.

### 9. `contributors` get-or-create race 500s an upload
**What:** two concurrent uploads carrying the **same artist name** both find no row, both insert,
one loses — and that user's entire upload fails with a 500.

**Why it matters:** 1 in 773 requests today, and it gets **more** likely as upload throughput
improves. A user loses their upload because someone else uploaded a different track by the same
artist at the same moment.

**Fix:** `INSERT … ON DUPLICATE KEY UPDATE`, or catch `IntegrityError` and re-`SELECT`. Audit the
other `_get_or_create` users too — labels, genres, albums.
**Where:** `OPTIMISATION_BACKLOG.md` §6b.

### 10. Content-Security-Policy (and `Permissions-Policy`)
**What:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and HSTS are all set
(restored 2026-08-17 when the stress `add_header` lines were removed — those had been suppressing
them on every `/api/` response). **CSP is absent.**

**Why it matters:** a missing seatbelt rather than an open wound. CSP limits the blast radius *if*
an XSS gets in; without it, one XSS anywhere can read tokens and call the API as the user. Actual
XSS exposure looks low (React escapes by default), so this is hardening — and it is the fiddliest
header to add without breaking things, so do it deliberately rather than in a rush.

---

## P3 — cleanup and hygiene

### 11. nginx CORS map does not match the app's allow-list
`map $http_origin $cors_allow_origin` has `stack.resomix.com` and `landing.resomix.com`; the app
allows `www.resomix.com`, `embed.resomix.com` and `api-docs.resomix.com`, none of which are in the
map. **Inert today** because the map is still unused — becomes real the moment error-response CORS
headers are wired up. Dev origins (`localhost:517x`) are now commented out.

### 12. fail2ban's nginx jails are inert behind Cloudflare
fail2ban extracts the **real** client IP (thanks to `real_ip`) and bans it in **iptables** — but
packets arrive from Cloudflare edges, so the ban matches nothing. Either use fail2ban's
`cloudflare` action (API token) or accept the jails as decorative and say so in the config.
**The `[sshd]` jail is unaffected and genuinely valuable** — it catches real brute-force daily.
Leave it alone.

### 13. Refresh the Cloudflare `set_real_ip_from` ranges periodically
Verified current 2026-08-17 (15 v4 + 7 v6, exact match). If Cloudflare adds a range and we do not,
clients arriving through it lose real-IP restoration and silently share one bucket.

### 14. `admin_rl` zone is dead config
Defined (`120r/m` after the retune) and **never referenced by any `limit_req`**. Admin is actually
governed by `api_rl` plus the app-level login limit. Either wire it to `/api/v1/admin/` with its
own `location`, or delete it — leaving it invites the same mistake of reading the zone and assuming
it is in force.

### 15. GPU box: stale stress-testing origin
`ALLOWED_ORIGINS` still contains `http://205.147.200.11/` (the phase-4 staging load generator).
Harmless — the GPU server is called server-to-server so CORS never gates it — but it is leftover
scaffolding of exactly the kind that caused the 520.

### 16. GPU box: optional `RESTART_VRAM_FLOOR`
The restart cadence is now 3/4 days, chosen from a measured ~1 GB/day drift. Time is only a proxy:
a busy week drifts faster. A "restart when free VRAM < N **and** idle" trigger would make the
schedule self-correcting. ~10 lines in `restart_analysis_if_idle.sh`.

### 17. Sandbox service
Stopped 2026-08-17 (was a public, unmanaged proxy into production on `0.0.0.0:8004`, running since
May, reachable directly on the origin IP and bypassing Cloudflare entirely). The **vhost was kept
deliberately** so the TLS cert and Certbot renewal survive for a future real sandbox.
**Outstanding:** rotate `SANDBOX_USER_PASSWORD` and `LEGACY_API_KEY`, and check whether the
`sandbox_service` account still holds real permissions in production.

### 18. Frontend: halve the API request volume
Every API call carries `X-Device-Hash`, which makes it **non-simple**, so every call is preflighted
— two HTTP requests per logical call. Moving the guest device signal to a cookie would halve it.
Search-as-you-type is **already debounced** (500 ms) and needs nothing. The other lever is
collapsing the six bootstrap calls into fewer.

### 19. Frontend: share modal copies a link even when the visibility change failed
`PlaylistShare.tsx` sets the link in both the `else` and the `catch`, and still shows "Copied!" —
so a user can share a link to a playlist that is **still private** and be told it worked.

### 20. `Cache-Control: no-store` on visibility-dependent API responses
No cache headers are set on API responses at all. If any Cloudflare cache rule ever covers
`/api/v1/*`, a 403 for a then-private playlist could be replayed to later visitors. Cheap
insurance.

### 21. vitest / node:test runner overlap
Four files (`libraryUrlState`, `libraryLocking`, `matchBarScale`, `searchFieldState`) are written
for `node:test` and pass under `pnpm test:pure` (85 tests), but `vitest run`'s `*.test.ts` glob
also matches them and reports 4 failed files. **Cosmetic, but dangerous**: a genuinely broken file
would be lost in expected noise. Exclude them in the vitest config or rename to `*.pure.ts`.

---

## Deferred by decision (not forgotten)

### The global queue over analysis + similarity
Fully designed in `QUEUE_DESIGN.md` — two lanes, foreground beats background, deficit round robin
4:1 Pro:Free, `BG_PROMOTE_AFTER` to prevent starvation. **Deliberately deferred until real users
arrive**: what exists today holds. The poll-based similarity upload (the piece that fixed the only
production failure) shipped separately and is live.

### Re-running phase 4 against the queue
The suite, the nginx geo exemption (now removed) and `[PERF-TRACE]` were kept for this. Note the
exemption is gone, so a future run needs it re-added or the results measure the limiter again.

---

## Testing lessons worth keeping

**Organise tests by input state, not by outcome.** The existing suite covered the authorization
matrix thoroughly — owner sees private, stranger does not, guest sees public — but every case used
either a **valid token or no token**. Nothing exercised the third credential state: *present but
bad*. Authorization was tested. Authentication was tested. Their interaction was not, and that is
exactly where the bug lived.

**Three things this session were invisible rather than broken**, each producing a plausible-looking
log line while doing nothing: an inherited `flock` FD that silently killed the weekly GPU restart, a
stale restart stamp, and two health probes pointing at the same instance. Distrust a log line that
reassures you.

**A mechanism that is wired up is not a mechanism that works.** `error_context` was installed,
called, and captured **nothing** for its entire life, because `BaseHTTPMiddleware` runs the app in
a child task with a copied context. It had no test. Anything whose failure mode is "silently
records less" needs a test that asserts it recorded something.

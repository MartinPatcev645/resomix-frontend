# Retirement of the static `RESOMIX_API_KEY` super-key

## Why
`RESOMIX_API_KEY` (`settings.api_key`) was a placeholder from before real user accounts + JWT
existed. It played **three** roles at once, all of which are now handled by proper auth:

1. **Frontend tenant identity** — guests/logged-in users were identified as System Partner 1 by
   sending this shared key on every request.
2. **Admin super-key** — `X-API-KEY == settings.api_key` (or the same value as a Bearer token)
   *bypassed* RBAC entirely and granted **all** permissions.
3. **Outbound media-server credential** — the backend passed it to the internal HLS media service.

A single shared static secret that grants full admin is exactly what an enterprise auth model must
not have. It is now retired.

## The new model
| Surface | Before | After |
|---|---|---|
| Guest (frontend) | `X-API-KEY` super-key → Partner 1 | **Anonymous → System Partner 1** (`get_public_partner`, `allow_anonymous`) |
| Logged-in (frontend) | JWT *or* super-key | **User JWT → System Partner 1** |
| Admin | super-key bypass (all perms) | **Admin-role JWT** via `/admin/auth/login` + **RBAC** (`require_admin` needs the `role:admin` claim *and* the DB `admin` role) |
| B2B partner | `rmx_…` partner key | unchanged (`rmx_…` key, its own per-second/monthly quotas) |
| Internal monthly pipeline | super-key | **`require_admin`** (admin JWT) |
| HLS media server (outbound) | `settings.api_key` | **`settings.hetzner_internal_api_key`** (dedicated cross-service key) |

## Backend changes
- `app/api/dependencies/partner.py::_get_partner_core` — removed the `settings.api_key` credential
  branch (priority 2). Platform access is now: valid user JWT → Partner 1; else anonymous → Partner 1
  when `allow_anonymous`. A stale/invalid token degrades to anonymous on public endpoints instead of
  hard-failing.
- `get_current_partner_scoped(scope, allow_anonymous=False)` — gained `allow_anonymous`; the scope is
  a B2B-key concept and does not apply to Partner 1. Similarity search passes `allow_anonymous=True`.
- `app/api/dependencies/auth.py` — removed the super-key branches in `require_permission` and
  `require_admin`, and **deleted the `get_api_key` dependency** entirely (no endpoint used it).
- All 28 former `get_api_key` endpoints reclassified: frontend/public → `get_public_partner`
  (waitlist, telemetry, ratings, engagement, transfers, dummy HLS, contact-submit, similarity view /
  HLS / play-session, entitlements/me, feedback-submit); admin/internal → `require_admin`
  (`monthly_pipeline`, `contact` get/update).
- `app/core/rbac.py` — **registered 5 admin permissions that were referenced but never in the
  registry** (`partners:manage`, `playlist:manage`, `promo:manage`, `similarity:manage`,
  `spotify_apps:manage`). The super-key had masked this drift by skipping the permission check. Run
  `python scripts/seed_rbac.py` to sync (idempotent; grants them to the `admin` role).
- `app/core/config.py` — `settings.api_key` neutered: default `""`, documented as retired, accepted
  nowhere. Kept only so legacy test references resolve.
- `.env` / `.env.example` — `RESOMIX_API_KEY` removed.

## Frontend changes (`resomix-web`)
- `packages/api-client/src/utils.ts` + `authClient.ts` — interceptors no longer send `X-API-KEY` or
  the `api_key` query param, and the **admin super-key Bearer fallback is removed** (admins log in).
- `telemetry.ts`, `getUrl`, `appleService.ts`, `tidalService.ts`, `HlsPlaylistController.ts` — no
  longer append `api_key` to URLs (playback auth is the edge `token`).
- `packages/api-client/src/config.ts` — `API_KEY` field removed.

## Verification
- Backend: full suite green (**460 passed**). Admin flows use an admin-role JWT
  (`tests/api/library_helpers.py::create_admin_user` / `admin_auth_headers`).
- Frontend: `api-client`, `hooks`, `webapp` type-check clean (`tsc -b`).

## ⚠️ Follow-ups / flags
- **HLS media server** (`playlist_service._call_media_server`) now sends
  `HETZNER_INTERNAL_API_KEY`. Streaming was out of scope (on hold) and `HLS_MEDIA_BASE_URL` is unset
  in dev, so this path is untested here — **verify the media server accepts that key** (or configure
  it) before re-enabling streaming.
- **Test hygiene (optional):** ~16 test files still include a now-inert `X-API-KEY: settings.api_key`
  header (value is `""`, ignored). Harmless; can be scrubbed later. The `settings.api_key` field can
  be deleted once those references are gone.
- **Admin web app:** relies on `/admin/auth/login` producing an admin-role JWT (no more super-key
  fallback). Confirm the admin app's login flow is wired when building the admin UI (Phase 7.2).

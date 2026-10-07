# Reference Docs — Canonical Partner & Developer Documentation

This folder holds the **shareable, canonical** documentation for the Resomix
Alwyzon control-plane: the docs we keep aligned with the running system and hand
to **partners, frontend developers, and auditors**.

Everything else under `docs/` is internal. Current operating material sits in
`docs/` itself, and anything superseded has been moved to `docs/outdated/`, which
is kept for reference and is not maintained.

> Keep this separation intact. A new document that is partner or developer facing
> and meant to stay in sync with the code belongs here. Internal operating notes
> stay in `docs/`. Nothing is ever deleted; it moves to `docs/outdated/`.

---

## Frontend & API integration

| Document | Purpose |
|----------|---------|
| [frontend_api_integration_guide.md](frontend_api_integration_guide.md) | The canonical endpoint reference the frontend builds against. |
| [PARTNER_DETAILS_API.md](PARTNER_DETAILS_API.md) | Partner-facing API details. |
| [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md) | High-level product / system overview. |
| [AUTH_IMPLEMENTATION_GUIDE.md](AUTH_IMPLEMENTATION_GUIDE.md) | JWT, sessions, 2FA — auth model for integrators. |
| [database.md](database.md) | Schema design and table relationships. |
| [APPLE_MUSIC_FRONTEND_GUIDE.md](APPLE_MUSIC_FRONTEND_GUIDE.md) | Apple Music transfer — frontend guide. |
| [SPOTIFY_APP_ADMIN_FRONTEND_GUIDE.md](SPOTIFY_APP_ADMIN_FRONTEND_GUIDE.md) | Spotify app admin — frontend guide. |
| [GET_ALL_USER_PLAYLISTS_FRONTEND_GUIDE.md](GET_ALL_USER_PLAYLISTS_FRONTEND_GUIDE.md) | User-playlists endpoint — frontend guide. |
| [PLAYLIST_FORK_FRONTEND_GUIDE.md](PLAYLIST_FORK_FRONTEND_GUIDE.md) | Playlist fork — frontend guide. |
| [SPOTIFY_TRANSFER_README.md](SPOTIFY_TRANSFER_README.md) | Spotify OAuth transfer feature. |
| [TIDAL_TRANSFER_README.md](TIDAL_TRANSFER_README.md) | Tidal OAuth transfer feature. |

## Partner onboarding & operations

| Document | Purpose |
|----------|---------|
| [PARTNER_ONBOARDING.md](PARTNER_ONBOARDING.md) | Operator runbook for onboarding a B2B partner end-to-end. |
| [fresh_server_setup_runbook.md](fresh_server_setup_runbook.md) | Stand up the control-plane on a clean VPS (fresh DB, no restore). |

> **Restoring from backup is not documented here.** The procedure lives in the
> `server-backups` repository, at `docs/DR-RUNBOOK.md`. The old `restore_runbook.md`
> described a Docker and mariabackup process we do not use and has been moved to
> `docs/outdated/`.

## Compliance & technical due-diligence pack

Shareable with partners and auditors. Internal security-audit reports are kept out
of this folder, under `docs/outdated/technical/`.

| Document | Purpose |
|----------|---------|
| [1.Digital_suuply_chain.md](1.Digital_suuply_chain.md) | Digital supply chain. |
| [2.Copyright_Liability.md](2.Copyright_Liability.md) | Copyright & liability. |
| [3.Media_delivery.md](3.Media_delivery.md) | Media delivery. |
| [4.Resiliance_availability.md](4.Resiliance_availability.md) | Resilience & availability. |
| [5.Data_backup.md](5.Data_backup.md) | Data backup. |
| [6.Example_questions.md](6.Example_questions.md) | Common due-diligence Q&A. |

> The per-server reference documents that used to sit here, `alwyzon_server.md` and
> `hetzner_server.md`, were written from memory and have been superseded by the
> discovery pass in `server-backups/docs/SERVERS.md`, which was run on the machines
> themselves. Both have been moved to `docs/outdated/`.

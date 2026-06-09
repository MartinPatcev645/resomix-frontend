# Reference Docs — Canonical Partner & Developer Documentation

This folder holds the **shareable, canonical** documentation for the Resomix
Alwyzon control-plane: the docs we keep aligned with the running system and hand
to **partners, frontend developers, and auditors**.

Everything *outside* this folder under `docs/` (scoping reports, gap analyses,
roadmaps, implementation plans, status snapshots, internal impl notes) is
**internal development material** — useful to us, not meant for external sharing.

> Keep this separation intact: when a new doc is partner/developer-facing and
> meant to stay in sync with the code, put it here. Working notes stay in `docs/`.

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
| [restore_runbook.md](restore_runbook.md) | Disaster-recovery / database restoration procedure. |

## Compliance & technical due-diligence pack

Shareable with partners and auditors. (Internal security-audit reports are kept
out of this folder, under `docs/` / `docs/technical/`.)

| Document | Purpose |
|----------|---------|
| [1.Digital_suuply_chain.md](1.Digital_suuply_chain.md) | Digital supply chain. |
| [2.Copyright_Liability.md](2.Copyright_Liability.md) | Copyright & liability. |
| [3.Media_delivery.md](3.Media_delivery.md) | Media delivery. |
| [4.Resiliance_availability.md](4.Resiliance_availability.md) | Resilience & availability. |
| [5.Data_backup.md](5.Data_backup.md) | Data backup. |
| [6.Example_questions.md](6.Example_questions.md) | Common due-diligence Q&A. |
| [alwyzon_server.md](alwyzon_server.md) | Alwyzon control-plane server reference. |
| [hetzner_server.md](hetzner_server.md) | Hetzner media/similarity server reference. |

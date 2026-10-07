# Outdated documentation

Nothing here is maintained, and nothing here should be trusted as a description of
how the system works today. It is kept because it records **why** decisions were
made, which the current documentation does not, and because some of it is the only
written account of a piece of work.

Archived 7 October 2026. Everything outside this folder was checked against the
code on the same day and is current.

**If a document here disagrees with the code, the code is right.** These files are
not corrected when the system changes, by design. Correcting them would make them
look current, which is the one thing they must not look.

---

## What is in here and why

### Planning and scoping exercises

| Folder | What it was |
|---|---|
| `may_2026/` | A scoping report, 30-day roadmap, gap analyses and week-by-week implementation plans from May 2026. The RBAC and partner portal work came out of it |
| `zz_new_db_migration/` | The planning for the database rebuild. Schema mapping, model inventories and the seed-data blueprint |
| `complete_flow/` | An early end-to-end walkthrough |

### Point-in-time reviews

| File | What it was |
|---|---|
| `technical/SECURITY_AUDIT_REPORT_2026.md` | Security audit, February 2026 |
| `technical/prompt_response.md` | Working notes from the same audit |
| `SECURITY_AUDIT_REPORT.md` | An earlier audit, October 2025 |
| `DATABASE_NORMALIZATION_AUDIT.md` | Normalisation review, August 2026 |
| `alwyzon_server.md`, `hetzner_server.md` | Reviews of each server against label-integration requirements. Superseded by the discovery pass in `server-backups/docs/SERVERS.md`, which was run on the machines rather than written from memory |

### Feature work, recorded at the time it was built

These describe a feature as it was designed and shipped. The feature is live; the
document is a record of building it, not of how it behaves now. For current
behaviour, read the code or the reference guides.

`ACCOUNT_DELETION_GDPR_OPTIONS.md`, `ACCOUNT_LIFECYCLE_AND_NOTIFICATIONS_PLAN.md`,
`APPLE_EXPORT_MOBILE_LINK.md`, `APPLE_MUSIC_IMPLEMENTATION_GUIDE.md`,
`CONSUMER_BILLING_PLAN.md`, `EXPORT_SETUP_GUIDE.md`,
`FRONTEND_PLANS_AND_GUEST_ENFORCEMENT.md` and its implementation file,
`LIBRARY_AND_DISCOVERY_PLAN.md`, `MODEL_ALIGNMENT_PLAN.md`,
`OPEN_CATALOGUE_REINGEST_PLAN.md`, `OPEN_TRACKS_PIPELINE_SETUP.md`,
`OPEN_TRACKS_PLAYBACK_ENABLEMENT.md`, `PARTNER_INGESTION_TEST_PLAN.md`,
`PLAYBACK_APPLE_MUSIC_PLAN.md`, `PLAYLIST_ENGAGEMENT_IMPLEMENTATION.md`,
`PLAYLIST_FORK_IMPLEMENTATION_GUIDE.md`, `RATE_LIMITING_ALIGNMENT.md`,
`SIMILARITY_API_UPDATE.md`, `SPOTIFY_APP_MANAGEMENT_IMPLEMENTATION.md`,
`STATIC_API_KEY_REMOVAL.md`, `TIDAL_OAUTH_INTEGRATION.md`,
`admin_operation_limit_implementation.md`, `ingestion_pipeline_v2_plan.md`,
`ingestion_v2_handoff.md`, `integration_summary.md`, `transition.md`,
`transition_stripe.md`.

### Incidents and one-off reports

| File | What it was |
|---|---|
| `CORS_OUTAGE_AUG2026.md` | The August 2026 CORS outage and what fixed it |
| `SHARED_PLAYLIST_PRIVATE_ERROR.md` | A single bug investigation |
| `REPO_CHANGES_2026-07-13_to_2026-07-23.md` | A ten-day change summary |
| `PRODUCTION_DATA_EXTRACTION.md` | A one-off extraction |
| `stress.md`, `resomix_alwyzon.md` | Working notes |

### Superseded or stale by generation

| File | Why |
|---|---|
| `PROJECT_FILES.md` | A file inventory generated 21 May 2026, listing 492 files. The repository has moved on and nothing regenerates it |
| `restore_runbook.md` | **The most misleading file in this archive.** It describes a restore using Docker, mariabackup and rsync. That is not how backups are taken or restored. The real procedure is `server-backups/docs/DR-RUNBOOK.md`. It was archived rather than deleted only because its filename is the one somebody would reach for in an incident, and a redirect is safer than a gap |

---

## Where to look instead

| You want | Read |
|---|---|
| How to set up and work in this repo | `docs/ONBOARDING.md` |
| How the system is put together | the root `README.md` |
| Day-to-day operations | `docs/RUNBOOK.md` |
| Partner and frontend reference | `docs/reference/` |
| How to restore from backup | `server-backups/docs/DR-RUNBOOK.md` |
| What is known and not done | `docs/OPEN_TODOS.md` |

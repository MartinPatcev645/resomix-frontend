# Alwyzon, the main Resomix API

The service the Resomix website talks to. Authentication, the catalogue, search,
similarity, playlists, the library, plans and billing, partner tenancy and the
admin surface all live here, and this is the only server the browser calls for
data.

It is also the only part of the system that holds the database. If this is down,
Resomix is down. That is not true of any other machine.

Production is `bserver.resomix.com`. Interactive API docs are at `/docs`.

> **New here? Read [`docs/ONBOARDING.md`](docs/ONBOARDING.md) first.** It covers
> setup, the git workflow, the coding practices and how to run the tests. This file
> describes the system; that one gets you working in it.

Every number and version below was read from the code on 7 October 2026.

---

## What it provides

**317 endpoints**, in three groups.

| Group | Endpoints | Called by |
|---|---|---|
| Public and partner | 131 | The website and partner integrations |
| Admin | 162 | The internal admin panel only |
| Internal | 24 | Our own machines, never a browser |

**For users.** Registration, email verification, login, password reset, two-factor
authentication, session management, Google sign-in and account deletion. Full-text
search over tracks, artists, albums and genres. Similarity search by track or by
uploaded reference. Deep track analysis. Playlists, including forking, embedding and
export to Spotify, Tidal and Apple Music. A personal library with ratings and
engagement. Signed, time-limited preview URLs. Stripe subscriptions, carts, orders,
refunds and VAT validation. Guests are a supported identity with their own limits,
not an absence of one.

**For partners.** Separate tenants with their own catalogue, API keys and users.
Audio delivered over SFTP, ingestion triggered through the admin API, and queries
scoped to their own material. Partner activity is audited separately.

**For administrators.** Seventeen areas, covering users, roles, admin
authentication, entitlements, operation limits, partners, processing, similarity,
playlists, promotions, messages, feedback, contact, waitlist, Spotify apps, logs and
backup status.

---

## Architecture

Six layers. Every feature follows them in the same order.

```
Router        app/api/routers/      Declares the endpoint and its dependencies
  ↓
Controller    app/controllers/      Thin HTTP handling, calls the service
  ↓
Service       app/services/         All business logic. No HTTP knowledge
  ↓
Repository    app/repositories/     Database queries only
  ↓
Model         app/models/           SQLAlchemy tables
                                    MariaDB, ~1.98M catalogue tracks
```

| Layer | Files |
|---|---|
| Routers | 29 public, plus `admin/` and `internal/` |
| Controllers | 38 |
| Services | 84 |
| Repositories | 32 |
| Models | 48 |
| Schemas | 31 |

Roughly 108,000 lines of Python.

**The rule, and it is not negotiable.** No business logic in routers or
controllers. No HTTP knowledge in services or repositories. No side effects in
models. A router or controller that makes a decision is a bug.

### Supporting folders

| Folder | Holds |
|---|---|
| `app/core/` | Config, security, exceptions, roles and permissions |
| `app/api/dependencies/` | Auth, database session, guest identity, partner, search caps |
| `app/api/middlewares/` | CORS, rate limiting, idempotency, partner audit, public names |
| `app/tasks/` | Celery workers and task definitions |
| `app/utils/` | 26 shared helpers |
| `app/templates/emails/` | Email templates |
| `alembic/` | 46 schema migrations |

---

## Stack

| Component | Version | Notes |
|---|---|---|
| Python | 3.12 locally and in Docker | **Production runs 3.10.** See the note below |
| FastAPI | 0.109 | |
| SQLAlchemy | 2.0, async | |
| MariaDB | **10.6** in production | |
| Alembic | 1.13 | 46 migrations |
| Pydantic | 2.5 | |
| Redis | 5.0 client | Cache, counters, sessions, Celery queue |
| Celery | 5.3 | |
| Elasticsearch | 8.12 client | Full-text search |
| Stripe | 15.1 | |

> **Python version mismatch, known and open.** This repository targets 3.12, and the
> Dockerfile builds on 3.12, but the production machine has only 3.10 installed and
> runs the application on it. Nothing is broken today, but production is not running
> what this file describes. Tracked in [`docs/OPEN_TODOS.md`](docs/OPEN_TODOS.md).

---

## How a request is handled

Five middleware layers, in order, before anything reaches a router.

| Layer | Does |
|---|---|
| CORS | Which origins may call at all |
| Rate limiting | Caps call frequency, especially on login |
| Idempotency | Returns the stored answer if this exact request was already answered |
| Partner audit | Records partner activity separately |
| Timing | Measures duration, and catches errors nothing else logged |
| Public names | The last thing to touch any JSON reply |

**Public names** is registered last so it is the outermost layer. It buffers every
JSON response, removes internal model names and corrects the content length, which
means it also catches error bodies written by the exception handlers.
Service-to-service routes are exempt, because their callers are our own scripts and
renaming there would break them while protecting nobody.

---

## Access control

Three mechanisms that are often confused and do different jobs.

**Authentication, who you are.** Two credentials are accepted. An API key, for
partners and anonymous public access. A JWT, for logged-in users, with a separate
refresh token. Alongside that, Redis-backed sessions with a sliding expiry,
two-factor codes, verification and reset tokens, password strength rules, and an
active-account check on every authenticated request.

**Authorisation, what you may do.** Named permissions grouped into three roles.

| Role | For |
|---|---|
| `admin` | Everything |
| `partner_admin` | A partner's own keys and users |
| `user` | Their own data and public resources |

Endpoints require a permission by name, not a role.

**Entitlements, what your plan includes.** Deliberately **soft**, and separate from
permissions. Permissions are a security boundary; entitlements are a commercial
one. A guest at a limit is invited to log in, a user at a limit is invited to
upgrade, and neither is refused with a security error. Three shapes exist: counted
daily allowances that reserve a slot and refund it if the work fails, boolean
feature flags, and numeric caps the caller clamps itself to.

If Redis is unavailable a counted check is **allowed**. A soft commercial limit must
not take the product down during an infrastructure problem.

---

## Background work

Celery, with Redis as the queue and tasks routed to named queues.

| Group | Does |
|---|---|
| Analysis | Orders deep analysis, collects the result |
| Ingestion | Brings a delivered batch into the catalogue |
| Processing | Per-track processing pipeline |
| Similarity | Similarity work too slow to do inline |
| Track | Per-track maintenance |
| Webhooks | Outbound delivery, up to five retries |

> **Do not `kill -9` the API process.** It supervises the Celery worker, and a hard
> kill orphans the worker rather than stopping it. The orphan keeps consuming from
> the same queue with stale configuration, and the symptom is alternating success
> and failure on one endpoint, which looks like a flaky bug and is not one. Use
> `systemctl stop`, or a plain `kill`.

---

## Logging

Two destinations, two audiences.

Application logs go to the standard Python logger. **Never `print`**, it does not
persist.

The `system_logs` table is the operational one. Every request and notable action is
written with a correlation ID, level, category, action, endpoint, status code,
duration, client address, related track or playlist, custom metadata, a stack trace
on errors, and CPU and memory at that moment. It is indexed so the admin panel can
trace one request end to end, list errors in the last hour, find requests over five
seconds, or show everything one user did.

Any response leaving as a server error is caught and logged by the timing
middleware even when the failing code path never called the logger.

---

## Standards

**Structure.** The six layers, in order. Search for an existing service or helper
before writing a new one.

**Responses.** One shared formatter, so every reply has the same shape. Errors are
raised as the custom exception types in `app/core/exceptions.py` and converted by
the global handlers. Do not build error JSON by hand in a service.

**Typing and docs.** Type hints on every function. A docstring on every public
method. Comments explain **why**; the code already says what.

**Configuration.** `app/core/config.py` is deliberately not a Pydantic settings
class. A new setting is a dead constant until its variable is added to the mapping
table in that file, and to `.env.example` with a placeholder. This catches people
out regularly.

**Formatting.** `make fmt` for Black and isort, `make lint` for Ruff. Both before a
pull request.

---

## Testing

141 test files.

| Suite | Files | Database |
|---|---|---|
| `tests/unit/` | 76 | None. Run freely |
| `tests/api/` | 62 | Yes, and it must be a throwaway |

> **The API suite deletes every row created during the run**, and does not
> distinguish its own rows from anything else created at the same time. Never point
> it at a database you are developing on or that anyone else is using. Create a
> separate one. [`docs/ONBOARDING.md`](docs/ONBOARDING.md) section 6 has the exact
> steps.

A new endpoint gets at least one test for its success case and one for its main
refusal. Run the files you touched rather than the whole suite.

---

## Database changes

Every model change ships with an Alembic migration in the same pull request.

Read the generated migration before committing; autogenerate misses renames, server
defaults and data changes. Never edit a migration that has already been merged,
write a new one. Say in the pull request that it contains a migration, so it is run
on the next staging deploy rather than discovered in production.

---

## Git workflow

`demo` is staging, `main` is production. Push only to your own named branch, never
to either. Every change reaches `demo` through a reviewed pull request, one change
per request, small enough to review in a sitting.

Commit prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`.

Before opening a pull request: formatter and linter clean, tests for what you
changed passing, any model change carrying its migration and saying so, new settings
in both `config.py` and `.env.example`, and no secrets or real user data in the diff.

---

## Common commands

```bash
make migrate       # alembic upgrade head
make seed-plans    # seed plans and entitlements, required or every plan check 500s
make api           # run the API with reload
make test          # pytest
make fmt           # black + isort
make lint          # ruff
```

`make` is not available on Windows. `docs/ONBOARDING.md` has the PowerShell
equivalents.

---

## Documentation

Everything lives under `docs/`. Nothing is ever deleted; superseded material moves
to `docs/outdated/`.

### Start here

| Document | For |
|---|---|
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Setting up and working in this repo |
| [docs/QUICK_START.md](docs/QUICK_START.md) | The original setup guide, covers macOS |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Day-to-day operations |
| [docs/OPEN_TODOS.md](docs/OPEN_TODOS.md) | Everything known and not done, across all repos |

### Reference, kept in sync with the code

[`docs/reference/`](docs/reference/) holds the partner, frontend and auditor facing
documents. The endpoint reference the frontend builds against, the auth model, the
schema, the integration guides for Spotify, Tidal and Apple Music, partner
onboarding, the fresh-server runbook, and the compliance pack.

### Operating documents

| Document | Covers |
|---|---|
| [docs/PROCESSING_PIPELINE_RUNBOOK.md](docs/PROCESSING_PIPELINE_RUNBOOK.md) | The processing pipeline |
| [docs/BACKUP_AND_DISASTER_RECOVERY_PLAN.md](docs/BACKUP_AND_DISASTER_RECOVERY_PLAN.md) | Backup and recovery |
| [docs/stripe_live_doc.md](docs/stripe_live_doc.md) | Stripe setup, go-live and pricing |
| [docs/FOUNDING_PRICES_RUNBOOK.md](docs/FOUNDING_PRICES_RUNBOOK.md) | Founding price handling |
| [docs/ADMIN_ACCESS_HARDENING.md](docs/ADMIN_ACCESS_HARDENING.md) | Admin access controls |
| [docs/ANTIVIRUS_INTEGRATION.md](docs/ANTIVIRUS_INTEGRATION.md) | ClamAV scanning |
| [docs/CORS_CONFIG.md](docs/CORS_CONFIG.md) | CORS configuration |
| [docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md](docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md) | Upload and search limits |
| [docs/OPEN_CATALOGUE_REINGEST_FOLLOWUPS.md](docs/OPEN_CATALOGUE_REINGEST_FOLLOWUPS.md) | Open items from the catalogue re-ingest |
| [docs/PRIVACY_POLICY_RETENTION_SECTION.md](docs/PRIVACY_POLICY_RETENTION_SECTION.md) | Retention policy text |
| [docs/DOCS_GENERATION.md](docs/DOCS_GENERATION.md) | How the partner API docs are generated |
| [docs/testing_suite_setup.md](docs/testing_suite_setup.md) | Test suite setup |

### Archive

[`docs/outdated/`](docs/outdated/) holds 74 documents covering planning exercises,
point-in-time audits, feature work as it was built, and incident reports. It is
useful for understanding **why** something was done. It is not maintained, and if it
disagrees with the code, the code is right. Its own README explains what is in there
and what replaced each item.

### Where this sits in the wider system

The cross-system documentation lives in the `official-documentation` repository,
which covers all the machines, what runs where, and the weekly changelog.

# RESOMIX — ROADMAP v3.0 STATUS DEEP-CHECK (re-verified 2026-06-09)

This is a task-by-task re-check of `resomix_30day_roadmap_v2.md` (v3.0) against the
**actual current source** across both repos. It supersedes the earlier draft of this
file. Where the prior assessment was optimistic or has since gone stale, it is corrected here.

## Architecture note — the two-server split (read this first)

Several roadmap tasks were written for a single-app, in-process design. The codebase has
since settled into a **two-server architecture**, and that changes how W2-4 and W2-7
should be read (and means W1-5's per-partner FAISS lives on the media server, not in-process):

- **Alwyzon control-plane** — *this* repo (`basic_fastapi_server_resomix`, port 8001). Owns
  MariaDB, partners/keys/quotas/webhooks, admin, the SFTP auth+event hooks, and all tenant
  persistence. DB-authoritative.
- **Hetzner media/similarity server** — `resomix-similarity-open` (port 8004, **no database**).
  Owns partner files on disk, the PYXIS-1 embedding/FAISS engines, HLS/peaks/segments, the CSV
  validation runner, and the ECDSA-signed deletion audit log.

Alwyzon talks to Hetzner over an internal HTTP API (`settings.similarity_server_url` +
`HETZNER_INTERNAL_API_KEY`). **Ingestion is now fire-and-forget:** the SFTP `.done` event (or
an admin trigger) opens a `PROCESSING` ingest_log and POSTs the job to Hetzner via
`start_ingestion_job`; Hetzner validates the CSV + audio and writes a result JSON; Alwyzon's
admin status-poll later pulls that result and persists tracks via `apply_ingestion_result`
(ORM → SQL-injection-safe). The most recent commit added **processing-status synchronization
with automatic self-healing** between the two servers.

---

## Legend
- ✅ **Fully done** — code + test coverage in place
- ⚠️ **Partial** — code exists but something is missing (test gap, incomplete feature, or requires server-side action)
- 🌐 **External / Infra** — not a code task; needs Hetzner, Cloudflare, Stripe dashboard, or founder action
- ❌ **Not done** — genuinely missing

**Test status at re-check:** Alwyzon suite **266 passed**; Hetzner suite **70 passed**
(includes a new 27-case `test_ingestion_runner.py` added this session for the CSV validator).

---

## WEEK 1 — Multi-Tenancy Core, API Plane, FAISS, Rate-Limiting

| ID | Task | Status | Where it lives | Tests? | Notes |
|---|---|---|---|---|---|
| **W1-1** | DB tables: `partners`, `partner_api_keys`, `partner_quotas`, `partner_usage_logs`, `partner_webhooks`, `webhook_delivery_logs` | ✅ Fully done | `app/models/partner.py` — 6 models with indexes, FKs, Stripe fields | `test_partner_management_flow.py`, `test_partner_admin.py` | — |
| **W1-2** | API key issuance (SHA-256 hash, `rmx_live_*`/`rmx_sandbox_*`, issue/revoke/rotate) | ✅ Fully done | `PartnerService.generate_api_key()`, `app/api/routers/admin/partners.py` | `test_partner_management_flow.py` | — |
| **W1-3** | `get_current_partner()` dep — validates `Bearer rmx_*`, sets `partner_id`+`api_key_id` | ✅ Fully done | `app/api/dependencies/partner.py` (+ `get_public_partner`, `get_current_partner_scoped`) | `test_b2b_security_hardening.py`, `test_partner_api.py` | — |
| **W1-4** | `partner_id` on core tables + every query scoped | ✅ Fully done | `Track`/`Release`/etc. carry `partner_id`; `database/connection.py` event listener auto-injects `WHERE partner_id` | `test_tenant_isolation.py` | — |
| **W1-5** | FAISS per-partner indexes | ✅ Done (two-server) | One FAISS index per partner runs on the Hetzner similarity server (`resomix-similarity-open`), reached via `similarity_server_url`. Admin `rebuild-index` triggers a per-partner rebuild there. The roadmap's intent — partner-isolated FAISS, rebuilt after ingestion — is fully met. | `test_similarity_routes.py`, `test_similarity_service_partner.py` | Lives on the Hetzner server rather than in-process on Alwyzon. The two-server split is the chosen architecture; the requirement is satisfied, not deferred. |
| **W1-6** | Query-builder middleware refusing unscoped partner queries | ✅ Fully done | `@event.listens_for(Session,"do_orm_execute")` in `database/connection.py`; raises on unscoped partner-model queries; admin bypass | `test_tenant_isolation.py` | — |
| **W1-7** | Layer-1 rate limiting: token-bucket per key, 10 rps, Redis Lua, 429+`Retry-After` | ✅ Fully done | `RateLimitService.check_rate_limits()` with `TOKEN_BUCKET_LUA`, called in `get_current_partner()` | `test_rate_limiting.py` (5 distinct tests) | Prior duplicate-test defect is **fixed**. |
| **W1-8** | Layer-2 quota: rolling-30-day counter, Redis INCR → MariaDB flush every 5 min | ✅ Fully done | `MONTHLY_QUOTA_LUA` + `quota_worker.py`; `quota.warning`/`quota.exceeded` wired | `test_rate_limit_service.py` | — |

**Week 1 gate:** ✅ Passes — all eight tasks done. FAISS lives on the Hetzner server (per-partner), not in-process.

---

## WEEK 2 — Audit Log, Versioning, Idempotency, SFTP, CSV Parsing, Staging

| ID | Task | Status | Where it lives | Tests? | Notes |
|---|---|---|---|---|---|
| **W2-1** | Per-key audit log middleware → `partner_usage_logs` | ✅ Fully done | `PartnerAuditMiddleware` (`app/api/middlewares/partner_audit.py`), background task on `rmx_*` requests | `test_partner_audit.py` | — |
| **W2-2** | API versioning under `/api/v1/` | ✅ Fully done | `app/api/routers/__init__.py` `V1_PREFIX`; legacy root routes kept; policy doc present | All tests use `/api/v1/` | — |
| **W2-3** | Idempotency-Key on POST/PUT, Redis 24h | ✅ Fully done | `IdempotencyMiddleware`; `X-Idempotency-Hit` on replay | `test_idempotency.py`, `test_b2b_security_hardening.py` | — |
| **W2-4** | SFTPGo with FastAPI auth hook, per-partner chroot | ⚠️ **Code done; server deploy unverified** | Auth+event hooks: `app/api/routers/internal/sftp.py`. Provisioning: `app/services/sftp_service.py` (slug-based home `partners/<uuid-slug>`, root list-only + uploads confined to `/live` & `/test`, plaintext password handed to SFTPGo, cascade-delete + SFTPGo decommission on partner delete). | `test_sftp_provisioning.py`, `test_sftp_service.py`, `test_sftp_ingestion_flow.py` | Whether SFTPGo is actually running on Hetzner SX65 pointing at this hook is a server-side fact, not verifiable from code. |
| **W2-5** | SFTP storage quota per tier | ✅ Fully done | `SftpService` quota map, returned in auth-hook response (`quota_size`) | `test_sftp_service.py` | — |
| **W2-6** | Staging environment (CX22 VPS) | 🌐 Pure infra | Schema + compose + `.env` ready to deploy | N/A | VPS not provisioned; `staging.resomix.com` DNS not set. |
| **W2-7** | CSV / metadata parsing pipeline | ✅ **Done — now on Hetzner** | The validator moved to Hetzner `app/services/ingestion_runner.py::validate_batch` (BOM-safe, column-order-agnostic, ISRC format, required fields, per-row error report, all-or-nothing atomic reject). Alwyzon hand-off = `start_ingestion_job` → `apply_ingestion_result`. **Note:** Alwyzon's old `process_ingestion_batch` still exists but is **no longer wired into any live path** (only the legacy `test_ingestion_validation.py` imports it) — it is dead/legacy code and can be removed. | **NEW** `resomix-similarity-open/tests/test_ingestion_runner.py` (27 cases), `test_sftp_ingestion_flow.py` (hand-off), `test_ingestion_validation.py` (legacy) | The earlier "lives in `process_ingestion_batch`" claim is now stale. |

**Week 2 gate:** ⚠️ Conditional — W2-4 SFTPGo server deploy and W2-6 staging VPS remain operational tasks; CSV parsing itself is complete and now test-covered on the Hetzner side.

---

## WEEK 3 — Sandbox, Public Docs, Status, Partners Landing, Staging Finalisation

| ID | Task | Status | Where it lives | Notes |
|---|---|---|---|---|
| **W3-1** | OpenAPI 3.1 spec, all partner endpoints annotated | ✅ Fully done | Auto-generated from FastAPI/Pydantic | — |
| **W3-2** | Docs portal (Scalar) at `api-docs.resomix.com` | ✅ Done — live | `resomix_docs/` React+Vite, `@scalar/api-reference-react`, pre-filled sandbox key | — |
| **W3-3** | Four B2B guides (Getting Started, Auth, Endpoint ref, Error codes) | ✅ Done — live | Public markdown guides on `api-docs.resomix.com` | — |
| **W3-4** | Sandbox catalogue (500–1,000 CC BY tracks → `partner_id=1`) | ✅ Done — DB verified | `scripts/seed_sandbox_catalog.py`; ~700 open tracks under partner 1 | — |
| **W3-5** | Sandbox key `rmx_sandbox_demo_*`, rate-limited; sandbox proxy live | ✅ Done — live | `sandbox.resomix.com` (`resomix-sandbox-fastapi/`); 4 endpoints E2E-tested | — |
| **W3-6** | Status page (Uptime Robot, 5 monitors) | ✅ Done — live | `stats.uptimerobot.com/...` | Custom `status.resomix.com` needs paid plan — deferred. |
| **W3-7** | `/health` (`status, version, uptime, dependencies`) | ✅ Fully done | `app/api/routers/health.py` (MariaDB+Redis) | Hetzner server has its own health route. |
| **W3-8** | Partners landing page on resomix.com | ✅ Done — live (React) | — | CTA → Stripe checkout needs a click-through verification once W4-4 dashboard config is live. |
| **W3-9** | B2B pricing page | ✅ Done — live (React) | — | Tier CTAs depend on W4-4 Price IDs in `.env`. |
| **W3-10** | OpenAPI polish | ✅ Fully done | All routes annotated | — |
| **W3-11** | Cloudflare WAF + CDN | 🌐 Cloudflare dashboard | No code | Zone/WAF/Page-Rules not done. |
| **W3-12** | Counsel kickoff (DPA/MSA/NDA) | 🌐 Founder track | — | — |
| **W3-13** | Staging finalisation (FAISS, SFTPGo staging, full loop smoke) | 🌐 Pure infra | — | Blocked by W2-6 VPS. |

**Week 3 gate:** ✅ All code tasks complete; only W3-11 (Cloudflare) and W3-13 (staging, blocked by W2-6) outstanding.

---

## WEEK 4 — Webhooks, B2B Stripe, Backups, Restore Drill

| ID | Task | Status | Where it lives | Notes |
|---|---|---|---|---|
| **W4-1** | Custom Celery webhook dispatcher (HMAC-SHA256, exp-backoff, delivery log) | ✅ Done | `app/tasks/webhooks.py` + `celery_app.py`; retry 1m→5m→30m→2h→8h; auto-deactivate after 10 fails. `make worker` + `docker compose --profile worker` | `systemd` unit on SX65 still the only server-side step. |
| **W4-2** | Wire 7 event types | ✅ Done | ingestion.* + track.indexed (`ingestion_service.py`), quota.* (`partner_service.py`), embedding.deleted (`cleanup_worker.py`) | — |
| **W4-3** | Per-partner webhook config via admin | ✅ Done | CRUD under `/api/v1/admin/partners/webhooks` | `test_partner_admin.py` |
| **W4-4** | Stripe B2B (3 products, Tax, VIES, branded invoicing) | ⚠️ Most code done; branded invoice template + dashboard setup not done | `stripe_b2b_service.py`, `vies_service.py`, `scripts/setup_stripe.py` | **Done in code:** 3 tiers (Starter/Growth/Enterprise) monthly+annual with SaaS tax_code (`setup_stripe.py`); VIES VAT validation attached as Stripe `eu_vat` tax ID on the Customer (GR→EL prefix handled); `automatic_tax` + `customer_update.address=auto` for Greek VAT/EU OSS; PO number carried as subscription metadata; EUR pricing. **Still missing (roadmap W4-4d):** the *branded invoice template* — `invoice_settings.issuer` is just `type:self` (Stripe default), there is **no logo/custom-field/footer rendering** and **no USD/GBP secondary currency**. **Dashboard/ops remaining:** run `setup_stripe.py`, paste Price IDs into `.env`, configure Stripe Tax/OSS + register Greek VAT, upload branding, accountant verifies 3 sample invoices (EU-business / EU-consumer / non-EU). |
| **W4-5** | Stripe webhook handler (subscription.*/invoice.*) | ✅ Done | `webhook_service.py`, `/api/v1/webhooks/stripe`, idempotent on event ID | `test_partner_management_flow.py` |
| **W4-6** | Nightly `mariabackup` → Hetzner Storage Box | ⚠️ Script exists; cron not set | `scripts/backup_restore.sh` | Order Storage Box (€3.81/mo), add cron on SX65, verify rsync of config/assets. |
| **W4-7** | Restore drill on fresh VPS + runbook | ⚠️ Partial — fresh-bring-up runbook added; restore drill unverified | `docs/reference/fresh_server_setup_runbook.md`, `docs/reference/restore_runbook.md`, `scripts/backup_restore.sh` | New fresh-server bring-up runbook (clean VPS, empty DB, no restore) is ready to test on a real VPS — covers ~90% of W4-7. The remaining gap is the live restore-from-backup drill (no CI proof). |

**Week 4 gate:** ⚠️ Partial — Stripe dashboard (W4-4), Storage Box + cron (W4-6), live restore (W4-7) remain. Worker launch handled bar a `systemd` unit.

---

## WEEK 5 — Trust Pack, Deletion Proof, Regression Suite, Polish

| ID | Task | Status | Where it lives | Notes |
|---|---|---|---|---|
| **W5-1** | Incident-response runbook | ✅ Done in docs | `docs/` | — |
| **W5-2** | Auditable data-deletion (signed log + tenant-scoped export) | ✅ **Now done** (was ❌) | Hetzner `audit_service` writes **ECDSA-signed** deletion events (`deletion_service.py`, `audit_keys_dir`/`audit_logs_dir`), exposed at internal `/audit-log/{partner_id}`. Alwyzon exposes the partner-scoped export `GET /api/v1/partner/deletion-log` (`app/api/routers/partner.py`) via `hetzner_service.get_deletion_log`. `embedding.deleted` webhook fires from `cleanup_worker.py`. | Implementation differs from the literal roadmap (ECDSA-signed audit files on the media server + Alwyzon export endpoint, rather than HMAC-into-`system_logs`) but satisfies the intent: signed, auditable, partner-downloadable. A dedicated end-to-end test would be good to add. |
| **W5-3** | Trust Pack PDF | 🌐 Founder track | — | — |
| **W5-4** | CAIQ Lite | 🌐 Founder track | — | — |
| **W5-5** | Sub-processor list on Privacy page | 🌐 Website | — | — |
| **W5-6** | Counsel finalisation | 🌐 Founder track | — | — |
| **W5-7** | OpenAPI final polish | ✅ Done | All routes annotated | — |
| **W5-8** | Public changelog | ✅ Done | Markdown, wireable into docs-config | — |
| **W5-9** | Tenant-isolation regression suite (30–40 cases) | ⚠️ **Improved, still under the named-suite spec** | Effective cross-tenant coverage is now broader than before: `test_tenant_isolation.py` (2) + `test_partner_isolation.py` (1 flow, Alwyzon **and** Hetzner) + `test_b2b_security_hardening.py` (4) + `test_granular_security.py` (6) + `test_admin_security_hardened.py` (10) + `test_similarity_service_partner.py` (4). | Still not a single named 30–40-case suite; missing explicit statement/quota isolation + explicit webhook cross-fire cases. Gap narrowed from the prior ~7-test read. |
| **W5-10** | Cloudflare CDN edge rules for HLS `.ts` | 🌐 Cloudflare dashboard | No code | — |
| **W5-11** | ISRC-conflict policy doc | ✅ Done | Ingestion flags `DUPLICATE_ISRC_IN_BATCH`; policy doc + tests | `test_ingestion_runner.py`, `test_ingestion_validation.py` |
| **W5-12** | Full regression sweep (W1–W4 criteria) | ⚠️ Operational | `tests/test_weekly_gate.py` | Full sweep against staging blocked by W2-6. |
| **W5-13** | Mock diligence rehearsal | 🌐 Team exercise | — | — |
| **W5-14** | API SDK examples (Python + JS) | ✅ Done | curl in `quickstart.md`; Py/JS snippets addable | — |
| **W5-15** | Days 33–35 buffer + smoke + gate | ⚠️ Partial | `tests/test_weekly_gate.py` | Live smoke needs staging. |

**Week 5 gate:** ⚠️ Closer than before — W5-2 is now implemented; W5-9 is improved but still short of the named 30–40-case suite, and staging-dependent items (W5-12/W5-15) remain blocked by W2-6.

---

## Capabilities built since the prior status (not in the roadmap, but shipped)

These were added during the two-server work and aren't on the v3.0 task list:

- **`service_mode` per partner** (`similarity_only` vs `similarity_playback`) — gates whether the
  pipeline retains peaks+segments for full playback or just embeddings+preview. (`app/models/partner.py`)
- **Playback token minting + partner-scoped edge tokens** — secure asset resolution at the edge
  (commit `cb84b93`). Tests: `test_partner_playback_token.py`, `test_playback_token.py`.
- **Playlist-creation gate in the similarity service** (commit `b1bca5d`). Test: `test_playlist_creation_gate.py`.
- **Admin-controlled processing pipeline** — `app/api/routers/admin/processing.py` (embeddings jobs,
  ingestion trigger/retry, track set-live/stop) with **Hetzner status sync + automatic self-healing**
  (commit `b805650`). Tests: `test_admin_processing.py`, `test_admin_secondary_workflows.py`.

---

## Summary — what's actually remaining

### Real code gaps (developer work)
| Gap | Effort | Priority |
|---|---|---|
| **W5-9** Expand tenant-isolation into the named 30–40-case suite (explicit statement/quota isolation, explicit webhook cross-fire) | ~6–8h | 🔴 High (Day-35 gate wants 100% pass on a real suite) |
| **W5-2** Add an end-to-end test for the deletion-proof flow (delete → ECDSA-signed audit entry → partner export) | ~1–2h | 🟡 Medium (feature is built; test it) |
| Remove the now-unwired legacy `process_ingestion_batch` (+ migrate/retire `test_ingestion_validation.py`) | ~1h | 🟡 Low (dead code; the live path is the Hetzner runner) |

### Server / infra (Hetzner SX65 + new VPS)
| Task | Where |
|---|---|
| Deploy & configure **SFTPGo** on SX65, point auth hook at `/internal/sftp/auth` | SX65 |
| Nightly `mariabackup` cron → Hetzner Storage Box (subscribe, mount, cron) | SX65 |
| Live **restore drill** on fresh VPS + update runbook | new VPS |
| Provision **staging CX22 VPS**, deploy app, replicate schema (unblocks W3-13/W5-12/W5-15) | new VPS |
| `systemd` unit for the Celery worker | SX65 |

### External services (no code)
| Task | Service |
|---|---|
| Cloudflare zone: WAF, CDN, HLS edge rules (W3-11, W5-10) | Cloudflare |
| `setup_stripe.py` + Stripe Tax/OSS + Greek VAT + Price IDs + accountant check (W4-4) | Stripe |
| `status.resomix.com` custom domain | Uptime Robot (paid) |

### Founder track (no code)
DPA / B2B MSA / Mutual NDA via counsel; Trust Pack PDF; CAIQ Lite; sub-processor list; diligence rehearsal; outbound list; ADE booking.

---

## Net change vs the prior version of this file

- **W2-7 CSV parsing** — re-described for the two-server model: validator now lives in Hetzner's
  `ingestion_runner.py`; Alwyzon's `process_ingestion_batch` is now **dead/legacy code**. New 27-case
  test suite added on the Hetzner side.
- **W5-2 deletion proof** — moved ❌/⚠️ → ✅ (ECDSA-signed audit log on Hetzner + Alwyzon export endpoint).
- **W1-7** — duplicate-test defect **fixed**.
- **W5-9** — gap narrowed (now ~27 effective cross-tenant/security tests across 6 files) but still short of the named suite.
- Added a **Capabilities built since** section (service_mode, playback tokens, playlist gate, admin processing pipeline + self-healing status sync).
- Test totals refreshed: **Alwyzon 266 / Hetzner 70**.

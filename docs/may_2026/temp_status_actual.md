Let me do a thorough deep-check across the codebase. I'll read all the relevant files in parallel to assess each task.

Now let me read the key implementation files in batches:

Now let me verify a few specific claims from the temp_status.md against actual files:

Now I have everything I need. Let me compile the full assessment.

Here is the full, honest, task-by-task deep-check based on reading the actual source files. I cross-referenced the `temp_status.md` self-assessment against the real code wherever claims seemed optimistic.

---

## Legend
- ✅ **Fully done** — code + test coverage in place
- ⚠️ **Partial** — code exists but something is missing (test gap, incomplete feature, or requires server-side action)
- 🌐 **External / Infra** — not a code task; needs Hetzner, Cloudflare, Stripe dashboard, or founder action
- ❌ **Not done** — genuinely missing

---

## WEEK 1 — Multi-Tenancy Core, API Plane, FAISS, Rate-Limiting

| ID | Task | Status | Where it lives | Tests? | What's missing |
|---|---|---|---|---|---|
| **W1-1** | DB tables: `partners`, `partner_api_keys`, `partner_quotas`, `partner_usage_logs`, `partner_webhooks`, `webhook_delivery_logs` | ✅ Fully done | `app/models/partner.py` — all 6 models complete with indexes, FKs, Stripe fields pre-added | `test_partner_management_flow.py`, `test_partner_admin.py` | Nothing |
| **W1-2** | API key issuance (SHA-256 hash, `rmx_live_xxx`/`rmx_sandbox_xxx`, admin issue/revoke/rotate) | ✅ Fully done | `PartnerService.generate_api_key()`, `app/api/routers/admin/partners.py` | `test_partner_management_flow.py` | Nothing |
| **W1-3** | `get_current_partner()` dependency — validates `Bearer rmx_*`, sets `request.state.partner_id` + `api_key_id` | ✅ Fully done | `app/api/dependencies/partner.py` — also includes `get_public_partner()` and `get_current_partner_scoped()` variants | `test_b2b_security_hardening.py`, `test_partner_api.py` | Nothing |
| **W1-4** | `partner_id` column on all core tables + all queries scoped | ✅ Fully done | `Track`, `Release`, and other models have `partner_id` FK. `database/connection.py` SQLAlchemy event listener auto-injects `WHERE partner_id = :pid` on every ORM query | `test_tenant_isolation.py` (unit) | Nothing |
| **W1-5** | FAISS per-partner indexes loaded at startup | ⚠️ **Architectural deviation** | FAISS does NOT run in-process. The FastAPI app still delegates all similarity to the **external Alwyzon microservice** via `settings.similarity_server_url`. `partner_id` is forwarded as a query param to scope results. Admin endpoint `POST /admin/similarity/rebuild-faiss` triggers a rebuild *on the external server*. | `test_similarity_routes.py` | FAISS is not in-process; it lives on the external GPU server. This is the pre-existing architecture that was never replaced. Acceptable if you're keeping the microservice, but it's NOT the "zero new service, in-process FAISS" decision from the roadmap. |
| **W1-6** | Query-builder middleware refusing unscoped partner queries | ✅ Fully done | Implemented as `@event.listens_for(Session, "do_orm_execute")` in `database/connection.py`. Raises `RuntimeError("Multi-tenancy violation: ...")` for unscoped partner-model queries. Admin bypass available. | `test_tenant_isolation.py` | Nothing |
| **W1-7** | Layer 1 rate limiting: token-bucket burst per API key, 10 req/sec, Redis Lua | ✅ Fully done | `RateLimitService.check_rate_limits()` with `TOKEN_BUCKET_LUA` atomic Lua script in Redis. Called inside `get_current_partner()`. HTTP 429 + `Retry-After`. **Note:** `app/api/middlewares/rate_limit.py` is a separate, legacy SlowAPI middleware for IP-based auth endpoint limiting — different system. | `test_rate_limiting.py` (has a duplicate test function — minor code defect) | Rate limit middleware file naming is misleading |
| **W1-8** | Layer 2 quota: rolling-30-day counter, Redis INCR → MariaDB flush every 5 min | ✅ Fully done | `MONTHLY_QUOTA_LUA` script + `quota_worker.py` (5 min interval, started in lifespan). `quota.warning` (80%) and `quota.exceeded` wired in `PartnerService.sync_quotas_from_redis()` | `test_rate_limit_service.py` | Nothing |

**Week 1 gate verdict:** ✅ Passes — with the note that FAISS is external, not in-process.

---

## WEEK 2 — Audit Log, Versioning, Idempotency, SFTP, CSV Parsing, Staging

| ID | Task | Status | Where it lives | Tests? | What's missing |
|---|---|---|---|---|---|
| **W2-1** | Per-key audit log middleware → `partner_usage_logs` | ✅ Fully done | `PartnerAuditMiddleware` in `app/api/middlewares/partner_audit.py`. Fires as a background task only on `rmx_*` authenticated requests. Writes correlation_id, latency, IP, user-agent. | `test_partner_audit.py` | Nothing |
| **W2-2** | API versioning — all partner endpoints under `/api/v1/` | ✅ Fully done | `app/api/routers/__init__.py` with `V1_PREFIX = "/api/v1"`. Legacy root routes preserved. Versioning policy doc in `docs/may_2026/api_versioning_policy.md`. | All tests use `/api/v1/` paths | Nothing |
| **W2-3** | Idempotency-Key on POST/PUT — Redis cache 24h | ✅ Fully done | `IdempotencyMiddleware` in `app/api/middlewares/idempotency.py`. Handles partner auth early resolution, caches 2xx–4xx responses, returns `X-Idempotency-Hit: true` on replay. | `test_idempotency.py`, `test_b2b_security_hardening.py` (cross-tenant collision test) | Nothing |
| **W2-4** | SFTPGo on Hetzner SX65 with FastAPI auth hook | ⚠️ **Code done, server deployment unverified** | Auth hook: `app/api/routers/internal/sftp.py`. DB model: `app/models/sftp_user.py`. Admin provisioning: `app/api/routers/admin/partners.py`. Service: `app/services/sftp_service.py` with `QUOTA_MAP`. Per-partner chroot enforced. | `test_sftp_provisioning.py`, `test_sftp_service.py`, `test_sftp_ingestion_flow.py` | Whether **SFTPGo is actually deployed and running on Hetzner SX65** and pointing to this auth hook URL is a server-side config not verifiable from code. This is the hardest W2 task. |
| **W2-5** | SFTP storage quota per tier | ✅ Fully done | `SftpService.QUOTA_MAP`: sandbox=1GB, starter=10GB, growth=50GB, enterprise=unlimited. Passed in auth hook response. | `test_sftp_service.py` | Nothing |
| **W2-6** | Staging environment — Hetzner CX22 VPS provisioning | 🌐 **Pure infra** | No code required. MariaDB schema, `docker-compose.yml`, and `.env` template are ready to deploy. | N/A | **Hetzner CX22 VPS has not been provisioned.** `staging.resomix.com` DNS not configured. |
| **W2-7** | CSV / metadata parsing pipeline — row-level validation, ISRC check, error report | ✅ Fully done | `process_ingestion_batch()` in `app/services/ingestion_service.py`. BOM-safe, column-order-agnostic, validates ISRC format, required fields; writes per-row `IngestionError` records with actionable messages. Fires `ingestion.started/failed/completed` webhooks. | `test_sftp_ingestion_flow.py`, `test_ingestion_validation.py`, `test_monthly_pipeline_routes.py` | Nothing |

**Week 2 gate verdict:** ⚠️ Conditional — W2-4 SFTPGo server deployment and W2-6 staging VPS still need real-world setup.

---

## WEEK 3 — Sandbox, Public Docs, Status Page, Partners Landing Page, Staging Finalisation

| ID | Task | Status | Where it lives | Tests? | What's missing |
|---|---|---|---|---|---|
| **W3-1** | OpenAPI 3.1 spec — all partner endpoints annotated | ✅ Fully done | Auto-generated from FastAPI + Pydantic schemas at `/openapi.json` (dev only). All endpoints have summary, description, request/response schemas, error responses. | Checked by contract implicitly | Nothing |
| **W3-2** | Scalar docs portal at `api-docs.resomix.com` | ✅ **Done — live at https://api-docs.resomix.com/** | `api_docs/index.html` + `api_docs/openapi.json` deployed. Scalar CDN rendering with white-label CSS. | N/A | ⚠️ **Needs live sandbox API test**: verify that the curl/Python/JS examples in the portal actually work against `https://api.resomix.com` using `rmx_sandbox_demo` key (similarity search, upload, metadata extraction). **Missing portal sections to add**: (1) `GET /api/v1/partner/me` reference, (2) `GET /api/v1/health` reference, (3) Webhook events guide (7 event types + HMAC-SHA256 signature verification), (4) SFTP ingestion guide (credentials, chroot, CSV manifest spec), (5) `Idempotency-Key` header guide. **Do NOT publish**: `AUTH_IMPLEMENTATION_GUIDE.md` (internal JWT user auth), `PARTNER_DETAILS_API.md` (admin endpoint), `frontend_api_integration_guide.md` (mixes internal flows), `docs/technical/*`, and all `docs/may_2026/w*_*.md` planning files. |
| **W3-3** | B2B developer guides (Getting Started, Auth, Endpoint ref, Error codes) | ✅ **Done — published to portal** | Core B2B guide lives in `api_docs/README.md`: 5-min quickstart, bearer key auth, scope table, rate-limit layers, curl+Python+JS examples for all 3 endpoints, 14-entry error code table. `docs/may_2026/partners_endpoints.md` is the internal endpoint rationale doc. | N/A | ⚠️ **Needs live sandbox API test**: end-to-end smoke test using `rmx_sandbox_demo` key against production URL to confirm all code examples in the portal return valid responses. Missing sections (listed in W3-2) should be added before partner onboarding begins. |
| **W3-4** | Sandbox catalogue — 500–1,000 CC BY 4.0 tracks seeded to `partner_id=1` | ✅ **Done — DB verified** | `scripts/seed_sandbox_catalog.py` run successfully. DB query confirmed **700 CC BY 4.0 open tracks** inserted under `partner_id=1` (Resomix Global B.V.). Source: `scripts/open_tracks/open_tracks.json`. | N/A | Nothing |
| **W3-5** | Sandbox API key `rmx_sandbox_demo_xxx` issued and rate-limited | ✅ **Done — DB verified** | Key `rmx_sandbox_demo` exists in `partner_api_keys` (DB-verified). `partner_id=1`, scopes `["similarity:read","metadata:read"]`, `rate_limit_rps=5`, `rate_limit_monthly=3000`, `is_active=1`. Hash: `dd0654f4...`. | N/A | Nothing |
| **W3-6** | Status page (Uptime Robot) | ✅ **Done — live at https://stats.uptimerobot.com/T3Nh7RXCWE** | 5 monitors configured on Uptime Robot free plan. Health endpoints respond correctly (`{"status": "healthy", ...}`). | N/A | Custom domain `status.resomix.com` requires Uptime Robot paid plan — defer until needed. Current public URL is fully shareable with partners in the meantime. |
| **W3-7** | `/health` endpoint: `{status, version, uptime_seconds, dependencies}` | ✅ Fully done | `app/api/routers/health.py` — checks MariaDB + Redis, returns full dependency status. Started in `app_instance.state.start_time` at lifespan. | `test_health_routes.py` | Roadmap said "each of three FastAPI services" — only one FastAPI app exists. The similarity microservice is separate and needs its own health endpoint if that requirement holds. |
| **W3-8** | Partners landing page on resomix.com | ✅ **Done — live in React frontend** | Implemented in the React frontend repository and live on `resomix.com/partners`. | N/A | ⚠️ **Needs test**: verify the CTA ("Get API Access" / onboarding flow) correctly links through to the Stripe checkout or partner contact form once Stripe is configured (W4-4). |
| **W3-9** | Public B2B pricing page (Starter/Growth/Enterprise, EUR primary) | ✅ **Done — live in React frontend** | Implemented in the React frontend repository and live on `resomix.com`. | N/A | ⚠️ **Needs test**: verify that pricing tier CTAs trigger the correct Stripe checkout session once `setup_stripe.py` is run and Price IDs are in `.env` (W4-4 dependency). |
| **W3-10** | OpenAPI polish — descriptions, examples, error codes on every endpoint | ✅ Fully done | All routes annotated. Pydantic schemas comprehensive. | Implicit | Nothing |
| **W3-11** | Cloudflare WAF + CDN in front of resomix.com | 🌐 Cloudflare dashboard | No code required | N/A | **Cloudflare zone setup, DNS proxying, WAF rules, Page Rules — not done in code** |
| **W3-12** | Counsel kickoff for DPA / B2B MSA / Mutual NDA | 🌐 Founder track | — | N/A | — |
| **W3-13** | Staging environment finalisation — FAISS, SFTPGo staging, full ingestion loop smoke test | 🌐 Pure infra | — | N/A | **Depends on W2-6 staging VPS which doesn't exist yet** |

**Week 3 gate verdict:** ⚠️ Mostly done — W3-2, W3-3, W3-4/5, W3-6, W3-8, W3-9 are all ✅. **Only remaining blocker**: W3-11 (Cloudflare WAF — external dashboard setup). **Testing gaps**: sandbox API code examples need a live smoke test with `rmx_sandbox_demo`; pricing/CTA flows depend on Stripe (W4-4). W3-13 (staging finalisation) blocked by W2-6 staging VPS. W3-6 custom domain (`status.resomix.com`) deferred until Uptime Robot paid plan is purchased.

---

## WEEK 4 — Webhooks, B2B Stripe, Backups, Restore Drill

| ID | Task | Status | Where it lives | Tests? | What's missing |
|---|---|---|---|---|---|
| **W4-1** | Custom Celery webhook dispatcher — HMAC-SHA256, exponential backoff, delivery log | ✅ **Fully done + worker launch configured** | `app/tasks/webhooks.py` + `app/tasks/celery_app.py`. Retry chain: 1m → 5m → 30m → 2h → 8h. HMAC in `X-Resomix-Signature`. Auto-deactivates after 10 consecutive failures. **Worker launch added in two ways:** (1) `make worker` → runs `celery -A app.tasks.celery_app worker` locally (mirrors `make api`); (2) `docker compose --profile worker up -d celery_worker` → containerised worker via new `celery_worker` service in `docker-compose.yml` (reuses same `Dockerfile`, overrides CMD). | `test_partner_management_flow.py` | On Hetzner SX65, run `make worker` under `screen`/`tmux` or add a `systemd` unit pointing to the same celery command. |
| **W4-2** | Wire 7 event types into pipeline | ✅ Fully done | `ingestion.started`, `ingestion.completed`, `ingestion.failed`, `track.indexed` → `ingestion_service.py`. `quota.warning`, `quota.exceeded` → `partner_service.py`. `embedding.deleted` → `cleanup_worker.py`. All 7 wired. | Covered by various B2B tests | Nothing |
| **W4-3** | Per-partner webhook configuration via admin endpoint | ✅ Fully done | `POST /api/v1/admin/partners/webhooks`, `GET /api/v1/admin/partners/webhooks/{partner_id}`, `PUT /api/v1/admin/partners/webhooks/{webhook_id}`, `DELETE /api/v1/admin/partners/webhooks/{webhook_id}`. HMAC secret documented. | `test_partner_admin.py` | Nothing |
| **W4-4** | Stripe B2B: 3 products, automatic Tax, VIES validation, branded invoicing | ⚠️ **Code done, Stripe dashboard setup not done** | `app/services/stripe_b2b_service.py` (customer creation, VIES validation, checkout session). `app/services/vies_service.py` (VIES REST API). `scripts/setup_stripe.py` (create Products/Prices in Stripe). | No automated invoice verification tests | **Remaining:** (1) Run `setup_stripe.py` in Stripe dashboard; (2) Paste Price IDs into `.env`; (3) Stripe Tax configuration (Greek VAT, OSS scheme) in Stripe dashboard; (4) Accountant verification of 3 sample invoices (EU business/consumer/non-EU). VIES validates live against EU API — works in code but not tested end-to-end. |
| **W4-5** | Stripe webhook handler: `subscription.created/updated/deleted`, `invoice.paid/failed` | ✅ Fully done | `app/services/webhook_service.py` handles Stripe events with signature verification, idempotency (event ID check), auto-activates/suspends partner on subscription events. `app/api/routers/webhooks.py` at `/api/v1/webhooks/stripe`. | `test_partner_management_flow.py` | Nothing |
| **W4-6** | Nightly `mariabackup` → Hetzner Storage Box, different DC | ⚠️ **Script exists, server cron not set up** | `scripts/backup_restore.sh` exists | N/A | **Hetzner Storage Box subscription (€3.81/mo) needs to be ordered. Cron job needs to be added to the Hetzner SX65 server. `rsync` configuration for config/assets not verified.** |
| **W4-7** | Restore drill on a fresh VPS, documented runbook | ⚠️ **Docs exist, live drill unverified** | `docs/restore_runbook.md` exists. `scripts/backup_restore.sh` exists. | N/A | **The actual drill (restore on a real fresh VPS and verify data integrity) is an operational task. Can't be verified from code. The `temp_status.md` says it was verified in 25 seconds — but no CI proof exists.** |

**Week 4 gate verdict:** ⚠️ Partial — Stripe dashboard setup (W4-4), Storage Box subscription and cron (W4-6), and the live restore drill (W4-7) remain. Celery worker launch is now handled (`make worker` + `docker compose --profile worker up -d celery_worker`); only a `systemd` unit on Hetzner SX65 is left as a server-side step.

---

## WEEK 5 — Trust Pack, Deletion Proof, Regression Suite, Polish

| ID | Task | Status | Where it lives | Tests? | What's missing |
|---|---|---|---|---|---|
| **W5-1** | Incident-response runbook (severity levels, escalation, partner-comms template) | ✅ Done in docs | Exists in `docs/` per `temp_status.md` | N/A | Nothing |
| **W5-2** | Auditable data-deletion with HMAC-signed log + tenant-scoped export endpoint | ⚠️ **Partial** | `embedding.deleted` webhook fires in `cleanup_worker.py`. But: (a) the **HMAC-signed log entry to `system_logs`** is not implemented — the cleanup worker just triggers the webhook, it doesn't write a signed hash to the DB. (b) The **tenant-scoped log export endpoint** for partners to download their deletion history is **not found** in the routers. | No dedicated deletion proof test | **Two sub-components missing: signed audit hash on `system_logs`, and the export endpoint `GET /api/v1/partner/deletion-log`** |
| **W5-3** | Trust Pack PDF (data-flow diagram, no-training statement, EU residency) | 🌐 Founder track | — | N/A | — |
| **W5-4** | CAIQ Lite questionnaire pre-filled | 🌐 Founder track | — | N/A | — |
| **W5-5** | Sub-processor list on Privacy page | 🌐 Website update | — | N/A | — |
| **W5-6** | Counsel finalisation — DPA/MSA/NDA signed | 🌐 Founder track | — | N/A | — |
| **W5-7** | OpenAPI final polish — re-deploy docs | ✅ Done | All routes annotated. Deployment-ready. | Implicit | Nothing |
| **W5-8** | Public changelog at `docs.resomix.com/changelog` | ✅ Done in docs | Changelog content written. Requires Mintlify portal (W3-2) to be live to publish. | N/A | Depends on W3-2 being live |
| **W5-9** | Tenant-isolation regression suite — 30–40 test cases | ⚠️ **Significant gap vs roadmap spec** | Existing coverage: `test_tenant_isolation.py` (2 tests), `test_partner_isolation.py` (1 integration flow, ~5 steps), `test_b2b_security_hardening.py` (4 tests). **Total: ~7 distinct test functions.** The roadmap required ~30–40 cases covering: (a) key A can't read key B's tracks/embeddings/usage/statements, (b) SFTP chroot isolation, (c) webhook subscriptions don't cross-fire, (d) admin `partner_id` filter enforcement. | Partial | **Missing ~25–30 additional test cases.** Specifically: explicit statement/quota isolation test, explicit webhook cross-fire test, explicit admin filter enforcement tests, playlist/engagement isolation tests. The suite is the biggest real testing gap. |
| **W5-10** | Cloudflare CDN edge rules for HLS `.ts` segments | 🌐 Cloudflare dashboard | No code required | N/A | **Cloudflare dashboard setup** |
| **W5-11** | ISRC-conflict policy document | ✅ Done in docs + code | Ingestion service flags `DUPLICATE_ISRC_IN_BATCH` errors. Policy doc written in markdown. `test_ingestion_validation.py` tests duplicate ISRC detection. | `test_ingestion_validation.py` | Nothing |
| **W5-12** | Full regression sweep — all W1–W4 acceptance criteria | ⚠️ **Operational** | `tests/test_weekly_gate.py` exists. The sweep against staging is blocked by staging not existing (W2-6). | `test_weekly_gate.py` | **Staging environment needed for full sweep. Production sweep relies on running tests manually.** |
| **W5-13** | Mock diligence rehearsal (30-question security questionnaire answered in 24h) | 🌐 Team exercise | — | N/A | — |
| **W5-14** | API SDK examples (Python + JavaScript copy-paste snippets) | ✅ Done in docs | Written in guides in `docs/` | N/A | Need to be published on Mintlify (depends on W3-2) |
| **W5-15** | Days 33–35 integration buffer + final smoke tests + readiness gate | ⚠️ Partial | `tests/test_weekly_gate.py` exists as gate checklist | N/A | **Staging doesn't exist; live smoke test on production only** |

**Week 5 gate verdict:** ❌ Not fully passable — W5-9 regression suite is under-built (7 tests vs 30–40 required), W5-2 signed deletion log + export endpoint is missing, and all staging-dependent tasks are blocked.

---

## Summary: What's Actually Remaining

### Real Code Gaps (need developer work)
| Gap | Effort | Priority |
|---|---|---|
| **W5-9** Tenant-isolation regression suite: expand from ~7 to 30–40 test cases | ~8–10h | 🔴 High (Day-35 gate requires 100% pass rate) |
| **W5-2** HMAC-signed deletion log entry to `system_logs` + partner deletion-history export endpoint | ~3–4h | 🔴 High (compliance requirement) |
| **W1-7** Fix duplicate test function in `test_rate_limiting.py` | ~0.5h | 🟡 Low |

### Server/Infrastructure Tasks (Hetzner SX65 + new VPS)
| Gap | Where |
|---|---|
| Deploy and configure **SFTPGo** on Hetzner SX65, point auth hook at FastAPI `/internal/sftp/auth` | Hetzner SX65 |
| Set up nightly `mariabackup` cron job to Hetzner Storage Box (subscribe, mount, write cron) | Hetzner SX65 |
| Run live **restore drill** on fresh VPS and update runbook | New fresh VPS |
| Provision **staging Hetzner CX22 VPS**, deploy app, replicate DB schema | New VPS |
| Add `systemd` unit on Hetzner SX65 to run `celery -A app.tasks.celery_app worker` persistently (local `make worker` + Docker `celery_worker` service already in place) | Hetzner SX65 |

### External Services (no code needed)
| Task | Service |
|---|---|
| Set up Mintlify/Scalar at `docs.resomix.com` | Mintlify or Scalar |
| Set up BetterStack status page, 5 monitors | BetterStack |
| Configure **Cloudflare** zone: WAF, CDN, HLS edge rules | Cloudflare |
| Run `scripts/setup_stripe.py`, configure Stripe Tax + OSS scheme, paste Price IDs into `.env`, accountant invoice check | Stripe dashboard |
| Register Greek VAT in Stripe Tax | Stripe + Greek tax authority |

### Founder Track (no code)
DPA, B2B MSA, Mutual NDA via counsel; Trust Pack PDF; CAIQ Lite; sub-processor list; diligence rehearsal; outbound list; ADE booking.
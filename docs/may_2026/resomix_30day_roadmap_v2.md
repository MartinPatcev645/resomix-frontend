# RESOMIX — 35-DAY PARTNER-READINESS ROADMAP — v3.0

**Revision restructuring v2.0 into 5 weeks of ≤60h each. Task content unchanged; week boundaries and IDs re-derived from a strict 60-hour-per-week ceiling. This document supersedes v2.0.**

| Document control | Value |
| :---- | :---- |
| Prepared for | Reform Studios (Resomix) — Founder \+ Developer |
| Audience | **Primary:** Backend developer. **Secondary:** Founder (sales/legal track) |
| Replaces | `resomix_30day_roadmap_v2.md` v2.0 |
| Reason for revision | v2.0's Week 1 packed 112h into 7 days at \~16h/day, which is unsustainable. v3.0 enforces a hard 60-hour-per-week ceiling and redistributes the same task list across 5 weeks with no content changes — only boundaries and IDs move. Outbound now starts Day 36 |
| Status | Final — ready to execute |
| Engineering effort | \~274 hours over 35 calendar days. Requires \~55–60 hrs/week pace from one experienced full-stack developer — sustainable for 5 weeks at \~8–9 h/day |
| Cash | \~€4K–€6K (counsel \+ tooling \+ Wise account \+ LinkedIn Sales Navigator) |

---

## CHANGE LOG FROM v2.0 → v3.0

v3.0 is a **structural restructure only**. No tasks added, removed, or re-estimated. The plan is split into 5 weeks of ≤60h each instead of 4 weeks where Week 1 was unsustainable at 112h. Task IDs are re-derived because tasks have moved between weeks; cross-references throughout the document have been updated accordingly.

| \# | v2.0 issue | v3.0 resolution |
| :---- | :---- | :---- |
| S1 | Week 1 at 112h was unsustainable; "Option A" deferred work into Week 2 informally | Hard 60h-per-week ceiling. Tasks split across 5 weeks: Week 1 = 59h, Week 2 = 53h, Week 3 = 52h, Week 4 = 59h, Week 5 = 51h |
| S2 | Task IDs (W1-1..W1-15, W2-1..W2-13, W3-1..W3-13, W4-1..W4-9) reflected the old 4-week split | Re-derived: Week 1 = W1-1..W1-8, Week 2 = W2-1..W2-7, Week 3 = W3-1..W3-13, Week 4 = W4-1..W4-7, Week 5 = W5-1..W5-15. Cross-references throughout the document updated |
| S3 | Acceptance gates and integrated schedule assumed a 30-day timeline | All gates now Day 7 / Day 14 / Day 21 / Day 28 / Day 35. Outbound starts Day 36 |
| S4 | Risk R13 (Week 1 hours don't fit) | Removed — addressed by structural fix |
| S5 | Section 9 "Week 5 contingency" duplicated what is now a real Week 5 | Renamed to "Week 6 contingency"; contingency starts Day 36 if Day-35 gate fails |

---

## CHANGE LOG FROM v1.0 → v2.0 (RETAINED FOR HISTORY)

The developer's review of v1.0 identified the following issues. Each was addressed in v2.0 as listed.

| \# | v1.0 issue | v2.0 resolution |
| :---- | :---- | :---- |
| C1 | Time estimates ignored integration, regression testing, bug-fixing | All retained tasks now use developer's realistic estimates where provided; remaining tasks have a flat 20% integration multiplier built in |
| C2 | OpenSearch k-NN claim was incorrect — production runs **Elasticsearch**, not OpenSearch; k-NN vector search is OpenSearch-specific | Vector search now uses **FAISS in-memory per partner**. Migration to Qdrant or pgvector deferred to ≥5 partners or ≥500K tracks |
| C3 | Hook0 added an unnecessary PostgreSQL service for webhooks | Replaced by **custom Celery webhook dispatcher** using existing Celery \+ Redis. \~300 lines Python, 14h vs. 24h |
| C4 | CSV/metadata parsing was implicit but not budgeted; SFTP arrival without parsing produces zero useful data | **Added as named task** in Week 2 (W2-7), 12h |
| C5 | Tenant-isolation testing was one bullet, not a suite | **Added regression suite as named task** (W5-9), 12h |
| C6 | No staging environment work; production was implicitly the test target | **Staging environment added** (W2-6 \+ W3-13), 16h |
| C7 | Stripe Tax / EU VAT estimate of 4h was \~5× under | Now budgeted at **22h** for Stripe Tax \+ VIES \+ branded invoicing |
| C8 | Wise Business "1–3 days" assumed standard EU verification | Flagged as **1–3 weeks possible**; founder starts Day 1 with Revolut Business as fallback |
| C9 | Day 27 was the only buffer day | **Days 33–35 reserved as integration / regression / buffer** |
| C10 | Legal pack timeline of 7 days for counsel back-and-forth was unrealistic | Counsel engagement now starts **Day 1**, drafts by Day 14, final by Day 33 |
| C11 | Hook0, Datalust Seq, Metabase, 1-Day Demo Widget, formal E2E onboarding test | All five **deferred to Week 6+ / post-first-pilot**. Rationale below |
| C12 | "All Week 1, 2, 3 acceptance criteria still pass (regression check)" had zero hours allocated | Now a named Week 5 task (W5-12) with 8h budget |

---

## EXECUTIVE SUMMARY

The technical asset (PYXIS-1, three-server architecture, EU compliance posture, normalised B2B schema, boarding-pass JWT, HLS pipeline) is real and working. The 35-day plan productises what exists into a partner-grade B2B API, adds the legal and operational wrapper that procurement teams demand, and ships on Day 35 with the founder ready to start outbound on Day 36\.

**Total engineering effort: \~274 hours over 35 days at \~55–60 hrs/week.** This is achievable for one motivated, experienced full-stack developer for a five-week sprint at \~8–9 h/day. It is not sustainable indefinitely; post-Day-35 the developer must drop to 35–40 hrs/week.

**Hard rules for the 35 days (do not violate):**

1. **No new product features.** Productisation only. Anything not in this document is out of scope.  
2. **No framework migration.** Stay on FastAPI / MariaDB / Redis. No PostgreSQL, no microservices, no Fast-SAAS.  
3. **No vendor SaaS additions** beyond what is listed. (Mintlify, BetterStack, Cloudflare free, Wise Business — all listed below.)  
4. **The founder does not write code.** Founder runs the parallel sales/legal track in Section 7\.  
5. **Every week ends with a binary GO / NO-GO acceptance gate.** Failure halts the next week's work until P0 items are closed.

---

## SECTION 1 — STACK DECISIONS (LOCKED FOR 35 DAYS)

These are the engineering decisions that drive every task below. Locked: changes require founder approval.

| Decision | Choice | Rationale |
| :---- | :---- | :---- |
| **Database** | MariaDB (existing) | No migration. The 5-tier B2B schema works |
| **Vector storage** | **FAISS in-memory per partner** | Elasticsearch (not OpenSearch) is what's actually deployed. FAISS gives exact cosine similarity (sub-millisecond on CPU), zero new service, in-process search. Aligns with explainability/determinism differentiator. Migration to Qdrant or pgvector at ≥5 partners / ≥500K tracks |
| **Webhook delivery** | **Custom Celery dispatcher** | Uses existing Celery \+ Redis. No new database service (Hook0 needs PostgreSQL). \~300 lines Python. UI can be added Phase 2 |
| **API auth (partner)** | Custom API-key in MariaDB | Clerk/WorkOS introduce vendor cost. Reconsider at 5+ partners |
| **API auth (admin)** | Cloudflare Zero Trust (existing) | No change |
| **Frontend** | React (existing) | No change |
| **API framework** | FastAPI (existing) | No change |
| **Storage** | Bare-metal SX65 ZFS/RAID10 (existing) | MinIO migration is a Phase-2 activity |
| **Status page** | **BetterStack free tier** (not Cloudflare Worker) | 2h vs. 6h. Same functional outcome. Cloudflare Worker only if BetterStack hits a limit |
| **API documentation** | Mintlify or Scalar (free) | Auto-generates from OpenAPI |
| **Backup target** | Hetzner Storage Box, different DC | €3.81/month for 1TB; 3-2-1 compliant |
| **Logging** | Existing `system_logs` table \+ log files (Datalust Seq deferred) | Acceptable for 1–3 partners. Add Seq in Week 6+ |
| **BI / admin analytics** | Existing admin dashboard \+ phpMyAdmin (Metabase deferred) | Acceptable for first 1–3 partners |
| **CDN / DDoS / WAF** | Cloudflare free plan | Edge caching for HLS segments |
| **SFTP** | SFTPGo (open source, FastAPI auth hook) | Per-partner chroot |

---

## SECTION 2 — DEFERRED ITEMS (NOT IN 35-DAY SCOPE)

These were in v1.0 and have been **deferred to Week 6+ or post-first-pilot**. The developer should not work on these in the 35-day window. The founder must not request them.

| Deferred item | Why deferred | When to revisit |
| :---- | :---- | :---- |
| Hook0 self-hosted webhook service | Replaced by Celery dispatcher | Reconsider at 5+ partners if partner-facing webhook subscription UI is requested |
| Datalust Seq centralised logging | Existing `system_logs` table \+ correlation IDs are sufficient for 1–3 partners | Week 6+ or first incident that requires cross-server log correlation at scale |
| Metabase admin BI | phpMyAdmin \+ existing admin dashboard sufficient | Add when finance team needs self-service partner usage reports |
| 1-Day Demo Widget (embeddable iframe) | Sandbox API \+ Loom video achieve 80% of effect | When inbound traffic justifies it — likely Week 9+ |
| Formal E2E onboarding test as separate task | Folded into Week 5 regression suite | Already covered |
| Partner-side benchmark methodology PDF | Useful but not blocking | Post-first-pilot, when first partner asks |
| API SDK (full Python/JS packages) | Curl examples \+ docs sufficient initially | When second partner integration begins |
| Datalust Seq \+ Metabase | Both deferred | Week 6+ |
| Self-service partner-portal UI for API keys | Manual issue is fine for 1–5 partners | When partner \#5 onboards |
| Adaptive bitrate HLS, territory geoblocking, ACR (Audible Magic), MinIO migration, microservices split, DDEX ERN ingestion, SOC 2 audit | All Phase-2+ | Per existing `architecture_ddex` and `Resomix_Vendor_Strategy_DSP_Onboarding.md` |

---

## SECTION 3 — THE 35-DAY PLAN

### Pace and discipline

- **Target pace: 55–60 hrs/week** (\~8–9 h/day × 7 days, or 11 h/day × 5 days). Sustainable for 5 weeks at this pace.  
- **Days 33–35 reserved as integration buffer** — no new tasks scheduled. These exist to absorb slippage from earlier weeks.  
- **Each week ends with a binary GO / NO-GO acceptance gate.** If P0 criteria fail, do not proceed to next week's tasks; close the gap first.  
- **All tasks are tagged with their dependencies.** A task with `Dep: W1-3` cannot start until W1-3 is done.

### Hour estimate methodology

Where the developer's review of v1.0 provided a realistic estimate (e.g., the 17h tenant\_id audit, 17h SFTPGo, 22h Stripe), that estimate is used directly. For all other tasks, a flat **\+20% integration / bug-fix multiplier** is applied to the original v1.0 estimate. This is a single multiplier applied uniformly per the developer's recommendation, not per-task re-estimation.

### Hour estimate methodology — IDs in v3.0

In v2.0 the IDs reflected the original 4-week split. v3.0 re-derives IDs against the new 5-week split:

- **Week 1 (W1-1..W1-8):** ex-W1-1..W1-8 (unchanged)
- **Week 2 (W2-1..W2-7):** ex-W1-9, W1-10, W1-11, W1-12, W1-13, W1-14, W1-15
- **Week 3 (W3-1..W3-13):** ex-W2-1..W2-13 (numbers shifted, content unchanged)
- **Week 4 (W4-1..W4-7):** ex-W3-1..W3-7
- **Week 5 (W5-1..W5-15):** ex-W3-8..W3-13 \+ ex-W4-1..W4-9

---

### WEEK 1 (Days 1–7) — Multi-tenancy core, API plane, FAISS, rate-limiting

**Goal:** End of Week 1, the partner / API-key tables exist, every authenticated request is tenant-scoped via middleware, FAISS per-partner indexes load on startup, and rate-limiting plus quota enforcement are live. A partner API key can be issued and used to make a similarity search.

| ID | Task | Hours | Dep | Notes |
| :---- | :---- | :---- | :---- | :---- |
| W1-1 | Add `partners`, `partner_api_keys`, `partner_quotas`, `partner_usage_log`, `partner_webhooks`, `webhook_delivery_log` tables (schema in §4) | 5 | — | Migration script tested locally first |
| W1-2 | API key issuance: `secrets.token_urlsafe(32)`; SHA-256 hashed storage; admin endpoints to issue / revoke / rotate. Format: `rmx_live_xxx` and `rmx_sandbox_xxx` | 7 | W1-1 | Never store plaintext keys |
| W1-3 | FastAPI dependency `get_current_partner()` validates `Authorization: Bearer rmx_*`, populates `request.state.partner_id` and `request.state.api_key_id` | 5 | W1-2 | Used by every partner endpoint |
| W1-4 | `tenant_id` integration into existing tables — full query audit | **17** | W1-1 | **Developer realistic estimate.** Includes: (a) decision document on column-add vs new partner-scoped tables (2–4h), (b) identifying every query touching affected tables across services \+ admin \+ scripts, (c) updating each query, (d) integration testing. Default decision: **add `partner_id` column to existing tables; demo data uses `partner_id = 0` (sandbox tenant); enforce via middleware** |
| W1-5 | FAISS per-partner indexes — replaces OpenSearch k-NN approach | 6 | W1-4 | One `IndexFlatIP` per `partner_id`, loaded into `dict[int, faiss.Index]` at startup. L2-normalize embeddings before storage so inner product \== cosine similarity. Rebuild per partner after ingestion completes |
| W1-6 | Query-builder middleware: refuses to emit any partner-scoped query without `WHERE partner_id = :pid`. Raises typed exception | 7 | W1-4 | Catches the highest-risk class of bug — accidental cross-tenant query |
| W1-7 | Layer 1 rate limiting: per-API-key burst protection. Token-bucket in Redis. Default 10 req/sec, configurable per tier. HTTP 429 \+ `Retry-After` | 6 | W1-3 | Use `slowapi` or hand-rolled |
| W1-8 | Layer 2 quota enforcement: rolling-30-day request counter per partner. Atomic Redis `INCR` with monthly key expiry; flushed to MariaDB every 5 minutes | 6 | W1-7 | Triggers `quota.warning` event at 80% (later wired in Week 4\) |

**Week 1 total: 59 hours.** \~8.4 h/day across 7 days.

### Week 1 acceptance gate (Day 7\)

- [ ] Founder issues a partner API key from admin in \<60 sec  
- [ ] `curl` to `/api/v1/similarity/search` with valid key returns valid JSON in \<500ms  
- [ ] `curl` without key, with wrong key, after exceeding rate limit returns 401, 401, 429 respectively  
- [ ] Two partners' data is provably isolated (one automated test; full suite in Week 5\)  
- [ ] FAISS index loads correctly per partner at startup; sub-millisecond similarity queries  

---

### WEEK 2 (Days 8–14) — Audit log, versioning, idempotency, SFTP, CSV parsing, staging foundation

**Goal:** End of Week 2, every authenticated request writes to the audit log, partner endpoints are versioned under `/api/v1/`, idempotency-keys protect retry-safe partner automation, SFTPGo is live with per-partner chroot, the CSV/metadata parser ingests the manifest accompanying each SFTP delivery, and a staging environment exists.

| ID | Task | Hours | Dep | Notes |
| :---- | :---- | :---- | :---- | :---- |
| W2-1 | Per-key audit log middleware: writes `{timestamp, correlation_id, partner_id, api_key_id, endpoint, method, status, latency, ip, user_agent}` to `partner_usage_log` for every authenticated request | 5 | W1-3 | Reuses `system_logs` infrastructure |
| W2-2 | API versioning: prefix all partner endpoints with `/api/v1/`. Document semver policy (breaking-change deprecation: 6 months). Legacy unversioned routes remain for the consumer frontend | 4 | — |  |
| W2-3 | Idempotency-key support on POST `/api/v1/ingest/track` and `/api/v1/similarity/search`: `Idempotency-Key` header; cache full response in Redis 24h | 4 | W1-3 | Required for retry-safe partner automation |
| W2-4 | SFTPGo on SX65 with FastAPI auth hook per `sftp_auth.md` | **17** | W1-1 | **Developer realistic estimate.** Includes: deploy (2h), configure auth hook (2h), edge cases — expired keys, IP-whitelist mismatches, partial uploads, cross-OS SFTP-client testing (10h), per-partner provisioning script wiring SFTPGo+MariaDB+Stripe (3h). Per-partner chroot at `/sftp/partners/{partner_id}/incoming/` and `/test/` |
| W2-5 | SFTP storage quota per partner enforced at SFTPGo level (default 1 GB sandbox, configurable per tier) | 3 | W2-4 | SFTPGo built-in feature |
| W2-6 | **Staging environment foundation** (Part 1 of 2\) — provision a separate Hetzner CX22 VPS, replicate MariaDB schema, wire Alwyzon staging API to GPU server (shared with prod is OK for staging; mark requests `X-Env: staging`) | 8 | — | **NEW per developer review.** Without staging, all multi-tenant testing is destructive |
| W2-7 | **CSV / metadata parsing pipeline** | 12 | W2-4 | **NEW per developer review.** When SFTP delivery completes, parse the CSV/JSON sidecar manifest (3–4h), validate ISRC format \+ required fields \+ encoding (3–4h), insert validated rows to `tracks_partner` / `releases_partner` with foreign keys (3–4h), surface per-row errors in ingestion report so partner sees "row 47 missing ISRC" not "batch failed" (2–3h). Test against messy real-world CSV: BOM characters, mixed line endings, columns out of order |

**Week 2 total: 53 hours.** \~7.6 h/day across 7 days.

### Week 2 acceptance gate (Day 14\)

- [ ] Audit log row written for every authenticated request (verifiable in `partner_usage_log`)  
- [ ] All partner endpoints under `/api/v1/`; semver deprecation policy documented  
- [ ] Repeating an `Idempotency-Key`-bearing POST returns the same cached response  
- [ ] SFTP login as test partner places a CSV+audio bundle in correct chroot; cross-partner access denied  
- [ ] CSV is parsed; valid rows insert; invalid rows surface as actionable error report  
- [ ] Staging environment is reachable at `staging.resomix.com` and accepts the same API calls as production  

---

### WEEK 3 (Days 15–21) — Sandbox, public docs, status, legal kickoff, partner surfaces, staging finalisation

**Goal:** End of Week 3, a partner who lands on resomix.com/partners has a public API documentation portal, a working sandbox demo, a status page showing 7 days of uptime, a B2B pricing page, and a "Get API key" form. Counsel has draft DPA / B2B MSA / Mutual NDA in review.

| ID | Task | Hours | Dep | Notes |
| :---- | :---- | :---- | :---- | :---- |
| W3-1 | Generate clean OpenAPI 3.1 spec — annotate every partner endpoint with description, examples, error responses, security scheme | 4 | W2 done | Existing `/openapi.json` is starting point; needs 50% rework |
| W3-2 | Set up Mintlify (free startup tier) or Scalar at `docs.resomix.com`. Auto-generates from OpenAPI. Custom domain \+ TLS | 5 | W3-1 | **Developer realistic estimate** (5h not 3h) — includes finding endpoints with missing descriptions / examples / error responses and going back into FastAPI to add them, custom domain DNS, theming |
| W3-3 | Write four required guides: (a) Getting Started — first similarity search in 5 minutes; (b) Authentication; (c) Endpoint reference with curl/Python/JS examples; (d) Error code reference (e.g., `QUOTA_EXCEEDED`, `INVALID_AUDIO_FORMAT`, `TENANT_SUSPENDED`) | 6 | W3-2 | Markdown |
| W3-4 | Build sandbox catalogue: ingest 500–1,000 CC BY 4.0 tracks (already on platform) into `partner_id = 0` sandbox tenant. Generate FAISS index | 4 | W2 done | Reuse demo catalogue |
| W3-5 | Issue public sandbox API key `rmx_sandbox_demo_xxx` (rate-limited 100 calls/day). Document in Getting Started guide | 1 | W3-4 |  |
| W3-6 | Status page on **BetterStack free tier** (5 monitors free) | 2 | — | **Developer recommendation.** Cloudflare Worker alternative is 6h for no functional gain |
| W3-7 | `/health` endpoint on each of three FastAPI services: `{status, version, uptime_seconds, dependencies}` | 4 | — | \+20% on v1.0 estimate |
| W3-8 | Partners landing page on resomix.com: 60-second video demo (founder records), value proposition, "Try sandbox now" CTA, "Get production API key" form (mailto-routed in Week 4), 8-slide pricing tiers | 8 | — | Existing React app |
| W3-9 | Public B2B pricing page: Starter (€99/mo, 5K tracks, 5K calls/mo), Growth (€499/mo, 100K tracks, 100K calls/mo), Enterprise (Contact us — silo namespace, dedicated support, custom limits). EUR primary | 4 | W3-8 | Pricing can revise post-pilot |
| W3-10 | OpenAPI polish — descriptions, examples, error codes on every endpoint | 3 | W3-2 | Continuous through week |
| W3-11 | Cloudflare in front of resomix.com (free plan): WAF, DDoS, CDN for static assets, Page Rules for HLS-segment cache | 3 | — | Moved up from Week 4 in v1.0 — needed for status-page reliability story |
| W3-12 | **Counsel kickoff (founder track, parallel)**: engage music-industry counsel for DPA \+ B2B MSA \+ Mutual NDA. Brief based on existing legal pack. Target: drafts by Day 21, final by Day 33 | 0 (founder) | — | **Critical path — start Day 1** |
| W3-13 | **Staging environment finalisation** (Part 2 of 2): replicate FAISS index loading, wire SFTPGo staging instance, smoke-test full ingestion-to-search loop on staging | 8 | W2-6 | **Continued from W2-6** |

**Week 3 total: 52 hours engineering** (founder track parallel: counsel kickoff). \~7.4 h/day across 7 days.

### Week 3 acceptance gate (Day 21\)

- [ ] `docs.resomix.com` is live, public, mobile-friendly, with all four guides  
- [ ] An external developer can complete the Getting Started guide in \<5 minutes using only the docs  
- [ ] `status.resomix.com` (BetterStack subdomain or custom domain) is live with 7+ days of uptime history  
- [ ] resomix.com/partners is live with demo video, pricing tiers, "Get API key" CTA  
- [ ] Sandbox API key returns valid similarity results in \<200ms  
- [ ] Staging environment accepts SFTP delivery, parses CSV, generates FAISS index, returns search results — full loop works  
- [ ] Counsel has draft DPA, B2B MSA, Mutual NDA in review  

---

### WEEK 4 (Days 22–28) — Webhooks, B2B Stripe, backups, restore drill

**Goal:** End of Week 4, webhook events flow to partners with HMAC \+ retry; Stripe is configured for B2B subscriptions with VAT, VIES, branded invoicing; the platform survives a server failure with documented RPO/RTO and a *successful* restore drill on file.

| ID | Task | Hours | Dep | Notes |
| :---- | :---- | :---- | :---- | :---- |
| W4-1 | **Custom Celery webhook dispatcher** — replaces Hook0 entirely | 14 | W1-1 | **Developer recommendation.** \~300 lines Python. Components: (a) `partner_webhooks` table already exists (W1-1); (b) Celery task `dispatch_webhook(partner_id, event, payload)` does HTTP POST with HMAC-SHA256 signature in `X-Resomix-Signature` header; (c) exponential-backoff retry chain (5 attempts: 1m, 5m, 30m, 2h, 8h); (d) delivery log to `webhook_delivery_log` table; (e) admin endpoint to list/retry failed deliveries |
| W4-2 | Wire 7 event types into existing pipeline: `ingestion.started` (SFTP file detected), `ingestion.completed` (all tracks indexed), `ingestion.failed` (with error details), `track.indexed` (per-track), `quota.warning` (80%), `quota.exceeded` (hard limit), `embedding.deleted` (TTL purge runs) | 6 | W4-1 | Each event: 1h to identify trigger point \+ emit. Tested on staging |
| W4-3 | Per-partner webhook configuration via admin endpoint: URL, secret, events list, retry policy. HMAC verification documented in partner docs | 3 | W4-1 | UI deferred; admin-issued for first partners |
| W4-4 | **Stripe B2B configuration** — products, prices, Tax, VIES, branded invoicing | **22** | — | **Developer realistic estimate** (22h not 11h). Components: (a) create three Products (Starter, Growth, Enterprise) with monthly \+ annual prices in Stripe (annual \= 10× monthly \= 17% discount) — 3h; (b) Stripe Tax setup: register Greek VAT, enable Tax for EU member states, configure OSS scheme for cross-border B2C — 6h; (c) VIES API integration to validate B2B partner VAT IDs at customer creation — 4h; (d) branded invoice template: Reform Studios logo, VAT number on Customer object, PO number as metadata, EUR primary \+ USD/GBP secondary — 4h; (e) annual-discount pricing wiring — 2h; (f) accountant verification of one EU-business invoice \+ one EU-consumer invoice \+ one non-EU invoice — 3h |
| W4-5 | Stripe webhook handler for B2B events: `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. Idempotent (Stripe retries; the handler must be safe to call twice with same `event.id`) | 5 | W4-4 | \+20% on v1.0 estimate. Reuses webhook infrastructure pattern from W4-1 |
| W4-6 | Backup procedure: nightly `mariabackup` of MariaDB to second Hetzner Storage Box (€3.81/month, 1TB). Different DC for 3-2-1. `rsync` of critical config/asset files. **RPO documented as 24h, RTO as 4h** | 5 | — | \+20% on v1.0 estimate |
| W4-7 | **Restore drill** — perform the actual restore on a fresh VPS. Verify data integrity. Document the procedure as a step-by-step runbook. **Do not pass Week 4 gate without successful restore.** | 4 | W4-6 | \+20% on v1.0 estimate. **Developer flagged this honestly: first restore reveals a problem 90% of the time.** Build in time to fix what fails |

**Week 4 total: 59 hours engineering.** \~8.4 h/day across 7 days.

### Week 4 acceptance gate (Day 28\)

- [ ] Test webhook fires successfully to test partner endpoint with valid HMAC signature; failed delivery retries with exponential backoff  
- [ ] Test partner can be charged €99 for Starter monthly; VAT applies correctly for EU buyer (with VIES-verified VAT ID), EU consumer, non-EU buyer  
- [ ] Backup-restore drill completed successfully; runbook updated with any deviations  
- [ ] Counsel has DPA, B2B MSA, Mutual NDA in final-redline (final by Day 33\)  

---

### WEEK 5 (Days 29–35) — Trust pack, deletion proof, regression suite, polish, rehearsal, GO/NO-GO

**Goal:** End of Week 5, the legal pack is signable; the Trust Pack and CAIQ Lite are ready to send within 4 hours of any inbound diligence request; the cross-tenant regression suite passes; every partner-facing artefact is polished; the team can answer any inbound diligence question in \<24h; and the founder starts outbound on Day 36.

Days 33–35 are explicitly **buffer days** — minimal new tasks scheduled. They exist to absorb Week 1–4 slippage.

| ID | Task | Hours | Dep | Notes |
| :---- | :---- | :---- | :---- | :---- |
| W5-1 | Incident-response runbook: one page covering severity levels, on-call (founder \+ developer), escalation, partner-communication template | 2 | — | Markdown |
| W5-2 | Documented data-deletion procedure with auditable proof: when a partner requests deletion, system fires `embedding.deleted` webhook, writes signed log entry with hash to `system_logs`, and a tenant-scoped log export endpoint allows partner to download their deletion history | 5 | W4-1 | \+20% on v1.0 estimate |
| W5-3 | **Trust Pack one-pager (founder track)**: data-flow diagram (audio in → PYXIS-1 → vectors stored → audio purged), deletion-proof mechanism, no-AI-training statement, EU residency confirmation, security controls list. PDF deliverable | 4 (founder) | — | Founder owns content; developer reviews technical accuracy |
| W5-4 | **CAIQ Lite questionnaire (founder track)**: 50–60-question CSA Cloud Security Alliance template, pre-filled from existing GDPR Summary, Privacy Policy, security architecture | 6 (founder) | — | Spreadsheet form, exportable as PDF |
| W5-5 | **Sub-processor list** (founder track) published on Privacy page: Hetzner (DE/AT), Alwyzon (AT), Stripe (IE), Cloudflare (US — flag in disclosure), Wise (BE), Mintlify or Scalar (US — flag), BetterStack (US — flag) | 1 (founder) | — | Markdown update \+ Privacy Policy revision |
| W5-6 | **Counsel finalisation (founder track)**: DPA, B2B MSA, Mutual NDA — final approval, signed copies on shared drive | 0 (founder) | W3-12 | Critical path. If not done by Day 33, Day-35 gate fails |
| W5-7 | OpenAPI polish — final pass on descriptions, examples, error codes on every endpoint. Re-deploy docs | 3 | W3-2 |  |
| W5-8 | Public changelog at `docs.resomix.com/changelog` — semver, breaking vs non-breaking changes flagged | 2 | — | Mintlify built-in |
| W5-9 | **Tenant-isolation regression test suite** | **12** | W1 done | **NEW per developer review.** Pytest suite covering every partner-scoped endpoint × every cross-tenant scenario: (a) partner A's API key cannot read partner B's tracks, embeddings, usage, statements; (b) partner A's SFTP cannot read partner B's chroot; (c) partner A's webhook subscriptions never fire on partner B's events; (d) admin endpoints with `partner_id = X` filter genuinely apply the filter. \~30–40 test cases. **Suite must pass on every CI run** |
| W5-10 | Cloudflare CDN edge rules for HLS segments: cache `.ts` segments at edge for 24h; bypass cache for `.m3u8` manifests. Reduces SX65 egress | 2 | W3-11 |  |
| W5-11 | ISRC-conflict policy document: when two partners deliver tracks with same ISRC, default behaviour is flag-in-admin and notify both partners — Resomix does not auto-merge. One-page policy doc | 2 | — | Markdown |
| W5-12 | **Full regression sweep** — run all Week 1, 2, 3, 4 acceptance criteria against staging \+ production. Document failures. Fix or defer to Week 6 contingency | 8 | W5-9 | **NEW.** v1.0 had this as one bullet with zero hours; now budgeted |
| W5-13 | Founder diligence rehearsal: mock partner sends 30-question security questionnaire; founder \+ developer answer each in \<24h using prepared Trust Pack \+ CAIQ Lite | 4 | W5-3, W5-4 | Mock partner \= friend, advisor, or counsel |
| W5-14 | API SDK examples: ship Python and JavaScript snippets in docs for each endpoint. Runnable copy-paste, not packaged SDK | 3 | W3-2 |  |
| W5-15 | **Days 33, 34, 35: integration buffer \+ final smoke tests \+ readiness gate** | 8 | All | **NEW per developer review.** Three days of dedicated buffer. Use for: outstanding bugs from regression sweep, Week-4 slippage absorption, final smoke testing of the full partner journey, founder-developer sync on Day 35 |

**Week 5 total: 51 hours engineering** (founder track parallel: \~10 hours). \~7.3 h/day across 7 days.

### Week 5 / Day 35 readiness gate (THE BIG ONE)

This is the gate that decides whether outbound starts on Day 36. **All P0 items below must pass. If any fails, do not start outbound.**

- [ ] All Week 1, 2, 3, 4 acceptance criteria still pass (regression sweep complete)  
- [ ] Tenant-isolation regression suite has 100% pass rate  
- [ ] An external developer (friend / advisor / counsel) completes the entire onboarding flow in \<30 min using only the docs  
- [ ] A 30-question mock security questionnaire is answered with Trust Pack \+ CAIQ Lite within 24h  
- [ ] Status page shows ≥99% uptime over the last 14 days  
- [ ] DPA, B2B MSA, Mutual NDA are counsel-final and on shared drive  
- [ ] Backup-restore drill is documented and reproducible (a second restore on Day 35 confirms)  
- [ ] Stripe B2B test invoices for three buyer profiles (EU business, EU consumer, non-EU) match accountant's expected output  
- [ ] Sub-processor list live on Privacy page  
- [ ] Trust Pack PDF \+ CAIQ Lite spreadsheet ready to send within 4 hours of inbound diligence  
- [ ] Founder has 30-target outbound list, Loom demo, pitch deck, ADE 2026 booked, Abbey Road Red REDD application submitted  
- [ ] Wise Business account is operational (or Revolut Business fallback active)

**If GO:** outbound begins Day 36. **If NO-GO:** identify which P0 item failed, allocate Week 6 contingency to close it, restart gate.

---

### 3.5 — Total hours and pace

| Week | Days | Eng. hours | Pace at 7 days | Pace at 5 days |
| :---- | :---- | :---- | :---- | :---- |
| Week 1 | 1–7 | 59 | 8.4 h/day ✅ | 11.8 h/day ⚠ |
| Week 2 | 8–14 | 53 | 7.6 h/day ✅ | 10.6 h/day ✅ |
| Week 3 | 15–21 | 52 | 7.4 h/day ✅ | 10.4 h/day ✅ |
| Week 4 | 22–28 | 59 | 8.4 h/day ✅ | 11.8 h/day ⚠ |
| Week 5 | 29–35 | 51 | 7.3 h/day ✅ | 10.2 h/day ✅ |
| **Total** | **35** | **274** | **7.8 h/day avg** ✅ | **10.9 h/day avg** ⚠ |

**The honest read on the math:** at a 7-day-per-week pace, no week exceeds 8.4 h/day. This is sustainable for a 5-week sprint. At a 5-day pace, Weeks 1 and 4 push to \~12 h/day — also achievable but tighter; the developer should plan a 6- or 7-day work pattern for those weeks specifically.

### Integrated 35-day schedule

Day 1  ─┬─ W1-1 schema (5h) \+ W1-2 API key (start, 4h)              \[Founder: counsel kickoff, Wise app, LinkedIn post\]

Day 2  ─┤  W1-2 API key (finish, 3h) \+ W1-3 auth dep (5h)

Day 3  ─┤  W1-4 tenant\_id audit (Part 1, 9h of 17h)

Day 4  ─┤  W1-4 tenant\_id audit (Part 2, 8h)

Day 5  ─┤  W1-5 FAISS (6h) \+ W1-6 query middleware (start, 3h)

Day 6  ─┤  W1-6 query middleware (finish, 4h) \+ W1-7 rate limiting (4h)

Day 7  ─┴─ W1-7 rate limiting (finish, 2h) \+ W1-8 quota (6h) \+ Week 1 gate

Day 8  ─┬─ W2-1 audit log (5h) \+ W2-2 versioning (4h)               \[Founder: demo Loom, LinkedIn post 2\]

Day 9  ─┤  W2-3 idempotency (4h) \+ W2-4 SFTPGo (Part 1, 5h)

Day 10 ─┤  W2-4 SFTPGo (Part 2, 9h)

Day 11 ─┤  W2-4 SFTPGo (Part 3, 3h) \+ W2-5 SFTP quota (3h) \+ W2-6 staging Part 1 (start, 3h)

Day 12 ─┤  W2-6 staging Part 1 (finish, 5h) \+ W2-7 CSV parsing (Part 1, 4h)

Day 13 ─┤  W2-7 CSV parsing (Part 2, 8h)

Day 14 ─┴─ Week 2 gate

Day 15 ─┬─ W3-1 OpenAPI (4h) \+ W3-2 Mintlify (start, 3h)            \[Founder: legal drafts review\]

Day 16 ─┤  W3-2 Mintlify (finish, 2h) \+ W3-3 docs (6h)

Day 17 ─┤  W3-4 sandbox (4h) \+ W3-5 sandbox key (1h) \+ W3-6 status (2h) \+ W3-7 health (1h)

Day 18 ─┤  W3-7 health (finish, 3h) \+ W3-8 partners page (5h)

Day 19 ─┤  W3-8 partners page (finish, 3h) \+ W3-9 pricing (4h) \+ W3-10 OpenAPI polish (1h)

Day 20 ─┤  W3-10 OpenAPI polish (finish, 2h) \+ W3-11 Cloudflare (3h) \+ W3-13 staging Part 2 (start, 3h)

Day 21 ─┴─ W3-13 staging Part 2 (finish, 5h) \+ Week 3 gate

Day 22 ─┬─ W4-1 Celery webhooks (Part 1, 8h)                        \[Founder: counsel back-and-forth\]

Day 23 ─┤  W4-1 Celery webhooks (Part 2, 6h) \+ W4-2 wire 7 events (Part 1, 2h)

Day 24 ─┤  W4-2 wire 7 events (Part 2, 4h) \+ W4-3 webhook config (3h)

Day 25 ─┤  W4-4 Stripe (Part 1, 9h)

Day 26 ─┤  W4-4 Stripe (Part 2, 9h)

Day 27 ─┤  W4-4 Stripe (Part 3, 4h) \+ W4-5 Stripe handler (5h)

Day 28 ─┴─ W4-6 backup (5h) \+ W4-7 restore drill (4h) \+ Week 4 gate

Day 29 ─┬─ W5-1 IR runbook (2h) \+ W5-2 deletion proof (5h)          \[Founder: counsel final review\]

Day 30 ─┤  W5-7 OpenAPI final (3h) \+ W5-8 changelog (2h) \+ W5-9 regression suite (Part 1, 3h)

Day 31 ─┤  W5-9 regression suite (Part 2, 8h)

Day 32 ─┤  W5-9 regression suite (Part 3, 1h) \+ W5-10 Cloudflare CDN (2h) \+ W5-11 ISRC policy (2h) \+ W5-12 regression sweep (Part 1, 3h)

Day 33 ─┤  **Buffer Day 1** — W5-12 regression sweep (Part 2, 5h) \+ slippage absorption (W5-15: 3h)  \[Founder: ADE booking, REDD application\]

Day 34 ─┤  **Buffer Day 2** — W5-13 diligence rehearsal (4h) \+ W5-14 SDK examples (3h) \+ slippage absorption (W5-15: 2h)

Day 35 ─┴─ **Buffer Day 3** — W5-15 final smoke tests (3h) \+ GO/NO-GO gate

Average pace across 35 days: **7.8 hours/day**. Heaviest individual days (Days 22–27 covering Celery webhooks \+ Stripe Parts 1–3) hit 9 hours, which is sustainable. No day exceeds 9 hours.

---

## SECTION 4 — DATABASE SCHEMA (ADDITIVE ONLY)

Add these tables in W1-1. They are additive — no changes to existing tables required. The migration runs against MariaDB cleanly.

\-- Partner / tenant table

CREATE TABLE IF NOT EXISTS partners (

    id              INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    partner\_uuid    CHAR(36) UNIQUE NOT NULL,

    legal\_name      VARCHAR(255) NOT NULL,

    display\_name    VARCHAR(255) NOT NULL,

    contact\_email   VARCHAR(255) NOT NULL,

    vat\_number      VARCHAR(64),

    country\_code    CHAR(2),

    tier            ENUM('sandbox','starter','growth','enterprise') DEFAULT 'sandbox',

    is\_active       TINYINT(1) DEFAULT 1,

    onboarded\_at    DATETIME DEFAULT CURRENT\_TIMESTAMP,

    notes           TEXT,

    INDEX idx\_partner\_uuid (partner\_uuid),

    INDEX idx\_partner\_tier (tier, is\_active)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- Insert sandbox partner with id=0 (or use AUTO\_INCREMENT and reference by uuid)

INSERT INTO partners (partner\_uuid, legal\_name, display\_name, contact\_email, tier)

VALUES ('00000000-0000-0000-0000-000000000000', 'Resomix Sandbox', 'Sandbox', 'sandbox@resomix.com', 'sandbox');

\-- API keys table

CREATE TABLE IF NOT EXISTS partner\_api\_keys (

    id                  INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    partner\_id          INT UNSIGNED NOT NULL,

    key\_prefix          VARCHAR(16) NOT NULL,         \-- 'rmx\_live\_abc1' for display

    key\_hash            CHAR(64) NOT NULL,             \-- SHA-256 of full key

    label               VARCHAR(100),                  \-- 'Production', 'Sandbox', 'Dev'

    scopes              JSON NOT NULL,                 \-- \['search:read','ingest:write'\]

    rate\_limit\_rps      INT UNSIGNED DEFAULT 10,

    rate\_limit\_monthly  INT UNSIGNED DEFAULT 100000,

    is\_active           TINYINT(1) DEFAULT 1,

    created\_at          DATETIME DEFAULT CURRENT\_TIMESTAMP,

    last\_used\_at        DATETIME,

    last\_used\_ip        VARCHAR(45),

    expires\_at          DATETIME,

    revoked\_at          DATETIME,

    revoked\_reason      VARCHAR(255),

    FOREIGN KEY (partner\_id) REFERENCES partners(id) ON DELETE CASCADE,

    INDEX idx\_apikey\_hash (key\_hash),

    INDEX idx\_apikey\_active (is\_active, partner\_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- Per-partner API usage log

CREATE TABLE IF NOT EXISTS partner\_usage\_log (

    id              BIGINT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    correlation\_id  CHAR(36),

    partner\_id      INT UNSIGNED NOT NULL,

    api\_key\_id      INT UNSIGNED NOT NULL,

    endpoint        VARCHAR(255) NOT NULL,

    method          VARCHAR(10),

    status\_code     SMALLINT UNSIGNED,

    latency\_ms      DECIMAL(10,3),

    request\_bytes   INT UNSIGNED,

    response\_bytes  INT UNSIGNED,

    client\_ip       VARCHAR(45),

    user\_agent      VARCHAR(500),

    error\_code      VARCHAR(64),

    created\_at      DATETIME DEFAULT CURRENT\_TIMESTAMP,

    FOREIGN KEY (partner\_id) REFERENCES partners(id) ON DELETE CASCADE,

    FOREIGN KEY (api\_key\_id) REFERENCES partner\_api\_keys(id) ON DELETE CASCADE,

    INDEX idx\_usage\_partner\_time (partner\_id, created\_at),

    INDEX idx\_usage\_endpoint (endpoint, created\_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci

PARTITION BY RANGE (TO\_DAYS(created\_at)) (

    PARTITION p\_initial VALUES LESS THAN (TO\_DAYS('2026-01-01')),

    PARTITION p\_max VALUES LESS THAN MAXVALUE

);

\-- Per-partner monthly quota tracking

CREATE TABLE IF NOT EXISTS partner\_quotas (

    id              INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    partner\_id      INT UNSIGNED NOT NULL,

    api\_key\_id      INT UNSIGNED,

    period\_start    DATE NOT NULL,

    period\_end      DATE NOT NULL,

    requests\_made   BIGINT UNSIGNED DEFAULT 0,

    quota\_limit     BIGINT UNSIGNED NOT NULL,

    is\_overage      TINYINT(1) DEFAULT 0,

    last\_synced\_at  DATETIME,

    FOREIGN KEY (partner\_id) REFERENCES partners(id) ON DELETE CASCADE,

    UNIQUE KEY uk\_quota\_period (partner\_id, api\_key\_id, period\_start),

    INDEX idx\_quota\_period (period\_start, period\_end)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- Webhook subscriptions

CREATE TABLE IF NOT EXISTS partner\_webhooks (

    id                          INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    partner\_id                  INT UNSIGNED NOT NULL,

    url                         VARCHAR(500) NOT NULL,

    secret\_hash                 CHAR(64) NOT NULL,

    events                      JSON NOT NULL,

    is\_active                   TINYINT(1) DEFAULT 1,

    last\_delivery\_at            DATETIME,

    last\_delivery\_status\_code   SMALLINT,

    consecutive\_failures        INT UNSIGNED DEFAULT 0,

    created\_at                  DATETIME DEFAULT CURRENT\_TIMESTAMP,

    FOREIGN KEY (partner\_id) REFERENCES partners(id) ON DELETE CASCADE,

    INDEX idx\_webhook\_partner\_active (partner\_id, is\_active)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- Webhook delivery log

CREATE TABLE IF NOT EXISTS webhook\_delivery\_log (

    id                  BIGINT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,

    correlation\_id      CHAR(36),

    webhook\_id          INT UNSIGNED NOT NULL,

    partner\_id          INT UNSIGNED NOT NULL,

    event\_type          VARCHAR(64) NOT NULL,

    payload             JSON NOT NULL,

    attempt\_number      TINYINT UNSIGNED DEFAULT 1,

    response\_status     SMALLINT,

    response\_latency\_ms INT UNSIGNED,

    error\_message       TEXT,

    delivered\_at        DATETIME,

    created\_at          DATETIME DEFAULT CURRENT\_TIMESTAMP,

    FOREIGN KEY (webhook\_id) REFERENCES partner\_webhooks(id) ON DELETE CASCADE,

    FOREIGN KEY (partner\_id) REFERENCES partners(id) ON DELETE CASCADE,

    INDEX idx\_delivery\_partner\_event (partner\_id, event\_type, created\_at),

    INDEX idx\_delivery\_status (response\_status, created\_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- Add partner\_id to existing tables (migration with safe default)

\-- Note: existing demo data goes to partner\_id \= 1 (sandbox)

ALTER TABLE tracks            ADD COLUMN partner\_id INT UNSIGNED NOT NULL DEFAULT 1;

ALTER TABLE tracks            ADD INDEX idx\_tracks\_partner (partner\_id, id);

ALTER TABLE tracks            ADD FOREIGN KEY (partner\_id) REFERENCES partners(id);

ALTER TABLE releases          ADD COLUMN partner\_id INT UNSIGNED NOT NULL DEFAULT 1;

ALTER TABLE releases          ADD INDEX idx\_releases\_partner (partner\_id, id);

ALTER TABLE releases          ADD FOREIGN KEY (partner\_id) REFERENCES partners(id);

\-- Repeat for other partner-scoped tables: contributors, playlists, embeddings\_metadata, etc.

\-- The query-builder middleware (W1-6) refuses to emit any SELECT/UPDATE/DELETE on these tables

\-- without an explicit partner\_id predicate.

---

## SECTION 5 — TOOL STACK (NO NEW PAID SERVICES)

| Layer | Tool | Cost | Notes |
| :---- | :---- | :---- | :---- |
| Vector store | **FAISS** in-process | Free (Python lib) | Replaces OpenSearch k-NN |
| Webhook delivery | **Custom Celery dispatcher** | Free | Replaces Hook0 |
| API documentation | Mintlify (startup tier) or Scalar | Free | Auto-generates from OpenAPI |
| Status page | **BetterStack free tier** (5 monitors) | Free | Replaces Cloudflare Worker |
| SFTP | SFTPGo (open source) | Free | Per-partner chroot |
| Backup storage | Hetzner Storage Box | €3.81/month for 1TB | Different DC for 3-2-1 |
| CDN / DDoS / WAF | Cloudflare free plan | Free | Edge caching for HLS segments |
| Bank account | Wise Business or Revolut Business | Free | Multi-currency IBAN |
| CAIQ Lite template | CSA Cloud Security Alliance | Free | cloudsecurityalliance.org |
| Demo recording | Loom | Free tier | Founder records demos |
| LinkedIn outreach | LinkedIn Sales Navigator | €80/month | Founder track |
| Counsel | Greek music-industry lawyer | €3K–€5K one-time | DPA \+ B2B MSA \+ Mutual NDA |

**Total recurring cost added by this plan: \~€85/month** (Hetzner Storage Box \+ LinkedIn Sales Navigator). **One-time legal cost (Day 1 counsel engagement): €3K–€5K.** **Total cash to ship the 35 days: €4K–€6K.**

---

## SECTION 6 — RISK MATRIX

| \# | Risk | Likelihood | Impact | Mitigation |
| :---- | :---- | :---- | :---- | :---- |
| R1 | Developer scope-creep beyond 35-day list | High | High | Strict change-control. Any new task \= founder approval \+ another removed |
| R2 | Counsel delays on DPA / B2B MSA / Mutual NDA | Medium | High | Engage Day 1; demand drafts by Day 21; final by Day 33 |
| R3 | Cross-tenant data leak in production | Medium | **Critical** | W1-6 query-builder middleware refuses unscoped queries. W5-9 regression suite has 100% pass requirement before Day-35 gate |
| R4 | Stripe Tax misconfiguration causes incorrect VAT on first invoice | Medium | Medium | W4-4 budget includes accountant verification of three sample invoices |
| R5 | Webhook deliveries silently fail | Low | Medium | `webhook_delivery_log` \+ admin retry endpoint (W4-1) |
| R6 | Backup restore drill reveals corrupted backup | Medium | **Critical** | W4-7 budgeted at 4h precisely because first restore reveals issues; runbook documents fixes |
| R7 | Partner asks for SOC 2 immediately and refuses to proceed | Medium | High | Self-attested CAIQ Lite (W5-4) \+ transparent SOC-2 commitment starting at €100K ARR |
| R8 | Founder skips outbound list and waits for inbound | Medium | **Critical** | Section 7 founder track is non-optional |
| R9 | Musiio shutdown delayed by SoundCloud, weakening migration narrative | Low | Medium | Validate cut-off before launch. LabelRadar / Tracklib / Monstercat / Audiosocket plays remain |
| R10 | Diligence questionnaire asks something CAIQ Lite doesn't cover | Medium | Medium | Founder commits to 5-business-day SLA for extended responses |
| R11 | First partner's catalogue is 10× larger than sandbox assumes | Medium | Medium | Throttle ingestion to 5K tracks/day; communicate timeline transparently |
| R12 | Wise Business verification stalls beyond Week 1 | Low | Medium | Open Revolut Business in parallel as fallback |
| R13 | Cloudflare CDN configuration breaks HLS playback | Low | High | Test on staging (W3-13) before applying to production |
| R14 | FAISS index rebuild after ingestion locks search for the affected partner | Low | Medium | Use `IndexFlatIP.add()` for incremental updates rather than full rebuilds; lock-free reads from old index until new one is built |

---

## SECTION 7 — FOUNDER PARALLEL TRACK

Founder owns these in parallel with engineering. **Do not assign to developer.**

| Days | Founder tasks |
| :---- | :---- |
| 1 | Engage music-industry counsel for DPA \+ B2B MSA \+ Mutual NDA. Open Wise Business (and Revolut Business as parallel fallback). Confirm `legal@`, `licensing@`, `support@` aliases route. Send LinkedIn post 1 (signal-processing vs neural similarity) |
| 2–7 | Build 30-target outbound list per partnership-strategy doc (Tracklib, Audiosocket, LabelRadar, Monstercat, Musiio refugees, Defected, Toolroom, Anjuna, etc.). Identify named decision-makers via LinkedIn |
| 8 | Record 60-second demo video for partners landing page (Loom). Send LinkedIn post 2 (catalogue dark-matter) |
| 8–14 | Record 3-minute outbound Loom demo. Finalise pitch deck (8 slides) |
| 15 | Send LinkedIn post 3 (EU residency \+ no-training procurement angle) |
| 15–21 | Receive counsel-drafted DPA / B2B MSA / Mutual NDA drafts. Counsel back-and-forth on legal pack. Finalise outbound email \+ LinkedIn templates per the three target segments (Musiio refugees / sync libraries / electronic labels) |
| 22 | Send LinkedIn post 4 (ADE 2026 announcement) |
| 22–28 | Counsel back-and-forth continues. Submit Abbey Road Red REDD application. Book ADE 2026 Pro Pass (Oct 21–25, Amsterdam). Apply for ADE Tech & Start-Up Track. Submit Music Tectonics Swimming with Narwhals 2026 application |
| 29–33 | Counsel finalisation (signed DPA / B2B MSA / Mutual NDA on shared drive by Day 33). Run diligence rehearsal with developer (W5-13) |
| 34–35 | Final pitch-deck polish. Confirm Day-35 readiness gate. Schedule first three Day-36 outbound emails |
| **36** | **Outbound starts.** Stage 1: Musiio refugee sprint \+ LabelRadar/Beatport |

---

## SECTION 8 — DECISION GATES

Five binary gates. Each ends a week. Pass \= continue. Fail \= halt and close the gap.

| Gate | Day | Pass condition | Fail consequence |
| :---- | :---- | :---- | :---- |
| Week 1 | 7 | All Week 1 acceptance criteria pass | Slip Week 2 by lost days; absorb into Week 5 buffer |
| Week 2 | 14 | All Week 2 acceptance criteria pass | Same |
| Week 3 | 21 | All Week 3 acceptance criteria pass; counsel templates in review | Halt Week 4 work until P0 closed |
| Week 4 | 28 | All Week 4 acceptance criteria pass; counsel templates in final-redline | Halt Week 5 work until P0 closed |
| **Day 35 readiness** | **35** | **All P0 items closed; founder track complete; diligence rehearsal passed** | **Do not start outbound. Allocate Week 6 contingency to close gap. Restart gate** |

---

## SECTION 9 — WEEK 6 CONTINGENCY (IF NEEDED)

If the Day-35 gate fails, this is the contingency. Maximum 5 working days, 35 hours, to close any P0 gap.

Likely failure modes and their Week-6 fixes:

| Likely failure | Week-6 fix | Hours |
| :---- | :---- | :---- |
| Counsel templates not final | Founder \+ counsel push to final | 0 (founder) |
| Backup restore drill failed | Re-run, fix encryption / config issue | 4–8 |
| Tenant-isolation regression suite has failing tests | Fix the failures | 4–12 |
| Stripe VAT calculation incorrect for one buyer profile | Reconfigure \+ re-test | 4–8 |
| Webhook delivery has silent failure | Debug Celery pipeline | 4–8 |
| CSV parsing breaks on real-world delivery format | Strengthen parser | 4–8 |

**If Week 6 is invoked, outbound starts Day 41\.** Communicate this to anyone who has been pre-warned of the Day-36 launch.

---

## SECTION 10 — POST-35-DAY BACKLOG (NOT IN SCOPE)

Acknowledged but not started until first paid pilot signed:

- Hook0 self-hosted webhook service (replaced by Celery dispatcher)  
- Datalust Seq centralised logging  
- Metabase admin BI  
- 1-Day Demo Widget (embeddable iframe)  
- Self-service partner-portal UI for API-key management  
- Partner-side benchmark methodology PDF  
- Full Python and JavaScript SDK packages  
- Migration to PostgreSQL \+ pgvector or Qdrant (only if scale demands)  
- DDEX ERN 4.3 ingestion (only if a major distributor partner requires)  
- ACR (Audible Magic / ACRCloud) integration  
- Adaptive bitrate HLS, MaxMind territory geoblocking  
- SOC 2 Type II audit (start at €100K ARR, \~6–12 months)  
- MinIO migration for petabyte-scale (when SX65 30TB approaches saturation)  
- Microservices split per `Microservices Architecture for DSP Onboarding.md`

---

## CLOSING — THE COMMITMENT

By Day 35, Resomix is positioned as follows:

- A working PYXIS-1 engine that any partner calls via a documented, versioned, rate-limited, audited API  
- Strict multi-tenant isolation, verified by automated regression suite  
- FAISS in-memory similarity search delivering sub-millisecond exact cosine similarity  
- A polished sandbox where a partner's engineering team runs first similarity search inside 5 minutes  
- Public docs at docs.resomix.com, status page at BetterStack subdomain, partners landing page on resomix.com  
- Custom Celery webhook dispatcher firing 7 lifecycle events with HMAC signature \+ exponential-backoff retry  
- DPA \+ B2B MSA \+ Mutual NDA ready to send within 24h of inbound interest  
- Trust Pack PDF \+ CAIQ Lite ready for procurement-team diligence  
- B2B Stripe with VAT, multi-currency, branded invoicing, three sample invoices verified by accountant  
- Documented backup with successful restore drill on file  
- Staging environment for safe future testing  
- Founder-driven 30-target outbound list, polished pitch deck, recorded demo Loom, ADE 2026 booked

**Total engineering effort: \~274 hours over 35 days.** **Total founder time: \~60 hours over 35 days.** **Total cash: €4K–€6K.**

This is the disciplined, honest version of partner-readiness incorporating every accepted developer correction, restructured into 5 sustainable weeks. The hours are real; the scope is locked; the gates are binary. After Day 35 the outbound sprint from the existing partnership-strategy roadmap begins, and the asset (PYXIS-1) finally becomes the business.

---

*End of v3.0. Reviewed jointly by founder and developer on Day 0; weekly status reviews on Days 7, 14, 21, 28; final readiness gate on Day 35\.*

*If a developer's review identifies additional issues during execution, log them, decide GO/NO-GO on incorporation, and update this document at the next weekly gate — not mid-week.*

# Implementation Plan — Frontend Guest Enforcement, Plans & Entitlements

**Companion to:** [`FRONTEND_PLANS_AND_GUEST_ENFORCEMENT.md`](./FRONTEND_PLANS_AND_GUEST_ENFORCEMENT.md) (the design/RFC). That doc says **what & why**; this doc says **how, in what order, and how we prove each step is correct**.

**Golden rules for every step below (non-negotiable):**
1. **Best practices / industry standards** — normalized data, server-authoritative enforcement, typed config, no hardcoded numbers, no secrets in code.
2. **Additive & reversible** — migrations chain on the current head `d9e0f1a2b3c4`, are guarded (exists-checks), and have working `downgrade()`.
3. **Test every step before moving on:** (a) `python -m py_compile` the touched files, (b) **unit tests** for the happy path, (c) **edge cases** (empty/None, boundary, concurrency), (d) **leak/authz checks** (soft-deleted excluded, ownership enforced, tenant scoping, guest can't spoof identity), (e) run the **relevant test subset green** (full suite when the change is broad). A step is not "done" until its tests are green.
4. **Small, shippable increments** — each step is independently deployable and behind the existing behavior until wired.
5. **Frontend-only scope** — System Partner 1 + guests. **Do not touch B2B** partner/API-key/quota/Stripe-B2B tables.

**Legend:** 🟦 Alwyzon (`basic_fastapi_server_resomix`) · 🟩 Hetzner (`resomix-similarity-open`) · 🟨 Frontend (`resomix-web`) · 🟧 Admin UI · 🧪 Tests · ✅ Definition of Done.

---

## 📍 Progress & Audit — checkpoint after Phase 7.1

**Full suite: 438 passed, 0 failed** with both servers healthy (Alwyzon 8001 + similarity 8004). Seed baseline verified intact after admin-write tests (15 features / 5 plans / 75 entitlements, default=`free`, zero leftover temp rows). Migrations head = `e2a3b4c5d6e7`. Seed = 15 features × 5 plans = 75 entitlements (idempotent, typed correctly, `free` = default).

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundations | ✅ done (folded into 1–3) | `entitlement_keys.py`, config constants (`guest_cookie_*`, `entitlement_cache_ttl_seconds`), Redis atomic helper. |
| 1 — Data model | ✅ done | `plans`/`features`/`plan_entitlements`/`entitlement_overrides`, `users.plan_id`, `playlists.guest_visitor_id`, `user_subscriptions` extended. Guarded, reversible, seeded. |
| 2 — Entitlement resolution | ✅ done | `EntitlementService` (override→plan→default, Redis version-cache). Evaluator **seam** added (non-breaking). |
| 3 — Guest identity | ✅ done (services) · ⚠️ not wired | `GuestIdentityService` + `get_guest_context`. **Gap:** not called by any endpoint yet → cookie never issued / `visitor_id` never derived live. |
| 4 — Counters + gate | ✅ done | `redis_counter` (atomic Lua), `UsageCounterService` (UTC daily, self-clearing), `EntitlementGate` (soft, fail-open). |
| 5 — Endpoint enforcement | 🟢 **core done** (tail = TODOs, see below) | Wired + tested: similarity-**upload** guest-deny, **rating** gate, **guest daily playlist limit + track clamp + `guest_visitor_id` tagging** (E2E via live 8004), **Spotify export** gate. **Logged-in daily migration = [T1] ✅ done** (both guests & logged-in now on the same `PLAYLISTS_PER_DAY` gate — split-brain resolved). Remaining tail: Apple/Tidal export ([T2]), analysis ([T3]). |
| 2.3 — Evaluator on entitlements | ✅ **done via [T1]** | `operation_limit_evaluator` now sources `playlist_create` limits from entitlements (override→plan→default) and enforces the daily counter; legacy `UserOperationLimit` retained only for `spotify_transfer`. |
| 6 — Guest → account association | ✅ **done** | 6.1 reparent guest playlists on register/login/2FA (device `visitor_id`, system-partner-scoped, idempotent, no cross-visitor/owned-row claim); 6.2 new users placed on the default (free) plan explicitly. Best-effort (never breaks auth). Tests: `test_phase6_reparent.py` (4). Signup-bonus consumption deferred → see [T4] (unblocked by [T1]). |
| 7.1 — Admin entitlement API | ✅ **done** | `/api/v1/admin/plans|features` read + `PUT` entitlement edit (typed-validated, cache-busting, audited) + `PATCH` plan flags (single-default invariant) + user effective-plan view. RBAC `plans:manage`. Tests: `test_admin_entitlements.py` (8). |
| 7.2 — Admin UI plan editor | 🟧 **next (frontend repo)** | Grid of plans × features with typed inputs, activate/deactivate, effective-plan lookup — consumes the 7.1 API. Lives in `resomix-web`, not this backend. |

### 🔖 TODO backlog
> **Scheduling (user decision, 2026-07):** [T2] and [T4] are **deferred to after all phases are complete** — verified that neither is a prerequisite for any remaining phase (Spotify already demonstrates the export-gate pattern for the frontend; the signup bonus is a standalone grant). Pick them up in the end-of-plan cleanup pass alongside [T5].
- **[T1] Logged-in daily migration — ✅ DONE (user-approved behavior change).** `playlist_create` is now governed by the plan's `PLAYLISTS_PER_DAY` daily counter for logged-in frontend users, via `OperationLimitEvaluator.check` (peek) + a new `record_success` (record), unifying them with the guest path. Centralized in the evaluator, so **all three creation paths** migrate together: similarity **upload** + **by_id** (`similarity_service` records) and playlist **fork** (`playlist_controller` records). `OperationLimitResult` gained a `reason` (`upgrade_required`) propagated by all three controllers. Legacy total-limit logic removed for `playlist_create`; the register-time `UserOperationLimit(1000)` grant is now **vestigial** for playlist_create (still read for `spotify_transfer`). Tests: `test_t1_logged_in_daily.py` (3: peek/record, per-user isolation, E2E 1/day denial). **Effect: existing users (NULL plan_id → free) now get 2 playlists/day** instead of a 1000 lifetime total. *(Cleanup candidate: drop the vestigial register grant — deferred to avoid touching the legacy op-limit tests.)*
- **[T2] Apple Music & Tidal export gating (blocked on auth uplift).** Their transfer endpoints authenticate with `get_api_key` only — no `get_current_user`, so no plan to gate on. Require `get_current_user` first, then apply `check_export("apple"/"tidal", user=…)` exactly like Spotify.
- **[T3] Analysis gating (no endpoint yet).** `analysis_per_day` / `analysis_feature_count` plumbing is ready; wire when the analysis action ships (Step 5.6).
- **[T4] Signup-bonus consumption (Step 6.2 tail) — now UNBLOCKED by [T1].** `signup_bonus_playlists` is seeded per-plan and users are on a plan + the daily gate. Grant the bonus as a **one-time** day-1 allowance (e.g. pre-seed the user's Redis daily counter to `-bonus`, or an effective-limit bump gated by a one-time token). Must be idempotent (applied exactly once). Small, stateful — deserves its own increment; not required for correctness.
- **[T5] `guest_cookie_secret` prod env + `.env.example`** (secrets hygiene, from the Phase-5 audit).

### Audit findings & things the original step list under-specified (NEW — address before "done")
1. **Two enforcement systems now coexist.** The legacy `operation_limits` still governs logged-in users (`playlist_create` = *total*, Spotify toggle); the new entitlement system is additive. **Logged-in users are still on the OLD total limit, not the new per-day** — the evaluator `check()` switch (Step 2.3 follow-up) must migrate them, or we have two sources of truth. *Decide + do in the Phase-5 remainder.*
2. **Guest cookie is never issued yet.** `get_guest_context` isn't mounted on any route. The deferred guest count gate/tagging need a `visitor_id`; when wiring, either (a) derive it in the controller from `request` (chosen approach — the similarity endpoints already receive `request`), and (b) issue the signed cookie via `get_guest_context`/middleware on the frontend surface so the fast-path exists.
3. **Live-server test fragility** — ✅ **FIXED.** Added conftest `_skip_live_server_tests_if_down`: the live-8001 modules (`test_auth_flow`, `test_user_profile`, `test_security_management`, `test_partner_management_flow`, `test_audio_search_similarity`) now **skip** when 8001 is unreachable instead of hard-failing. (The earlier "16 failed" was purely 8001 being down.) New similarity-8004 tests carry a `@requires_similarity` skip-guard too.
4. **`guest_cookie_secret` is a dev default** — must be set via env in prod and added to `.env.example` (secrets-hygiene).
5. **Confirmed NOT a gap:** force-public for guest playlists is already handled (`is_public = anon_frontend` in `async_create_similarity_playlist`).

### Phase 5 — status of each item (all 🟦 Alwyzon, controller-scoped, B2B-exempt via `partner_id == system_partner_id`)
- **5.1 Guest daily playlist gate + tagging** — ✅ **done.** In `get_similarity_by_id`: derive `visitor_id` from `request`; **peek-at-top + record-on-success** (`peek_allowed` / `record_use`, chosen over reserve-and-refund because the method has many early-return failure paths — cleaner + no refund bookkeeping); on deny → soft `login_required`. After a successful guest create, tag via a scoped `UPDATE playlists SET guest_visitor_id=… WHERE uuid=… AND user_id IS NULL AND partner_id=…`. **E2E-verified** (guest req1 creates a public, tagged playlist; req2 same device → 403).
- **5.2 Track-count clamp** — ✅ **done.** `top_sk = min(top_sk, get_cap(DROPDOWN_MAX_TRACKS))` for the frontend surface (guest 20 / free 50). Verified: a guest `top_sk=100` yields ≤20 similar tracks.
- **5.3 Export wiring** — 🟡 **Spotify done**, Apple/Tidal blocked. `check_export("spotify", user)` gates the Spotify transfer (free → 403 `upgrade_required`; basic+ per `export_targets`). **Gap discovered:** the **Apple Music & Tidal transfer endpoints authenticate with `get_api_key` only — no `get_current_user`** — so there's no user to resolve a plan from. They must **require `get_current_user`** first before they can be plan-gated. (Pre-existing inconsistency; flagged for review.)
- **5.6 Analysis** — ⏳ no endpoint exists yet; entitlement plumbing (`analysis_per_day`, `analysis_feature_count`) is ready to wire when analysis ships.
- **5.7 Rename** — ✅ already logged-in + owner-only.
- **Logged-in daily migration** — ⏳ **remaining.** Guests now use the new daily gate; **logged-in users still use the legacy `operation_limits` total limit** for `playlist_create`. Switch the evaluator `check()` (or the similarity controller) to `peek_allowed/record_use(PLAYLISTS_PER_DAY, user=…)` so logged-in users get the per-day limit too, and retire the old counting. Do carefully — update the existing `operation_limits` tests.

> Testing note: with **8004 up**, the full similarity create/search path is E2E-testable **in-process** (httpx ASGITransport → app → live 8004) using an indexed `electrobuzz` seed UUID. New tests carry a `@requires_similarity` skip-guard so they skip cleanly when 8004 is down. Live-8001 tests now also skip gracefully (new conftest `_skip_live_server_tests_if_down`).

> **Hetzner (🟩) summary up front:** **No Hetzner changes are required for this feature.** Enforcement is entirely Alwyzon-side — Alwyzon clamps `top_k` before calling the similarity server, and the "generate K / unlock N" teasing is Alwyzon-side redaction (existing `ANON_VISIBLE_COUNT` / `demo_mode_utils`). The similarity server just computes what it's asked. The only future cross-service touch is the (not-yet-built) **analysis** service, which is separate from Hetzner similarity. Each phase restates "Hetzner: none" so this stays explicit.

---

## Phase 0 — Foundations (no behavior change)

### Step 0.1 — Config constants & feature-key registry
- **Goal/why:** one source of truth for the reset timezone, Redis key prefixes, and the canonical **feature keys** so we never typo a key across services.
- 🟦 **Changes:** add to `app/core/config.py`: `entitlement_reset_tz = "UTC"`, `guest_redis_prefix = "guest"`, `entitlement_cache_ttl_seconds`. Add `app/core/entitlement_keys.py` — a frozen enum/constants of feature keys (`PLAYLISTS_PER_DAY`, `MAX_TRACKS_PER_PLAYLIST`, `DROPDOWN_MAX_TRACKS`, `CAN_EXPORT`, `EXPORT_SCOPE`, `EXPORT_TRACK_LIMIT`, `EXPORT_TARGETS`, `CAN_RENAME`, `CAN_FAVORITE`, `CAN_RATE_TRACKS`, `ANALYSIS_PER_DAY`, `ANALYSIS_FEATURE_COUNT`, `CAN_SIMILARITY_UPLOAD`, `DEFAULT_PLAYLIST_VISIBILITY`, `SIGNUP_BONUS_PLAYLISTS`).
- **Best practice:** enum/constants over string literals; central config; **UTC everywhere** for reset math (no DST bugs).
- 🟩 Hetzner: none. 🟨 Frontend: none. 🟧 Admin: none.
- 🧪 **Tests:** `py_compile`; unit test asserting keys are unique & stable (guards against accidental rename). ✅ constants import cleanly; no duplicate keys.

### Step 0.2 — Redis helper audit
- **Goal:** confirm `app/db/redis.py` exposes an async client usable for `INCR`/`EXPIRE`/`EVAL` (Lua) from request context; add a tiny typed wrapper if missing.
- 🟦 **Changes:** thin `app/services/redis_counter.py` with `incr_with_expiry(key, ttl)` (atomic via pipeline/Lua) and `get_int(key)`.
- **Best practice:** atomic check-and-increment (Lua or `INCR`+`EXPIRE NX`) to avoid a race where two concurrent requests both pass the limit.
- 🧪 **Tests:** unit test against a Redis (or fakeredis) — increment, TTL set once, concurrent increments counted exactly once each. ✅ atomicity proven by a concurrent-increment test.

---

## Phase 1 — Data model (schema first; no enforcement yet)

### Step 1.1 — `plans`, `features`, `plan_entitlements` (tables, models, seed)
- **Goal:** the normalized entitlement backbone (§8 of design doc). Adding a feature/plan later = data insert, **no migration**.
- 🟦 **Changes:** SQLAlchemy models `app/models/plan.py` (Plan, Feature, PlanEntitlement); **guarded Alembic migration** (down_revision = `d9e0f1a2b3c4`) creating the three tables with FKs, `UNIQUE(plan_id, feature_id)`, indexes on `plan_entitlements(plan_id)`. **Seed migration/script** inserting: the `features` catalog (with `value_type`, `window`, `default_value`), and the `guest` + `free` plans with their entitlement values from the spec; `basic/pro/max` seeded as `is_active=false` drafts.
- **Best practice:** 3NF (no per-feature columns on `plans`); typed value columns (`int_value`/`bool_value`/`string_value`) validated against `feature.value_type`; **idempotent seed** (`INSERT … ON DUPLICATE KEY UPDATE` / exists-checks) so re-running is safe; `updated_by`/`updated_at` for audit.
- 🟩 Hetzner: none.
- 🧪 **Tests:** `py_compile` models+migration; **migration up+down** on a scratch DB (round-trips cleanly); unit tests: FK/unique constraints enforced, seed is idempotent (run twice → same rows), every seeded entitlement's value parses to its `feature.value_type`. ✅ `alembic upgrade`/`downgrade` clean; seed idempotent; constraint tests green.

### Step 1.2 — `users.plan_id` + `playlists.guest_visitor_id`
- **Goal:** attach users to a plan; tag guest-created playlists for enforcement + reparenting.
- 🟦 **Changes:** guarded migration adding `users.plan_id` (FK→plans, **nullable**) and `playlists.guest_visitor_id` (`varchar(64) NULL`, indexed). Update `User` and `Playlist` models.
- **Best practice:** **nullable `plan_id` resolved to the `is_default` plan at read time** → no risky backfill; add an **optional** one-time backfill script (existing users → free) that's idempotent. Index `guest_visitor_id` (lookups on reparent).
- 🧪 **Tests:** migration up/down; model round-trip; a user with `plan_id NULL` resolves to free (tested in Phase 2); index exists. ✅ columns+index present; models load; up/down clean.

### Step 1.3 — `subscriptions` table (design now, unused)
- **Goal:** shape the future paid layer so Phase-2 resolution can already prefer an active subscription's plan. **No billing yet.**
- 🟦 **Changes:** model + guarded migration for `subscriptions` (user_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start/end, cancel_at_period_end). Nullable/empty for now.
- **Best practice:** separate from B2B Stripe; status enum includes `past_due`/`canceled` so the evaluator can fall back to free.
- 🧪 **Tests:** migration up/down; model loads; FK integrity. ✅ table exists, unused, no runtime impact.

---

## Phase 2 — Entitlement resolution layer (read-only; nothing enforced yet)

### Step 2.1 — Effective-plan resolver
- **Goal:** given a caller, return the effective plan: **guest → guest plan; user → active `subscription.plan_id` else `users.plan_id` else free**; non-`active/trialing` subscription → treat as free.
- 🟦 **Changes:** `app/services/entitlement_service.py::resolve_plan(caller)`.
- **Best practice:** pure function of DB state; explicit fallback ladder; no side effects.
- 🧪 **Tests:** unit matrix — guest, free user (plan_id set), user with NULL plan_id → free, user with active sub → sub plan, user with `past_due` sub → free. ✅ all branches covered.

### Step 2.2 — Entitlement value resolver + Redis cache
- **Goal:** `get_entitlement(caller, feature_key) -> typed value` with precedence **override → plan_entitlement → feature.default**, cached per plan in Redis with **explicit invalidation**.
- 🟦 **Changes:** `EntitlementService.get_entitlement/…_bool/…_int`; Redis cache key `entl:plan:{plan_id}:v{version}`; a `plans.entitlements_version` (or a Redis version key) bumped on admin edit → **cache-bust**.
- **Best practice:** typed casting via `feature.value_type`; cache the whole plan's entitlement map (one read), not per-feature; **bust on write** (the classic bug is edits "not taking effect").
- 🧪 **Tests:** precedence (override wins; missing plan_entitlement → default), type casting (int/bool/enum/csv), **cache hit path**, **cache invalidation after an edit**, unknown feature_key → error not silent-false. ✅ precedence + cache-bust proven.

### Step 2.3 — Evolve `operation_limit_evaluator`
- **Goal:** make the existing evaluator source limits from `EntitlementService` (override → plan → default) instead of hardcoded defaults, **without breaking current `playlist_create` / spotify behavior**.
- 🟦 **Changes:** map existing `OperationType.code`s to feature keys; evaluator consults `EntitlementService`; keep `UserOperationLimit` as the **per-user override** layer (its `window_seconds` still usable). Daily counting moves to Redis (Phase 4); total counts stay as `COUNT(...)` (already excludes soft-deleted — we fixed that).
- **Best practice:** backward-compatible; feature-flag the new path if needed; no change to callers' signatures where avoidable.
- 🧪 **Tests:** existing operation-limit tests stay green; new tests: a plan change alters the effective limit; per-user override still wins. ✅ old tests green + new precedence tests green.

---

## Phase 3 — Guest identity (server-authoritative)

### Step 3.1 — Signed guest cookie
- **Goal:** issue an httpOnly, SameSite=Lax, **server-signed** guest cookie carrying a random `guest_id` (fast-path identity; layer 1).
- 🟦 **Changes:** `app/services/guest_identity_service.py` (issue/verify, HMAC-signed, short TTL, rotate-safe); set on first anonymous hit via middleware/dependency.
- **Best practice:** httpOnly (no JS access), signed (tamper-evident), SameSite, no PII inside.
- 🧪 **Tests:** issue→verify round-trip; **tampered cookie rejected**; missing cookie → new one minted. ✅ tamper rejection proven.

### Step 3.2 — `visitor_id` derivation (ThumbmarkJS + IP + lang)
- **Goal:** derive a **server-side, signed `visitor_id`** = `sha256(thumbmark_hash + ip_/24 + accept_language)`, with the signed cookie as fast-path. **Never trust a client-sent visitor_id.**
- 🟦 **Changes:** `guest_identity_service.derive_visitor_id(request)` reading the ThumbmarkJS hash from a header (e.g., `X-Device-Hash`), extracting client IP correctly (respect proxy/`X-Forwarded-For`/Cloudflare), reducing to /24, hashing server-side.
- **Best practice:** **server authority** (client supplies raw signals only); correct client-IP extraction behind the proxy; treat IP as weak corroboration; document the swap-in seam for a paid Pro `visitor_id` later (zero schema change).
- 🧪 **Tests:** determinism (same inputs → same id), **client-supplied `visitor_id` ignored**, IP /24 reduction correct (incl. IPv6 /48), missing device-hash → cookie/IP fallback (degraded), spoof attempt can't impersonate another visitor. ✅ spoof-resistance + determinism proven.

### Step 3.3 — Guest-context dependency
- **Goal:** a FastAPI dependency `get_guest_context` that yields `{visitor_id, is_guest}` for anonymous frontend requests (partner 1, no JWT).
- 🟦 **Changes:** dependency composing `get_current_user_optional` + `guest_identity_service`.
- 🧪 **Tests:** logged-in → not guest; anonymous → guest with visitor_id; B2B partner path unaffected. ✅ correct classification.

---

## Phase 4 — Guest counters & enforcement primitives (Redis)

### Step 4.1 — `GuestUsageService` (daily counters, UTC, TTL)
- **Goal:** per-visitor daily counters keyed `guest:{visitor_id}:{feature}:{UTC-date}` with TTL to the next UTC midnight; atomic check-and-increment.
- 🟦 **Changes:** `app/services/guest_usage_service.py` using `redis_counter` (Step 0.2).
- **Best practice:** UTC date key; **TTL set on first INCR** so it self-clears (answers "we don't hoard Redis"); atomic (Lua) so concurrency can't overshoot.
- 🧪 **Tests:** increment+TTL; **reset boundary** (key rolls at UTC midnight); **atomic concurrency** (N parallel creates → exactly N counted, limit not exceeded); expiry removes key. ✅ atomicity + reset proven.

### Step 4.2 — Enforcement gate helper
- **Goal:** one `enforce(caller, feature)` that handles the three feature shapes: **counted** (compare Redis counter vs entitlement), **boolean** (flag), **cap** (clamp/deny at validation), returning a structured **soft** result (never a hard security block for guests).
- 🟦 **Changes:** `app/services/entitlement_gate.py` returning `{allowed, reason, cta}`; a helper to translate to responses (`login_required` / `upgrade_required`).
- **Best practice:** soft gating (nudge), don't leak the mechanism, consistent response envelope; **daily counter incremented only on success**.
- 🧪 **Tests:** counted over/under limit; boolean allow/deny; cap clamp; guest vs free vs paid; **admin number change reflected** (via cache-bust). ✅ all shapes + tiers covered.

---

## Phase 5 — Wire enforcement into endpoints (🟦 Alwyzon)

> Each sub-step: enforce via `entitlement_gate`, add unit + integration tests for **guest / free / paid**, and **leak/authz** assertions. Hetzner: none throughout.

### Step 5.1 — Playlist creation (similarity create path)
- Enforce `playlists_per_day` (guest via Redis visitor counter; user via Redis user counter). For guests: set `playlists.guest_visitor_id`, force `is_public=TRUE`. Increment **only on success**.
- 🧪 guest at/over limit → soft `login_required`; free user daily limit; counters isolated per visitor/user; soft-deleted playlists don't count (already fixed); concurrency doesn't overshoot. ✅

### Step 5.2 — Track-count cap (dropdown greying source of truth)
- Clamp `top_sk` to `min(requested, entitlement(MAX_TRACKS_PER_PLAYLIST))`; expose `dropdown_max_tracks` so the frontend greys the rest. Generalize the existing `ANON_VISIBLE_COUNT` "unlock N" redaction to read from entitlements (guest unlock vs generate).
- **Best practice:** enforce server-side (never trust the client's chosen count); the greying is UX, the clamp is the guard.
- 🧪 request above cap → clamped, not errored; guest generate-K/unlock-N correct; per-tier caps; teasing redaction stable. ✅

### Step 5.3 — Export gating
- Gate Spotify/Apple/Tidal transfer endpoints on `can_export` + `export_scope` (`none/first_n/full`) + `export_track_limit` + `export_targets` (csv). Guest → denied; free → e.g. first-N text; paid → full + targets.
- 🧪 each target allowed/denied per plan; scope/limit honored; ownership still required; no soft-deleted playlist exportable. ✅

### Step 5.4 — Rating gating
- Gate track-rating endpoints on `can_rate_tracks` (guest denied).
- 🧪 guest denied; user allowed; existing rating tests green. ✅

### Step 5.5 — Similarity-by-upload gating
- Gate `/similarity/upload` on `can_similarity_upload` (guest denied → `login_required`).
- 🧪 guest denied cleanly; logged-in allowed; upload validation unaffected. ✅

### Step 5.6 — Analysis gating (feature stubbed)
- Gate the (future) analysis action on `analysis_per_day` + `analysis_feature_count`. Until analysis exists, the endpoint returns a clean "not yet available / gated" — but the **entitlement plumbing is wired now** so enabling it later is data-only.
- 🧪 entitlement resolves; daily counter path exercised with a stub; guest = 0. ✅

### Step 5.7 — Rename (confirm, no change)
- Rename is already **logged-in + owner-only** (we hardened it). Confirm `can_rename` maps to "logged-in users, own playlist" and guests are simply never offered it.
- 🧪 existing rename tests green; guest has no rename path. ✅

---

## Phase 6 — Guest → account association ✅ (core done)

### Step 6.1 — Reparent guest playlists on login/register ✅ **done**
- 🟦 On successful **register / login / 2FA-verified login**, `UPDATE playlists SET user_id=:uid, guest_visitor_id=NULL WHERE guest_visitor_id=:vid AND user_id IS NULL AND partner_id=:system_partner_id`.
- **Implementation:** `AuthService._reparent_guest_playlists(db, user_id, visitor_id)` (raw SQL → bypasses the ORM tenancy failsafe; explicit `partner_id` scoping). The controller derives the device `visitor_id` via `GuestIdentityService.derive_visitor_id(request)` (same derivation the similarity path used to tag) and threads it through `register_user` / `login_user` / `verify_2fa_and_login` → `_create_user_session` (the single login choke point covering both login and 2FA). **Best-effort** — a derivation/DB hiccup logs and returns 0, never breaking auth.
- **Best practice:** idempotent (re-run matches nothing once owned & un-tagged); only claims **unowned** rows tagged with **that** visitor under the **frontend system partner** → no cross-visitor / cross-partner / owned-row claim.
- 🧪 `test_phase6_reparent.py`: reparent-own-only + isolation from another visitor; idempotent re-run + no-op without visitor_id; **never claims an already-owned row**; login-endpoint E2E (controller derives + threads the id). ✅

### Step 6.2 — Default plan + signup bonus 🟢 **default-plan done; bonus = [T4] TODO**
- 🟦 On register: `AuthService._assign_default_plan` sets `users.plan_id` = the `is_default` plan (best-effort; resolution already treats NULL as default, so this just makes it explicit for admin queries). ✅
- ⏳ **Signup bonus deferred → [T4].** `signup_bonus_playlists` is seeded and readable, but granting it by seeding the user's Redis daily counter is only meaningful once logged-in users are on the daily gate (**[T1]**). Wire the two together. No guest-counter cross-referencing.
- 🧪 new user is on the default plan (covered). Bonus tests land with [T1]/[T4]. 

---

## Phase 7 — Admin API + UI

### Step 7.1 — 🟦 Admin entitlement endpoints ✅ **done**
- **Endpoints** (`/api/v1/admin/...`, reads need `admin:access`, writes add `plans:manage`): `GET /plans` (all plans + resolved entitlements), `GET /features` (catalog), `GET /plans/{code}`, `PUT /plans/{code}/entitlements/{feature_key}` (typed-validated edit), `PATCH /plans/{code}` (name / is_active / is_default), `GET /users/{uuid}/effective-plan` (support view: plan + entitlements + overrides).
- **Implementation:** `AdminEntitlementService` (validate+cast vs `feature.value_type`; upsert the correct typed column; **bump `entitlements_version` + drop Redis cache** via `EntitlementService.bump_plan_version`; stamp `updated_by`; single-default invariant) → `AdminEntitlementController` (`KeyError`→404, `ValueError`→400) → router. Added `plans:manage` to the RBAC registry (auto-granted to the admin role + the static super-key).
- 🧪 `tests/api/admin/test_admin_entitlements.py` (8): list/get/features/effective-plan (+404s), typed validation (int/bool ok, bad-type→400, unknown feature/plan→404), plan-flag update, **single-default invariant** (restores the real default), non-admin rejected (401/403), and the money test — **edit busts the cache so `EntitlementService` reads the new value immediately**. Mutation tests use throwaway temp plans (never seeded rows). ✅

### Step 7.2 — 🟧 Admin UI plan editor (frontend — next deliverable, not in this repo)
- A grid: **plans × features** with typed inputs (int / toggle / enum / csv), save-per-cell, plan activate/deactivate, view a user's effective plan + overrides.
- **Best practice:** optimistic UI with server validation; confirm on destructive edits; show "who/when last changed."
- 🧪 (frontend) component + e2e: edit a number → reflected in an API call's enforcement. ✅

---

## Phase 8 — Frontend (🟨 `resomix-web`)

> **Backend prerequisite for 8.2 — ✅ done (in Alwyzon):** `GET /api/v1/entitlements/me` returns the caller's effective plan + full entitlement map (plan values with per-subject overrides overlaid), for guests (server-derived `visitor_id`, never returned) and logged-in users alike. `EntitlementService.get_effective_map` + `EntitlementController` + `app/api/routers/entitlements.py`. Tests: `test_entitlements_me.py` (3). The frontend drives all of 8.2 off this single call.

### Step 8.1 — Device signal + guest cookie 🟢 **transport layer done** (in `resomix-web`)
- ✅ `packages/api-client/src/deviceId.ts` — **ThumbmarkJS** loaded from CDN (no bundle dep → degrades gracefully if blocked/offline), computed once, cached in memory + localStorage. `X-Device-Hash` injected on all non-admin requests by **both** axios interceptors (`utils.ts` + `authClient.ts`). `initDeviceHash()` fired at app start (`apps/webapp/src/main.tsx`). **Backend:** `X-Device-Hash` added to `cors_allow_headers` (else preflight would block every request). Type-checks clean.
- ⏳ Remaining: verify in a browser (incognito, adblock-on fallback), and the httpOnly guest **cookie** issuance (server already signs/verifies it; wire `get_guest_context` on the frontend surface if a fast-path cookie is wanted alongside the device hash).

### Step 8.2 — Entitlement-driven UI 🟢 **data layer done; component wiring remains** (in `resomix-web`)
- ✅ **Backend:** `GET /api/v1/entitlements/me` (see prerequisite above). **api-client:** `getMyEntitlements()` + `FEATURE_KEYS` + types (`entitlements.ts`). **hooks:** `useEntitlements()` (shared cache, typed `getInt/getBool/getStr/can`, `dropdownMaxTracks`, `playlistsPerDay`, `refresh()` for post-login/upgrade) — type-checks clean.
- ✅ **Two entitlement dimensions, both wired (desktop + mobile):**
  - **`dropdown_max_tracks` — depth selection:** shared `useTrackCountOptions()` locks count options beyond the plan cap (guest 20 / free 50 / basic+ 100), clamps `topSk`, and renders an **aligned** `LockNudge` (inline lock SVG + text via flex) with **tier-correct copy** — "Log in to unlock deeper results" (guest) / "Subscribe…" (logged-in). Logged-in users never see the login message.
  - **`max_tracks_per_playlist` — result unlock/teasing:** generalized the previously guest-only, hardcoded `rank > 10` blur in `sections/{desktop,mobile}/Playlist/PlaylistTable.tsx` to be **entitlement-driven for all tiers** (guest 10 / free 20 / basic 50 / pro 100). Locked rows blur; a tier-aware upsell card (Create account + Log In for guests; **Subscribe** for logged-in) sits 2 rows into the locked zone. No restriction while entitlements load (no flicker/false-lock).
  - **CTA routing seam:** `useEntitlementCta()` centralizes where nudges go — `login` → `/auth/login?redirect=…` (live); `subscribe` → behind `SUBSCRIPTION_ENABLED` (false now) so every "Subscribe" CTA activates the moment billing ships, no per-component edits. New `useEntitlements` convenience: `maxTracksPerPlaylist`.
  - `tsc -b` clean; no new eslint errors (pre-existing a11y warnings in those files untouched).
- ✅ **Server-side companion (design 5.2) — done.** The similarity result redaction is now **entitlement-driven for the whole frontend surface** (not anonymous-only): `SimilarityController._apply_frontend_unlock_redaction` scrambles tracks beyond `max_tracks_per_playlist` per tier (guest 10 / free 20 / basic 50 / pro 100); B2B never redacted. So the "unlock N" is server-authoritative — locked tracks' real metadata never leaves the server. Tests: `test_result_redaction.py` (3). Guest behaviour unchanged (still 10).
- ✅ **`top_sk` clamp gap closed.** `get_similarity_by_id` already clamped to `dropdown_max_tracks`; added the same clamp to `get_similarity_upload` (a hand-crafted request from a logged-in free user can no longer exceed their 50 cap; guests are blocked from upload entirely).
- ✅ **Soft-gate CTA (`login_required` / `upgrade_required`) — done, end-to-end.** api-client `handleApiError` now surfaces `reason`; `useUploadStore` gained `gateReason`; both similarity hooks (`useSelection` + `useUpload`) detect a gate reason and set it instead of a generic error; a reusable `GateCtaModal` (log-in/sign-up for guests, Subscribe for logged-in — routed via `useEntitlementCta`) renders on both `UploadPage` (desktop) + `UploadMobile`. `tsc -b` clean; no new eslint.
- ⏳ Remaining: show/hide **export/rename/favorite/rate** from `useEntitlements` (the `components/Modals/*` surfaces); call `useEntitlements().refresh()` on auth change (so limits re-resolve after login/logout); in-browser verification (dev server).
- **Best practice:** UI reflects entitlements but the **server is the guard** (greying is convenience, not security).
- 🧪 e2e (pending browser): guest hits daily limit → login CTA; after login, guest playlists appear (reparented); upgrade CTA on paid features.

### Step 8.3 — Consent / privacy disclosure
- Disclose fingerprinting for anti-abuse under **legitimate interest**, **separate from the analytics (PostHog/GA) consent** (which stays optional). Update privacy policy + `consentConfig.ts`.
- **Best practice:** don't gate enforcement behind optional analytics consent; document retention.
- 🧪 declining analytics consent still lets enforcement work; disclosure present. ✅

---

## Phase 9 — Hardening & operations

- **Retention/purge job** (🟦): delete unclaimed guest playlists (`guest_visitor_id NOT NULL`, older than N days) + confirm Redis TTLs; **GDPR erasure** by `visitor_id`/`user_id`.
- **Abuse brakes:** rate-limit guest creation (existing slowapi), optional **Cloudflare Turnstile/hCaptcha** hook on guest create if bots appear.
- **Observability:** metrics for gate hits (allow/deny/soft), counter sizes, cache hit-rate.
- 🧪 purge job idempotent + scoped; rate-limit returns soft; metrics emitted. ✅

## Deferred (design-ready, build later) — Paid billing
- `subscriptions` population + **Stripe consumer billing** (separate from B2B), **Stripe-driven proration** on upgrade (credit = `old_price × remaining_days/period_days`; your 3.33€ example), **downgrade next period (no refunds)**, **dunning → fall back to free** on `past_due`. Grandfathering decision (live entitlements vs snapshot on subscription) **before** paid launch.

---

## Coverage check vs the design doc (nothing missed)

| Design doc (`FRONTEND_PLANS_AND_GUEST_ENFORCEMENT.md`) | Covered by |
|---|---|
| §2 Guest tooling = ThumbmarkJS (MIT) + cookie + IP | Steps 3.1, 3.2, 8.1 |
| §3 Combined certainty / **false positives = soft gate only** | Steps 4.2, 5.1 (soft `login_required`), 8.2 |
| §4 Privacy/GDPR, legitimate interest, retention | Steps 8.3, 9 |
| §5 Redis TTL counters, **self-clearing**, UTC reset | Steps 0.1, 4.1 |
| §6 Guest→account reparent + **signup bonus** | Steps 6.1, 6.2 |
| §7 Flows (guest create / paywall / resolution precedence) | Steps 4.2, 5.1, 2.2 |
| §8 DB: plans / features / plan_entitlements / subscriptions / users.plan_id / playlists.guest_visitor_id | Steps 1.1, 1.2, 1.3 |
| §8.3 Counters: **Redis daily**, DB totals exclude soft-deleted | Steps 4.1, 5.1 |
| §9 Evolve `operation_limits` (override→plan→default, Redis cache) | Steps 2.1, 2.2, 2.3 |
| §10 Proration / downgrade next cycle / **Stripe-driven** / grandfathering | Deferred section |
| §11 Gaps: bots→captcha, signup-bonus abuse→email-verify, cache-bust, timezone, audit, export-scope/targets, analysis two levers, GDPR erasure, guest-public-on-reparent | Steps 5.3 (export shapes), 5.6 (analysis levers), 6.2 (bonus), 7.1 (cache-bust+audit), 9 (captcha, purge, erasure), 0.1 (timezone) |
| §12 Phased rollout | This entire doc (Phases 0–9 + deferred) |
| Rename = logged-in own-only (clean) | Step 5.7 (confirm, no change) |
| **PostHog** = analytics/feature-flags only, **not** enforcement | Step 8.3 (kept separate) |
| **Hetzner = no changes** (Alwyzon clamps top_k; teasing is Alwyzon-side) | Stated up front + per-phase "Hetzner: none" |

**Result:** every design-doc section maps to at least one implementation step. Two design points intentionally **deferred** (paid billing/proration, per your call) are captured in the Deferred section so they aren't lost.

---

## How to execute this safely (process)
1. Do steps **in order**; each is a small PR/commit.
2. For each: `py_compile` → write/extend unit tests (happy + edge + leak/authz) → run the **relevant test subset** green → only then proceed. Run the **full suite** at the end of each Phase.
3. Keep every limit/toggle as **data** (never hardcode) so the admin controls it.
4. Never let the client be authoritative for identity or counters.
5. Keep B2B and consumer paths cleanly separated throughout.
</content>

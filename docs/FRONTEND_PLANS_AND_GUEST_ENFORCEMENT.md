# Frontend Users: Guest Enforcement, Plans & Entitlements — Design Document

**Status:** Design / RFC (no code yet). **Scope:** Frontend consumer users + guests only (System Partner 1). **Explicitly out of scope:** B2B partners (they keep their own partner / API-key / quota / Stripe-B2B system — do not overload those tables).

**Author context:** current Alembic head is `d9e0f1a2b3c4` (playlists `deleted_at`). Everything here is **additive on top of** the existing schema and the existing `operation_limits` subsystem.

---

## 0. Table of contents
1. [Goals & the honest reality](#1-goals--the-honest-reality)
2. [Guest identification — tool comparison](#2-guest-identification--tool-comparison)
3. [How sure can we actually be? + false positives](#3-how-sure-can-we-actually-be--false-positives)
4. [Privacy & legal (EU / GDPR)](#4-privacy--legal-eu--gdpr)
5. [Guest lifecycle & Redis (what we store, what we clear)](#5-guest-lifecycle--redis)
6. [Guest → account association on login](#6-guest--account-association-on-login)
7. [Flows (guest creation, paywall, entitlement resolution)](#7-flows)
8. [Database design (Part 2)](#8-database-design-part-2)
9. [Reusing & evolving the existing operation_limits](#9-reusing--evolving-operation_limits)
10. [Subscription billing, proration & plan changes (notes / future)](#10-subscription-billing-proration--plan-changes)
11. [Gaps, good-to-knows & things we're missing](#11-gaps-good-to-knows--things-were-missing)
12. [Phased rollout](#12-phased-rollout)
13. [Sources](#13-sources)

---

## 1. Goals & the honest reality

**Goal:** enforce per-tier limits (guest / free / paid) on frontend users, with **all numbers and toggles admin-editable**, future-safe for paid plans, and cleanly separate from B2B.

**The honest reality about guests (read this first):** you **cannot** deterministically identify a guest who combines *incognito + cache/cookie clear + a different browser + a VPN + a different device*. That is a property of the web, not a budget problem. The realistic objective is:

> **Raise the cost of evasion above the cost of just signing up, and stop the *casual* evader (incognito / clear cookies / same device) — not the determined one.**

This is the right objective because, per our own product spec, a guest gains **almost nothing** by evading: they still can't export, rename, favorite, rate, or upload — all the real value is behind the login wall. So we spend *little* effort here and lean on the login wall as the real lever.

---

## 2. Guest identification — tool comparison

We will **not** pay for a commercial identity service now (Fingerprint Pro / ThumbmarkJS Pro / SEON / Castle). So the realistic menu is open-source client-side fingerprinting + our own server-side composite.

| Option | Accuracy (stable re-ID) | License | Cost | Notes |
|---|---|---|---|---|
| **ThumbmarkJS** (OSS) | **~80%** uniqueness client-side | **MIT** (production-safe) | Free | Actively maintained, 60k+ sites, ~1B fp/month. **Recommended base.** |
| **FingerprintJS** (OSS) | 40–60% | **BSL** ⚠️ (restricts production use) | Free | Popular but the license is a real problem for a commercial product; also lower accuracy. **Avoid for us.** |
| **ClientJS** | Low (stale) | MIT | Free | Unmaintained (~4 yrs); poor field performance. Skip. |
| **CreepJS** | High signal, but an *audit* tool | OSS | Free | Heavy, not production-grade for volume; great as a reference for signals to collect. |
| **In-house** (canvas/WebGL/audio/fonts/hardware/UA-CH hashed) | ~50–75% depending on effort | Ours | Dev time | Full control + no license risk, but you're re-building what ThumbmarkJS already does. Only worth it long-term. |
| **Commercial (Fingerprint/Thumbmark Pro, SEON, Castle)** | ~99–99.5%, VPN-resistant | Paid | €€ usage-based | **Deferred** until revenue justifies it. Design so we can swap the `visitor_id` source to this later with zero schema change. |

### Recommendation
**ThumbmarkJS (MIT, ~80%) as the client fingerprint**, fused **server-side** with two more layers into one `visitor_id`:

1. **Signed guest cookie** — httpOnly, SameSite=Lax, server-issued short JWT holding a random `guest_id`. Survives normal browsing; defeated by incognito/clear. *Cheapest, catches the honest majority.*
2. **ThumbmarkJS fingerprint hash** — device-based, **survives incognito + cookie clearing**. The workhorse.
3. **Network signal** — **IP /24 subnet or ASN**, used only as *corroboration* and coarse velocity, **never** as a hard key (CGNAT / shared office/uni/carrier IPs → many real users share one IP; VPN changes it trivially).

**Composite:** `visitor_id = sha256(thumbmark_hash + ip_/24 + accept_language)` (server-side), with the signed cookie as a fast-path when present. Store the mapping in Redis. **Because we compute `visitor_id` ourselves, swapping in a Pro service later is a one-line change** — the rest of the system only ever sees a `visitor_id`.

> Design note: keep the raw signals server-side only; never trust a client-sent `visitor_id` (a guest could forge it). The client sends the ThumbmarkJS hash + cookie; the server derives and signs the `visitor_id`.

---

## 3. How sure can we actually be? + false positives

### Combined certainty (realistic)
With **signed cookie + ThumbmarkJS + IP/ASN** you will reliably re-identify roughly **~75–85% of returning devices** under normal conditions. The **~15–25% you miss** are: privacy-hardened browsers (Tor, Brave strict, Firefox RFP), genuinely new devices, or the full evasion combo. That is **good enough** for a soft, conversion-oriented limit.

### False positives are the real risk — and here's the data
Independent research finds **more than 1 in 5 (>20%) static fingerprint IDs are shared by multiple distinct real users** (identical phone models/OS/settings, same corporate IP, etc.). If we **hard-block** on fingerprint, we will wrongly block innocent new users. Mitigations — all of which we adopt:

- **Treat the guest limit as a *soft nudge to log in*, never a hard security block.** The cost of a false positive is then tiny: a brand-new user is asked to sign up *slightly early*. Annoying, not harmful (unlike blocking a purchase). Frame every guest gate this way.
- **Require agreement across ≥2 signals** before treating two sessions as "the same guest" (e.g., fingerprint match *and* same /24), so a lone fingerprint collision doesn't trip it.
- **Accumulate evidence over time** (confidence grows with repeat visits) rather than acting on a single session.
- **Set the guest daily limit generously** (admin-tunable) so a collision victim isn't meaningfully harmed.
- **Never surface *why*** ("you already made a playlist today" → "sign up to make more"), so we don't leak the mechanism or accuse a new user.

**Bottom line:** we accept ~15–25% evasion and a small collision rate as the cost of a free, privacy-respectful, no-hard-block approach. The login wall — not the fingerprint — is our real defense.

---

## 4. Privacy & legal (EU / GDPR)

We use euro pricing → assume EU users → GDPR/ePrivacy apply.

- Fingerprinting for **anti-abuse/security** is generally defensible as **legitimate interest**, but you **must**: (a) **disclose** it in the privacy policy, (b) store only a **hashed `visitor_id`** (no raw PII), (c) **auto-purge** guest data after a short retention window (data minimization).
- Some EU interpretations require **consent** for non-strictly-necessary fingerprinting. Anti-fraud is usually treated as necessary, but **have counsel confirm** before launch and consider a cookie/consent banner that covers it.
- Retention: unclaimed guest playlists + Redis identity data get a **TTL / purge job** (e.g., 30–60 days), matching guest-checkout retention norms.

---

## 5. Guest lifecycle & Redis

**Answer to "do we clear Redis or just keep compiling?" → Everything in Redis has a TTL and self-clears. We do *not* hoard.** Two data classes:

| Key | Purpose | TTL / clearing |
|---|---|---|
| `guest:{visitor_id}:playlists:{YYYY-MM-DD}` | daily playlist counter | **expires at reset boundary** (auto-clears) |
| `guest:{visitor_id}:analysis:{YYYY-MM-DD}` | daily analysis counter | expires at reset boundary |
| `guest:{visitor_id}:meta` | last-seen, velocity, cookie↔fp link | short TTL (e.g., 24–72h), refreshed on visit |
| `guestcookie` (httpOnly) | fast-path `guest_id` | cookie maxAge (e.g., 30d), server-signed |

- **Daily counters** are keyed by date and given a TTL to the next reset → they **auto-expire**, so Redis never grows unbounded per guest.
- The **only durable guest footprint is in MariaDB**: the playlist rows the guest created, tagged with `guest_visitor_id`. Those are either **reparented on login** or **purged by a retention job** if never claimed.
- **Reset boundary / timezone:** use a **single fixed timezone for all reset math — recommend UTC** (no DST surprises), key = `…:{UTC-date}`. Tradeoff: a user in a late tz sees their reset "mid-evening." Acceptable; revisit if users complain (alternative: reset at a fixed local hour per user — more complex, defer).

---

## 6. Guest → account association on login

Guest-created playlists persist in MariaDB tagged with `guest_visitor_id` (not `user_id`). On **register or login**, run the standard anonymous-merge:

```sql
UPDATE playlists
   SET user_id = :new_user_id, guest_visitor_id = NULL
 WHERE guest_visitor_id = :current_visitor_id
   AND user_id IS NULL;
```

- **Signup bonus (your decision):** instead of the fiddly "give one more if they had one today," on signup we simply **grant the full logged-in daily allowance fresh** (or an admin-set `signup_bonus_playlists`). Clean, no cross-referencing guest counters. ✔️
- **Rename stays clean (your decision):** only **logged-in users can rename their *own* playlists** (ownership = `user_id` match — which we already enforce). Guests never rename. No messy guest-ownership logic. ✔️

---

## 7. Flows

### 7.1 Guest playlist creation (soft-gated)
```
Browser                         Alwyzon (API)                     Redis
  │  create playlist ─────────────▶│
  │  (thumbmark hash + guest cookie)│
  │                                 │  derive visitor_id
  │                                 │  (cookie → else fp+/24 composite)
  │                                 │  plan = GUEST plan
  │                                 │  limit = entitlement(GUEST, playlists_per_day)
  │                                 │  INCR guest:{vid}:playlists:{utc-date} ──▶│ (TTL→reset)
  │                                 │◀── count ────────────────────────────────│
  │                                 │  count > limit?
  │                                 │     yes → 200 with {gated:true,           
  │                                 │            reason:"login_required"}  ← soft nudge, no hard block
  │                                 │     no  → create playlist (user_id=NULL,
  │                                 │            guest_visitor_id=vid,
  │                                 │            is_public=TRUE,           ← guest playlists always public
  │                                 │            num_tracks ≤ entitlement(GUEST,max_tracks_per_playlist))
  │◀── response ────────────────────│
```

### 7.2 Paywall / entitlement check (any gated action: export, analysis, rename, tracks-per-playlist, similarity-upload)
```
resolve caller ──▶ plan
    guest            → GUEST plan
    logged-in        → active subscription.plan_id  ELSE users.plan_id  ELSE FREE plan
        │
        ▼
load entitlements(plan)  (cached in Redis; invalidated on admin edit)
        │
        ▼
feature is boolean? (can_export, can_rename, can_rate…) ──▶ allow/deny by flag
feature is counted?  (playlists_per_day, analysis_per_day) ──▶ compare counter (Redis) vs limit
feature is a cap?    (max_tracks_per_playlist)             ──▶ clamp/deny at request validation
        │
        ▼
allow → perform + INCR counter    |    deny → 402/403 with upgrade CTA
```

### 7.3 Entitlement resolution precedence (per user, per feature)
```
per-user/visitor override (entitlement_overrides, if present & not expired)
        └─ else ─▶ plan entitlement (plan_entitlements for the effective plan)
                        └─ else ─▶ feature default (features.default_value)
```

---

## 8. Database design (Part 2)

**Principle (industry standard for entitlements):** separate **what you are/sell** (`plans`) from **what you can do** (`features` + `plan_entitlements`), and drive every check from a **data-driven entitlement layer the admin edits — changing a number is a data change, not a deploy.** Normalized so new features/plans never require a migration.

### 8.1 New tables

**`plans`** — every tier is a real row (guest & free included)
| col | type | notes |
|---|---|---|
| id | PK | |
| code | varchar unique | `guest`,`free`,`basic`,`pro`,`max` |
| name | varchar | display |
| price_cents | int | 0 for guest/free |
| currency | char(3) | `EUR` |
| billing_interval | enum | `none`,`month`,`year` |
| is_active | bool | admin can retire a plan |
| is_default | bool | exactly one true = the free default |
| is_assignable | bool | guest = false (not user-selectable) |
| sort_order | int | UI ordering |
| created_at/updated_at | datetime | |

**`features`** — the capability catalog (the extensibility seam)
| col | type | notes |
|---|---|---|
| id | PK | |
| key | varchar unique | `playlists_per_day`, `max_tracks_per_playlist`, `dropdown_max_tracks`, `can_export`, `export_scope` (`none`/`first_n`/`full`), `export_track_limit`, `export_targets` (csv: `spotify,apple,tidal,serato,rekordbox`), `can_rename`, `can_favorite`, `can_rate_tracks`, `analysis_per_day`, `analysis_feature_count`, `can_similarity_upload`, `default_playlist_visibility`, `signup_bonus_playlists` |
| name | varchar | |
| value_type | enum | `int`,`bool`,`enum`,`csv` |
| window | enum | `none`,`daily`,`rolling_24h`,`total` (for counted features) |
| default_value | varchar | fallback when no entitlement row |
| description | text | admin help text |

**`plan_entitlements`** — plan × feature → value (**the table admin edits**)
| col | type | notes |
|---|---|---|
| id | PK | |
| plan_id | FK→plans | |
| feature_id | FK→features | |
| int_value | int null | typed by feature.value_type |
| bool_value | bool null | |
| string_value | varchar null | (enum/csv) |
| updated_by | FK→users null | audit |
| updated_at | datetime | |
| — | | `UNIQUE(plan_id, feature_id)` |

> **Why typed columns instead of one JSON blob?** A normalized `plan_entitlements` gives the admin UI clean per-cell editing, is auditable (who changed what), validates against `features.value_type`, and queries cheaply. A JSON column on `plans` is faster to build but worse for an admin editor and long-term integrity — we choose normalized.

**`subscriptions`** — future paid (design now, populate at paid launch)
| col | type | notes |
|---|---|---|
| id | PK | |
| user_id | FK→users | |
| plan_id | FK→plans | |
| status | enum | `active`,`trialing`,`past_due`,`canceled`,`incomplete` |
| stripe_subscription_id | varchar null | consumer Stripe (separate from B2B) |
| stripe_customer_id | varchar null | |
| current_period_start/end | datetime | |
| cancel_at_period_end | bool | downgrades take effect next period |
| created_at/updated_at | datetime | |

**`entitlement_overrides`** *(optional, future)* — per-user comps / promos / abuse penalties
`id, subject_type (user|visitor), subject_id (user_id or visitor_id hash), feature_id, int/bool/string value, reason, expires_at`. Highest precedence in resolution.

### 8.2 Changes to existing tables
- **`users.plan_id`** — `FK→plans NULL`, effective default = the `is_default` plan (free). *(Nullable + resolve-to-default avoids a backfill headache; or backfill to free's id.)*
- **`playlists.guest_visitor_id`** — `varchar(64) NULL, INDEX` — tags guest-created playlists (sits beside the existing nullable `user_id`; mirrors how we recently added `deleted_at`). Set on guest create; nulled on login-reparent.

### 8.3 Where usage counters live (time-based limits)
- **Daily / rolling counters** (guests **and** logged-in daily limits like `playlists_per_day`, `analysis_per_day`) → **Redis** (fast, auto-expiring, no DB write storm). The DB holds the **limit** (entitlement); Redis holds the **usage**.
- **Total/lifetime limits** (if any remain) → a `SELECT COUNT(...)` against the DB (as `operation_limits` does today), excluding soft-deleted rows (we already fixed that for playlists).
- **Optional durable audit:** an append-only `usage_events` rollup (user/visitor, feature, ts) written async **for analytics only**, never for enforcement. Defer.

### 8.4 Normalization / best-practice checklist
- 3NF: plans, features, and their many-to-many via `plan_entitlements` (no repeating feature columns on `plans`). ✔️
- FKs + `UNIQUE(plan_id, feature_id)`; index `plan_entitlements(plan_id)`, `users(plan_id)`, `playlists(guest_visitor_id)`, `subscriptions(user_id)`. ✔️
- All limits are **data**, not code → admin edits without deploys; new feature/plan = insert rows, **no migration**. ✔️
- Migrations are **additive** on top of head `d9e0f1a2b3c4` (guarded, like the existing ones). ✔️

---

## 9. Reusing & evolving `operation_limits`

Today you have: `OperationType` (`playlist_create` = **total**, and a Spotify export toggle), `UserOperationLimit` (per-user), `operation_limit_service` / `operation_limit_evaluator`. **We evolve, not rip out:**

- **Map `OperationType` → `features`.** `playlist_create` becomes the `playlists_per_day` feature (`window` changes `total → daily`); the Spotify toggle becomes part of `export_targets` / `can_export`.
- **`UserOperationLimit` becomes the per-user *override* layer** (`entitlement_overrides` role) — admin comps for a specific user.
- **The evaluator's resolution order becomes:** per-user override → **plan entitlement (new)** → feature default. Today it only knows per-user + a hardcoded default; we insert the **plan** layer in the middle.
- **Assigning defaults on register (your ask):** on signup, set `users.plan_id = free`. Because limits are resolved from `plan_entitlements` **live**, we **don't copy numbers onto the user** — editing the free plan instantly applies to all free users (this is what makes "admin edits the defaults" work). Per-user rows only exist for overrides. *(If you ever want to snapshot/grandfather, see §10.)*
- **"Refer to DB every time a user does something":** yes — but cache the effective entitlements per plan in Redis (invalidate on admin edit), so the hot path is a Redis read, not a DB round-trip per action. Counters are already Redis.

---

## 10. Subscription billing, proration & plan changes

*(Notes / future — do **not** build in the first pass, per your call.)*

- **Upgrade mid-cycle → credit the unused portion of the old plan.** Your example: on Basic (5€/mo), used 10 of 30 days → **2/3 unused → 3.33€ credit** toward the upgrade. General formula:
  `credit = old_price × (remaining_days / period_days)`, applied against the new plan's first charge.
- **Downgrade → takes effect next period** (no refunds). Keep the higher tier until `current_period_end`, then switch. ✔️
- **Strong recommendation:** **don't hand-roll proration — let Stripe do it.** Stripe Billing computes prorated credits/charges automatically on plan change (`proration_behavior`). We store the resulting `subscription` state; Stripe is the source of truth for money. This avoids a whole class of rounding/edge-case bugs.
- **Grandfathering:** because entitlements resolve live, changing a plan's limits affects current subscribers immediately. If you ever need to *lock* a subscriber's terms at purchase time, snapshot the entitlements onto the `subscription` row (add `entitlements_snapshot JSON`) or add `plans.version`. Decision to make **before** paid launch.
- **Failed payment / dunning:** `status=past_due` should **downgrade effective plan to free** until resolved (grace period optional). Design the evaluator to treat non-`active`/`trialing` subscriptions as "fall back to free."

---

## 11. Gaps, good-to-knows & things we're missing

- **Anti-fingerprint browsers (Tor/Brave/Firefox-RFP)** will look like a fresh guest every time. Accept it; they're a tiny minority. Don't escalate.
- **Shared devices / same household / same office IP** → legitimate multiple users may look like one guest. Our soft-limit framing means this only nudges them to log in early — acceptable, but keep guest limits generous.
- **Bots / scripted abuse** are a *different* threat than casual free-riders. Fingerprinting won't stop a determined bot. If bots become a problem, add **rate limiting + hCaptcha/Turnstile** on guest creation (cheap, effective). Note for later.
- **Server-authority:** never trust client-sent `visitor_id`/counters. Derive & sign server-side. A guest must not be able to reset their own counter by editing a request.
- **Abuse of the signup bonus:** if signup grants a fresh allowance, a determined user could sign up repeatedly with throwaway emails. Mitigate with **email verification before the bonus applies** and per-fingerprint signup velocity checks. Note for later.
- **Timezone consistency** (chosen: UTC reset) must be used **everywhere** — Redis keys, admin displays, analytics — or counts drift.
- **Admin audit trail:** every `plan_entitlements` / `plans` edit should record `updated_by` + timestamp (built into the schema) and ideally an append-only change log, so pricing/limit changes are traceable.
- **Feature/plan seeding & validation:** seed `features` (with `value_type`/`window`) and the guest/free/basic/pro/max plans in a migration; validate entitlement writes against `features.value_type` in the service layer.
- **Effective-plan caching invalidation:** when admin edits a plan, **bust the Redis entitlement cache** for that plan (pub/sub or version key), or edits appear to "not take effect."
- **Export scope nuance:** your spec mixes *boolean* export (can/can't), *scope* (first-N vs full), and *targets* (Spotify/Apple/Tidal/Serato/Rekordbox). Modeled as three features (`can_export`, `export_scope`+`export_track_limit`, `export_targets` csv) so admin can mix freely per plan.
- **Analysis "N features out of 20"** is modeled as `analysis_feature_count` (int) + `analysis_per_day` (int/daily) — two separate levers, admin-tunable.
- **GDPR data-subject requests:** a guest who later becomes a user may request deletion — ensure the reparenting + retention jobs make guest data findable/erasable by `visitor_id` and `user_id`.
- **Consistency of "public" for guests:** guest playlists are always `is_public=TRUE`; on reparent to a user, decide whether they stay public or become private (recommend: **stay as-is**, user can flip later).

---

## 12. Phased rollout

1. **Guest identity + Redis enforcement (no DB plans yet):** ThumbmarkJS + signed cookie + IP/ASN → `visitor_id`; Redis daily counters; hardcode guest limits temporarily. Add `playlists.guest_visitor_id` + login-reparent + privacy-policy disclosure.
2. **Plans/entitlements schema:** migration for `plans`, `features`, `plan_entitlements`, `users.plan_id`; seed guest/free (+ paid as inactive drafts); move guest & free limits into `plan_entitlements`.
3. **Evolve `operation_limit_evaluator`** to resolve override → plan entitlement → default, reading cached entitlements + Redis counters. Assign `plan_id=free` on register.
4. **Admin plan-editor UI** (CRUD over plans + plan_entitlements, with cache-bust).
5. **Paid launch:** `subscriptions` + **Stripe consumer billing** (separate from B2B) + proration via Stripe + dunning/downgrade-to-free.

---

## 13. Sources
- [ThumbmarkJS — free MIT fingerprinting library (GitHub)](https://github.com/thumbmarkjs/thumbmarkjs) · [Top free fingerprinting libraries 2025](https://www.thumbmarkjs.com/content/top-4-free-fingerprinting-libraries/)
- [FingerprintJS OSS (BSL license note)](https://github.com/fingerprintjs/fingerprintjs) · [Fingerprint Pro vs OSS accuracy](https://fingerprint.com/resources/frequently-asked-questions-faqs/)
- [Device fingerprint collisions / false positives (>1 in 5 shared)](https://securityboulevard.com/2026/03/fingerprinting-is-broken-heres-how-we-fixed-it/) · [Account-sharing detection without false positives](https://cside.com/blog/account-sharing-detection-without-false-positives)
- [Browser fingerprinting & GDPR](https://privacychecker.pro/blog/browser-fingerprinting-privacy)
- [Plans & entitlements DB schema](https://appmaster.io/blog/plans-entitlements-database-schema) · [Data modeling SaaS entitlements & pricing](https://garrettdimon.com/journal/posts/data-modeling-saas-entitlements-and-pricing) · [Entitlement management for SaaS](https://schematichq.com/blog/entitlement-management-system)
- [Assign guest session to account on login (merge pattern)](https://docs.commercetools.com/tutorials/anonymous-session)
</content>

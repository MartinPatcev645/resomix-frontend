# Consumer Billing & Subscriptions — Locked Plan (July 2026)

Status: **locked spec**, implementation pending. Owner: consumer plans only.

## 1. Scope & non-goals
- **In scope:** consumer subscription plans (`free`, `pro` now; `basic`, `max` later) billed through
  **Stripe hosted Checkout + Customer Portal**. Current-plan display, upgrade, downgrade, cancel,
  invoices/payment history, and per-billing-period usage history.
- **Out of scope (untouched):** the track-sales cart/e-commerce flow; the B2B partner subscription
  flow. We keep the new tables subject-keyed so **partner-managed billing can reuse them later**
  without rework (design-for, not build).

## 2. Locked decisions
- **Hosted Stripe only** — Checkout for subscribing, **Customer Portal** for manage/upgrade/downgrade/
  cancel/update-card/invoices. **No custom payment or card UI.**
- **Currency:** explicit **EUR + USD** prices per plan. Resolve by customer country (default EUR;
  US → USD). Settlement in EUR. A subscription's currency is fixed at first checkout.
- **No free trial** (add later if wanted).
- **Stripe Tax enabled** — VAT computed/collected by customer location; shown at checkout + on invoices.
- **Upgrade** = immediate (Stripe proration). **Downgrade** = at period end.
- **Active plans:** `pro` only now. `basic`/`max` stay `is_active = false` ("Coming soon", not
  purchasable). Admin can flip `is_active` (a plan needs an active price to be purchasable).
- **Effective plan resolution** (already implemented): active subscription → `users.plan_id` →
  default `free`. `past_due`/`canceled`/`incomplete` → treated as free.
- **Webhooks are the source of truth**; our DB mirrors Stripe.

## 3. Stripe Dashboard setup

### 3a. What YOU can do now (developer login) — all in a **Sandbox / Test mode**
1. Create a **Sandbox** (Dashboard → Sandboxes) or use the Test-mode toggle.
2. Developers → **API keys** → copy the **test** Secret + Publishable keys.
3. **Product catalog** → create Product **"Resomix Pro"** and add **two** recurring monthly prices on it:
   - **€10.00 / month, EUR** → copy price ID (`price_..._eur`).
   - **$/month, USD** (amount you choose, e.g. $11.00) → copy price ID (`price_..._usd`).
   - (Create Basic/Max the same way later; their *plans* stay inactive in our DB for now.)
4. Settings → Billing → **Customer portal** (test) → Activate; enable: switch plans (add the Pro
   product), cancel at period end, update payment method, show invoice history; set the return URL to
   the webapp profile; save.
5. Settings → **Tax** → enable **Stripe Tax** (test); set origin address (Greece).
6. Developers → **Webhooks** → add endpoint (test): `https://bserver.resomix.com/api/v1/webhooks/stripe`
   (for local dev use the Stripe CLI instead). Events: `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`, `checkout.session.completed`. Copy the **signing secret** (`whsec_...`).
7. **Hand off to the dev team:** test secret key, test publishable key, test webhook secret, the Pro
   **EUR price ID**, the Pro **USD price ID**, and the product ID.

### 3b. What you need from GEORGE (account owner) — for GO-LIVE only
1. **Activate the Stripe account for live payments** — business/legal details + **bank account** for
   payouts (only the owner can complete activation).
2. **Live-mode API keys** + create the live Products/Prices (or approve you doing it).
3. **Stripe Tax registrations** for live — Greek VAT / EU OSS numbers (confirm they cover B2C consumer
   sales, not only the B2B OSS already set up).
4. Approve the **price amounts + currencies** and the legal entity/branding shown on invoices & receipts.
5. Mirror the Customer Portal + Stripe Tax config in **live** mode.

> Everything to **build + test** is doable by you in the Sandbox now. George is only needed to flip to
> **live** (account activation, bank, tax registration, live keys). We swap env keys at launch.

## 4. Database changes (Alembic — all additive/idempotent, nothing existing changes behavior)
1. **`plan_prices`** (new): `id`, `plan_id`→plans, `interval` (`month`|`year`), `currency` CHAR(3),
   `stripe_price_id` (unique), `stripe_product_id`, `unit_amount_cents`, `is_active`, timestamps.
   Multiple rows per plan (per currency/interval). *Plan is purchasable if `plan.is_active` AND it has
   an active price in the resolved currency.* → **makes Stripe price mapping data, not code.**
2. **`user_subscriptions`** (extend existing): add `stripe_price_id`, `currency` CHAR(3),
   `canceled_at`, `trial_end` (reserved). One row per user (unchanged).
3. **`billing_invoices`** (new): `id`, `user_id`, `stripe_invoice_id` (unique), `stripe_subscription_id`,
   `plan_id`, `amount_paid_cents`, `currency`, `status`, `period_start`, `period_end`,
   `hosted_invoice_url`, `invoice_pdf`, `created_at`, `paid_at`. → payment history + downloadable
   invoices (links to Stripe-hosted invoice/PDF, no custom rendering).
4. **`subscription_events`** (new, append-only): `id`, `user_id`, `stripe_event_id`, `type`
   (`created|renewed|upgraded|downgraded|canceled|reactivated|payment_failed|past_due`),
   `from_plan_id`, `to_plan_id`, `currency`, `amount_cents`, `effective_at`, `created_at`.
   → the timeline (when subscribed / switched / cancelled / which plan when).
5. **`usage_period_history`** (new): `id`, `subject_type` (`user`|`visitor`), `subject_id`, `plan_id`,
   `feature_key`, `period_start`, `period_end`, `used_count`, `limit_value`, `updated_at`; unique
   (`subject_type`,`subject_id`,`feature_key`,`period_start`). **Write-through** from the usage
   counters so per-period usage (uploads, similarity playlists) survives the Redis TTL and can be
   reported for the current and all past periods.

**Safety review:** all changes are new tables + new **nullable** columns. Existing code (entitlement
resolution already reads `user_subscriptions`; billing-period service; cart) is unaffected. No FK
cycles. Down-migrations drop only the new objects.

## 5. Backend
- **Config:** keep `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`. Consumer
  price IDs live in `plan_prices` (DB), seeded/admin-set (optional bootstrap env only to seed Pro).
  Add a **country→currency** map (default EUR; configurable USD-country set incl. US), resolved from the
  request country (Cloudflare `CF-IPCountry` header / geo; fallback EUR).
- **`BillingService`** (new): `resolve_currency(request)`, `get_plans_for_display(currency, user)`,
  `create_checkout_session(user, plan_code, currency)` (`mode=subscription`, currency-matched price,
  get-or-create customer, `automatic_tax`, success/cancel URLs), `create_portal_session(user)`,
  `map_price_to_plan(stripe_price_id)`.
- **`WebhookService`** (extend the existing verified + idempotent handler):
  - `customer.subscription.created/updated/deleted` → upsert `user_subscriptions` (status, `plan_id`
    via price map, currency, period, `cancel_at_period_end`, `canceled_at`) + append `subscription_events`
    + bust entitlement cache.
  - `invoice.paid` → upsert `billing_invoices` (paid) — renewal record.
  - `invoice.payment_failed` → mark `past_due` + event (+ optional dunning email).
  - Keep `checkout.session.completed` for the cart; ignore its subscription sessions (subscription
    state comes from the subscription events).
- **`UsageHistoryService`** (new / extend usage): write-through to `usage_period_history` on each
  consume/increment; expose current + history.
- **Router `/billing`** (new, authed):
  - `GET /billing/plans` → active plans + resolved-currency price + the user's current plan/status.
  - `GET /billing/subscription` → current plan, status, renewal date or "cancels on", usage this period.
  - `GET /billing/invoices` → the user's invoices.
  - `GET /billing/usage` → current + historical per-period usage.
  - `POST /billing/checkout` `{plan_code}` → Stripe Checkout URL.
  - `POST /billing/portal` → Stripe Customer Portal URL.
  - (webhook stays at `/api/v1/webhooks/stripe`.)
- **Messages:** informative + standard for every state (see §7).

## 6. Frontend (reuse existing UI: ButtonSleek, cards, dotted borders, StatusMessage, HoverFlow, entitlement components)
- **Landing = public Pricing page** (`/pricing`): Free / **Pro** (active → "Subscribe") / **Basic** &
  **Max** ("Coming soon", disabled). Prices in the resolved currency. If logged in, highlight the
  viewer's current plan. CTA: guest → login→checkout; free user → checkout; already-subscribed →
  Customer Portal.
- **Webapp = management (Profile → "Plan & Billing")**: current plan + status + renewal/cancel date;
  **usage meters** (uploads, similarity playlists) used/limit this period; **Upgrade** (→checkout) or
  **Manage subscription** (→portal, which handles downgrade/cancel/card/invoices); **Billing history**
  (invoices with Stripe hosted "View"/"PDF" links). Reuse the existing `GateCtaModal`/entitlement CTA
  for inline upgrade nudges.
- **Return states** (re-fetch `/billing/subscription` after returning from Stripe): success ("You're on
  Pro"), scheduled cancel ("Pro until DATE"), payment failed ("update your payment method" → portal),
  reactivated, etc.
- With hosted Checkout/Portal (redirect to backend-created URLs) the frontend needs **no Stripe.js**.

## 7. Edge cases (handle + test)
- Guest → guest plan; logged-in free → free.
- Upgrade immediate+prorated; downgrade at period end.
- `cancel_at_period_end` → keep plan until end → `subscription.deleted` → free.
- Payment failed → `past_due` (Stripe Smart Retries grace) → recovered (`invoice.paid`) or → canceled → free.
- Re-subscribe after cancel.
- **Admin deactivates a plan with active subscribers** → keep them until they cancel; hide from new
  purchase + portal switching. No force-downgrade.
- Mid-period plan change adjusts usage limits (limits are plan-resolved, not snapshotted — already true).
- Duplicate / out-of-order webhooks → idempotent by `event.id`; trust the subscription object's status.
- Already-subscribed user clicks "Subscribe" → route to Portal, not a second Checkout.
- Currency locked at first checkout; later country change doesn't change an existing subscription.
- Stripe customer get-or-create.
- Webhook-vs-redirect race → UI reads DB and re-fetches.
- Redis down → usage enforcement fails open (existing); history write best-effort.
- Optional nightly **Stripe↔DB reconciliation** job (pull subscription + recent invoices) to self-heal drift.

## 8. Admin
- Manage `plan_prices` (set/rotate Stripe price IDs per currency/interval), toggle `plan.is_active` /
  `is_assignable`. Activating requires an active price.
- View a user's subscription, invoices, and usage history.
- Extend the existing admin plans/entitlements page.

## 9. Testing
- **Unit:** price→plan mapping, currency resolution, each webhook handler (mock Stripe events),
  entitlement resolution across sub states, usage write-through/history.
- **Integration (test mode / Stripe CLI):** checkout + portal session creation; end-to-end webhook
  lifecycle (subscribe → renew → cancel → past_due → recover); invoices + usage persisted.
- **Edge-case tests** for every item in §7.

## 10. Env / config
- Backend: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (test → live).
- Consumer price IDs → `plan_prices` (DB). Optional bootstrap: `STRIPE_PRICE_PRO_MONTHLY_EUR`,
  `STRIPE_PRICE_PRO_MONTHLY_USD` (seed only).
- Country→currency map (USD countries) in config.
- Frontend: none required for hosted flow (redirect-based).

## 11. Order of work
1. DB migrations + models (no keys needed) — **first**.
2. Seed `plan_prices` for Pro (EUR+USD) once price IDs are provided.
3. `BillingService` + `/billing` endpoints.
4. Webhook subscription + invoice handlers.
5. Usage-history write-through.
6. Frontend: landing pricing + webapp profile billing + messages.
7. Admin price management.
8. Tests throughout.
9. Swap to live keys (George) → launch.

# Account Lifecycle, Billing Notifications & Admin User Management — Implementation Plan

**Status:** proposed — nothing in here is built yet
**Date:** 2026-08-08
**Scope:** `basic_fastapi_server_resomix` (backend) + `resomix-web` (webapp, admin)

---

## 0. How to read this

Section 1 is **what the code does today**. Every claim in it was read out of the source and
carries a `file:line` so it can be checked rather than trusted. Nothing in section 1 comes from
a doc, a changelog, or memory — several of the docs in this folder are out of date on exactly
these paths.

Sections 2 onward are the plan. Phases are ordered so each one is independently shippable and
independently testable; a later phase never has to be half-built to make an earlier one work.

---

## 1. What exists today

### 1.1 Subscription state and how Stripe reaches it

`user_subscriptions` ([app/models/purchase.py:33-66](../app/models/purchase.py)) holds exactly one
row per **paid** user. Free users have no row and resolve through `users.plan_id` → default plan.

Columns that exist:

```
user_id  plan_id  status  stripe_subscription_id  stripe_customer_id  stripe_price_id  currency
is_founding  founding_lock_ends_at  stripe_schedule_id
current_period_start  current_period_end  cancel_at_period_end  canceled_at  trial_end
subscribed_at  updated_at
```

Columns that **do not** exist and matter later: `cancel_at`, `ended_at`, `cancellation_reason`.

The effective plan is resolved live, per request, at
[entitlement_service.py:95-105](../app/services/entitlement_service.py) — it matches only
`status IN ('active','trialing')` (`ACTIVE_SUBSCRIPTION_STATUSES`,
[entitlement_keys.py:66](../app/core/entitlement_keys.py)). There is no cache to bust: writing the
row is enough to change what a user can do on their very next request.

Stripe events are received by [webhook_service.py:108-155](../app/services/webhook_service.py),
which routes **eight** branches:

| Event | Handler |
|---|---|
| `checkout.session.completed` | cart fulfilment, or `apply_founding_lock` for subscriptions |
| `charge.dispute.created` | `purchase_service.handle_dispute` — **one-time cart orders only** |
| `customer.subscription.created/updated/deleted` | `billing_sync.sync_subscription` |
| `invoice.paid` / `invoice.payment_succeeded` | `billing_sync.record_invoice` |
| `invoice.payment_failed` | `billing_sync.mark_payment_failed` → `past_due` |
| `subscription_schedule.*` (6 types) | `billing_sync.sync_schedule` — founding-lock mirror |

Signature verification and idempotency are handled up front
([webhook_service.py:60-88](../app/services/webhook_service.py)); every event is dedup'd by
`stripe_event_id` against `system_logs`.

**Critically for debugging: the complete raw payload of every Stripe event we receive is already
persisted** to `system_logs.log_metadata.raw_payload`
([webhook_service.py:90-105](../app/services/webhook_service.py)). We do not need to add logging
to find out what Stripe actually sent — we only need to read it.

### 1.2 How cancellation is displayed today

`sync_subscription` writes `row.cancel_at_period_end = bool(sub.get("cancel_at_period_end"))` and
`row.canceled_at = _ts(sub.get("canceled_at"))`
([billing_sync_service.py:288-290](../app/services/billing_sync_service.py)). Both are returned by
`get_subscription_summary` ([billing_service.py:626-634](../app/services/billing_service.py)) and
both are in the TypeScript contract (`packages/api-client/src/billing.ts:88-95`).

The profile screen picks its wording at
`packages/ui/src/Billing/PlanBillingCard.tsx:144-157`:

```ts
if (sub.cancel_at_period_end && sub.current_period_end) {
  statusLine = `Cancels on ${fmtDate(sub.current_period_end)} — you keep ${planName} until then`;
} else if (status === "active" && sub.current_period_end) {
  statusLine = `Renews on ${fmtDate(sub.current_period_end)}`;
}
```

So the cancelled state **is** implemented — but it hangs on one boolean, and the branch below it
is the one that says "Renews on".

### 1.3 Refunds and disputes

**Not handled.** `charge.refunded` appears nowhere in the codebase. The only charge event wired up
is `charge.dispute.created`, and `purchase_service.handle_dispute`
([purchase_service.py:78-102](../app/services/purchase_service.py)) looks up an `Order` by
`payment_intent_id` and sets `order.status = "failed"`. Subscriptions do not create `Order` rows,
so for a subscription dispute this handler finds nothing and returns `False`. `charge.dispute.closed`
is not subscribed to at all.

Independently of our code: **refunding an invoice in Stripe does not cancel the subscription.**
Stripe treats the two as unrelated objects. Today an admin refunding €9.99 leaves the customer
fully Pro and still scheduled to renew.

### 1.4 Emails

[email_service.py](../app/services/email_service.py) has eight methods — verification (`:48`),
operation notification (`:98`), password reset (`:135`), 2FA (`:183`), welcome (`:236`), contact
confirmation (`:278`), contact admin notification (`:322`). `app/templates/emails/` holds the eight
matching files.

**There are no billing emails of any kind.** Stripe's own customer emails cover receipts, invoices
and failed-payment notices; Stripe never sends a cancellation or refund notice. All of it is ours
to write.

Template convention note: `base.html` defines `{% block content %}` at line 206 but **no template
extends it** — all eight are standalone documents with inlined CSS. New templates should follow the
existing standalone pattern rather than introduce inheritance for the first time in this change.

### 1.5 What `is_active` actually does

The admin toggle (`POST /admin/users/{uuid}/toggle-status` →
[user_service.py:635-679](../app/services/user_service.py)) flips `users.is_active`, writes an
`admin_operation_log`, and refuses self-deactivation.

`is_active` is **read** in exactly two places in the entire backend:

- [app/api/dependencies/auth.py:264](../app/api/dependencies/auth.py) — inside
  `require_permission(...)`, i.e. admin-guarded endpoints only
- [app/services/auth_service.py:517](../app/services/auth_service.py) — Google sign-in only

It is **not** checked by `get_current_user`, and **not** checked by the email/password login path
([auth_service.py:311-400](../app/services/auth_service.py) verifies password, brute-force lockout,
email verification and 2FA — never `is_active`). Deactivating a user therefore:

- does not revoke their existing session
- does not stop them using any part of the webapp
- does not stop them logging back in with their password

It is, functionally, a label on an admin screen.

### 1.6 Account deletion

**User-facing deletion already exists and is broken.**
`DELETE /users/me` ([app/api/routers/users.py:384](../app/api/routers/users.py)) →
`user_controller.delete_account` → `user_service.delete_account`
([user_service.py:191-221](../app/services/user_service.py)), which calls
`user_repo.async_delete` → `db.delete(obj)`
([base_repository.py:262-272](../app/repositories/base_repository.py)) — a hard row delete with
the comment "cascade will handle related records".

Three foreign keys make that false:

| Table | Column | `ondelete` | Source |
|---|---|---|---|
| `orders` | `user_id` | `RESTRICT` | [ecommerce.py:46](../app/models/ecommerce.py) |
| `admin_operation_logs` | `admin_user_id` | `RESTRICT` | [admin_operation_log.py:45](../app/models/admin_operation_log.py) |
| `tracks` | `uploaded_by` | *(none → RESTRICT in MySQL)* | [track.py:45](../app/models/track.py) |

So the delete raises an `IntegrityError` for any user who has ever uploaded a track or placed an
order. Second defect on the same path: `verify_password(password, user.password_hash)` is called
unconditionally, so a Google-only account (`password_hash IS NULL`) crashes before it gets that far.

The UI is at `packages/ui/src/Content/ProfileContent.tsx:390-430` — an inline "Danger Zone" with a
password field, no countdown, and no explanation of consequences.

**Admin-facing deletion does not exist.** There is no `DELETE /admin/users/{uuid}` in
[app/api/routers/admin/users.py](../app/api/routers/admin/users.py), no controller method, and no
`deleteAdminUser` in `packages/api-client/src/admin/users.ts`. The admin menu item at
`apps/admin/src/pages/UsersPage.tsx:267-281` confirms the dialog and then unconditionally calls
`showErrorModal('Not Available', 'Delete user endpoint is not yet available on the server.')`.
**The error you are seeing is hardcoded, not a failure.**

### 1.7 Admin user screens

`get_user_detail` ([admin_user_controller.py:85-120](../app/controllers/admin_user_controller.py))
returns uuid, email, username, name, partner_id, is_active, is_email_verified, 2FA fields, roles,
created_at, updated_at — and `"last_login": None`, a literal hardcoded placeholder (line 110). No
IP, no plan, no subscription, no activity.

The list endpoint returns the same minus 2FA. The admin table
(`apps/admin/src/pages/UsersPage.tsx:198-250`) shows User / Username / Status / Joined / Actions.
Detail is a `Drawer`, not a page.

Data that exists but is not surfaced:

- `user_sessions.ip_address`, `.created_at`, `.expires_at`, `.revoked_at`
  ([user.py:335-365](../app/models/user.py)) — enough for last login and last IP
- `consumption_events.user_id`, `.client_ip`, `.event_timestamp`
  ([consumption_event.py:73-106](../app/models/consumption_event.py)) — playback telemetry only

Data that does **not** exist: a general "last action" timestamp. `system_logs` records
`client_ip`, `endpoint`, `method` and `status_code` but **has no `user_id` column**
([app/models/log.py](../app/models/log.py)), so request logs cannot be attributed to a person.

Admin routing already supports detail pages — `playlists/:uuid` →
`PlaylistDetailsPage.tsx` (279 lines) at `apps/admin/src/App.tsx:93`. That is the pattern to copy.

### 1.8 Contact and feedback

There is **no reply capability anywhere**. `app/api/routers/admin/contact.py` exposes list, detail,
delete, batch-delete, mark-status and export. The feedback admin service
([feedback_service.py](../app/services/feedback_service.py)) mirrors it. Neither the backend nor
`apps/admin/src` contains a `reply`, `respond` or send-message handler.

Available context for a reply:

- `contacts` — `user_id`, `name`, `email`, `subject`, `message`, `contact_type`, `status`,
  `submitted_at` ([contact.py:32-90](../app/models/contact.py))
- `feedback` — `user_id`, `category`, `message`, `satisfaction`, `recommendation`, `status`,
  `submitted_at` ([feedback.py:32-68](../app/models/feedback.py))

Both carry `submitted_at` as a naive UTC `DateTime`, so quoting "you contacted us on … UTC" is
straightforward.

---

## 2. Confirmed defects

| # | Defect | Evidence |
|---|---|---|
| D1 | Profile can show "Renews on" for a cancelled subscription | §3.1 below |
| D2 | Refunds have no effect — customer keeps Pro | no `charge.refunded` handler |
| D3 | Subscription disputes have no effect | `handle_dispute` only matches `orders` |
| D4 | Deactivated users can still log in and use everything | `is_active` unread on both paths |
| D5 | `DELETE /users/me` throws for any user with a track or order | FK `RESTRICT` ×3 |
| D6 | `DELETE /users/me` crashes for Google-only accounts | `password_hash IS NULL` |
| D7 | Admin delete is a hardcoded error message | `UsersPage.tsx:278` |
| D8 | `last_login` is a hardcoded `None` | `admin_user_controller.py:110` |

---

## 3. Root-cause analysis for the cancellation display (item 1)

You asked specifically whether we are firing the webhook, listening to it, and updating. Answering
each in turn:

**Are we listening?** Yes — `customer.subscription.updated` is routed
([webhook_service.py:127](../app/services/webhook_service.py)) and is in the documented 12-event
production set (`stripe_live_doc.md:136`). Whether it is *selected on the live endpoint* is a
dashboard setting this repo cannot see; Phase 0 verifies it from recorded data.

**Are we updating?** Yes — `row.cancel_at_period_end` is written on every subscription event, and
`scripts/pricing_e2e_test.py:652-660` asserts that sync against a real Stripe test clock.

**So why the wrong label?** Two mechanisms, both real, and they compound:

### 3.1 The frontend ignores a field we already have

`canceled_at` is set by Stripe **at the moment a cancel-at-period-end is requested** — not when the
subscription finally ends. The Stripe library documents this precisely
(`.venv/.../stripe/_subscription.py:670`):

> "If the subscription was canceled with `cancel_at_period_end`, `canceled_at` will reflect the time
> of the most recent update request, not the end of the subscription period…"

We store it, we return it, and `PlanBillingCard.tsx` never reads it. So the moment
`cancel_at_period_end` is false for *any* reason while `canceled_at` is set, the UI falls through to
"Renews on".

### 3.2 The founding lock makes `cancel_at_period_end` unreliable

This is specific to our design. `apply_founding_lock`
([billing_service.py:341-363](../app/services/billing_service.py)) attaches a
**subscription schedule** to every founding subscription — 22 monthly phases or 2 yearly ones,
`end_behavior="release"`. Until phase 2 begins, the subscription is **schedule-managed**.

Stripe expresses cancellation differently for schedule-managed subscriptions: the cancellation
lands on the schedule and/or as a `cancel_at` timestamp, rather than as a `cancel_at_period_end`
boolean flip. We have **no `cancel_at` column** (§1.1) and `sync_schedule`
([billing_sync_service.py:89-186](../app/services/billing_sync_service.py)) only ever reads
`status` and `phases` — it never looks at `end_behavior`.

Result: `canceled_at` set, `cancel_at_period_end` false, `status` still `active`,
`current_period_end` present → **"Renews on 8 Aug"**. That is exactly the symptom reported.

### 3.3 What this means for the fix

I cannot prove *which* of the two fired for your specific subscription without the payload — but the
payload is already on disk (§1.1), which is what Phase 0 reads. The fix in Phase 1 is written to be
correct under **either** mechanism, so it does not depend on that answer. Phase 0 exists to confirm
it worked, not to decide what to build.

Your second point — an admin cancelling in the Stripe dashboard should behave identically — is
automatic once this is fixed: a dashboard cancel and a portal cancel emit the *same* event with the
same `cancellation_details.reason` (`cancellation_requested`). Stripe gives us no way to tell them
apart, which per your instruction is fine.

---

## 4. Target behaviour

| Trigger | Money | Access | Email |
|---|---|---|---|
| User cancels in portal | not refunded | Pro until period end, then free | "Subscription cancelled" |
| Admin cancels in dashboard | not refunded | Pro until period end, then free | same email |
| Admin cancels immediately | not refunded | free immediately | "Subscription ended" |
| **Full** refund of latest invoice | returned | **free immediately** | "Subscription cancelled & refunded" |
| **Partial** refund | partly returned | unchanged | "Partial refund issued" |
| Dispute opened (chargeback) | held | **free immediately** | "Subscription suspended" |
| Dispute won by us | returned to us | restored to Pro | "Access restored" |
| Dispute lost | gone | stays free | none (already told) |
| Payment fails (dunning) | — | free immediately (`past_due`) | already Stripe's job |
| User deletes own account | subscription cancelled | inactive immediately | "Account scheduled for deletion" |
| 30 days elapse | — | still inactive | admin notified to purge |
| Admin purges | — | data destroyed | "Account deleted" |

Chargebacks (your credit-card-fraud scenario) are covered by the dispute rows: Stripe fires
`charge.dispute.created` when the bank pulls the money and `charge.dispute.closed` with
`status: won|lost` when it resolves. Both need handling — `created` revokes, `closed`+`won` restores.

---

## 5. Data model changes

### 5.1 `user_subscriptions` — three columns

```python
cancel_at:  Mapped[Optional[datetime]]  # Stripe's own cancellation boundary
ended_at:   Mapped[Optional[datetime]]  # when access actually stopped
cancellation_reason: Mapped[Optional[str]]  # requested|refunded|disputed|payment_failed|admin
```

`cancel_at` is what §3.2 needs. `ended_at` distinguishes "cancelled, still running" from "over".
`cancellation_reason` is what picks the email template and what support reads first.

### 5.2 `users` — four columns

```python
deactivated_at:       Mapped[Optional[datetime]]
deactivation_reason:  Mapped[Optional[str]]   # user_requested|admin|abuse
deletion_requested_at:Mapped[Optional[datetime]]
purge_due_at:         Mapped[Optional[datetime]]  # deletion_requested_at + 30d
last_seen_at:         Mapped[Optional[datetime]]
```

`last_seen_at` is the honest answer to "last action" (§1.7): nothing else in the schema can produce
it. Written by a throttled middleware touch (at most once per 5 minutes per user) so it costs one
cheap `UPDATE` per session rather than one per request.

### 5.3 New table `user_messages`

Every admin→user email, whatever the surface it was sent from. Without this there is no record that
a reply was ever sent, and no way to stop two admins answering the same contact twice.

```python
id, user_id (SET NULL), admin_user_id (RESTRICT), channel  # contact|feedback|direct
source_id           # contacts.id / feedback.id / NULL
subject, body       # what the admin actually typed
recipient_email     # denormalised — survives the user being purged
sent_at, delivery_status  # sent|failed
```

### 5.4 The tombstone user

One reserved `users` row (`deleted@resomix.internal`, inactive, no password, no roles) that purged
users' financial and audit rows are repointed to. Seeded once, alongside the existing RBAC seed
(`scripts/seed_rbac.py`), and protected from deletion by the purge endpoint itself.

This is what makes decision Q1 physically possible: `orders.user_id`,
`admin_operation_logs.admin_user_id` and `tracks.uploaded_by` are all `RESTRICT` (§1.6), so a kept
row cannot simply lose its owner — it needs somewhere to point.

### 5.5 Migration notes

All additive — new nullable columns, one new table, one seeded row. No backfill, no downtime, no
column drops. One Alembic revision per section (5.1, 5.2, 5.3+5.4), because 5.1 ships in Phase 1
while the rest are not needed until Phases 4 and 7.

> **Check the graph before pushing a migration.** Revision ids here are hand-written, not
> generated, and this history already contains ids that look like near-neighbours of each other
> (`b3c4d5e6f7a8`, `c4d5e6f7a8b9`, `d5e6f7a8b9c0`…). Reusing one produces
> *"Cycle is detected in revisions"* at `upgrade` time — the graph fails to parse, so nothing is
> applied and the deploy simply stops. One command catches it:
>
> ```
> .venv/bin/alembic heads
> ```
>
> Exactly one head, and it should be the revision you just wrote. Anything else — two heads, or a
> cycle error — means the id collides or the `down_revision` is wrong.

Existing `RESTRICT` foreign keys are deliberately **left alone**. Loosening them to `SET NULL` would
make purging trivial but would silently orphan financial records the first time anyone deletes a
user by hand in a SQL client.

---

## 6. Phases

### Phase 0 — Diagnose the live cancellation (half a day, read-only)

**New:** `scripts/diagnose_subscription.py`, modelled on the existing read-only
`scripts/redis_healthcheck.py`.

Given an email or subscription id, print side by side:

1. every `system_logs` row for that customer's Stripe events, newest first — event type, timestamp,
   and the fields that matter out of the stored `raw_payload`: `status`, `cancel_at_period_end`,
   `cancel_at`, `canceled_at`, `cancellation_details`, `schedule`
2. the current `user_subscriptions` row
3. the live Stripe object, re-read via the API
4. a verdict line: which of §3.1 / §3.2 applies, or "webhook never arrived"

This settles "are we firing / listening / updating" from recorded fact. If the verdict is "never
arrived", the fix is a dashboard setting and not code — which is worth knowing before writing any.

**Constraint:** read-only, refuses to write, safe to run against production.

### Phase 1 — Make cancellation state true and legible (1–2 days)

**Backend**
- Migration 5.1.
- `sync_subscription` ([billing_sync_service.py:241](../app/services/billing_sync_service.py)):
  store `cancel_at`; set `cancellation_reason` from `sub.cancellation_details.reason`; set
  `ended_at` when the event is `.deleted`.
- `sync_schedule` ([billing_sync_service.py:89](../app/services/billing_sync_service.py)): read
  `end_behavior`; when it is `cancel`, mirror the schedule's end onto `cancel_at`. This is the
  schedule-managed path from §3.2.
- `get_subscription_summary` ([billing_service.py:626](../app/services/billing_service.py)): add
  `cancel_at`, `ended_at`, `cancellation_reason`, and a single derived
  `cancellation: { pending: bool, effective_at: iso, reason: str } | null` so the client is not
  re-deriving three-field logic.

**Frontend** — `PlanBillingCard.tsx:144-157`, and `ConsumerPricingContent.tsx:284` which has the
same single-boolean assumption.

Wording as requested, with the date the server derived:

```
Active till 8 Aug 2026 (Cancelled)
```

Read `cancellation.pending` rather than any raw boolean, so a future change of Stripe mechanism
cannot silently regress this to "Renews on".

**Why this ordering:** the derived field means the frontend fix is one property read, and the same
property drives the pricing page, the profile card and any future surface identically.

### Phase 2 — Billing email infrastructure and the cancellation emails (2–3 days)

**New templates** in `app/templates/emails/`, standalone documents matching the existing eight
(§1.4):

- `subscription_cancelled.html` — cancelled, access until *date*, no charge after that
- `subscription_ended.html` — access has ended now
- `subscription_refunded.html` — refunded in full, access ended, amount + method
- `subscription_partial_refund.html` — amount refunded, plan unaffected
- `subscription_disputed.html` — access suspended pending the bank's decision
- `subscription_restored.html` — access restored
- `account_deletion_scheduled.html` — Phase 4
- `account_deleted.html` — Phase 5
- `admin_purge_due.html` — Phase 5, to the admin inbox
- `admin_message.html` — Phase 7, the generic admin→user body

**New:** `app/services/billing_email_service.py`. Deliberately *not* more methods on
`EmailService` — that class is auth/contact-shaped and already at 362 lines. The new service takes
`EmailService` as a collaborator and owns the billing vocabulary (amounts, currency, period dates,
plan names).

**Dispatch mechanism — matches what the codebase already does (decision Q3).** Every email in this
app today is an inline `await` wrapped in try/except and treated as best-effort; the canonical
example is [contact_service.py:113-121](../app/services/contact_service.py):

```python
try:
    await self.email_service.send_contact_confirmation(...)
except Exception as email_exc:
    print(f"Contact confirmation email failed (non-fatal): {email_exc}")
```

Celery exists and is used for heavy work (analysis, ingestion, track purges, outbound webhooks) but
**no email goes through it**. Billing emails follow the established pattern rather than introducing
a second one.

**One constraint this must respect.** `webhook_service.py:157-180` returns 500 on any exception so
Stripe retries the whole event. An SMTP timeout raised inside a handler would therefore replay a
subscription sync. Two rules make the existing pattern safe here:

1. Handlers **collect** the notifications they want sent; `handle_stripe_webhook` dispatches them
   **after** `await db.commit()`, never before.
2. Each send is individually try/except'd and swallowed, logging through `LoggingService` the way
   `notification_service._send_and_log` ([notification_service.py:140](../app/services/notification_service.py))
   already does — `print()` is the older style and should not be copied forward.

That keeps the webhook contract intact without a queue. If billing mail volume ever makes inline
SMTP a latency problem, moving these to Celery is a self-contained change behind
`BillingEmailService`.

**Idempotency.** Stripe retries. A `user_messages`-style guard, or a unique key on
`(user_id, template, stripe_event_id)`, prevents a customer receiving the same cancellation notice
four times.

**Idempotency.** Stripe retries. A `user_messages`-style guard, or a unique key on
`(user_id, template, stripe_event_id)`, prevents a customer receiving the same cancellation notice
four times.

### Phase 3 — Refunds and disputes (2–3 days)

**New webhook branches** in `webhook_service.py`, plus the matching Stripe dashboard events
(this takes the production set from 12 to 15 — `stripe_live_doc.md:135-149` needs updating):

| Event | Behaviour |
|---|---|
| `charge.refunded` | full → cancel immediately + downgrade + email; partial → email only |
| `charge.dispute.created` | subscription charge → suspend immediately + email; else existing cart path |
| `charge.dispute.closed` | `won` → restore Pro + email; `lost` → stay free, no email |

**New:** `app/services/billing_refund_service.py`.

Full vs partial is decided on `charge.amount_refunded >= charge.amount`, not on a human's intent —
it is the only signal that is always present.

"Cancel immediately" means both sides: `stripe.Subscription.delete(...)` so Stripe stops billing,
**and** the local row to `status='canceled'`, `ended_at=now`, `cancellation_reason='refunded'`.
Doing only the local half leaves Stripe renewing a plan we have already revoked.

**Schedule interaction:** a founding subscriber has an active schedule (§3.2). Cancelling the
subscription while a schedule is attached needs the schedule released first, or Stripe refuses.
`repair_founding_locks.py` already contains a working release-then-act sequence — reuse it rather
than writing a second one.

**Dispute → subscription:** `handle_dispute` currently matches only `orders`
([purchase_service.py:88-92](../app/services/purchase_service.py)). Extend it to fall back to
`user_subscriptions` via the charge's invoice → subscription id, using the existing
`_invoice_subscription_id` helper ([billing_sync_service.py:38](../app/services/billing_sync_service.py))
which already handles both the Basil and legacy payload shapes.

### Phase 4 — Account lifecycle: deactivation that means something (3–4 days)

**Make `is_active` real.** This is D4, and it is a prerequisite for everything else in this phase —
a "deleted" account that can still log in is not deleted.

- `login_user` ([auth_service.py:311](../app/services/auth_service.py)): reject when
  `not user.is_active`, with a distinct code the frontend can recognise (`ACCOUNT_DEACTIVATED`)
  rather than a generic 403.
- `get_current_user` ([app/api/dependencies/auth.py](../app/api/dependencies/auth.py)): the single
  chokepoint every authenticated endpoint passes through. Checking here covers the whole webapp in
  one place — playlists, uploads, analysis, exports — instead of endpoint by endpoint.
  **Admin routes must keep working**, so the check belongs in `get_current_user` with the existing
  `require_permission` check left in place.
- Revoke all `user_sessions` rows on deactivation, so it takes effect immediately rather than at
  token expiry.

**Self-service deletion**, replacing the broken path at §1.6:

- `DELETE /users/me` no longer hard-deletes. It sets `deactivated_at`, `deletion_requested_at`,
  `purge_due_at = now + 30d`, `deactivation_reason='user_requested'`; cancels any live Stripe
  subscription; revokes sessions; sends `account_deletion_scheduled.html`.
- Fix D6 while here: a Google-only account has no password to verify. Require the Google
  re-authentication we already have (`link_google_to_user`, `auth_service.py:527`) or accept
  typing the account email as confirmation — the current code throws.

**Frontend** — replace the inline Danger Zone (`ProfileContent.tsx:390-430`) with the existing
`ConfirmDialog` (`packages/ui/src/Modals/ConfirmDialog.tsx`), which already supports
`confirmDisabled` for a gated destructive button. The delete-track dialog
(`apps/webapp/src/pages/LibraryPage.tsx:984-1024`) is the working reference.

> Countdown is **4 seconds** (decision Q2), matching the existing delete-track dialog so there is
> one destructive-action idiom across the app.

Copy must state, per your instruction: loss of account access, playlists, uploads and any active
subscription; permanent deletion in 30 days.

**Blocked-user experience** — a deactivated user hitting login or any API call gets the
`ACCOUNT_DEACTIVATED` code, and the frontend shows a dedicated screen pointing at support. Reuse
the session-expired modal pattern already wired through `useAccess()`.

### Phase 5 — Admin purge (2 days)

No automatic deletion — an admin acts, exactly as you specified.

**Notification.** A daily job finds `purge_due_at <= now` and emails the admin inbox
(`admin_purge_due.html`), reusing the `settings.admin_notification_email` pattern from
[email_service.py:322](../app/services/email_service.py).

Scheduled the way this repo already schedules recurring work — a **systemd timer plus a oneshot
service running a script in `scripts/`**, exactly like `deploy/systemd/es-reindex-tracks.timer`
driving `scripts/es_reindex_tracks.py` every ~15 days. No Celery beat process exists today and this
does not justify introducing one.

New files: `scripts/notify_purge_due.py`, `deploy/systemd/purge-due-notify.service`,
`deploy/systemd/purge-due-notify.timer` (daily), plus a `RUNBOOK.md` entry for enabling it.

**New:** `DELETE /admin/users/{uuid}` (permission `user:delete`, a new RBAC permission) →
`AdminUserController.delete_user` → `UserService.admin_purge_user`.

#### Retention policy (decision Q1)

The 30-day grace is served by Phase 4 — for those 30 days the account is inactive and **nothing is
touched**, so a mistaken deletion is fully reversible by reactivating. At purge, the split is:

**Kept, anonymised** — financial and analytics records survive the person:

| Data | Treatment |
|---|---|
| `orders`, `order_items` | keep amounts, currency, dates, Stripe ids; clear name/email/address; repoint `user_id` to the tombstone user |
| `billing_invoices` | keep — amounts and periods are accounting records; `user_id` → tombstone |
| `subscription_events` | keep — plan-change history feeds revenue reporting; `user_id` → tombstone |
| `consumption_events` | keep the event, **null the `client_ip`** — it is the only PII on the row, and the FK is already `SET NULL` |
| `usage_period_history` | keep — aggregate usage analytics, no PII once `subject_id` is scrubbed |
| `admin_operation_logs` | **never delete** — the audit trail of what *admins* did; `admin_user_id` → tombstone |

**Deleted outright** — everything that is the person or their content:

uploaded tracks and their storage artefacts (audio, HLS segments, peaks, previews) · analysis
results and their durable `results_dir` payloads · playlists, playlist tracks, engagement, ratings ·
cart, exports, transfer records · sessions, tokens, auth providers · contacts, feedback ·
`user_subscriptions` · the `users` row itself.

A **tombstone user** (a single reserved row, seeded once alongside the RBAC seed) is what the three
`RESTRICT` foreign keys repoint to. Without it none of the "kept" rows can outlive the user.

#### Teardown order

Driven by the FK `RESTRICT` set in §1.6 — repoint before deleting, or the final `DELETE` fails:

1. repoint `admin_operation_logs.admin_user_id` → tombstone
2. anonymise + repoint `orders`, `billing_invoices`, `subscription_events` → tombstone
3. null `consumption_events.client_ip`, scrub `usage_period_history.subject_id`
4. delete uploaded tracks + storage artefacts
5. delete analysis results + `results_dir` payloads
6. delete playlists, playlist tracks, engagement, ratings
7. delete cart, exports, transfer records
8. delete contacts, feedback, `user_messages` bodies (keep the row + `recipient_email` for audit)
9. delete sessions, tokens, auth providers, `user_subscriptions`
10. delete the `users` row

Filesystem deletion must be idempotent and must not abort the transaction — a missing file is not
a reason to fail a purge.

Dry-run first (`?dry_run=true` returning the manifest of what would go and what would be kept),
following `repair_founding_locks.py`'s dry-run-by-default convention. Then `account_deleted.html`
to the retained `recipient_email`, sent **before** the row disappears.

### Phase 6 — Admin user detail page and richer table (3–4 days)

**Backend** — one new endpoint rather than widening the existing detail response, so the list page
stays cheap:

`GET /admin/users/{uuid}/overview` returning:

- identity — email, username, name, uuid, roles, verified, 2FA, joined
- activity — `last_seen_at`, last login (`MAX(user_sessions.created_at)`), last IP
  (that session's `ip_address`), active session count
- plan — current plan, subscription status, period, founding flag, `cancellation`
- billing — invoice history from `billing_invoices`, subscription events from `subscription_events`
- counts — playlists, uploaded tracks, analyses, exports, ratings given
- support — contact submissions (count + latest summary), feedback (count + latest), messages sent
- lifecycle — `deactivated_at`, `purge_due_at`

Counts are `COUNT(*)` per relation. Roughly eight aggregates; issue them concurrently rather than
sequentially, and do not put any of them on the list endpoint.

**Frontend** — `apps/admin/src/pages/UserDetailsPage.tsx` at route `users/:uuid`, following
`PlaylistDetailsPage.tsx` (279 lines) and registered in `App.tsx:93`'s block.

Cross-links, as requested: playlist count → `/playlists?user=<uuid>`, track count →
`/tracks?user=<uuid>`. Both list pages need a `user` filter param added to their existing filter
handling.

**Table columns** — add **Plan** and **Last activity** to `UsersPage.tsx`. Both must come from the
list endpoint, which means adding a plan join and `last_seen_at` to `list_users_admin`
([user_repository.py:306](../app/repositories/user_repository.py)) — a join, not an N+1 per row.

### Phase 7 — Admin → user messaging (3–4 days)

**Backend** — `app/services/user_message_service.py` + migration 5.3.

| Endpoint | Purpose |
|---|---|
| `POST /admin/contact/{id}/reply` | reply quoting the original contact |
| `POST /admin/feedback/{id}/reply` | reply quoting the original feedback |
| `POST /admin/users/{uuid}/message` | direct message, nothing quoted |
| `POST /admin/messages/preview` | render the template, return HTML, send nothing |

All four share one renderer. Preview and send **must** go through the same code path — a preview
that renders differently from what is sent is worse than no preview.

Permission: `user:message` (new). Every send writes a `user_messages` row and an
`admin_operation_log` entry.

Template content, per your spec:

- contact reply — their submission time in UTC, their message quoted, then "Resomix response"
- feedback reply — same shape, quoting category / rating / message
- direct — the admin's message alone, no quoted block

**Frontend** — one shared `SendMessageModal` in `apps/admin/src/components/`, used from all three
surfaces. Compose → **Preview** → Send / Edit / Discard, exactly as described. Preview renders the
server's HTML in a sandboxed iframe rather than trusting client-side rendering to match.

Antd `Modal` + `Form`, matching the existing admin modals in `UsersPage.tsx`; `StatusModal` +
`useStatusModals` for the result, as every other admin page already does.

---

## 7. Reuse inventory

| Need | Reuse | Where |
|---|---|---|
| Email send + failure logging | `EmailService` + `LoggingService` | `email_service.py` |
| Best-effort inline send (decision Q3) | `contact_service.py:113-121` | — |
| Structured send-failure logging | `notification_service._send_and_log` | `:140` |
| Admin inbox email | `send_contact_admin_notification` | `email_service.py:322` |
| Recurring scheduled job | systemd timer + `scripts/` entry point | `deploy/systemd/es-reindex-tracks.timer` |
| Admin audit trail | `admin_operation_log_service.log_operation` | used throughout `user_service` |
| Seeding a reserved row | `scripts/seed_rbac.py` | — |
| Read-only diagnostic script shape | `scripts/redis_healthcheck.py` | — |
| Dry-run-then-apply shape | `scripts/repair_founding_locks.py` | — |
| Schedule release before mutation | `repair_founding_locks.py` | — |
| Invoice→subscription id across API versions | `_invoice_subscription_id` | `billing_sync_service.py:38` |
| Countdown confirm dialog | `ConfirmDialog` + `confirmDisabled` | `packages/ui/src/Modals/` |
| Admin detail page shape | `PlaylistDetailsPage.tsx` | `apps/admin/src/pages/` |
| Admin result modals | `StatusModal` + `useStatusModals` | `@resomix/ui`, `@resomix/hooks` |
| Access-revoked UX | `useAccess()` session-expired modal | `packages/hooks` |
| Stripe test clocks | `scripts/pricing_e2e_test.py` | — |

**Genuinely new:** `billing_email_service.py`, `billing_refund_service.py`,
`user_message_service.py`, `diagnose_subscription.py`, `notify_purge_due.py`, ten email
templates, three Alembic revisions, one seeded tombstone user, one systemd timer pair, one admin
page, one shared modal, three RBAC permissions (`user:delete`, `user:message`, plus the existing
`user:update` reused).

---

## 8. Tests

Existing suite: `tests/api/` (integration, live server on `:8001`) and `tests/unit/`.

> **Two standing constraints.** `tests/conftest.py` cleans up with a high-water-mark strategy that
> deletes any row created during the run — **never run pytest while you are using the app**. And
> vitest is not to be run in these repos.

**Unit** (`tests/unit/services/`)

- `test_billing_cancellation_state.py` — the §3 matrix: `cancel_at_period_end` only; `cancel_at`
  only; `canceled_at` only; schedule `end_behavior=cancel`. Each must produce
  `cancellation.pending == true`. This is the regression net for D1.
- `test_billing_refund_service.py` — full vs partial boundary at `amount_refunded == amount`;
  dispute created/won/lost.
- `test_user_message_service.py` — preview and send render byte-identical HTML.

**Integration** (`tests/api/`)

- `test_account_lifecycle.py` — deactivated user cannot log in, cannot call an authed endpoint,
  keeps admin access if an admin; sessions revoked on deactivate.
- `test_admin_user_purge.py` — dry-run manifest is accurate; purge succeeds for a user with tracks,
  orders and admin log entries (the three `RESTRICT` FKs — this is the D5 regression test).
- `test_admin_user_overview.py` — counts and last-login/IP correct against seeded data.
- `test_admin_messaging.py` — permission enforced, `user_messages` row written, audit logged.

**End-to-end** — extend `scripts/pricing_e2e_test.py`, which already drives real Stripe test clocks
and refuses non-`sk_test` keys:

- `refund` — subscribe, refund in full, assert immediate downgrade + `ended_at`
- `refund_partial` — assert plan **unchanged**
- `dispute` — Stripe's `4000000000000259` chargeback test card; assert revoke, then resolve
- `cancel_founding` — cancel a subscription that has a live schedule; assert
  `cancellation.pending` regardless of which mechanism Stripe used. **This is the direct test for
  the bug you reported.**

**Email assertions** — assert on the render, not on SMTP. Patch `FastMail.send_message` and check
subject, recipient and key substrings, matching the existing mocking style.

---

## 9. Decisions (settled 2026-08-08)

| # | Question | Decision |
|---|---|---|
| Q1 | Data handling on purge | **30-day grace, nothing touched.** At purge: keep financial and analytics records (anonymised, repointed to a tombstone user); delete everything else. Full split in Phase 5. |
| Q2 | Delete-confirm countdown | **4 seconds**, matching the existing delete-track dialog. |
| Q3 | Email dispatch | **Inline `await` + try/except, best-effort** — the pattern already used at `contact_service.py:113`. Not Celery. Webhook sends happen strictly after `db.commit()`. Scheduled jobs use a systemd timer + `scripts/` entry point, like `es-reindex-tracks.timer`. |
| Q4 | Dispute won → restore Pro | **Yes**, with an email. The customer did nothing wrong. |
| Q5 | Email on `past_due` → free | **No.** Stripe's dunning mail already covers it; a second one reads as a system fault. |

No decisions remain open. Every phase below is specified well enough to build.

---

## 10. Sequencing

```
Phase 0  ── diagnose (read-only, ½ d)
Phase 1  ── cancellation truth + wording (1–2 d)   ← fixes the reported bug
Phase 2  ── email infrastructure (2–3 d)
Phase 3  ── refunds + disputes (2–3 d)             ← needs Phase 2
Phase 4  ── lifecycle + is_active hardening (3–4 d)
Phase 5  ── admin purge (2 d)                      ← needs Phase 4
Phase 6  ── admin detail page + columns (3–4 d)    ← independent, can run parallel
Phase 7  ── messaging (3–4 d)                      ← needs Phase 2
```

Roughly **17–23 working days**. Phase 6 shares no code with 1–5 and can be built alongside them.

Phases 1 and 4 carry the two live defects (wrong billing information shown to paying customers; a
deactivation control that does not deactivate). Everything else is additive.

---

## 11. Scope checklist

Everything this plan covers, as a flat list. Nothing here is built yet.

### A. Subscription cancellation display — **DONE**

- [x] A1 — `scripts/diagnose_subscription.py` (read-only) reads the stored raw payloads
- [x] A2 — `cancel_at`, `ended_at`, `cancellation_reason` on `user_subscriptions`
      (migration `f4a1c8e2d9b6`)
- [x] A3 — `sync_subscription` stores all three, clears them on resume, and never erases a
      reason a refund/dispute handler set
- [x] A4 — `sync_schedule` reads `end_behavior == "cancel"` **before** the two-phase guard, so a
      truncated cancelled schedule is still seen
- [x] A5 — `BillingService.cancellation_state` → `cancellation: {pending, ended, effective_at, reason}`
- [x] A6 — Profile shows **"Active till 8 Mar 2027 (Cancelled)"**
- [x] A7 — Same fix on the pricing/subscribe page
- [x] A8 — Admin-initiated Stripe cancels show the same text (same event, no extra work)

Tests: `tests/unit/services/test_billing_cancellation_state.py` (15),
`test_billing_cancellation_sync.py` (13). All three frontend apps build.

### B. Billing emails — **infrastructure + cancellation DONE**

- [x] B1 — `BillingEmailService`, inline post-commit like `contact_service`; delivery goes through
      a new generic `EmailService.send_templated`
- [x] B2 — `billing_notifications` table (migration `c9e2a7d4f1b8`), keyed by **state** not event
- [x] B2a — **Subscription started (welcome)** — added after review: a first-time subscriber
      received nothing from us, only Stripe's payment receipt if that was even enabled, while a
      cancellation got a well-written email. Quotes the price actually paid (from `plan_prices`,
      so a founding subscriber is not shown the list price) and, for founding subscribers, the
      date their rate is locked until. Fires on `customer.subscription.created` **only** — the
      dedupe key alone would still have greeted every existing subscriber the first time a
      webhook touched them after deploy
- [x] B3 — Subscription cancelled — template + wired
- [x] B4 — Subscription ended — template + wired
- [x] B5 — Full refund — template + wired
- [x] B6 — Partial refund — template + wired
- [x] B7 — Dispute opened — template + wired
- [x] B8 — Dispute won — template + wired
- [x] B8a — **Cancellation reversed** — added after testing showed a resume updated the profile
      but told the customer nothing, leaving "your subscription is cancelled" as the last word
- [ ] B9 — Account deletion scheduled (30-day notice) — Phase 4
- [ ] B10 — Account deleted (final) — Phase 5
- [ ] B11 — Admin inbox: purge due — Phase 5
- [ ] B12 — Generic admin→user message template — Phase 7

All six templates `{% extends "base.html" %}`. **This is a deliberate change from §1.4's
"standalone" note:** `base.html` already carried the header, footer, full CSS and dark mode with an
unused `{% block content %}`, and six more copies of that 35-line CSS block would mean a brand
tweak touching six files. The inheritance machinery was already in the repo — it had simply never
been used.

Tests: `test_billing_email_service.py` (21), `test_webhook_billing_notify.py` (14). All twelve
render paths (6 templates × with/without optional fields) verified to produce complete documents
with no unrendered placeholders.

### C. Refunds and disputes — **DONE**

- [x] C1 — `charge.refunded` handled; full vs partial on `amount_refunded >= amount`
- [x] C2 — Full refund → cancelled in Stripe **and** locally, free immediately, founding lock cleared
- [x] C3 — Partial refund → email only, plan untouched
- [x] C4 — Founding schedule released before cancelling (Stripe refuses otherwise)
- [x] C5 — Subscription chargebacks handled; cart orders still fall through to `PurchaseService`
- [x] C6 — `charge.dispute.closed`: won → restored, lost → stays suspended
- [x] C7 — **2** new events to add in Stripe (12 → 14): `charge.refunded`,
      `charge.dispute.closed`. `charge.dispute.created` was already selected — it just never
      matched subscriptions
- [x] C8 — `stripe_live_doc.md` event table updated

**Design note not in the original plan.** A chargeback cannot be expressed as a `status` value:
Stripe keeps a disputed subscription **active**, so the next `customer.subscription.updated` would
mirror that straight back over ours and return access mid-dispute. Suspension is our own decision
about our own product, so it lives in `user_subscriptions.access_suspended_at`
(migration `d8b4f2a6c1e3`), which no sync path touches, and
`EntitlementService.get_effective_plan` gained one `IS NULL` condition. A full refund does not use
it — there the subscription genuinely is cancelled and `status` is the correct durable answer.

Tests: `test_billing_refund_service.py` (28).

### D. Making deactivation real — **DONE**

- [x] D1 — Blocked at `get_current_user`. **Free**: that function already loads the user row, so
      it is an in-memory boolean, not an extra query — and it is one line in one dependency, not
      per-endpoint work
- [x] D2 — Blocked at password login, after the password check so the response cannot be used to
      enumerate deactivated accounts
- [x] D3 — `UserService.deactivate` revokes every session. Without it a suspended user keeps
      working for up to `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (30) on any device holding a token
- [x] D4 — `{"code": "ACCOUNT_DEACTIVATED", "error": …}` on both login paths and the dependency
- [x] D5 — Dedicated explanation on both surfaces: the login screen branches on the CODE (a 403
      used to be assumed to mean "unverified email", so a deactivated user was shown Verify Your
      Email and a resend button that could never help), and a mid-session deactivation logs out
      through `logout({reason: 'deactivated'})` → its own modal, broadcast to every tab
- [x] D6 — `assert_active` shared by **both** token-resolving dependencies. `get_current_user_optional`
      was missed first time round, leaving 17 endpoints — similarity search among them — still
      granting a deactivated user full entitlements

> Why both a login block and a chokepoint check: login-only leaves the 30-minute access-token
> window open. Session revocation closes the refresh path
> (`async_get_active_sessions` filters `revoked_at`), but not tokens already issued.

### E. Self-service account deletion — **DONE** (E4 pending)

- [x] E1 — `request_account_deletion` soft-deletes; nothing is removed, so the tenancy bypass the
      old hard delete needed is gone with it
- [x] E2 — Password required only where one exists; a Google-only account (`password_hash IS
      NULL`) can now delete itself. Schema, API client and TS type all made optional to match
- [x] E3 — `deactivated_at`, `deletion_requested_at`, `purge_due_at = +30d`, reason
      `user_requested`
- [ ] E4 — Cancel any live Stripe subscription as part of deletion *(the email already says the
      subscription is cancelled — this must land before that sentence is true)*
- [x] E5 — `DeleteAccountDialog` using the shared `ConfirmDialog`, 4s countdown matching
      delete-track
- [x] E6 — Consequences listed; the response and email both carry the purge date

Tests: `tests/unit/services/test_account_lifecycle.py` (14). All three apps build.

### F. Admin purge

- [ ] F1 — Seed the tombstone user
- [ ] F2 — Daily systemd timer + script emailing admins when accounts are purge-due
- [ ] F3 — `DELETE /admin/users/{uuid}` with a new `user:delete` permission
- [ ] F4 — Keep + anonymise: orders, invoices, subscription events, consumption events, usage history
- [ ] F5 — Never delete admin operation logs — repoint to tombstone
- [ ] F6 — Delete: tracks + storage artefacts, analyses + payloads, playlists, ratings, cart,
      exports, transfers, contacts, feedback, sessions, tokens, the user row
- [ ] F7 — Dry-run mode returning the full keep/delete manifest
- [ ] F8 — Wire the admin UI button to the real endpoint (currently a hardcoded error)

### G. Admin user visibility

- [ ] G1 — `last_seen_at` column + throttled middleware touch (nothing today can answer "last action")
- [ ] G2 — Replace the hardcoded `"last_login": None` with the real value
- [ ] G3 — Surface last login, last IP and active session count
- [ ] G4 — `GET /admin/users/{uuid}/overview` — identity, activity, plan, billing, counts, support,
      lifecycle
- [ ] G5 — New `UserDetailsPage` at `users/:uuid`, following `PlaylistDetailsPage`
- [ ] G6 — Playlist count → `/playlists?user=<uuid>`; track count → `/tracks?user=<uuid>`
- [ ] G7 — Add a `user` filter to the playlists and tracks admin pages
- [ ] G8 — Add **Plan** and **Last activity** columns to the users table (via a join, not N+1)

### H. Admin → user messaging

- [ ] H1 — `user_messages` table (audit of every message sent)
- [ ] H2 — `UserMessageService` with one shared renderer
- [ ] H3 — `POST /admin/contact/{id}/reply` — quotes their message + submission time in UTC
- [ ] H4 — `POST /admin/feedback/{id}/reply` — quotes category, rating, message
- [ ] H5 — `POST /admin/users/{uuid}/message` — direct, nothing quoted
- [ ] H6 — `POST /admin/messages/preview` — same code path as send, renders without sending
- [ ] H7 — Shared `SendMessageModal`: compose → preview → send / edit / discard
- [ ] H8 — New `user:message` permission; every send audit-logged

### I. Tests

- [ ] I1 — Unit: cancellation-state matrix (all four Stripe mechanisms → `pending == true`)
- [ ] I2 — Unit: refund full/partial boundary; dispute created / won / lost
- [ ] I3 — Unit: message preview and send render identically
- [ ] I4 — Integration: deactivated user blocked on login and on authed endpoints
- [ ] I5 — Integration: purge succeeds against all three `RESTRICT` foreign keys
- [ ] I6 — Integration: overview counts, last login, last IP
- [ ] I7 — Integration: messaging permissions + audit rows
- [ ] I8 — E2E: `refund`, `refund_partial`, `dispute`, `cancel_founding` on Stripe test clocks

### J. Documentation

- [ ] J1 — `stripe_live_doc.md` event table (12 → 15)
- [ ] J2 — `RUNBOOK.md` entry for the purge-due timer
- [ ] J3 — Retention policy recorded for whoever answers the first GDPR request

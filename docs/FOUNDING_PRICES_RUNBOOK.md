# Founding prices — operator runbook

**Pricing v2.1, Phase F1.** The code is in place; these are the steps a human has to perform,
because they create real objects in a live payment system.

Nothing here is automated on purpose. A script that creates Stripe prices is a script that can
create them twice, in the wrong mode, or at the wrong amount — and a duplicate price that someone
subscribes to is not something you can quietly delete afterwards.

---

## What already works without any of this

The founding window is open (`BETA_END_DATE = 2027-02-01T00:00:00Z`), and `resolve_offer_price`
falls back to the **list** price when no founding price exists. So today the pricing page and
checkout both sell the current €9.00 list price, exactly as before. Nothing is broken while this
runbook is outstanding — it simply is not yet a founding offer.

---

## Step 1 — create four prices in Stripe

In the **same Stripe account and mode** the app uses (`STRIPE_SECRET_KEY`). All four attach to the
existing Pro product.

| Price | Amount | Interval | Needed for |
|---|---|---|---|
| `pro_founding_monthly` | **€7.99** | month | What founding buyers pay |
| `pro_founding_yearly` | **€69.00** | year | What founding buyers pay |
| `pro_list_monthly` | **€9.99** | month | Phase 2 of the monthly schedule |
| `pro_list_yearly` | **€89.00** | year | Phase 2 of the yearly schedule |

> ⚠️ **The list prices are not optional and not "later".** A Subscription Schedule must reference
> its phase-2 price *at the moment it is created* — i.e. on the first founding sale. If the list
> price does not exist then, `apply_founding_lock` logs an error and applies **no lock at all**: the
> customer keeps the founding rate indefinitely. That is the generous direction, but it is not what
> was agreed, and it is invisible until someone reads the logs.
>
> The list prices are **created but never exposed in checkout** until the window closes — that is
> what `price_kind` is for.

There is already a €9.00 monthly list price in `plan_prices`. Decide deliberately whether the list
price becomes €9.99 (per the spec) or stays €9.00, and if it changes, attach the new one as the
`list` kind in step 2 — it replaces the old row for that plan/interval/currency.

---

## Step 2 — attach each price to the plan

`POST /admin/entitlements/plans/pro/prices` (admin, `plans:manage`):

```json
{ "stripe_price_id": "price_...", "interval": "month", "price_kind": "founding" }
```

Amount, currency and product are read back **from Stripe**, so a typo in the amount cannot enter
the database — only a wrong price ID can, and that surfaces immediately as the wrong number on the
pricing page.

Repeat for all four, with the right `price_kind` and `interval` each time.

> `price_kind` is part of the upsert key. Attaching a founding price does **not** overwrite the
> list price for the same interval and currency — that was the pre-Phase-F behaviour and it would
> have destroyed the phase-2 price the schedule depends on.

---

## Step 3 — verify before anyone can buy

```bash
curl -s "$API/api/v1/billing/plans" | jq '.data.beta, (.data.plans[] | select(.code=="pro"))'
```

Expect: `beta.founding_active: true`, `unit_amount_cents: 799`, `is_founding_price: true`,
`list_unit_amount_cents: 999`.

If `is_founding_price` is `false`, the founding row is missing or inactive — checkout would sell
the list price.

---

## Step 4 — prove the lock with a Stripe test clock

This is the only way to confirm the part that matters, and it cannot be checked by reading code:

1. Test clock → subscribe to Pro monthly at the founding price.
2. Confirm a Subscription Schedule exists on the subscription, `end_behavior = release`, phase 1
   = founding × **22**, phase 2 = list.
3. Advance the clock through cycle 22 → invoices stay **€7.99**.
4. Advance one more → invoice is **€9.99**, and the schedule releases.
5. Confirm `user_subscriptions.is_founding` flips to `0` on release (the
   `subscription_schedule.released` webhook).

Yearly is the same with **2** iterations.

---

## Step 5 — check the webhook endpoint is subscribed to the new events

The founding lock is mirrored from `subscription_schedule.*`. Add these in the Stripe dashboard
webhook configuration if they are not already selected:

```
subscription_schedule.created
subscription_schedule.updated
subscription_schedule.released
subscription_schedule.canceled
subscription_schedule.completed
subscription_schedule.aborted
```

Without them the schedule still runs — Stripe enforces it — but `is_founding` never clears when the
lock ends, and the profile screen keeps telling a customer they are on a founding rate they are no
longer paying.

---

## Rollback

Set the founding prices to `is_active = false`
(`PATCH /admin/entitlements/plans/pro/prices/{id}`). Checkout falls straight back to the list price
on the next request. **Existing schedules are untouched** — anyone who already bought keeps their
locked rate, which is the guarantee.

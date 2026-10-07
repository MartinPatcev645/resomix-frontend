Here is the complete, industry-standard implementation plan for your Resomix B2C Stripe integration. This plan perfectly maps your FastAPI backend to your new enterprise MariaDB schema. 

Treat this as your definitive blueprint. 

---

## 🏗️ Phase 1: Core Infrastructure & Setup

### 1. Environment & Dependencies
*   **Install Stripe:** Ensure `stripe` is in your `requirements.txt`.
*   **Environment Variables:** Your `.env` must contain:
    *   `STRIPE_SECRET_KEY` (For API calls)
    *   `STRIPE_WEBHOOK_SECRET` (Generated via Stripe CLI for local testing)
    *   `FRONTEND_URL` (For Stripe redirect success/cancel URLs)

### 2. Local Testing Setup (Stripe CLI)
*   Ensure you have the Stripe CLI installed.
*   Run the webhook tunnel in a dedicated terminal during development:
    ```bash
    stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
    ```

---

## 🛒 Phase 2: The Pre-Flight Checkout (API & Service)

**Where:** `cart_controller.py` and `order_service.py`
**Goal:** Transition the user from a shopping cart to the Stripe hosted checkout page securely, without losing track of abandoned carts.

**The Workflow:**
1.  **Format Selection:** The UI sends a `POST /api/checkout/init` payload containing the user's `cart_id` (which is populated with `track_format_id`s, not generic track IDs).
2.  **Calculate Totals:** The backend queries `cart_items` joined with `track_formats` to calculate the exact `subtotal_cents`. Do *not* trust any prices sent from the frontend.
3.  **Create Pending Order:** 
    *   `INSERT INTO orders (user_id, subtotal_cents, total_cents, status)` with `status = 'pending'`.
    *   Store the generated `order.id`.
4.  **Create Stripe Session:** Call `stripe.checkout.Session.create()`.
    *   Set `mode='payment'`.
    *   Enable Adaptive Pricing (`automatic_tax` / currency conversion flags).
    *   **CRITICAL:** Set the `metadata` dictionary to include `{"internal_order_id": order.id}`.
5.  **Redirect:** Return the `stripe_session.url` to the Vue.js frontend so the user is redirected to pay.

---

## 🛡️ Phase 3: The Idempotent Webhook Pipeline

**Where:** `webhooks.py` (Router) and `webhook_controller.py`
**Goal:** Securely receive Stripe's payment confirmations and guarantee you never double-process an event.

**The Workflow:**
1.  **Raw Payload Extraction:** Your `POST /webhooks/stripe` endpoint MUST extract the raw bytes (`await request.body()`) before any FastAPI JSON parsing occurs.
2.  **Signature Verification:** Pass the raw body and the `Stripe-Signature` header into `stripe.Webhook.construct_event()`. If it fails, return `400 Bad Request`.
3.  **Idempotency Check:** 
    *   Take the Stripe `event.id` (e.g., `evt_12345`).
    *   Query your `system_logs` (or a dedicated webhook audit table). 
    *   If that `event.id` already exists and was processed successfully, instantly return `200 OK` and halt. Do not proceed to fulfillment.
4.  **Audit Logging:** Insert the raw JSON payload and `event.id` into your `system_logs` table for an immutable financial audit trail.

---

## 📦 Phase 4: Atomic Fulfillment

**Where:** `purchase_service.py`
**Goal:** Translate a successful payment into digital ownership and unlock the files for the user.

**The Workflow:**
1.  **Route the Event:** If the webhook event is `checkout.session.completed`, extract the `internal_order_id` from the session's `metadata`.
2.  **Database Transaction (Atomic):** Open a SQL transaction so everything succeeds or fails together.
    *   **Update Order:** `UPDATE orders SET status = 'paid', stripe_session_id = ? WHERE id = internal_order_id`.
    *   **Create Purchases:** `SELECT` all items from `cart_items` for that user. Loop through them and `INSERT INTO purchases (order_id, user_id, track_format_id, price_cents)`.
    *   **Clear Cart:** `UPDATE carts SET status = 'completed' WHERE user_id = ? AND status = 'active'`.
3.  **Commit:** Commit the transaction to MariaDB.
4.  **Acknowledge:** Return `200 OK` to Stripe. The user's "My Downloads" page in Vue.js will now show the tracks by querying the `purchases` table.

---

## 🚨 Phase 5: Security & Dispute Automation

**Where:** `webhook_controller.py`
**Goal:** Protect your platform from friendly fraud and "Digital Theft."

**The Workflow:**
1.  **Listen for Disputes:** Add a handler for the `charge.dispute.created` event in your webhook controller.
2.  **Map the Charge:** Extract the `payment_intent` from the dispute object. Use it to query Stripe to find the associated Checkout Session, and subsequently, your `internal_order_id`.
3.  **Revoke Access:**
    *   `UPDATE orders SET status = 'failed' WHERE id = internal_order_id`.
    *   *(Optional but recommended)* Flag the `purchases` rows as revoked so the UI immediately hides the download buttons for those specific tracks.

---

## 🎟️ Phase 6: Promo Code Sync (Admin Panel)

**Where:** `admin_controller.py`
**Goal:** Ensure discount codes created by your team work natively inside the Stripe Checkout page.

**The Workflow:**
1.  **Creation:** When an admin creates a code (e.g., "WINTER20" for 20% off) in the Vue.js dashboard:
    *   Create the rule in Stripe: `stripe.Coupon.create(percent_off=20)`.
    *   Create the text code: `stripe.PromotionCode.create(coupon=coupon.id, code="WINTER20")`.
    *   `INSERT INTO promo_codes` in your MariaDB, saving the Stripe IDs alongside your local data.
2.  **Application:** When generating the `stripe.checkout.Session` in Phase 2, pass `allow_promotion_codes=True` so the user sees the promo code box on the payment page. Stripe will handle the math automatically.
```
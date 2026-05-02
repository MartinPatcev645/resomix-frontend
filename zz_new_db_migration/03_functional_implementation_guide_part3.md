# Phase 3: Functional Implementation Guide
## Part 3: E-Commerce, DDEX B2B, and Telemetry

This final guide outlines the file-by-file codebase updates required for the remainder of the system: **E-Commerce/Billing**, **DDEX/B2B Ingestion**, and **High-Velocity Telemetry/Security**.

### 1. Overview of Changes
- **Commerce Integrity Restored**: The e-commerce flow now strictly depends on the immutable `orders` ledger. `purchases` are no longer standalone; they MUST be tied to an `order_id`. `carts` now support `promo_codes`.
- **B2B Pipeline Setup**: A massive suite of `deal` and `royalty` tables have been added to support DDEX ERN ingestion.
- **Admin & Support Integrations**: `Waitlist`, `Feedback`, `Contact`, and `ManualTakedowns` are structured using optimized `INT UNSIGNED` IDs. External integrations like `PlaylistTransferTrack` also use `INT UNSIGNED`.
- **Telemetry Scale**: Telemetry and logs (`system_logs`, `consumption_events`) are isolated, retaining `BIGINT UNSIGNED` primary keys to support infinite scaling, while the rest of the application has been optimized to `INT UNSIGNED`.

---

### 2. File-by-File Implementation Plan

#### A. SQLAlchemy Models (`app/models/`)

**1. `app/models/commerce.py` (or `order.py`, `cart.py`)**
*   **Target Models**: `PromoCode`, `Order`, `Purchase`, `Cart`, `CartItem`, `UserSubscription`
*   **Required Updates**:
    *   **Primary Keys**: Update all `id` columns to explicitly use `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Foreign Keys**: 
        *   `Purchase` must now include `order_id` (`INT UNSIGNED`, nullable=False).
        *   `Order` must include `promo_code_id` (`INT UNSIGNED`, nullable=True).
        *   `Cart` must include `promo_code_id` (`INT UNSIGNED`, nullable=True).
        *   `CartItem` must include `release_id` (`INT UNSIGNED`, nullable=True) to support "Complete My Album" logic.

**2. `app/models/b2b.py` (New DDEX Models)**
*   **Target Models**: `Deal`, `Message`, `ReleaseDeal`, `DealTerritory`, `DealUseType`, `RoyaltyRate`
*   **Required Updates**:
    *   These are entirely new models that need to be scaffolded. Ensure all primary keys (`id`) and foreign keys (`deal_id`, `message_id`) are mapped as `Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True))`. 
    *   `RoyaltyRate` must map the `rate_type` Enum properly (`FixedRate`, `RevenueShare`, `PerStream`, `PerDownload`, `MinGuarantee`, `Other`).

**3. `app/models/telemetry.py` (Logging & Security)**
*   **Target Models**: `SystemLog`, `ConsumptionEvent`, `IngestLog`, `IngestionError`, `AcrInfringementLog`
*   **Required Updates**:
    *   **CRITICAL EXCEPTION**: Ensure the primary key `id` for these specific models is mapped as **`id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True)`**. These tables handle massive throughput and must not be downsized.
    *   **Foreign Keys**: Any foreign keys pointing to standard entities (e.g., `user_id`, `track_id` inside `SystemLog` or `ConsumptionEvent`) must be mapped as `Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey(...))` to match the new optimized schema.

**4. `app/models/admin.py` (Support & Integrations)**
*   **Target Models**: `Waitlist`, `Feedback`, `Contact`, `ManualTakedown`, `PlaylistTransferTrack`
*   **Required Updates**:
    *   **Primary Keys**: Update `id` columns to explicitly use `id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Foreign Keys**: Ensure `user_id` and `track_id` (in `ManualTakedown` and `PlaylistTransferTrack`) are mapped as `Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey(...))`.

#### B. Pydantic Schemas (`app/schemas/`)

**1. `app/schemas/commerce.py`**
*   **Required Updates**:
    *   Update the `PurchaseResponse` schema to include the `order_id` and the nested `Order` details.
    *   Update `CartSchema` to accept an optional `promo_code`.
    *   Update `CheckoutRequestSchema` to require an `order_id` validation state before processing Stripe intents.

#### C. Data Access Layer (`app/repositories/`)

**1. `app/repositories/commerce_repository.py`**
*   **Target Functions**: `checkout_cart()`, `record_purchase()`
*   **Required Updates**:
    *   **Async execution**: Require `AsyncSession` for executing the queries via `await session.execute(select(...))`.
    *   **Transactional Integrity**: The `checkout_cart` logic must now explicitly create an `Order` record *before* the Stripe session is completed (as `status='pending'`). Once the webhook returns success, it updates the `Order` to `status='paid'` and then batch-inserts the `Purchases` using the newly generated `order_id`.

**2. `app/repositories/telemetry_repository.py`**
*   **Target Functions**: `log_consumption()`
*   **Required Updates**:
    *   Ensure the `isrc` and `label_id` are explicitly denormalized (copied directly into the `consumption_events` table) upon track play. This avoids catastrophic `JOIN` performance hits when generating Monthly DSRF reports.

#### D. Business Logic (`app/services/`)

**1. `app/services/checkout_service.py`**
*   **Target Functions**: `apply_promo_code()`
*   **Required Updates**:
    *   Implement logic to query the new `promo_codes` table, validate the `expires_at` and `max_uses` rules, and attach the ID to the `Cart` before generating the Stripe session subtotal.

#### E. API Routers (`app/api/routers/`)

**1. `app/api/routers/commerce.py` & Webhooks**
*   **Required Updates**:
    *   Ensure the Stripe webhook router properly matches the `stripe_session_id` back to the `Order` table (since the legacy `stripe_payment_intent_id` logic on standalone purchases is deprecated).

---

### 3. Migration Checklist & Secondary Verification

To ensure billing integrity and B2B scale are maintained, verify the following:
- [ ] **Billing Integrity**: Are `purchases` enforcing `nullable=False` on `order_id`? (No orphaned purchases allowed).
- [ ] **Type Match Check**: Inside `consumption_events` and `system_logs`, are the foreign keys (`user_id`, `track_id`, `label_id`) successfully updated to `INT UNSIGNED`, even though their primary key `id` is `BIGINT UNSIGNED`?
- [ ] **Telemetry Enum Validation**: Does the `event_category` in `ConsumptionEvent` strictly match the DB ENUM (`stream_start`, `stream_complete`, `stream_skip`, `download_success`)?

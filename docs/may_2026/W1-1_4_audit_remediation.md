# Audit & Remediation Plan: W1-1 to W1-4 (Pragmatic Multi-Tenant Foundation)

## Overview
This document outlines the final, high-priority technical gaps that must be closed to satisfy the **Partner-Ready** criteria of Week 1. This plan focuses strictly on data isolation and auditing for the B2B SaaS API, deferring B2C refactors and non-essential features to later weeks or the post-pilot backlog.

---

## I. Truly Missing Database Gaps (Fix Now)
These holes cause cross-tenant leakage or block ingestion auditing. Total estimated effort: ~3.5h.

### 1. Missing `partner_id` on Content Tables
The following tables currently rely on joins through `party_id` or `track_id`, which is a leakage risk.
- [ ] **`audio_files`, `image_files`, `document_files`**: Add `partner_id INT UNSIGNED NOT NULL DEFAULT 1` + FK + Index.
- [ ] **`playlists`**: Add `partner_id INT UNSIGNED NOT NULL DEFAULT 1` + FK + Index.
- [ ] **`ingest_logs`**: Add `partner_id INT UNSIGNED NOT NULL DEFAULT 1` + FK + Index.

### 2. Explicit Deletion Constraints
- [ ] Update `partner_id` Foreign Keys on `tracks`, `releases`, `audio_files`, `image_files`, `document_files`, `ingest_logs`, and `playlists` to include **`ON DELETE RESTRICT`**.
    - *Rationale*: Deleting a partner should not silently nuke their catalog; it should require an explicit cleanup process.

### 3. Canonical Decision: The Sandbox Tenant
- [ ] **Document `partner_id = 1`**: Add a schema header comment and an ADR note confirming that `partner_id = 1` is the "Resomix Sandbox".
    - All B2C consumer users belong to ID 1.
    - All public/demo tracks (CC_BY) belong to ID 1.
    - The public sandbox API key (W3-5) resolves to ID 1.

---

## II. Application Layer Hardening (W1-4 Pragmatic Path)

### 1. High-Traffic Repository Scoping
Don't hand-audit every query. Focus on the primary entry points and trust the **W1-6 Global Middleware** to catch the long tail.
- [ ] **`PlaylistRepository`**: Update UUID lookups to include `partner_id`.
- [ ] **`TrackRepository`**: Update high-traffic `get_with_relationships` and search methods.
- [ ] **`SimilarityRepository`**: Ensure raw SQL updates include the `partner_id` predicate.

### 2. No Anonymous Fallbacks
- [ ] **Auth Enforcement**: Every authenticated request MUST resolve to a `partner_id` via an API key (even the sandbox key).
- [ ] **Middleware Rule**: The future W1-6 middleware will NOT have a fallback to "Partner 1" for anonymous requests.
    - **Requirement**: Unauthenticated requests to partner-scoped endpoints must return a strict **`401 Unauthorized`**. No soft blocks or defaults.

---

## III. Deferred Items (Out of Scope for W1-4)

The following were identified in previous audits but are **EXCLUDED** from the current remediation to maintain focus:
- **Skip**: `track_ratings`, `user_track_engagements` (B2C-only, maps to Partner 1).
- **Skip**: `feedbacks`, `contacts`, `waitlists` (B2C public forms).
- **Skip**: `ecommerce` tables (Post-pilot backlog).
- **Skip**: Junction tables like `release_tracks` (Inherit scope via JOIN; scale doesn't require denormalization yet).
- **Defer**: `partner_subscription_history` and `partner_payments` (Week 4 Stripe integration).
- **Defer**: `partner_tiers` lookup table (Enum is sufficient for Phase 1).
- **Defer**: `parties`, `labels`, `contributors` refactoring (Dormant in SaaS-only mode).

---

## IV. Status Check: Already Handled
The following items were reviewed and confirmed as correctly implemented or appropriately planned:
- **API Usage History**: Granular audit trail for every call is handled by `partner_usage_logs` (W2-1).
- **Monthly Consumption**: Aggregate tracking per 30-day period is handled by `partner_quotas` (W1-8).
- **Current Plan Status**: Tracked via `Partner.tier` (W1-1).
- **B2C/Demo Traffic**: Correcty mapping to `partner_id = 1` (Resomix Sandbox).
- **Auth Dependency**: `get_current_partner()` correctly resolves API keys and populates `request.state`.

---

## V. Verification Plan
1. **Schema Audit**: Verify all new `partner_id` columns have `NOT NULL DEFAULT 1` and `ON DELETE RESTRICT`.
2. **Leak Test (Single Resource)**: Verify that a "Partner 2" API key fetching a specific UUID owned by "Partner 1" returns `404 Not Found`.
3. **Leak Test (List Enumeration)**: Verify that a "Partner 2" list request (e.g., `/api/v1/tracks`) returns **zero results** from Partner 1's catalog.
4. **Auth Check**: Confirm that unauthenticated requests to scoped endpoints fail with `401 Unauthorized` rather than falling back to Partner 1.

# Resomix B2B Roadmap Phase 2 Implementation Guide (W1-5 to W1-8)

This document provides a comprehensive, highly detailed guide for implementing tasks W1-5 through W1-8 from the `resomix_30day_roadmap_v2.md`. This guide adheres to our established coding standards, enforces strict tenant isolation, and prioritizes a dual-server architecture for similarity computations.

---

## 1. General Guidelines & Best Practices

Before commencing any work on these tasks, all developers must adhere strictly to the following rules:

1. **Surgical Edits:** Do not rewrite entire modules or change core business logic unless explicitly required by the task. Make precise, localized insertions and modifications.
2. **Environment & Tooling:** 
   - Always execute Python commands using the virtual environment: `.venv/bin/python ...` or `.venv/bin/pytest ...`.
3. **Database Interactions:**
   - **No Alembic:** Do not use Alembic for schema migrations during this phase.
   - **Direct SQL:** If the database schema needs updating (tables, columns, indexes), apply the updates directly using `docker exec`. Ensure that the live database, `new_database.sql`, and SQLAlchemy models are always perfectly aligned.
   - Example Database Command:
     ```bash
     docker exec -i resomix-test-db mariadb -uroot -ptest resomix_db -e "SELECT * FROM tracks;"
     ```
4. **Testing Standards:**
   - Write comprehensive unit tests covering all edge cases.
   - Ensure you test the functionality, imports, and verify stability by starting the server (`make api` or `.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001`).

---

## 2. Approach & Architecture

The upcoming tasks span both the local FastAPI server and the external Hetzner Similarity server. The approach must be highly coordinated:

*   **Current Server (FastAPI):** Acts as the orchestrator. It manages API keys, rate limits, and scopes requests with a `partner_id`. It does *not* hold FAISS indexes.
*   **External Server (Hetzner):** Acts as the computation engine. It holds the FAISS indexes in memory and manages the temporary file uploads required for audio similarity, segmented by `partner_id`.

---

## 3. Detailed Task Implementations

### Task W1-5: FAISS Per-Partner Indexes (Delegated to Hetzner Server)

Because the FAISS embeddings reside on the Hetzner server, this task requires coordination across both codebases.

#### A. Modifications on the Current Server (FastAPI)
**Objective:** Pass tenant context (`partner_id`) to the similarity server and provide admin tools to manage the remote indexes.

1.  **File to Touch:** `app/services/similarity_service.py`
    *   **Action:** Modify the methods `calculate_similarity_for_upload` and `get_similarity_by_path`.
    *   **Details:** The `partner_id` is *already* successfully passed down from the FastAPI router via `get_current_partner_scoped` through the `SimilarityController` and into these service methods. The only required change is to inject `"partner_id": partner_id` into the JSON payload (or form data) immediately before making the HTTP call to the Hetzner server.

2.  **File to Touch:** `app/api/routers/admin/similarity.py` *(New File)*
    *   **Action:** Create a new admin router specifically for managing the remote FAISS indexes.
    *   **Details:** Implement an endpoint like `POST /admin/similarity/rebuild-index`. It must be secured with `get_api_key` (checking for admin privileges). It should accept an optional `partner_id`. This endpoint will trigger a rebuild command via an HTTP call to the Hetzner server. Remember to register this router in `app/api/routers/__init__.py`.

#### B. Instructions for the Hetzner Server Codebase
**Objective:** The Hetzner server must be updated to securely isolate partners at the memory and file-system levels.

1.  **FAISS Index Initialization:**
    *   **Action:** Replace the global FAISS index with a dictionary mapping: `dict[int, faiss.Index]`.
    *   **Details:** On startup (or when triggered by the admin endpoint), load embeddings grouped by `partner_id`. Create one `faiss.IndexFlatIP` per partner. Ensure embeddings are L2-normalized prior to storage so that inner product equals cosine similarity.
2.  **Upload Directory Isolation:**
    *   **Action:** Modify the upload endpoints (e.g., `/similarity/query-by-upload/`).
    *   **Details:** Read the `partner_id` from the incoming request payload. Save the uploaded audio file into a partner-specific directory structure, e.g., `/uploads/partner_{partner_id}/{filename}`.
3.  **Query Isolation:**
    *   **Action:** Modify query endpoints (`/similarity/query-by-upload/` and `/similarity/query-by-uuid/`).
    *   **Details:** Extract the `partner_id`. Execute the `faiss.Index.search()` *only* against `faiss_indexes[partner_id]`. If a partner does not exist in the dictionary, return a structured 404 or empty result set.

### Task W1-6: Query-Builder Middleware for Tenant Isolation

**Objective:** Prevent cross-tenant data leaks at the ORM level by enforcing strict `partner_id` scoping.

1.  **File to Touch:** `database/connection.py` *(Existing File)*
    *   **Action:** Modify the existing `_do_orm_execute` SQLAlchemy event listener.
    *   **Details:** The codebase already contains a global failsafe using `with_loader_criteria` that automatically injects `.where(partner_id == pid)`. However, it currently fails open (does nothing) if `pid is None`. To meet the roadmap requirement, modify this hook to **raise a strict exception** (e.g., `RuntimeError` or a custom `CrossTenantViolationException`) if the queried model has a `partner_id` column but no `partner_id` context is active. This ensures the application refuses to emit any partner-scoped query anonymously.

### Task W1-7: Layer 1 Rate Limiting (Token Bucket)

**Objective:** Protect the API from burst traffic using Redis.

1.  **File to Touch:** `app/services/rate_limit_service.py` *(New File)*
    *   **Action:** Implement burst protection.
    *   **Details:** Use `aioredis` to execute an atomic Lua script for a Token Bucket algorithm. The key format should be `rate_limit:burst:{api_key_hash}`. The default limit is 10 requests per second (retrieved from `partner_api_keys.rate_limit_rps`).
2.  **File to Touch:** `app/api/dependencies/auth.py`
    *   **Action:** Integrate rate limiting into the API key validation flow.
    *   **Details:** After validating the `get_api_key`, call the rate limit service. If the bucket is exhausted, raise an `HTTPException` with status code `429 Too Many Requests` and include a `Retry-After` header.

### Task W1-8: Layer 2 Quota Enforcement (Monthly Limits)

**Objective:** Enforce rolling 30-day business quotas and sync them to MariaDB.

1.  **File to Touch:** `app/services/rate_limit_service.py`
    *   **Action:** Implement monthly quota tracking.
    *   **Details:** Alongside the burst check, perform a Redis `INCR` on a key like `rate_limit:monthly:{partner_id}:{YYYY_MM}`. If the value exceeds `partner_api_keys.rate_limit_monthly`, return a `429` error. Ensure this Redis key has a 35-day TTL (`EXPIRE`).
2.  **File to Touch:** `app/services/quota_flush_worker.py` *(New File)*
    *   **Action:** Create a background worker.
    *   **Details:** This worker should wake up every 5 minutes, read the monthly counters from Redis, and flush them to the MariaDB `partner_quotas` table using an `ON DUPLICATE KEY UPDATE` statement. Ensure the `period_start` and `period_end` are calculated correctly.
3.  **Database Alignment:**
    *   Ensure the `partner_quotas` table exists exactly as defined in `new_database.sql`. Use the following format for verification/creation:
        ```bash
        docker exec -i resomix-test-db mariadb -uroot -ptest resomix_db -e "
        CREATE TABLE IF NOT EXISTS partner_quotas (
            id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
            partner_id      INT UNSIGNED    NOT NULL,
            api_key_id      INT UNSIGNED    DEFAULT NULL,
            period_start    DATE            NOT NULL,
            period_end      DATE            NOT NULL,
            requests_made   BIGINT UNSIGNED NOT NULL DEFAULT 0,
            quota_limit     BIGINT UNSIGNED NOT NULL,
            is_overage      TINYINT(1)      NOT NULL DEFAULT 0,
            last_synced_at  DATETIME        DEFAULT NULL,
            FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
            FOREIGN KEY (api_key_id) REFERENCES partner_api_keys(id) ON DELETE CASCADE,
            UNIQUE KEY uk_quota_period (partner_id, api_key_id, period_start),
            INDEX idx_quota_period (period_start, period_end)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
        ```

---

## 4. Automated Testing Strategy

For every feature implemented above, the following testing protocols must be adhered to:

1.  **Rate Limiting & Quotas:**
    *   Write `pytest` tests using `.venv/bin/pytest`.
    *   Mock the Redis connection to simulate 11 rapid requests in 1 second. Verify the 11th request receives a 429 status and the `Retry-After` header.
    *   Simulate exceeding the monthly quota and assert the appropriate rejection.
2.  **Tenant Isolation (W1-6):**
    *   Create two mocked partners in the test database.
    *   Execute a standard ORM query for `Track` models.
    *   Assert that the query result *strictly* only contains tracks belonging to the partner context injected by the test middleware, with zero cross-tenant contamination.
3.  **Similarity Server Payload (W1-5):**
    *   Mock `httpx.AsyncClient` in `similarity_service.py` unit tests.
    *   Assert that the dictionary/payload being transmitted over HTTP natively includes `"partner_id": <id>`.
4.  **System Integrity Check:**
    *   After changes are made, run `.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001`.
    *   Ensure no import errors, circular dependencies, or broken endpoints occur during startup.

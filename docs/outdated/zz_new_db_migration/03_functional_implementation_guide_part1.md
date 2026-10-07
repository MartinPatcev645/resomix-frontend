# Phase 3: Functional Implementation Guide
## Part 1: Identity & Authentication

This document outlines the exact, file-by-file codebase updates required to support the new `new_database.sql` schema for the **Identity & Authentication** domain. 

### 1. Overview of Changes
The core structure of the Identity domain (`users`, `roles`, `permissions`, `user_sessions`, `user_tokens`, `user_auth_providers`, `user_operation_limits`, `sftp_users`, `spotify_apps`, `user_spotify_apps`) remains architecturally identical to the legacy database. However, strict database constraints (`INT UNSIGNED` for identities, `utf8mb4_unicode_ci` collation) have been introduced globally in the new schema to dramatically optimize index memory footprints. 

Therefore, the primary task for this domain is updating the **SQLAlchemy ORM Models** to strictly enforce these new MariaDB constraints, preventing silent ingestion failures or foreign key mismatches. We will implement these using the modern **SQLAlchemy 2.0 `Mapped` and `mapped_column` syntax** for strict type hinting and the Data Mapper pattern, along with injecting `AsyncSession` into our repositories.

---

### 2. File-by-File Implementation Plan

#### A. SQLAlchemy Models (`app/models/`)

**1. `app/models/user.py`**
*   **Target Models**: `User`, `UserSession`, `UserToken`, `UserAuthProvider`
*   **Required Updates**:
    *   **Primary Keys**: Update all `User`, `UserAuthProvider` `id` columns to explicitly use MariaDB's unsigned integers with SQLAlchemy 2.0 syntax: `id: Mapped[int] = mapped_column(dialects.mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)`. Note: High-velocity logs like `UserSession` and `UserToken` still use `BIGINT UNSIGNED` mapped as `Mapped[int] = mapped_column(dialects.mysql.BIGINT(unsigned=True), primary_key=True)`.
    *   **Foreign Keys**: Update all `user_id` foreign keys to use `user_id: Mapped[int] = mapped_column(dialects.mysql.INTEGER(unsigned=True), ForeignKey('users.id'))`. Failure to match the unsigned constraint will result in `FOREIGN KEY constraint failed` errors when generating Alembic migrations.
    *   **String Constraints**: Ensure `uuid` is mapped as `CHAR(36)` instead of a generic `String(36)`.
    *   **Collation Enforcement**: Add `__table_args__` to all models to enforce the new strict collation:
        ```python
        __table_args__ = (
            {'mysql_engine': 'InnoDB', 'mysql_charset': 'utf8mb4', 'mysql_collate': 'utf8mb4_unicode_ci'}
        )
        ```

**2. `app/models/role.py` (and related permissions)**
*   **Target Models**: `Role`, `Permission`, `UserRole`, `RolePermission`
*   **Required Updates**:
    *   **Primary Keys**: Roles and Permissions use `INT UNSIGNED` in the new database. Update the ORM to use `id: Mapped[int] = mapped_column(dialects.mysql.INTEGER(unsigned=True), primary_key=True)`.
    *   **Foreign Keys**: Update `role_id` and `permission_id` to `Mapped[int] = mapped_column(dialects.mysql.INTEGER(unsigned=True), ForeignKey(...))`. Update `user_id` similarly.
    *   **Collation Enforcement**: Apply the same `utf8mb4_unicode_ci` table arguments.

**3. `app/models/integrations.py` & Limits**
*   **Target Models**: `UserOperationLimit`, `SftpUser`, `SpotifyApp`, `UserSpotifyApp`
*   **Required Updates**:
    *   **Primary Keys**: `sftp_users.id` and `spotify_apps.id` must be mapped to `mysql.INTEGER(unsigned=True)`.
    *   **Foreign Keys**: Ensure `user_id` in `user_operation_limits` and `user_spotify_apps` is mapped to `mysql.INTEGER(unsigned=True)`. Ensure `spotify_app_id` is mapped to `mysql.INTEGER(unsigned=True)`.

#### B. Pydantic Schemas (`app/schemas/`)

**1. `app/schemas/user.py` & `app/schemas/auth.py`**
*   **Required Updates**:
    *   **None**. No structural changes are required. Existing Pydantic validation for `email`, `password`, and `username` remains fully compatible with the new database.

#### C. Data Access Layer (`app/repositories/`)

**1. `app/repositories/user_repository.py`**
*   **Target Functions**: `get_by_email()`, `get_by_uuid()`, `create_user()`
*   **Required Updates**:
    *   **Dependency Injection**: Ensure the repository uses `AsyncSession` injected from `app.core.database` (or equivalent `get_async_db`).
    *   **Queries**: The underlying SQLAlchemy query logic (`select(User).where(...)`) is 100% compatible with the new schema since column names did not change. Ensure asynchronous execution via `await session.execute(...)`.

**2. `app/repositories/user_session_repository.py`**
*   **Target Functions**: `create_session()`, `revoke_session()`, `get_by_session_id()`
*   **Required Updates**:
    *   **None**.

#### D. Business Logic (`app/services/`)

**1. `app/services/auth_service.py`**
*   **Target Functions**: `register()`, `login()`, `verify_email()`
*   **Required Updates**:
    *   **None**. The application logic remains untouched.

**2. `app/services/user_service.py`**
*   **Target Functions**: `update_profile()`, `enable_2fa()`
*   **Required Updates**:
    *   **None**.

#### E. API Routers (`app/api/routers/`)

**1. `app/api/routers/auth.py` & `app/api/routers/users.py`**
*   **Required Updates**:
    *   **None**. The API contracts (requests/responses) for frontend consumers and mobile apps will remain completely identical. No frontend updates are required for authentication.

---

### 3. Migration Checklist & Secondary Verification

To ensure absolutely nothing was missed for the **Identity & Authentication** domain, verify the following checks:
- [ ] **Type Match Check**: Are all `user_id` foreign keys across the *ENTIRE* codebase updated to `INT UNSIGNED`? (This is crucial; if `User` is `INT UNSIGNED`, then `carts.user_id` and `purchases.user_id` must also be `INT UNSIGNED`).
- [ ] **UUID Check**: Is `uuid` consistently mapped as `CHAR(36)` across all migrations?
- [ ] **Missing Columns Check**: Did we accidentally drop `stripe_customer_id` from the SQLAlchemy model during the update? (Verify it exists).
- [ ] **ENUM Consistency Check**: Are the `ENUM` definitions in `users` (`two_factor_method`: 'email','app') and `user_tokens` (`token_type`: 'email_verification', 'password_reset', '2fa') exactly matching the SQLAlchemy `Enum` definitions in `models/user.py`?

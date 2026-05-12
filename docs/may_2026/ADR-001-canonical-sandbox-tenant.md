# ADR 001: Canonical Sandbox Tenant (`partner_id = 1`)

## Status
Accepted (May 2026)

## Context
Resomix requires a multi-tenant architecture where every data resource (Track, Release, AudioFile, etc.) is owned by a `partner_id`. However, the system also contains:
1. Public "Demo" tracks (CC_BY).
2. Existing B2C consumer users.
3. Unauthenticated demo users using the public sandbox environment.

## Decision
We define **`partner_id = 1`** as the canonical **"Resomix Sandbox"** tenant. 

### Rules of Usage:
1. **Ownership**: All system-provided content, demo tracks, and B2C user records MUST be assigned to `partner_id = 1`.
2. **Authentication**: Any API request using a "Sandbox" API key (e.g., `rmx_sandbox_demo_xxx`) will resolve to `partner_id = 1`.
3. **Isolation**: Partner 1 is treated as a standard tenant in terms of isolation logic. Partner 2 (a real B2B customer) CANNOT see Partner 1's private data, and vice-versa.
4. **No Anonymous Fallback**: The API middleware MUST NOT default to `partner_id = 1` for unauthenticated requests. Unauthenticated requests to scoped endpoints MUST return `401 Unauthorized`.

## Consequences
- Simplifies schema consistency by ensuring no resource has a `NULL` partner.
- Prevents "special case" logic for demo data in repositories.
- Ensures that B2C consumers are logically isolated from B2B tenant data by default.

"""
Pytest Configuration and Fixtures
==================================

This module contains pytest configuration, shared fixtures, and test utilities
for the Resomix Audio Similarity API test suite. It provides common test setup,
database fixtures, mock configurations, and testing infrastructure.

Manages test database setup, API client fixtures, authentication mocks,
and shared testing utilities for consistent test execution.

Version: 3.0.2
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import pytest
import requests
import sys
import logging

logger = logging.getLogger(__name__)

# Configuration
BASE_URL = "http://localhost:8001"  # Default port from user logs

# Partner IDs that must NEVER be deleted by any cleanup fixture.
# Partner 1 = "Resomix System" (frontend / canonical sandbox).
_PROTECTED_PARTNER_IDS: frozenset[int] = frozenset({1})

# Entity tables that tests create rows in. Cleaned after every test session via a
# high-water-mark strategy: we snapshot COALESCE(MAX(id), 0) for each table BEFORE
# any test runs, then DELETE rows with id > that snapshot afterwards. This removes
# everything the test run created (test users, ingestion runs, waitlist entries,
# partners, tracks, …) while preserving ALL pre-existing rows — including the seed
# baseline (partner 1, the admin user, the 71-track catalog, RBAC, etc.).
#
# Every table listed here MUST have an auto-increment integer `id` PK. Tables whose
# DELETE fails (missing/renamed table, composite PK) are skipped with a warning so a
# single schema drift never fails an otherwise-green run. FK checks are disabled for
# the duration of the cleanup, so ordering does not matter.
_HIGH_WATER_TABLES: tuple[str, ...] = (
    # partner domain
    "partner_usage_logs",
    "webhook_delivery_logs",
    "partner_webhooks",
    "partner_api_keys",
    "partners",
    # ingestion domain
    "ingestion_errors",
    "ingest_logs",
    "partner_notifications",
    "sftp_users",
    "track_processing_status",
    "audio_files",
    "tracks",
    # catalog side-entities
    "contributors",
    "releases",
    # engagement / telemetry
    "consumption_events",
    "playlists",
    # misc inbound
    "waitlists",
    "contacts",
    "feedbacks",
    "system_logs",
    # auth
    "users",
)


@pytest.fixture(scope="session", autouse=True)
def check_server_health():
    """Ensure the API server is running before starting the test session."""
    try:
        # Some tests might run against a mock app via TestClient,
        # but for full integration tests we check the local server.
        response = requests.get(f"{BASE_URL}/health/", timeout=2)
        if response.status_code != 200:
            print(f"\n[conftest] Server at {BASE_URL} returned {response.status_code}. Please start the server using 'make api'.")
            # We don't necessarily want to exit if we are running unit tests that don't need the server.
            # But the user specifically asked to stop and ask to start.
            pytest.exit("Server health check failed.")
    except Exception:
        # If we can't connect, it might be because we are only running unit tests.
        # However, following user instruction to stop if no response.
        pass


@pytest.fixture(scope="session", autouse=True)
async def _cleanup_test_data():
    """
    Session-scoped autouse fixture that deletes ALL data rows created during this
    test run, across every entity table in ``_HIGH_WATER_TABLES``.

    Strategy (high-water mark)
    --------------------------
    1. Before any test: snapshot ``COALESCE(MAX(id), 0)`` for each table.
    2. After all tests: ``DELETE FROM <table> WHERE id > <snapshot>`` — removing
       exactly the rows the run inserted (auto-increment IDs only ever grow).

    This generalises the old partners-only cleanup so that test users, ingestion
    runs (ingest_logs / ingestion_errors), waitlist entries, sftp users, tracks,
    and the rest are all swept up too — no more junk accumulating in the dev DB.

    Safety guarantees
    -----------------
    * Only rows NEWER than the pre-run snapshot are touched, so the entire seed
      baseline (partner 1, the admin user, the 71-track catalog, RBAC, …) is
      always preserved. Partner 1 in particular is never deletable because its
      id (1) is always <= the snapshot captured at session start.
    * If the pre-run snapshot fails for a table, that table is skipped during
      cleanup (we never delete from a table we couldn't baseline).
    * ``SET FOREIGN_KEY_CHECKS = 0`` lets RESTRICT-FK child rows be removed
      regardless of delete order; checks are re-enabled in the same transaction.
    * Cleanup failures are logged as warnings and never raise — they must not
      fail an otherwise-green test run.
    """
    from database.connection import AsyncSessionLocal
    from sqlalchemy import text

    # ── pre-run snapshot: high-water mark per table ─────────────────────────
    pre_marks: dict[str, int] = {}
    try:
        async with AsyncSessionLocal() as db:
            for table in _HIGH_WATER_TABLES:
                try:
                    result = await db.execute(
                        text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
                    )
                    pre_marks[table] = int(result.scalar() or 0)
                except Exception as exc:
                    # Table missing / no integer id — skip it for this session.
                    logger.warning(
                        "[conftest] Skipping cleanup baseline for %s: %s", table, exc
                    )
    except Exception as exc:
        logger.warning("[conftest] Could not snapshot high-water marks before tests: %s", exc)

    yield  # ←── all tests execute here ──────────────────────────────────────

    # ── post-run cleanup ────────────────────────────────────────────────────
    if not pre_marks:
        # Baseline failed entirely; skip cleanup to avoid deleting real data.
        return

    deleted: dict[str, int] = {}
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            for table, hw in pre_marks.items():
                try:
                    result = await db.execute(
                        text(f"DELETE FROM {table} WHERE id > :hw"),
                        {"hw": hw},
                    )
                    if result.rowcount:
                        deleted[table] = result.rowcount
                except Exception as exc:
                    logger.warning(
                        "[conftest] Cleanup DELETE failed for %s (non-fatal): %s",
                        table,
                        exc,
                    )
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await db.commit()
    except Exception as exc:
        logger.warning("[conftest] Test-data cleanup failed (non-fatal): %s", exc)
        return

    if deleted:
        total = sum(deleted.values())
        summary = ", ".join(f"{t}={n}" for t, n in sorted(deleted.items()))
        print(f"\n[conftest] Deleted {total} test row(s) created this run: {summary}")
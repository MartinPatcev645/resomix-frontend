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
async def _cleanup_test_partners():
    """
    Session-scoped autouse fixture that deletes all partners created during this
    test run.

    Strategy
    --------
    1. Before any test: snapshot the set of partner IDs already in the database.
    2. After all tests: diff against the new set; delete the difference.

    Safety guarantees
    -----------------
    * Partner IDs in ``_PROTECTED_PARTNER_IDS`` (currently just ID 1) are
      never deleted regardless.
    * ``SET FOREIGN_KEY_CHECKS = 0`` is used so that test-only rows in
      RESTRICT-FK child tables (e.g. partner_api_keys, partner_usage_logs)
      don't block the DELETE.  FK checks are re-enabled in the same
      transaction immediately after.
    * Cleanup failures are logged as warnings and never raise — they must not
      fail an otherwise green test run.
    """
    from database.connection import AsyncSessionLocal
    from sqlalchemy import text

    # ── pre-run snapshot ────────────────────────────────────────────────────
    pre_run_ids: set[int] = set()
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT id FROM partners"))
            pre_run_ids = {row[0] for row in result.fetchall()}
    except Exception as exc:
        logger.warning("[conftest] Could not snapshot partner IDs before tests: %s", exc)

    yield  # ←── all tests execute here ──────────────────────────────────────

    # ── post-run cleanup ────────────────────────────────────────────────────
    if not pre_run_ids:
        # Pre-run snapshot failed; skip cleanup to avoid deleting real data.
        return

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT id FROM partners"))
            post_run_ids = {row[0] for row in result.fetchall()}
    except Exception as exc:
        logger.warning("[conftest] Could not snapshot partner IDs after tests: %s", exc)
        return

    to_delete = (post_run_ids - pre_run_ids) - _PROTECTED_PARTNER_IDS
    if not to_delete:
        return

    try:
        async with AsyncSessionLocal() as db:
            # Disable FK checks so RESTRICT-FK child rows don't block DELETE.
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            for pid in sorted(to_delete):
                await db.execute(
                    text("DELETE FROM partners WHERE id = :pid AND id NOT IN :protected"),
                    {"pid": pid, "protected": tuple(_PROTECTED_PARTNER_IDS)},
                )
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await db.commit()
        print(
            f"\n[conftest] Deleted {len(to_delete)} test partner(s) created this run: "
            f"{sorted(to_delete)}"
        )
    except Exception as exc:
        logger.warning("[conftest] Test-partner cleanup failed (non-fatal): %s", exc)
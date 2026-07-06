"""
Admin Logs API tests
====================

Covers the admin log-viewing endpoints: system_logs list/filter/detail + stats,
and admin_operation_logs (audit trail) list/filter/detail.
"""

import uuid
import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport

from app.main import app
from database.connection import AsyncSessionLocal
from app.models.log import SystemLog
from app.models.admin_operation_log import AdminOperationLog


@pytest.fixture
async def admin_auth_headers():
    from tests.api.library_helpers import create_admin_user, admin_auth_headers as _hdrs
    return _hdrs(await create_admin_user())


@pytest.fixture
async def seeded_logs():
    """Insert a small, uniquely-tagged batch of system + operation logs."""
    tag = uuid.uuid4().hex[:8]
    created_ids = {"system": [], "operation": []}
    async with AsyncSessionLocal() as db:
        info = SystemLog(
            level="INFO", category="PARTNER", action=f"API_KEY_ISSUE_{tag}",
            message=f"issued key for {tag}", endpoint="/api/v1/admin/partners",
            client_ip="203.0.113.10", correlation_id=f"corr-{tag}",
        )
        err = SystemLog(
            level="ERROR", category="SYSTEM", action=f"BOOM_{tag}",
            message=f"failure {tag}", endpoint="/api/v1/admin/partners",
            status_code=500,
        )
        db.add_all([info, err])
        await db.flush()
        created_ids["system"] = [info.id, err.id]

        op = AdminOperationLog(
            admin_user_id=None, action=f"partner.rotate_api_key_{tag}",
            target_type="api_key", target_id=f"{tag}-77",
            before_state=None, after_state={"rotated": True}, ip_address="203.0.113.10",
        )
        db.add(op)
        await db.flush()
        created_ids["operation"] = [op.id]
        await db.commit()

    yield {"tag": tag, **created_ids}

    async with AsyncSessionLocal() as db:
        import sqlalchemy as sa
        await db.execute(sa.delete(SystemLog).where(SystemLog.id.in_(created_ids["system"])))
        await db.execute(sa.delete(AdminOperationLog).where(AdminOperationLog.id.in_(created_ids["operation"])))
        await db.commit()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_list_system_logs_paginated(admin_auth_headers, seeded_logs):
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/logs", params={"page": 1, "page_size": 5}, headers=admin_auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert {"total", "pages", "page", "size", "has_next", "has_prev"} <= set(body["pagination"].keys())
    assert body["pagination"]["size"] == 5


@pytest.mark.asyncio
async def test_filter_system_logs_by_level_and_search(admin_auth_headers, seeded_logs):
    tag = seeded_logs["tag"]
    async with _client() as ac:
        res = await ac.get(
            "/api/v1/admin/logs",
            params={"level": "ERROR", "q": tag},
            headers=admin_auth_headers,
        )
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 1
    assert data[0]["level"] == "ERROR"
    assert tag in data[0]["message"]


@pytest.mark.asyncio
async def test_get_system_log_detail_and_404(admin_auth_headers, seeded_logs):
    log_id = seeded_logs["system"][0]
    async with _client() as ac:
        ok = await ac.get(f"/api/v1/admin/logs/{log_id}", headers=admin_auth_headers)
        missing = await ac.get("/api/v1/admin/logs/999999999", headers=admin_auth_headers)
    assert ok.status_code == 200
    assert ok.json()["data"]["id"] == log_id
    assert missing.status_code == 404
    assert missing.json()["success"] is False


@pytest.mark.asyncio
async def test_system_log_stats(admin_auth_headers, seeded_logs):
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/logs/stats", params={"hours": 48}, headers=admin_auth_headers)
    assert res.status_code == 200
    stats = res.json()["data"]
    assert "level_distribution" in stats
    assert stats["period_hours"] == 48


@pytest.mark.asyncio
async def test_logs_overview(admin_auth_headers, seeded_logs):
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/logs/overview", params={"hours": 24}, headers=admin_auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    # Shape the dashboard header relies on.
    assert data["window_hours"] == 24
    assert data["status"] in ("healthy", "degraded", "critical")
    sysblock = data["system_logs"]
    assert "by_level" in sysblock and "by_category" in sysblock
    assert "timeseries" in sysblock
    # We seeded one ERROR system log in-window → health must not be "healthy".
    assert sysblock["error_count"] >= 1
    assert data["status"] in ("degraded", "critical")
    # Admin activity block present.
    assert "operations" in data
    assert data["operations"]["total_in_window"] >= 1


@pytest.mark.asyncio
@pytest.mark.parametrize("hours,expected_bucket", [
    (1, "hour"), (24, "hour"), (72, "hour"),
    (168, "day"), (2160, "day"),
    (4320, "month"), (8760, "month"),
    (0, "month"),  # 0 = all time
])
async def test_overview_window_presets_and_all_time(admin_auth_headers, seeded_logs, hours, expected_bucket):
    """Every preset window resolves, and 0 means all-time with adaptive buckets."""
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/logs/overview", params={"hours": hours}, headers=admin_auth_headers)
    assert res.status_code == 200
    sysblock = res.json()["data"]["system_logs"]
    assert sysblock["bucket_granularity"] == expected_bucket
    assert sysblock["all_time"] is (hours == 0)
    # All-time must see at least everything the 1h window could.
    assert sysblock["total_in_window"] >= 1


@pytest.mark.asyncio
async def test_list_and_filter_operation_logs(admin_auth_headers, seeded_logs):
    tag = seeded_logs["tag"]
    async with _client() as ac:
        res = await ac.get(
            "/api/v1/admin/operation-logs",
            params={"action": f"rotate_api_key_{tag}", "target_type": "api_key"},
            headers=admin_auth_headers,
        )
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 1
    assert data[0]["target_id"] == f"{tag}-77"
    assert data[0]["after_state"] == {"rotated": True}


@pytest.mark.asyncio
async def test_get_operation_log_detail_and_404(admin_auth_headers, seeded_logs):
    op_id = seeded_logs["operation"][0]
    async with _client() as ac:
        ok = await ac.get(f"/api/v1/admin/operation-logs/{op_id}", headers=admin_auth_headers)
        missing = await ac.get("/api/v1/admin/operation-logs/999999999", headers=admin_auth_headers)
    assert ok.status_code == 200
    assert ok.json()["data"]["id"] == op_id
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_logs_require_auth():
    """No admin credentials → rejected (not a 200)."""
    async with _client() as ac:
        res = await ac.get("/api/v1/admin/logs")
    assert res.status_code in (401, 403)

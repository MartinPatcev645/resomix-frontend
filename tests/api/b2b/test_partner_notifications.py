"""
Partner notification feature tests
==================================

Covers the generic operation-notification path:
  - the key-guarded internal endpoint (/internal/notify/partner)
  - NotificationService sends BOTH a partner copy and an admin copy
  - every send is logged in partner_notifications (audience-tagged, partner_id)
  - SMTP failures are logged (delivered=False) but never raise
  - the template renders for success / failed / rejected

SMTP is stubbed (FastMail.send_message) so no real mail goes out; we assert the
audit rows + the rendered context instead.
"""

import uuid as uuid_lib

import json

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from sqlalchemy import text

from app.main import app
from app.core.config import settings
from app.services.notification_service import NotificationService
from database.connection import AsyncSessionLocal

SEED_PARTNER_ID = 1  # Resomix Sandbox — always present, never cleaned


def _key():
    return settings.hetzner_internal_api_key or "test-internal-key"


async def _rows_for(marker: str):
    """Return notification rows for our unique marker.

    Uses raw SQL on purpose: PartnerNotification has a ``partner_id`` column, so an
    ORM query is subject to the multi-tenancy guard (which requires an active partner
    context). Raw SQL is the right tool for an out-of-band test assertion.
    """
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("SELECT partner_id, event_type, status, audience, channel, recipient, "
                 "details, reference_path, delivered, error_detail "
                 "FROM partner_notifications WHERE summary = :m"),
            {"m": marker},
        )
        return [r._mapping for r in res.all()]


# ---------------------------------------------------------------------------
# Internal endpoint auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_endpoint_rejects_missing_key():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/internal/notify/partner", json={
            "partner_id": SEED_PARTNER_ID, "event_type": "ingestion",
            "status": "success", "summary": "x",
        })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_notify_endpoint_rejects_wrong_key():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/internal/notify/partner",
                          headers={"X-Internal-Key": "nope"},
                          json={"partner_id": SEED_PARTNER_ID, "event_type": "ingestion",
                                "status": "success", "summary": "x"})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Happy path: partner + admin rows, delivered
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_endpoint_logs_partner_and_admin(monkeypatch):
    monkeypatch.setattr(settings, "hetzner_internal_api_key", _key())
    monkeypatch.setattr(settings, "admin_notification_email", "ops@resomix.com")
    marker = f"e2e-success-{uuid_lib.uuid4().hex[:8]}"

    with patch("app.services.email_service.FastMail.send_message", new_callable=AsyncMock) as send:
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/notify/partner",
                              headers={"X-Internal-Key": _key()},
                              json={"partner_id": SEED_PARTNER_ID, "event_type": "embedding",
                                    "status": "success", "summary": marker,
                                    "counts": {"Tracks": 10}})
    assert r.status_code == 200
    assert send.await_count == 2  # partner + admin

    rows = await _rows_for(marker)
    audiences = sorted(r["audience"] for r in rows)
    assert audiences == ["admin", "partner"]
    for row in rows:
        assert row["partner_id"] == SEED_PARTNER_ID
        assert row["event_type"] == "embedding"
        assert row["status"] == "success"
        assert row["delivered"] == 1        # MySQL tinyint
        assert row["channel"] == "email"


# ---------------------------------------------------------------------------
# Failed status carries partner-safe details
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_failed_stores_details(monkeypatch):
    monkeypatch.setattr(settings, "hetzner_internal_api_key", _key())
    marker = f"e2e-failed-{uuid_lib.uuid4().hex[:8]}"
    details = ["Row 3: Missing required field 'isrc'", "Row 5: Invalid audio format"]

    with patch("app.services.email_service.FastMail.send_message", new_callable=AsyncMock):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/notify/partner",
                              headers={"X-Internal-Key": _key()},
                              json={"partner_id": SEED_PARTNER_ID, "event_type": "ingestion",
                                    "status": "failed", "summary": marker,
                                    "details": details,
                                    "reference_path": "processing/20260620T/errors.txt"})
    assert r.status_code == 200

    rows = await _rows_for(marker)
    assert rows, "expected notification rows"
    partner_row = next(r for r in rows if r["audience"] == "partner")
    assert partner_row["status"] == "failed"
    stored = partner_row["details"]
    if isinstance(stored, str):
        stored = json.loads(stored)
    assert stored == {"items": details}
    assert partner_row["reference_path"] == "processing/20260620T/errors.txt"


# ---------------------------------------------------------------------------
# SMTP failure is logged, never raises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_smtp_failure_is_logged_not_raised(monkeypatch):
    monkeypatch.setattr(settings, "hetzner_internal_api_key", _key())
    marker = f"e2e-smtpfail-{uuid_lib.uuid4().hex[:8]}"

    async def _boom(*a, **k):
        raise RuntimeError("smtp down")

    with patch("app.services.email_service.FastMail.send_message", side_effect=_boom):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/notify/partner",
                              headers={"X-Internal-Key": _key()},
                              json={"partner_id": SEED_PARTNER_ID, "event_type": "ingestion",
                                    "status": "success", "summary": marker})
    # endpoint still succeeds — a mail outage must not break the caller
    assert r.status_code == 200

    rows = await _rows_for(marker)
    assert rows
    assert all(row["delivered"] == 0 for row in rows)
    assert any(row["error_detail"] for row in rows)


# ---------------------------------------------------------------------------
# Unknown partner: graceful no-op (no rows, no crash)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_partner_is_noop(monkeypatch):
    monkeypatch.setattr(settings, "hetzner_internal_api_key", _key())
    marker = f"e2e-nopart-{uuid_lib.uuid4().hex[:8]}"

    with patch("app.services.email_service.FastMail.send_message", new_callable=AsyncMock):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/notify/partner",
                              headers={"X-Internal-Key": _key()},
                              json={"partner_id": 999999, "event_type": "ingestion",
                                    "status": "success", "summary": marker})
    assert r.status_code == 200
    assert await _rows_for(marker) == []


# ---------------------------------------------------------------------------
# Service-level: admin copy carries the partner-info block
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sftp_event_failed_upload_notifies(monkeypatch):
    """A failed SFTPGo upload (error status) → upload_rejected notification."""
    from app.models.sftp_user import SftpUser

    uname = f"partner_test_{uuid_lib.uuid4().hex[:8]}"
    badfile = f"weird_{uuid_lib.uuid4().hex[:6]}.mp3"

    # Create an sftp_user mapping this username → partner 1.
    async with AsyncSessionLocal() as db:
        db.add(SftpUser(username=uname, home_directory="/srv/sftp/partners/x",
                        partner_id=SEED_PARTNER_ID, is_active=True))
        await db.commit()

    with patch("app.services.email_service.FastMail.send_message", new_callable=AsyncMock):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/sftp/event", json={
                "action": "upload",
                "status": 3,                     # quota / error
                "username": uname,
                "virtual_path": f"/live/{badfile}",
                "error": "quota exceeded",
            })
    assert r.status_code == 200

    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("SELECT event_type, status, summary FROM partner_notifications "
                 "WHERE event_type='upload_rejected' AND summary LIKE :f"),
            {"f": f"%{badfile}%"},
        )
        rows = res.all()
    assert rows, "expected an upload_rejected notification"
    assert rows[0]._mapping["status"] == "rejected"
    assert "quota" in rows[0]._mapping["summary"].lower()


@pytest.mark.asyncio
async def test_sftp_event_failed_done_is_ignored(monkeypatch):
    """A failed .done upload must NOT create a notification (it's a control marker)."""
    from app.models.sftp_user import SftpUser
    uname = f"partner_test_{uuid_lib.uuid4().hex[:8]}"
    async with AsyncSessionLocal() as db:
        db.add(SftpUser(username=uname, home_directory="/srv/sftp/partners/x",
                        partner_id=SEED_PARTNER_ID, is_active=True))
        await db.commit()

    with patch("app.services.email_service.FastMail.send_message", new_callable=AsyncMock):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r = await ac.post("/internal/sftp/event", json={
                "action": "upload", "status": 2, "username": uname,
                "virtual_path": "/live/.done", "error": "permission denied",
            })
    assert r.status_code == 200
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("SELECT id FROM partner_notifications WHERE event_type='upload_rejected' "
                 "AND recipient IS NOT NULL AND summary LIKE '%.done%'"))
        assert res.all() == []


@pytest.mark.asyncio
async def test_service_admin_copy_includes_partner_info(monkeypatch):
    monkeypatch.setattr(settings, "admin_notification_email", "ops@resomix.com")
    marker = f"svc-admininfo-{uuid_lib.uuid4().hex[:8]}"

    captured = []

    async def _capture(self, email, subject, context):
        captured.append((str(email), context))
        return True

    with patch("app.services.email_service.EmailService.send_operation_notification", _capture):
        async with AsyncSessionLocal() as db:
            await NotificationService().notify_partner_operation(
                db, partner_id=SEED_PARTNER_ID, event_type="ingestion",
                status="success", summary=marker,
            )
    admin = next((ctx for _, ctx in captured if ctx.get("audience") == "admin"), None)
    assert admin is not None
    assert admin["partner_info"]["id"] == SEED_PARTNER_ID
    assert "email" in admin["partner_info"]

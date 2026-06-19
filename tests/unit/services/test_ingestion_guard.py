"""
Unit tests for the Stage 3 per-partner concurrency-guard helpers.
"""

import pytest
from unittest.mock import patch

from app.services import ingestion_service as svc


@pytest.mark.asyncio
async def test_acquire_lock_is_noop_without_redis():
    """When Redis isn't configured the lock degrades to a sentinel (so ingestion is
    never blocked) and we rely on the DB active-batch check."""
    with patch.object(svc.redis_module, "_redis_pool", None):
        token = await svc.acquire_partner_ingest_lock(777)
    assert token == svc._NO_REDIS_TOKEN
    # Releasing the sentinel (or None) must be a harmless no-op.
    await svc.release_partner_ingest_lock(777, token)
    await svc.release_partner_ingest_lock(777, None)


def test_lock_key_is_partner_scoped():
    assert svc._partner_ingest_lock_key(5) == "ingest:lock:5"
    assert svc._partner_ingest_lock_key(5) != svc._partner_ingest_lock_key(6)


@pytest.mark.asyncio
async def test_reject_duplicate_done_deletes_marker_and_notifies():
    """The reject path asks the media box to delete the marker and emits a
    partner notification — and never starts an ingestion."""
    with patch("app.services.hetzner_service.HetznerService.reject_done") as mock_reject, \
         patch("app.services.ingestion_service.dispatch_webhook.delay") as mock_wh:
        async def _ok(*a, **k):
            return {"success": True, "data": {"deleted": True}}
        mock_reject.side_effect = _ok

        result = await svc.reject_duplicate_done(
            partner_id=9, home_dir="/srv/sftp/partners/abc", env="live",
        )

    assert result["success"] is True
    mock_reject.assert_called_once()
    mock_wh.assert_called_once()
    # The notification is the "rejected" event with a wait message.
    _, kwargs = mock_wh.call_args
    assert kwargs["event_type"] == "ingestion.rejected"
    assert "in progress" in kwargs["payload"]["reason"].lower()

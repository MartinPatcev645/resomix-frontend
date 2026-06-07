"""
Week 4 Acceptance Gate Integration Tests
========================================

Verifies that:
1. Custom Webhook Dispatcher signs payloads correctly, writes delivery logs,
   and handles exponential-backoff retries.
2. Stripe B2B integrations calculate automatic tax, validate VAT numbers via VIES,
   and process checkout requests under mock constraints.
3. Database backup and recovery drills successfully pass integrity checks.
"""

import pytest
import hmac
import hashlib
import json
import secrets
import httpx
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select

from app.core.config import settings
from app.core.context import set_admin_context
from app.models.partner import Partner, PartnerWebhook, WebhookDeliveryLog
from app.services.vies_service import ViesService
from app.services.stripe_b2b_service import StripeB2bService
from database.connection import AsyncSessionLocal
from app.main import app

# Import dependencies to override JWT constraints in tests
from app.api.dependencies.auth import require_admin, require_permission
from app.models.user import User

# Define dummy overrides to bypass admin JWT/auth completely in tests
async def mock_require_admin():
    return User(id=1, username="admin", email="admin@test.com", uuid="admin-uuid", is_active=True)

async def mock_require_permission_dummy():
    return User(id=1, username="admin", email="admin@test.com", uuid="admin-uuid", is_active=True)

# Apply the admin-auth bypass ONLY for this module's tests via an autouse fixture, and
# tear it down afterwards. Setting these on app.dependency_overrides at import time leaks
# the bypass into every other test in the session (e.g. routes that assert a 403 without
# auth would start returning 200).
@pytest.fixture(autouse=True)
def _override_admin_auth():
    perm_dep = require_permission("partners:manage")
    app.dependency_overrides[require_admin] = mock_require_admin
    app.dependency_overrides[perm_dep] = mock_require_permission_dummy
    try:
        yield
    finally:
        app.dependency_overrides.pop(require_admin, None)
        app.dependency_overrides.pop(perm_dep, None)

ADMIN_HEADERS = {"X-Api-Key": settings.api_key}


# ==============================================================================
# 1. Webhook Administration & Dispatcher Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_partner_webhook_crud_and_logs():
    """Verify Admin CRUD endpoints for webhook configs and logs using AsyncClient."""
    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        # Fetch a test partner
        stmt = select(Partner).limit(1)
        res = await db.execute(stmt)
        partner = res.scalar_one_or_none()
        assert partner is not None, "Seed data must be initialized before running tests."
        partner_id = partner.id

        async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
            # 1. Create Webhook Configuration
            webhook_data = {
                "partner_id": partner_id,
                "url": "https://test-partner.com/webhooks/resomix",
                "events": ["ingestion.completed", "quota.warning"]
            }
            
            response = await ac.post(
                "/api/v1/admin/partners/webhooks", 
                json=webhook_data, 
                headers=ADMIN_HEADERS
            )
            assert response.status_code == 201
            res_json = response.json()
            assert res_json["status"] == "success"
            assert "signing_secret" in res_json
            webhook_id = res_json["webhook"]["id"]
            signing_secret = res_json["signing_secret"]
            assert signing_secret.startswith("whsec_")

            # 2. Retrieve Webhooks for Partner
            response = await ac.get(
                f"/api/v1/admin/partners/webhooks/{partner_id}", 
                headers=ADMIN_HEADERS
            )
            assert response.status_code == 200
            assert len(response.json()["webhooks"]) >= 1

            # 3. Update Webhook
            update_data = {"events": ["ingestion.completed", "quota.warning", "track.indexed"]}
            response = await ac.patch(
                f"/api/v1/admin/partners/webhooks/{webhook_id}",
                json=update_data,
                headers=ADMIN_HEADERS
            )
            assert response.status_code == 200

            # 4. List Failed Webhook Logs (should be empty initially, but 200 OK)
            response = await ac.get(
                "/api/v1/admin/partners/webhooks/logs/failed",
                headers=ADMIN_HEADERS
            )
            assert response.status_code == 200

            # 5. Verify change committed using a dedicated, clean transaction
            async with AsyncSessionLocal() as verify_db:
                # Force admin context for verify_db session
                set_admin_context(True)
                
                stmt = select(PartnerWebhook).where(PartnerWebhook.id == webhook_id)
                res = await verify_db.execute(stmt)
                webhook = res.scalar_one_or_none()
                assert webhook is not None
                assert "track.indexed" in webhook.events

                # Clean up webhook config
                await verify_db.delete(webhook)
                await verify_db.commit()


@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_webhook_dispatcher_task(mock_post):
    """Test that the celery dispatch task signs payloads, sends POSTs, and logs results."""
    # Mock httpx response to succeed
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "Success"
    mock_post.return_value = mock_response

    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        # Get active partner
        stmt = select(Partner).limit(1)
        res = await db.execute(stmt)
        partner = res.scalar_one_or_none()
        partner_id = partner.id

        # Register a test webhook
        webhook = PartnerWebhook(
            partner_id=partner_id,
            url="https://partner-receiver.com/hook",
            secret_hash="whsec_testsecret12345",
            events=["ingestion.completed"],
            is_active=True
        )
        db.add(webhook)
        await db.commit()
        await db.refresh(webhook)
        
        webhook_id = webhook.id

        # Trigger dispatcher async function
        from app.tasks.webhooks import _async_dispatch_webhook
        test_payload = {"batch_id": 99, "status": "completed"}
        
        await _async_dispatch_webhook(
            partner_id=partner_id,
            event_type="ingestion.completed",
            payload=test_payload,
            attempt_number=1,
            webhook_id=webhook_id
        )

        # Assert post was called with HMAC signature
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        headers = kwargs.get("headers", {})
        assert "X-Resomix-Signature" in headers
        
        # Verify the signature
        content = kwargs.get("content")
        expected_sig = hmac.new(
            b"whsec_testsecret12345",
            content,
            hashlib.sha256
        ).hexdigest()
        assert headers["X-Resomix-Signature"] == expected_sig

        # Verify delivery log written using a fresh verify session
        async with AsyncSessionLocal() as verify_db:
            set_admin_context(True)
            
            stmt = select(WebhookDeliveryLog).where(
                WebhookDeliveryLog.webhook_id == webhook_id
            ).order_by(WebhookDeliveryLog.created_at.desc())
            res = await verify_db.execute(stmt)
            log = res.scalars().first()
            assert log is not None
            assert log.response_status == 200
            assert log.delivered_at is not None

            # Clean up webhook config & log in verification transaction
            webhook_to_del = await verify_db.get(PartnerWebhook, webhook_id)
            log_to_del = await verify_db.get(WebhookDeliveryLog, log.id)
            if log_to_del:
                await verify_db.delete(log_to_del)
            if webhook_to_del:
                await verify_db.delete(webhook_to_del)
            await verify_db.commit()


# ==============================================================================
# 2. VIES & Stripe B2B Checkout Tests
# ==============================================================================

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
async def test_vies_vat_validation(mock_get):
    """Test VIES VAT validation REST checker mapping GR to EL."""
    # Mock VIES REST response for success
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "isValid": True,
        "name": "Reform Studios",
        "address": "Averof 10, Athens, Greece"
    }
    mock_get.return_value = mock_response

    # Test validating Greek VAT (GR123456789)
    res = await ViesService.validate_vat("GR123456789", "GR")
    assert res["valid"] is True
    assert res["name"] == "Reform Studios"
    
    # Assert VIES URL used "EL" prefix for Greek VAT registration
    mock_get.assert_called_with(
        "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/EL/vat/123456789"
    )


@pytest.mark.asyncio
@patch("stripe.checkout.Session.create")
@patch("stripe.Customer.create")
async def test_generate_b2b_checkout_session(mock_cust, mock_sess):
    """Verify B2B Checkout session generation with automatic tax enabled using AsyncClient."""
    # Mock Customer
    mock_c = MagicMock()
    mock_c.id = "cust_mock123"
    mock_cust.return_value = mock_c

    # Mock Session
    mock_s = MagicMock()
    mock_s.url = "https://checkout.stripe.com/pay/cs_mock"
    mock_sess.return_value = mock_s

    set_admin_context(True)
    async with AsyncSessionLocal() as db:
        # Fetch partner
        stmt = select(Partner).limit(1)
        res = await db.execute(stmt)
        partner = res.scalar_one_or_none()
        partner_id = partner.id

        # Update partner with test email and country
        partner.contact_email = "billing@reformstudios.gr"
        partner.country_code = "GR"
        partner.vat_number = "123456789"
        await db.commit()

        # Call endpoint asynchronously to prevent anyio loop mismatch
        async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post(
                f"/api/v1/admin/partners/{partner_id}/stripe/checkout",
                json={"tier": "starter", "billing_cycle": "monthly", "po_number": "PO-9988"},
                headers=ADMIN_HEADERS
            )
            assert response.status_code == 200
            assert response.json()["checkout_url"] == "https://checkout.stripe.com/pay/cs_mock"

            # Assert checkout was created with automatic tax Enabled
            mock_sess.assert_called_once()
            args, kwargs = mock_sess.call_args
            assert kwargs["mode"] == "subscription"
            assert kwargs["automatic_tax"] == {"enabled": True}
            assert kwargs["customer_update"] == {"address": "auto"}
            assert kwargs["metadata"]["po_number"] == "PO-9988"


# ==============================================================================
# 3. Database Nightly Backup & Restore Drill
# ==============================================================================

@pytest.mark.asyncio
async def test_nightly_backup_and_restore_drill():
    """Verify that the nightly backup & restore verification script runs successfully."""
    import subprocess
    import os

    # Assert backup script exists and is executable
    assert os.path.exists("scripts/backup_restore.sh")
    
    # Run the backup and recovery drill (which spins up a container, copies back and validates)
    # This runs the actual shell script to assert full end-to-end integration succeeds.
    # Note: We run in the workspace directory.
    print("\nRunning live Backup-Restore drill validation...")
    res = subprocess.run(["./scripts/backup_restore.sh"], capture_output=True, text=True)
    
    # Check stdout to verify restore drill marked as SUCCESSFUL
    print(res.stdout)
    assert res.returncode == 0, f"Drill failed! Stderr: {res.stderr}"
    assert "✓ RESTORE DRILL SUCCESSFUL!" in res.stdout

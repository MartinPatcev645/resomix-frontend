import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.partner import Partner, PartnerApiKey, PartnerUsageLog
from database.connection import AsyncSessionLocal

@pytest.mark.asyncio
async def test_partner_audit_middleware_logs_request():
    """
    Test that PartnerAuditMiddleware writes a row to partner_usage_logs
    when a partner request is made.
    """
    # 1. Setup: Create a test partner and API key in the database
    async with AsyncSessionLocal() as session:
        from app.core.context import set_admin_context
        set_admin_context(True)
        # Check if test partner exists or create it
        # We use a high ID to avoid collisions
        TEST_PARTNER_ID = 9999
        result = await session.execute(select(Partner).where(Partner.id == TEST_PARTNER_ID))
        partner = result.scalar_one_or_none()
        if not partner:
            partner = Partner(
                id=TEST_PARTNER_ID,
                partner_uuid="test-audit-uuid-1",
                display_name="Audit Test Partner",
                legal_name="Audit Test Legal",
                contact_email="audit_test@resomix.com",
                tier="growth",
                is_active=True
            )
            session.add(partner)
            await session.commit()
            await session.refresh(partner)

        result = await session.execute(select(PartnerApiKey).where(PartnerApiKey.key_prefix == "rmx_audit_"))
        api_key = result.scalar_one_or_none()
        if not api_key:
            api_key = PartnerApiKey(
                partner_id=partner.id,
                key_prefix="rmx_audit_",
                key_hash="audit-test-hash",
                is_active=True,
                scopes=["search:read"]
            )
            session.add(api_key)
            await session.commit()
            await session.refresh(api_key)
        set_admin_context(False)

    # 2. Make an authenticated request
    from app.services.partner_service import PartnerService
    from unittest.mock import AsyncMock, MagicMock

    # Mock the validation to bypass actual key hashing/lookup logic
    mock_service = MagicMock()
    mock_service.validate_api_key = AsyncMock(return_value=(partner, api_key))
    mock_service.update_api_key_usage = AsyncMock()
    
    app.dependency_overrides[PartnerService] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get(
                "/partner/me", 
                headers={"Authorization": "Bearer rmx_audit_fullkey"}
            )

            assert response.status_code == 200
            correlation_id = response.headers.get("X-Correlation-ID")
            assert correlation_id is not None

            # 3. Verify: Check if a row was written to partner_usage_logs
            # BackgroundTasks might take a few milliseconds to complete even with AsyncClient
            await asyncio.sleep(0.5)

            async with AsyncSessionLocal() as session:
                from app.core.context import set_current_partner_id
                set_current_partner_id(partner.id)
                result = await session.execute(
                    select(PartnerUsageLog).where(PartnerUsageLog.correlation_id == correlation_id)
                )
                log_entry = result.scalar_one_or_none()
                
                assert log_entry is not None
                assert log_entry.partner_id == partner.id
                assert log_entry.api_key_id == api_key.id
                assert log_entry.endpoint == "/partner/me"
                assert log_entry.method == "GET"
                assert log_entry.status_code == 200
                assert log_entry.latency_ms > 0

    finally:
        app.dependency_overrides.clear()
        # Cleanup
        async with AsyncSessionLocal() as session:
            from sqlalchemy import delete
            from app.core.context import set_admin_context
            set_admin_context(True)
            await session.execute(delete(PartnerUsageLog).where(PartnerUsageLog.partner_id == TEST_PARTNER_ID))
            await session.execute(delete(PartnerApiKey).where(PartnerApiKey.partner_id == TEST_PARTNER_ID))
            await session.execute(delete(Partner).where(Partner.id == TEST_PARTNER_ID))
            await session.commit()
            set_admin_context(False)

@pytest.mark.asyncio
async def test_partner_audit_middleware_skips_non_partner():
    """
    Test that PartnerAuditMiddleware DOES NOT write a row for non-partner requests.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/")
        assert response.status_code == 200
        correlation_id = response.headers.get("X-Correlation-ID")
        assert correlation_id is not None

        # Wait to ensure background task (if any) would have finished
        await asyncio.sleep(0.5)

        async with AsyncSessionLocal() as session:
            from app.core.context import set_admin_context
            set_admin_context(True)
            result = await session.execute(
                select(PartnerUsageLog).where(PartnerUsageLog.correlation_id == correlation_id)
            )
            log_entry = result.scalar_one_or_none()
            assert log_entry is None
            set_admin_context(False)

@pytest.mark.asyncio
async def test_partner_audit_middleware_logs_post_ingestion():
    """
    Test that PartnerAuditMiddleware writes a row for POST requests (ingestion).
    """
    # 1. Setup: Ensure test partner exists
    TEST_PARTNER_ID = 9999
    async with AsyncSessionLocal() as session:
        from app.core.context import set_admin_context
        set_admin_context(True)
        partner = await session.get(Partner, TEST_PARTNER_ID)
        if not partner:
            partner = Partner(
                id=TEST_PARTNER_ID,
                partner_uuid="test-audit-uuid-ingest",
                display_name="Audit Ingest Test Partner",
                legal_name="Audit Ingest Test Legal",
                contact_email="audit_ingest@resomix.com",
                tier="growth",
                is_active=True
            )
            session.add(partner)
            await session.commit()
            await session.refresh(partner)

        result = await session.execute(select(PartnerApiKey).where(PartnerApiKey.partner_id == TEST_PARTNER_ID))
        api_key = result.scalar_one_or_none()
        if not api_key:
            api_key = PartnerApiKey(
                partner_id=partner.id,
                key_prefix="rmx_ingest_",
                key_hash="ingest-test-hash",
                is_active=True,
                scopes=["search:read"]
            )
            session.add(api_key)
            await session.commit()
            await session.refresh(api_key)
        set_admin_context(False)

    # 2. Mock Ingestion Controller
    from fastapi.responses import JSONResponse
    from app.services.partner_service import PartnerService
    from unittest.mock import AsyncMock, MagicMock

    # Mock partner validation
    mock_partner_service = MagicMock()
    mock_partner_service.validate_api_key = AsyncMock(return_value=(partner, api_key))
    mock_partner_service.update_api_key_usage = AsyncMock()
    app.dependency_overrides[PartnerService] = lambda: mock_partner_service

    # Mock ingestion controller success response
    mock_controller = MagicMock()
    mock_controller.process_track = AsyncMock(return_value=JSONResponse(
        content={"success": True, "data": {"track_uuid": "test-track-123"}},
        status_code=200
    ))
    
    # We need to monkeypatch the controller instance in the router
    from app.api.routers import open_tracks_pipeline
    original_controller = open_tracks_pipeline.open_tracks_controller
    open_tracks_pipeline.open_tracks_controller = mock_controller

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Note: The endpoint expects multipart form data
            files = {"file": ("test.mp3", b"dummy audio content", "audio/mpeg")}
            data = {"path": "/path/to/test.mp3"}
            
            response = await ac.post(
                "/open_tracks_pipeline/track/", 
                headers={"Authorization": "Bearer rmx_audit_fullkey"},
                files=files,
                data=data
            )

            assert response.status_code == 200
            correlation_id = response.headers.get("X-Correlation-ID")
            assert correlation_id is not None

            # 3. Verify Log
            await asyncio.sleep(0.5)
            async with AsyncSessionLocal() as session:
                from app.core.context import set_current_partner_id
                set_current_partner_id(TEST_PARTNER_ID)
                result = await session.execute(
                    select(PartnerUsageLog).where(PartnerUsageLog.correlation_id == correlation_id)
                )
                log_entry = result.scalar_one_or_none()
                
                assert log_entry is not None
                assert log_entry.endpoint == "/open_tracks_pipeline/track/"
                assert log_entry.method == "POST"
                assert log_entry.status_code == 200

    finally:
        app.dependency_overrides.clear()
        open_tracks_pipeline.open_tracks_controller = original_controller

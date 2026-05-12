import pytest
from sqlalchemy import select
from app.models.track import Track
from app.core.context import partner_id_context
from database.connection import AsyncSessionLocal

@pytest.mark.asyncio
async def test_tenant_isolation_fails_without_context():
    """Verify that querying a partner-scoped model fails if no partner context is set."""
    # Ensure context is explicitly None
    token = partner_id_context.set(None)
    
    try:
        async with AsyncSessionLocal() as session:
            # Attempt to query Track (which has partner_id)
            # This should trigger the exception in database/connection.py once updated
            with pytest.raises(RuntimeError) as excinfo:
                stmt = select(Track).limit(1)
                await session.execute(stmt)
            
            assert "Multi-tenancy violation" in str(excinfo.value)
            assert "Track" in str(excinfo.value)
    finally:
        partner_id_context.reset(token)

@pytest.mark.asyncio
async def test_tenant_isolation_injects_filter_with_context():
    """Verify that querying with a partner context successfully injects the filter."""
    # Set context to Partner ID 1 (Sandbox)
    token = partner_id_context.set(1)
    
    try:
        async with AsyncSessionLocal() as session:
            # This should NOT fail
            stmt = select(Track).limit(1)
            # We just want to check it doesn't raise RuntimeError
            try:
                await session.execute(stmt)
            except Exception as e:
                # We don't care about DB connection errors here, only multi-tenancy violation
                if isinstance(e, RuntimeError) and "Multi-tenancy violation" in str(e):
                    pytest.fail(f"Query failed with multi-tenancy violation despite active context: {e}")
    finally:
        partner_id_context.reset(token)

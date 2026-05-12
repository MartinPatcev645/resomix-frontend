import asyncio
import uuid
from sqlalchemy import text, select
from database.connection import get_async_db
from app.models.partner import Partner
from app.models.track import Track
from app.models.playlist import Playlist
from app.core.context import set_current_partner_id

async def test_isolation():
    async with await get_async_db() as db:
        print("--- Setting up test data ---")
        
        # 1. Create Partner A
        partner_a_uuid = str(uuid.uuid4())
        partner_a_name = f"Partner_A_{uuid.uuid4().hex[:6]}"
        db.add(Partner(
            partner_uuid=partner_a_uuid,
            legal_name=partner_a_name,
            display_name=partner_a_name,
            contact_email=f"a_{uuid.uuid4().hex[:6]}@example.com",
            tier="starter",
            is_active=True
        ))
        await db.flush()
        partner_a_id = (await db.execute(text(f"SELECT id FROM partners WHERE partner_uuid='{partner_a_uuid}'"))).scalar()
        
        # 2. Create Partner B
        partner_b_uuid = str(uuid.uuid4())
        partner_b_name = f"Partner_B_{uuid.uuid4().hex[:6]}"
        db.add(Partner(
            partner_uuid=partner_b_uuid,
            legal_name=partner_b_name,
            display_name=partner_b_name,
            contact_email=f"b_{uuid.uuid4().hex[:6]}@example.com",
            tier="starter",
            is_active=True
        ))
        await db.flush()
        partner_b_id = (await db.execute(text(f"SELECT id FROM partners WHERE partner_uuid='{partner_b_uuid}'"))).scalar()
        
        print(f"Created Partner A (ID: {partner_a_id}) and Partner B (ID: {partner_b_id})")
        
        # 3. Create Track for Partner A
        track_a_uuid = str(uuid.uuid4())
        track_a = Track(
            uuid=track_a_uuid,
            title="Partner A Track",
            isrc=f"QM-AAA-{uuid.uuid4().hex[:8].upper()}",
            partner_id=partner_a_id,
            track_type="internal",
            is_active=1
        )
        db.add(track_a)
        
        # 4. Create Track for Partner B
        track_b_uuid = str(uuid.uuid4())
        track_b = Track(
            uuid=track_b_uuid,
            title="Partner B Track",
            isrc=f"QM-BBB-{uuid.uuid4().hex[:8].upper()}",
            partner_id=partner_b_id,
            track_type="internal",
            is_active=1
        )
        db.add(track_b)
        await db.commit()
        
        print(f"Created Track A ({track_a_uuid}) and Track B ({track_b_uuid})")
        
        print("\n--- Testing ORM Isolation Failsafe ---")
        
        # Test as Partner A
        set_current_partner_id(partner_a_id)
        stmt = select(Track)
        result = await db.execute(stmt)
        tracks = result.scalars().all()
        print(f"Partner A sees {len(tracks)} tracks: {[t.title for t in tracks]}")
        leak_found = False
        for t in tracks:
            if t.partner_id != partner_a_id:
                print(f"❌ LEAK DETECTED! Partner A saw track from Partner {t.partner_id}")
                leak_found = True
        if not leak_found:
            print("✅ ORM Failsafe Working: Partner A only saw its own tracks.")
        
        # Test as Partner B
        set_current_partner_id(partner_b_id)
        stmt = select(Track)
        result = await db.execute(stmt)
        tracks = result.scalars().all()
        print(f"Partner B sees {len(tracks)} tracks: {[t.title for t in tracks]}")
        leak_found = False
        for t in tracks:
            if t.partner_id != partner_b_id:
                print(f"❌ LEAK DETECTED! Partner B saw track from Partner {t.partner_id}")
                leak_found = True
        if not leak_found:
            print("✅ ORM Failsafe Working: Partner B only saw its own tracks.")
        
        # Test Repository Methods
        print("\n--- Testing Repository Isolation ---")
        from app.repositories.track_repository import TrackRepository
        repo = TrackRepository()
        
        # Get Track B using Partner A context
        set_current_partner_id(partner_a_id)
        track = await repo.async_get_by_uuid(db, track_b_uuid, partner_id=partner_a_id)
        if track:
            print("❌ LEAK DETECTED! Partner A accessed Track B via async_get_by_uuid")
        else:
            print("✅ Isolation Working: Partner A could not access Track B via async_get_by_uuid")
            
        # Test Similarity Repository (Raw SQL)
        from app.repositories.similarity_repository import SimilarityRepository
        sim_repo = SimilarityRepository()
        details = await sim_repo.async_get_reference_track_details_by_uuid(db, track_b_uuid, partner_id=partner_a_id)
        if details:
            print("❌ LEAK DETECTED! Partner A accessed Track B details via SimilarityRepository (Raw SQL)")
        else:
            print("✅ Isolation Working: Partner A could not access Track B details via SimilarityRepository (Raw SQL)")

        print("\n--- Testing Enumeration Isolation ---")
        # Test Partner B trying to list all tracks (should only see its own)
        set_current_partner_id(partner_b_id)
        all_tracks = await repo.async_search_tracks(db, query="", partner_id=partner_b_id)
        print(f"Partner B list/search returned {len(all_tracks)} results.")
        leak_found = False
        for t_data in all_tracks:
            # Note: repo returns dicts here, need to verify by title/UUID
            if t_data['title'] == "Partner A Track":
                print(f"❌ LEAK DETECTED! Partner B enumerated Partner A's track!")
                leak_found = True
        if not leak_found:
            print("✅ Enumeration Isolation Working: Partner B could not see Partner A's tracks in list results.")

        print("\n--- Cleanup ---")
        set_current_partner_id(None)
        await db.execute(text(f"DELETE FROM tracks WHERE partner_id IN ({partner_a_id}, {partner_b_id})"))
        await db.execute(text(f"DELETE FROM partners WHERE id IN ({partner_a_id}, {partner_b_id})"))
        await db.commit()
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(test_isolation())

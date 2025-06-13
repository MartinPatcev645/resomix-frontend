#!/usr/bin/env python3
"""
Database checker and test data seeder
"""

import asyncio
import sys
from database.connection import AsyncSessionLocal
from sqlalchemy import text

async def check_database():
    """Check database connection and tracks."""
    try:
        async with AsyncSessionLocal() as session:
            # Check if database is accessible
            result = await session.execute(text("SELECT 1"))
            print("✅ Database connection successful")
            
            # Check if tracks table exists
            try:
                result = await session.execute(text("SELECT COUNT(*) FROM tracks"))
                count = result.scalar()
                print(f"📊 Total tracks in database: {count}")
                
                if count > 0:
                    result = await session.execute(text("SELECT id, title, file_path FROM tracks LIMIT 5"))
                    tracks = result.fetchall()
                    print("🎵 Sample tracks:")
                    for track in tracks:
                        print(f"   ID: {track[0]}, Title: {track[1]}, Path: {track[2]}")
                else:
                    print("⚠️  No tracks found in database")
                    print("🔧 Adding a test track for testing...")
                    
                    # Add a test track
                    await session.execute(text("""
                        INSERT INTO tracks (id, title, artist_id, album_id, genre_id, file_path, duration, created_at, updated_at)
                        VALUES (
                            '507f1f77bcf86cd799439011',
                            'Test Track for Similarity',
                            1,
                            1,
                            1,
                            '/path/to/test/track.mp3',
                            180,
                            NOW(),
                            NOW()
                        )
                    """))
                    await session.commit()
                    print("✅ Test track added successfully")
                    
            except Exception as e:
                print(f"❌ Error checking tracks table: {e}")
                print("💡 The tracks table might not exist yet")
                
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Make sure MariaDB is running and .env file is configured correctly")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(check_database()) 
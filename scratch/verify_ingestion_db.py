import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

MARIA_DB_USER = os.getenv("MARIA_DB_USER", "root")
MARIA_DB_PASS = os.getenv("MARIA_DB_PASS", "test")
MARIA_DB_HOST = os.getenv("MARIA_DB_HOST", "127.0.0.1")
MARIA_DB_PORT = os.getenv("MARIA_DB_PORT", "3306")
MARIA_DB_NAME = os.getenv("MARIA_DB_NAME", "resomix_db")

DATABASE_URL = f"mysql+aiomysql://{MARIA_DB_USER}:{MARIA_DB_PASS}@{MARIA_DB_HOST}:{MARIA_DB_PORT}/{MARIA_DB_NAME}"

async def verify_ingestion_db():
    print(f"Connecting to database: {DATABASE_URL}...\n")
    engine = create_async_engine(DATABASE_URL)
    try:
        async with engine.connect() as conn:
            # 1. Query Ingest Logs
            print("--- LATEST INGESTION LOGS ---")
            query_logs = text("""
                SELECT id, partner_id, batch_filename, status, track_count, error_message, started_at 
                FROM ingest_logs 
                ORDER BY id DESC LIMIT 5
            """)
            result = await conn.execute(query_logs)
            logs = result.fetchall()
            if not logs:
                print("No ingestion logs found.")
            for log in logs:
                print(f"Log ID: {log[0]} | Partner: {log[1]} | File: {log[2]} | Status: {log[3]} | Track Count: {log[4]} | Started: {log[6]}")
                if log[5]:
                    print(f"  Error message: {log[5]}")
                
                # 2. Query Ingestion Errors for this Log
                query_errs = text("""
                    SELECT id, error_code, error_message, error_severity, reference_node 
                    FROM ingestion_errors 
                    WHERE ingest_log_id = :log_id
                """)
                err_result = await conn.execute(query_errs, {"log_id": log[0]})
                errors = err_result.fetchall()
                if errors:
                    print("  Row-level errors logged:")
                    for err in errors:
                        print(f"    - [{err[3].upper()}] Code: {err[1]} | Ref: {err[4]} | Message: {err[2]}")
                print()

            # 3. Query total tracks count in database
            print("--- TOTAL TRACKS SCOPE ---")
            query_tracks = text("SELECT COUNT(*) FROM tracks")
            tracks_res = await conn.execute(query_tracks)
            total_tracks = tracks_res.scalar()
            print(f"Total Tracks in DB: {total_tracks}")
            
            # Show the last 5 ingested tracks
            query_recent_tracks = text("SELECT id, isrc, title, display_artist, partner_id, created_at FROM tracks ORDER BY id DESC LIMIT 5")
            recent_res = await conn.execute(query_recent_tracks)
            recent_tracks = recent_res.fetchall()
            if recent_tracks:
                print("\nMost Recently Ingested Tracks:")
                for t in recent_tracks:
                    print(f"  - Track ID: {t[0]} | ISRC: {t[1]} | Title: {t[2]} | Artist: {t[3]} | Partner ID: {t[4]}")
            
    except Exception as e:
        print(f"Error querying database: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_ingestion_db())

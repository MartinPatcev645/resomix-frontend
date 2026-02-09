import os
import sys
import time
from typing import Dict, List, Set
import csv
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import httpx

# Load environment variables from .env file in current directory
load_dotenv()

# Database configuration
db_user = os.getenv("MARIA_DB_USER", "resomixAdmin")
db_pass = os.getenv("MARIA_DB_PASS", "")
db_host = os.getenv("MARIA_DB_HOST", "127.0.0.1")
db_port = os.getenv("MARIA_DB_PORT", "3306")
db_name = os.getenv("MARIA_DB_NAME", "resomix_db")
DB_URL = f"mariadb+mariadbconnector://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

# Similarity server configuration
SIMILARITY_SERVER_URL = os.getenv("SIMILARITY_SERVER_URL", "")

# File paths
ALL_UUIDS_FILE = "all_uuids.txt"
ALL_UUIDS_CSV_FILE = "all_uuids.csv"
COMPLETED_FILE = "completed.txt"
ERROR_FILE = "error.txt"

# Batch configuration
BATCH_SIZE = 50
DB_UPDATE_BATCH_SIZE = 10

# Test mode configuration
TEST_MODE = False  # Set to False for normal operation

def get_db_connection():
    """Create and return a database engine."""
    try:
        return create_engine(DB_URL)
    except SQLAlchemyError as e:
        print(f"[ERROR] Could not connect to database: {e}")
        sys.exit(1)

def create_all_uuids_file(db_engine):
    """Create all_uuids.txt file by reading all track UUIDs from database."""
    print("[INFO] Creating all_uuids.txt file...")
    
    try:
        with db_engine.connect() as conn:
            result = conn.execute(text("SELECT uuid FROM tracks ORDER BY id"))
            uuids = [row[0] for row in result.fetchall()]
        
        with open(ALL_UUIDS_FILE, "w") as f:
            for uuid in uuids:
                f.write(f"{uuid}\n")
        
        print(f"[INFO] Created {ALL_UUIDS_FILE} with {len(uuids)} UUIDs")
        return len(uuids)
        
    except Exception as e:
        print(f"[ERROR] Failed to create {ALL_UUIDS_FILE}: {e}")
        sys.exit(1)

def create_all_uuids_csv_file(db_engine):
    """Create all_uuids.csv with columns: uuid,type,created_at from database."""
    print("[INFO] Creating all_uuids.csv file...")

    try:
        with db_engine.connect() as conn:
            result = conn.execute(text("SELECT uuid, type, created_at FROM tracks ORDER BY id"))
            rows = result.fetchall()

        with open(ALL_UUIDS_CSV_FILE, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["uuid", "type", "created_at"])  # header
            for uuid, track_type, created_at in rows:
                writer.writerow([uuid, track_type, str(created_at) if created_at is not None else ""]) 

        print(f"[INFO] Created {ALL_UUIDS_CSV_FILE} with {len(rows)} rows")
    
    except Exception as e:
        print(f"[ERROR] Failed to create {ALL_UUIDS_CSV_FILE}: {e}")
        sys.exit(1)

def load_uuids_from_file(filepath: str) -> Set[str]:
    """Load UUIDs from a text file into a set."""
    if not os.path.exists(filepath):
        return set()
    
    try:
        with open(filepath, "r") as f:
            return {line.strip() for line in f if line.strip()}
    except Exception as e:
        print(f"[ERROR] Failed to read {filepath}: {e}")
        return set()

def append_to_file(filepath: str, content: str):
    """Append content to a file."""
    try:
        with open(filepath, "a") as f:
            f.write(content + "\n")
    except Exception as e:
        print(f"[ERROR] Failed to write to {filepath}: {e}")

async def call_similarity_api(uuids: List[str]) -> Dict:
    """Call the similarity API probe-durations endpoint."""
    # Build URL with API key as query parameter
    base_url = f"{SIMILARITY_SERVER_URL.rstrip('/')}/probe-durations/"
    api_key = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
    url = f"{base_url}?api_key={api_key}"
    
    payload = {"uuids": uuids}
    
    print(f"[DEBUG] Calling URL: {url}")
    print(f"[DEBUG] Payload: {len(uuids)} UUIDs")
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            url,
            headers={"Content-Type": "application/json", "Origin": "https://bserver.resomix.com"},
            json=payload
        )
        response.raise_for_status()
        return response.json()

def update_durations_in_db(db_engine, duration_updates: List[Dict]) -> int:
    """Update durations in database in smaller batches."""
    if not duration_updates:
        return 0
    
    update_sql = text("UPDATE tracks SET duration_sec = :duration WHERE uuid = :uuid")
    updated_count = 0
    
    try:
        with db_engine.connect() as conn:
            with conn.begin():
                # Process in smaller batches to avoid overwhelming the database
                for i in range(0, len(duration_updates), DB_UPDATE_BATCH_SIZE):
                    batch = duration_updates[i:i + DB_UPDATE_BATCH_SIZE]
                    
                    for update in batch:
                        try:
                            result = conn.execute(update_sql, {
                                "duration": round(update["duration_s"], 3),
                                "uuid": update["uuid"]
                            })
                            if result.rowcount > 0:
                                updated_count += 1
                        except SQLAlchemyError as e:
                            print(f"[ERROR] Failed to update {update['uuid']}: {e}")
                    
                    # Small delay between batches to be gentle on the database
                    time.sleep(0.1)
        
        return updated_count
        
    except Exception as e:
        print(f"[ERROR] Database batch update failed: {e}")
        return 0

async def process_batch(db_engine, batch_uuids: List[str], batch_num: int) -> int:
    """Process a single batch of UUIDs."""
    print(f"[INFO] Processing batch {batch_num} with {len(batch_uuids)} UUIDs...")
    
    # Call similarity API
    api_response = await call_similarity_api(batch_uuids)
    
    if api_response.get("status") != "success":
        print(f"[ERROR] Batch {batch_num} API call failed: {api_response.get('message', 'Unknown error')}")
        return 0
    
    # Log API response counts
    processed_count = api_response.get("processed_count", 0)
    found_count = api_response.get("found_count", 0)
    error_count = api_response.get("error_count", 0)
    print(f"[API] Batch {batch_num}: Processed={processed_count}, Found={found_count}, Errors={error_count}")
    
    # Process the response data
    duration_updates = []
    completed_uuids = []
    
    for item in api_response.get("data", []):
        uuid = item.get("uuid")
        if not uuid:
            continue
            
        completed_uuids.append(uuid)
        
        if item.get("found") and item.get("duration_s") is not None:
            duration_updates.append({
                "uuid": uuid,
                "duration_s": item["duration_s"]
            })
        else:
            # Log error
            error_msg = item.get("error", "Unknown error")
            append_to_file(ERROR_FILE, f"{uuid}=={error_msg}")
    
    # Update database
    db_updated_count = update_durations_in_db(db_engine, duration_updates)
    print(f"[DB] Batch {batch_num}: Updated {db_updated_count}/{len(duration_updates)} durations in database")
    
    # Mark UUIDs as completed
    for uuid in completed_uuids:
        append_to_file(COMPLETED_FILE, uuid)
    
    return len(completed_uuids)

async def test_mode(db_engine, remaining_uuids: List[str], total_tracks: int, completed_count: int):
    """Test mode: Process 2 batches and estimate completion time."""
    print("[INFO] Running in TEST MODE - processing 2 batches only...")
    
    if len(remaining_uuids) == 0:
        print("[INFO] No remaining tracks to test with!")
        return
    
    # Process maximum 2 batches
    test_batches = min(2, (len(remaining_uuids) + BATCH_SIZE - 1) // BATCH_SIZE)
    print(f"[INFO] Testing with {test_batches} batch(es)...")
    
    start_time = time.time()
    total_processed_in_test = 0
    
    for batch_num in range(1, test_batches + 1):
        start_idx = (batch_num - 1) * BATCH_SIZE
        end_idx = min(start_idx + BATCH_SIZE, len(remaining_uuids))
        batch_uuids = remaining_uuids[start_idx:end_idx]
        
        try:
            batch_processed = await process_batch(db_engine, batch_uuids, batch_num)
            total_processed_in_test += batch_processed
            print(f"[TEST] Batch {batch_num} completed: {batch_processed} tracks processed")
        except Exception as e:
            print(f"[ERROR] Test batch {batch_num} failed: {e}")
            continue
    
    end_time = time.time()
    test_duration = end_time - start_time
    
    # Calculate estimates
    if total_processed_in_test > 0:
        time_per_track = test_duration / total_processed_in_test
        remaining_tracks = len(remaining_uuids) - total_processed_in_test
        estimated_time_remaining = time_per_track * remaining_tracks
        
        # Format time estimates
        def format_time(seconds):
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            return f"{hours}h {minutes}m {secs}s"
        
        print("\n[TEST RESULTS]")
        print(f"  Test Duration: {format_time(test_duration)}")
        print(f"  Tracks Processed: {total_processed_in_test}")
        print(f"  Time per Track: {time_per_track:.2f} seconds")
        print(f"  Remaining Tracks: {remaining_tracks}")
        print(f"  Estimated Time to Complete: {format_time(estimated_time_remaining)}")
        print(f"  Current Progress: {completed_count + total_processed_in_test}/{total_tracks} ({((completed_count + total_processed_in_test)/total_tracks*100):.1f}%)")
    else:
        print("\n[TEST RESULTS]")
        print(f"  Test Duration: {test_duration:.2f} seconds")
        print("  No tracks were successfully processed - cannot estimate completion time")
    
    print("\n[INFO] Test completed. Set TEST_MODE = False to run full processing.")

async def main():
    """Main processing function."""
    print("[INFO] Starting update_all_durations script...")
    
    # Initialize database connection
    db_engine = get_db_connection()

    # This is just to get uuids for alignment of files script.
    # Comment it when need to use the remaining script
    create_all_uuids_csv_file(db_engine)
    quit()
    
    # Check if all_uuids.txt exists, create if not
    if not os.path.exists(ALL_UUIDS_FILE):
        total_tracks = create_all_uuids_file(db_engine)
    else:
        print(f"[INFO] Using existing {ALL_UUIDS_FILE}")
        all_uuids = load_uuids_from_file(ALL_UUIDS_FILE)
        total_tracks = len(all_uuids)
    
    # Load all UUIDs and completed UUIDs
    all_uuids = load_uuids_from_file(ALL_UUIDS_FILE)
    completed_uuids = load_uuids_from_file(COMPLETED_FILE)
    
    # Calculate remaining UUIDs
    remaining_uuids = list(all_uuids - completed_uuids)
    
    print(f"[INFO] Total tracks: {total_tracks}")
    print(f"[INFO] Completed tracks: {len(completed_uuids)}")
    print(f"[INFO] Remaining tracks: {len(remaining_uuids)}")
    
    if not remaining_uuids:
        print("[INFO] All tracks have been processed!")
        return
    
    # Check if we're in test mode
    if TEST_MODE:
        await test_mode(db_engine, remaining_uuids, total_tracks, len(completed_uuids))
        return
    
    # Process in batches
    total_processed = len(completed_uuids)
    batch_num = 1
    
    for i in range(0, len(remaining_uuids), BATCH_SIZE):
        batch_uuids = remaining_uuids[i:i + BATCH_SIZE]
        
        try:
            batch_processed = await process_batch(db_engine, batch_uuids, batch_num)
            total_processed += batch_processed
            
            # Progress report every 20 batches
            if batch_num % 20 == 0:
                print(f"[PROGRESS] After {batch_num} batches: {total_processed}/{total_tracks} tracks completed ({total_processed/total_tracks*100:.1f}%)")
            
            batch_num += 1
            
            # Small delay between batches
            await asyncio.sleep(1)
            
        except KeyboardInterrupt:
            print(f"\n[INFO] Script interrupted. Progress saved. Processed {total_processed}/{total_tracks} tracks.")
            break
        except Exception as e:
            print(f"[ERROR] Batch {batch_num} failed: {e}")
            batch_num += 1
            continue
    
    print(f"[INFO] Script completed! Final count: {total_processed}/{total_tracks} tracks processed.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

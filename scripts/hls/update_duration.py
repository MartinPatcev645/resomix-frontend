import json
import os
import argparse
import sys
from typing import Dict, List
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Load environment variables from .env file in current directory
load_dotenv()

db_user = os.getenv("MARIA_DB_USER", "resomixAdmin")
db_pass = os.getenv("MARIA_DB_PASS", "")
db_host = os.getenv("MARIA_DB_HOST", "127.0.0.1")
db_port = os.getenv("MARIA_DB_PORT", "3306")
db_name = os.getenv("MARIA_DB_NAME", "resomix_db")
DB_URL = (
    f"mariadb+mariadbconnector://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
)

# -----------------------------------------------------------------------------
# Configuration helpers
# -----------------------------------------------------------------------------

def get_db_connection() -> create_engine:
    """Create and return a MySQL/MariaDB connection using env vars.

    Expected environment variables:
        DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
    """
    try:
        return create_engine(DB_URL)
    except SQLAlchemyError as e:
        print(f"[ERROR] Could not connect to database: {e}")
        sys.exit(1)

# -----------------------------------------------------------------------------
# JSON helpers
# -----------------------------------------------------------------------------

def extract_tracks(payload: Dict[str, any]) -> List[Dict[str, any]]:
    """Extract track UUID + duration pairs from similarity JSON response."""
    tracks: List[Dict[str, any]] = []

    # Queried track
    queried = payload.get("data", {}).get("queried_track")
    if queried and queried.get("id") and queried.get("duration") is not None:
        tracks.append({"uuid": queried["id"], "duration": float(queried["duration"])})

    # Similar tracks
    for tr in payload.get("data", {}).get("similar_tracks", []):
        if tr.get("id") and tr.get("duration") is not None:
            tracks.append({"uuid": tr["id"], "duration": float(tr["duration"])})

    return tracks

# -----------------------------------------------------------------------------
# Main updating logic
# -----------------------------------------------------------------------------

def update_durations(db: create_engine, track_updates: List[Dict[str, any]]):
    """Run UPDATE statements to set duration_sec for each track."""
    fetch_sql = text("SELECT duration_sec FROM tracks WHERE uuid = :uuid")
    update_sql = text("UPDATE tracks SET duration_sec = :duration WHERE uuid = :uuid")

    updated = 0
    with db.connect() as conn:
        with conn.begin():
            for item in track_updates:
                try:
                    uuid = item["uuid"]
                    new_dur = round(item["duration"], 3)
                    prev = conn.execute(fetch_sql, {"uuid": uuid}).scalar()
                    if prev is None:
                        print(f"[WARN] uuid {uuid} not found")
                        continue
                    conn.execute(update_sql, {"duration": new_dur, "uuid": uuid})
                    print(f"[OK] {uuid} | {prev} -> {new_dur}")
                    updated += 1
                except SQLAlchemyError as e:
                    print(f"[ERROR] Failed to update {item['uuid']}: {e}")

    print(f"[INFO] Updated {updated} track(s).")

# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Update track durations from similarity JSON response.")
    parser.add_argument(
        "--file",
        "-f",
        default="response_updated.json",
        help="Path to the JSON file (default: response_updated.json in the same directory)",
    )

    args = parser.parse_args()

    # Read JSON
    try:
        with open(args.file, "r", encoding="utf-8") as fp:
            payload = json.load(fp)
    except FileNotFoundError:
        print(f"[ERROR] File not found: {args.file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON: {e}")
        sys.exit(1)

    track_updates = extract_tracks(payload)
    if not track_updates:
        print("[INFO] No track data found in JSON. Nothing to update.")
        return

    db = get_db_connection()
    try:
        update_durations(db, track_updates)
    finally:
        pass # No explicit close needed for create_engine


if __name__ == "__main__":
    main()

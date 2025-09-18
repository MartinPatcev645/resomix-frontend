import json
import os
import argparse
import sys
from typing import Dict, List

import mysql.connector
from mysql.connector import Error, MySQLConnection

# -----------------------------------------------------------------------------
# Configuration helpers
# -----------------------------------------------------------------------------

def get_db_connection() -> MySQLConnection:
    """Create and return a MySQL/MariaDB connection using env vars.

    Expected environment variables:
        DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
    """
    try:
        return mysql.connector.connect(
            host=os.getenv("MARIA_DB_HOST", "localhost"),
            port=int(os.getenv("MARIA_DB_PORT", 3306)),
            user=os.getenv("MARIA_DB_USER", "root"),
            password=os.getenv("MARIA_DB_PASS", ""),
            database=os.getenv("MARIA_DB_NAME", "resomix"),
            autocommit=True,
        )
    except Error as e:
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

def update_durations(db: MySQLConnection, track_updates: List[Dict[str, any]]):
    """Run UPDATE statements to set duration_sec for each track."""
    sql = "UPDATE tracks SET duration_sec = %s WHERE uuid = %s"

    with db.cursor() as cur:
        for item in track_updates:
            try:
                # Round to 3 decimal places as defined in schema
                cur.execute(sql, (round(item["duration"], 3), item["uuid"]))
                if cur.rowcount == 0:
                    print(f"[WARN] No track found with uuid {item['uuid']}")
            except Error as e:
                print(f"[ERROR] Failed to update {item['uuid']}: {e}")

    print(f"[INFO] Updated {len(track_updates)} track(s).")

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
        db.close()


if __name__ == "__main__":
    main()

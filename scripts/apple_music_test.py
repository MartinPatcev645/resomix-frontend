import os
import time
import urllib.parse
import jwt
import requests
import json
import pymysql

# ==========================================
# CONFIGURATION
# ==========================================
TEAM_ID = "Y7LW8T55DP"
KEY_ID = "XD23FYNSG2"
PRIVATE_KEY_PATH = "./creds/AuthKey_XD23FYNSG2.p8"
FILENAME = "Rodrigo Deem - Contact (Extended Mix)"
OUTPUT_FILE = "results.csv"
STOREFRONT = "us"

USE_JSON_LIST = True
JSON_FILE_PATH = "scripts/apple_music_tracks_selection.json"

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
DB_HOST = "localhost"
DB_USER = "resomix_user"
DB_PASS = "resomix_prod"
DB_NAME = "resomix_prod"

# ==========================================
# DB FUNCTION
# ==========================================
def get_track_metadata(file_path):
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        
        query = """
        SELECT 
            t.title, 
            t.duration_sec, 
            GROUP_CONCAT(a.name SEPARATOR ', ') AS artists
        FROM tracks t
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.file_path = %s
        GROUP BY t.id
        """
        
        with connection.cursor() as cursor:
            cursor.execute(query, (file_path,))
            result = cursor.fetchone()
            return result
    except Exception as e:
        print(f"DB Error: {e}")
        return None
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

# ==========================================
# JWT GENERATION
# ==========================================
def generate_developer_token():
    """Generates an Apple Music Developer Token valid for 180 days."""
    with open(PRIVATE_KEY_PATH, "r") as f:
        private_key = f.read()

    headers = {
        "alg": "ES256",
        "kid": KEY_ID
    }
    
    payload = {
        "iss": TEAM_ID,
        "iat": int(time.time()),
        "exp": int(time.time()) + (180 * 24 * 60 * 60) # 180 days in seconds
    }
    
    token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
    return token

# ==========================================
# APPLE MUSIC API SEARCH
# ==========================================
def search_track(query, token):
    """
    Searches for a track on Apple Music using the catalog search API.
    Returns the top result's metadata.
    """
    url = f"https://api.music.apple.com/v1/catalog/{STOREFRONT}/search"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    params = {
        "types": "songs",
        "term": query,
        "limit": 1
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        if response.status_code == 429:
            print("  [!] Rate limit hit. Backing off for 5 seconds...")
            time.sleep(5)
            return search_track(query, token)
            
        response.raise_for_status()
        data = response.json()
        
        results = data.get("results", {}).get("songs", {}).get("data", [])
        
        if results:
            song = results[0]
            attributes = song.get("attributes", {})
            previews = attributes.get("previews", [])
            preview_url = previews[0].get("url") if previews else "No preview URL"
            
            artwork_url = attributes.get("artwork", {}).get("url", "").replace("{w}", "600").replace("{h}", "600")
            apple_duration_ms = attributes.get("durationInMillis", 0)
            
            return {
                "id": song.get("id"),
                "name": attributes.get("name"),
                "artist": attributes.get("artistName"),
                "preview": preview_url,
                "url": attributes.get("url"), # Deep link to Apple Music
                "constructed_url": f"https://music.apple.com/{STOREFRONT}/song/{song.get('id')}",
                "isrc": attributes.get("isrc", "NO_ISRC"),
                "durationInMillis": apple_duration_ms,
                "durationFormatted": f"{apple_duration_ms // 60000:02d}:{(apple_duration_ms // 1000) % 60:02d}",
                "albumName": attributes.get("albumName", "Unknown Album"),
                "releaseDate": attributes.get("releaseDate", "Unknown Date"),
                # Join the list of genres into a single string separated by pipes
                "genres": " | ".join(attributes.get("genreNames", [])),
                "artwork_url": artwork_url
            }
        
        return None

    except Exception as e:
        print(f"Request error for '{query}': {e}")
        return None

# ==========================================
# MAIN EXECUTION
# ==========================================
def process_tracks():
    print("Generating Developer Token...")
    token = generate_developer_token()
    
    # Initialize the CSV file with headers if it doesn't exist
    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write("Query,FilePath,IsMatch,SongID,ISRC,DurationMs,DurationFormatted,Name,Artist,Album,ReleaseDate,Genres,AppleMusicURL,PreviewURL,ArtworkURL,DeepLinkURL\n")
            
    tasks = []
    if USE_JSON_LIST:
        print(f"Loading queries from JSON: {JSON_FILE_PATH}")
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            paths = json.load(f)
        for path in paths:
            db_meta = get_track_metadata(path)
            if db_meta and db_meta.get('title'):
                artists = db_meta.get('artists')
                title = db_meta.get('title')
                query = f"{artists} - {title}" if artists else title
                tasks.append({
                    "query": query,
                    "path": path,
                    "db_title": title,
                    "db_duration_sec": db_meta.get('duration_sec')
                })
            else:
                print(f"Path not found in DB or missing title: {path}")
                # Fallback to filename
                filename = os.path.basename(path)
                query, _ = os.path.splitext(filename)
                tasks.append({
                    "query": query,
                    "path": path,
                    "db_title": None,
                    "db_duration_sec": None
                })
    else:
        query, _ = os.path.splitext(FILENAME)
        tasks.append({
            "query": query,
            "path": "",
            "db_title": None,
            "db_duration_sec": None
        })
            
    print(f"Starting processing for {len(tasks)} track(s)...")

    with open(OUTPUT_FILE, "a", encoding="utf-8") as outfile:
        for idx, task in enumerate(tasks):
            query = task['query']
            path = task['path']
            print(f"[{idx+1}/{len(tasks)}] Searching Apple Music for query: '{query}'")
            result = search_track(query, token)
            
            if result:
                # Escape double quotes inside strings for valid CSV generation
                safe_name = result['name'].replace('"', '""')
                safe_artist = result['artist'].replace('"', '""')
                safe_album = result['albumName'].replace('"', '""')
                
                # Check match logic
                is_match = "N/A"
                if task['db_title'] and task['db_duration_sec'] and result.get('durationInMillis'):
                    db_duration_ms = float(task['db_duration_sec']) * 1000
                    apple_duration_ms = float(result['durationInMillis'])
                    db_title_lower = task['db_title'].lower()
                    
                    if "(radio edit)" in db_title_lower or "(extended mix)" in db_title_lower:
                        # Allow Apple Music duration to be less or equal to our DB duration (+ 2s margin)
                        is_match = "True" if apple_duration_ms <= (db_duration_ms + 2000) else "False"
                    else:
                        # Require exact match (+/- 2 seconds)
                        is_match = "True" if abs(apple_duration_ms - db_duration_ms) <= 2000 else "False"
                
                csv_line = f'"{query}","{path}","{is_match}","{result["id"]}","{result["isrc"]}","{result["durationInMillis"]}","{result["durationFormatted"]}","{safe_name}","{safe_artist}","{safe_album}","{result["releaseDate"]}","{result["genres"]}","{result["constructed_url"]}","{result["preview"]}","{result["artwork_url"]}","{result["url"]}"\n'
                outfile.write(csv_line)
                print(f"  -> MATCH: ID: {result['id']} (IsMatch: {is_match})")
            else:
                # Write an empty row for tracks not found, preserving the column count
                outfile.write(f'"{query}","{path}","N/A","NOT_FOUND","","","","","","","","","","","",""\n')
                print(f"  -> MISS")

    print(f"Processing complete. Results saved in: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_tracks()

import os
import time
import urllib.parse
import jwt
import requests
import json
import pymysql
import csv
import re

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
# METADATA CLEANING & FORMATTING HELPERS
# ==========================================
def clean_db_metadata(artists, title, file_path):
    clean_artists = artists or ''
    clean_title = title or ''
    
    # Remove file extension from title if present
    for ext in ['.mp3', '.flac', '.wav', '.aiff', '.FLAC', '.WAV', '.MP3']:
        if clean_title.endswith(ext):
            clean_title = clean_title[:-len(ext)]
            break
            
    # If artists is 'Unknown' or empty, try to parse from the title or filename
    if not clean_artists or clean_artists.lower() == 'unknown':
        if clean_title and ' - ' in clean_title:
            parts = clean_title.split(' - ', 1)
            potential_artist = re.sub(r'^\d+[\.\-_ ]*', '', parts[0]).strip()
            potential_title = parts[1].strip()
            if potential_artist and potential_title:
                clean_artists = potential_artist
                clean_title = potential_title
        else:
            filename = os.path.basename(file_path)
            name_without_ext, _ = os.path.splitext(filename)
            # Clean common electrobuzz network tags
            name_without_ext = re.sub(r'[-_]electrobuzz\.(net|pro|com|click|dj)', '', name_without_ext, flags=re.IGNORECASE)
            name_without_ext = re.sub(r'_\(www\.electrobuzz\.(net|pro|com|dj)\)', '', name_without_ext, flags=re.IGNORECASE)
            if ' - ' in name_without_ext:
                parts = name_without_ext.split(' - ', 1)
                potential_artist = re.sub(r'^\d+[\.\-_ ]*', '', parts[0]).strip()
                potential_title = parts[1].strip()
                if potential_artist and potential_title:
                    clean_artists = potential_artist
                    clean_title = potential_title
            elif '-' in name_without_ext:
                parts = name_without_ext.split('-', 1)
                potential_artist = re.sub(r'^\d+[\.\-_ ]*', '', parts[0]).strip()
                potential_title = parts[1].strip()
                if potential_artist and potential_title:
                    clean_artists = potential_artist
                    clean_title = potential_title
                    
    # Strip leading track numbers/indices from artists and title
    if clean_artists:
        clean_artists = re.sub(r'^\d+[\.\-_ ]*', '', clean_artists).strip()
        if clean_artists.lower() == 'unknown':
            clean_artists = ''
            
    if clean_title:
        clean_title = re.sub(r'^\d+[\.\-_ ]*', '', clean_title).strip()
        
    return clean_artists, clean_title

def format_seconds_to_mmss(seconds):
    if seconds is None:
        return ""
    try:
        total_seconds = int(float(seconds))
        mins = total_seconds // 60
        secs = total_seconds % 60
        return f"{mins:02d}:{secs:02d}"
    except (ValueError, TypeError):
        return ""

# ==========================================
# MAIN EXECUTION
# ==========================================
def process_tracks():
    print("Generating Developer Token...")
    token = generate_developer_token()
    
    # We define the strict headers as requested by the user
    headers = [
        "in_house_query",
        "in_house_file_path",
        "is_match",
        "apple_song_id",
        "apple_isrc",
        "in_house_duration",
        "apple_duration",
        "apple_name",
        "apple_artist",
        "apple_album",
        "apple_release_date",
        "apple_genres",
        "apple_music_url",
        "apple_preview_url",
        "apple_artwork_url",
        "apple_deep_link_url",
        "in_house_duration_ms",
        "apple_duration_ms"
    ]
    
    # Overwrite the file to ensure the columns are correct and aligned
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(headers)
            
    tasks = []
    if USE_JSON_LIST:
        print(f"Loading queries from JSON: {JSON_FILE_PATH}")
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            paths = json.load(f)
        for path in paths:
            db_meta = get_track_metadata(path)
            if db_meta and db_meta.get('title'):
                artists = db_meta.get('artists') or ''
                title = db_meta.get('title') or ''
                
                # Perform robust cleaning
                clean_artists, clean_title = clean_db_metadata(artists, title, path)
                query = f"{clean_artists} - {clean_title}" if clean_artists else clean_title
                
                tasks.append({
                    "query": query,
                    "path": path,
                    "db_title": clean_title,
                    "db_duration_sec": db_meta.get('duration_sec')
                })
            else:
                print(f"Path not found in DB or missing title: {path}")
                # Fallback to filename parsing
                filename = os.path.basename(path)
                name_without_ext, _ = os.path.splitext(filename)
                clean_artists, clean_title = clean_db_metadata('', name_without_ext, path)
                query = f"{clean_artists} - {clean_title}" if clean_artists else clean_title
                
                tasks.append({
                    "query": query,
                    "path": path,
                    "db_title": clean_title,
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

    with open(OUTPUT_FILE, "a", encoding="utf-8", newline="") as outfile:
        writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
        
        for idx, task in enumerate(tasks):
            query = task['query']
            path = task['path']
            print(f"[{idx+1}/{len(tasks)}] Searching Apple Music for query: '{query}'")
            result = search_track(query, token)
            
            in_house_duration = format_seconds_to_mmss(task['db_duration_sec'])
            in_house_duration_ms = int(float(task['db_duration_sec']) * 1000) if task['db_duration_sec'] is not None else ""
            
            if result:
                # Check match logic
                is_match = "N/A"
                apple_duration_ms = result.get('durationInMillis', 0)
                
                if task['db_title'] and in_house_duration_ms:
                    db_title_lower = task['db_title'].lower()
                    
                    if "radio edit" in db_title_lower or "extended mix" in db_title_lower or "extended remix" in db_title_lower:
                        # Allow Apple Music duration to be less or equal to our DB duration (+ 2s margin)
                        is_match = "True" if apple_duration_ms <= (in_house_duration_ms + 2000) else "False"
                    else:
                        # Require exact match (+/- 2 seconds)
                        is_match = "True" if abs(apple_duration_ms - in_house_duration_ms) <= 2000 else "False"
                
                row = [
                    query,
                    path,
                    is_match,
                    result["id"],
                    result["isrc"],
                    in_house_duration,
                    result["durationFormatted"],
                    result["name"],
                    result["artist"],
                    result["albumName"],
                    result["releaseDate"],
                    result["genres"],
                    result["constructed_url"],
                    result["preview"],
                    result["artwork_url"],
                    result["url"],
                    in_house_duration_ms,
                    apple_duration_ms
                ]
                writer.writerow(row)
                print(f"  -> MATCH: ID: {result['id']} (IsMatch: {is_match})")
            else:
                # Write an empty row for tracks not found, preserving the column count
                row = [
                    query,
                    path,
                    "N/A",
                    "NOT_FOUND",
                    "",  # ISRC
                    in_house_duration,
                    "",  # apple_duration
                    "",  # apple_name
                    "",  # apple_artist
                    "",  # apple_album
                    "",  # apple_release_date
                    "",  # apple_genres
                    "",  # apple_music_url
                    "",  # apple_preview_url
                    "",  # apple_artwork_url
                    "",  # apple_deep_link_url
                    in_house_duration_ms,
                    ""   # apple_duration_ms
                ]
                writer.writerow(row)
                print(f"  -> MISS")

    print(f"Processing complete. Results saved in: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_tracks()

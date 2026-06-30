import os
import time
import urllib.parse
import jwt
import requests
import json

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
# APPLE MUSIC API CALL
# ==========================================
def search_track(query, token, retries=3):
    """Searches a track query using the Apple Music API, managing rate limits."""
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://api.music.apple.com/v1/catalog/{STOREFRONT}/search?types=songs&limit=1&term={encoded_query}"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        # Handle Rate Limits (HTTP 429)
        if response.status_code == 429:
            if retries > 0:
                print(f"[Rate Limit] Hit 429. Backing off for 5 seconds... ({retries} retries left)")
                time.sleep(5)
                return search_track(query, token, retries - 1)
            else:
                print(f"Max retries exceeded due to rate limit for: {query}")
                return None

        if response.status_code != 200:
            print(f"HTTP Error {response.status_code} for query: {query}")
            return None

        data = response.json()
        results = data.get("results", {}).get("songs", {}).get("data", [])
        
        if results:
            song = results[0]
            attributes = song.get("attributes", {})
            previews = attributes.get("previews", [])
            preview_url = previews[0].get("url") if previews else "No preview URL"
            
            # The artwork URL contains placeholders like {w}x{h}. 
            # We replace them to request a 600x600 pixel image.
            artwork_data = attributes.get("artwork", {})
            raw_artwork_url = artwork_data.get("url", "NO_ARTWORK")
            artwork_url = raw_artwork_url.replace("{w}", "600").replace("{h}", "600")
            
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
            f.write("Query,SongID,ISRC,DurationMs,DurationFormatted,Name,Artist,Album,ReleaseDate,Genres,AppleMusicURL,PreviewURL,ArtworkURL,DeepLinkURL\n")
            
    queries = []
    if USE_JSON_LIST:
        print(f"Loading queries from JSON: {JSON_FILE_PATH}")
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            paths = json.load(f)
        for path in paths:
            filename = os.path.basename(path)
            query, _ = os.path.splitext(filename)
            queries.append(query)
    else:
        query, _ = os.path.splitext(FILENAME)
        queries.append(query)
            
    print(f"Starting processing for {len(queries)} track(s)...")

    with open(OUTPUT_FILE, "a", encoding="utf-8") as outfile:
        for idx, query in enumerate(queries):
            print(f"[{idx+1}/{len(queries)}] Searching Apple Music for query: '{query}'")
            result = search_track(query, token)
            
            if result:
                # Escape double quotes inside strings for valid CSV generation
                safe_name = result['name'].replace('"', '""')
                safe_artist = result['artist'].replace('"', '""')
                safe_album = result['albumName'].replace('"', '""')
                
                csv_line = f'"{query}","{result["id"]}","{result["isrc"]}","{result["durationInMillis"]}","{result["durationFormatted"]}","{safe_name}","{safe_artist}","{safe_album}","{result["releaseDate"]}","{result["genres"]}","{result["constructed_url"]}","{result["preview"]}","{result["artwork_url"]}","{result["url"]}"\n'
                outfile.write(csv_line)
                print(f"  -> MATCH: ID: {result['id']}")
            else:
                # Write an empty row for tracks not found, preserving the column count
                outfile.write(f'"{query}","NOT_FOUND","","","","","","","","","","","",""\n')
                print(f"  -> MISS")

    print(f"Processing complete. Results saved in: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_tracks()

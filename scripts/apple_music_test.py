import os
import time
import urllib.parse
import jwt
import requests
from rapidfuzz import fuzz

# ==========================================
# CONFIGURATION
# ==========================================
TEAM_ID = "Y7LW8T55DP"
KEY_ID = "XD23FYNSG2"
PRIVATE_KEY_PATH = "./creds/AuthKey_XD23FYNSG2.p8"
FILENAME = "Rodrigo Deem - Contact"
LOCAL_DURATION_MS = 210000  # Local file duration for validation
OUTPUT_FILE = "results.csv"
STOREFRONT = "us"

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
def search_track(query, token, target_duration_ms=None, retries=3):
    """Searches a track query using the Apple Music API, managing rate limits and heuristics."""
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://api.music.apple.com/v1/catalog/{STOREFRONT}/search?types=songs&limit=5&term={encoded_query}"
    
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
                return search_track(query, token, target_duration_ms, retries - 1)
            else:
                print(f"Max retries exceeded due to rate limit for: {query}")
                return None

        if response.status_code != 200:
            print(f"HTTP Error {response.status_code} for query: {query}")
            return None

        data = response.json()
        results = data.get("results", {}).get("songs", {}).get("data", [])
        
        if not results:
            return None
            
        # Loop through the candidates and apply Heuristic Validation
        for song in results:
            attributes = song.get("attributes", {})
            apple_name = attributes.get("name", "")
            apple_artist = attributes.get("artistName", "")
            
            # 1. String Similarity
            apple_combined = f"{apple_artist} {apple_name}".lower()
            query_lower = query.lower()
            
            similarity_score = fuzz.ratio(query_lower, apple_combined)
            
            if similarity_score < 80:  # e.g., 80% threshold
                print(f"  [Reject] Low similarity ({similarity_score:.1f}%): '{apple_combined}'")
                continue
                
            # 2. Duration Fingerprinting
            apple_duration_ms = attributes.get("durationInMillis", 0)
            
            if target_duration_ms:
                duration_diff = abs(apple_duration_ms - target_duration_ms)
                
                is_radio_edit = "(radio edit)" in apple_name.lower()
                
                if duration_diff > 2000 and not is_radio_edit:
                    print(f"  [Reject] Duration mismatch (Apple: {apple_duration_ms}ms vs Target: {target_duration_ms}ms) for '{apple_combined}'")
                    continue
                elif is_radio_edit and duration_diff > 2000:
                    print(f"  [Accept] Duration mismatch allowed due to Radio Edit exception for '{apple_combined}'")

            print(f"  [Accept] Valid match found ({similarity_score:.1f}% similarity): '{apple_combined}'")

            previews = attributes.get("previews", [])
            preview_url = previews[0].get("url") if previews else "No preview URL"
            
            # The artwork URL contains placeholders like {w}x{h}. 
            # We replace them to request a 600x600 pixel image.
            artwork_data = attributes.get("artwork", {})
            raw_artwork_url = artwork_data.get("url", "NO_ARTWORK")
            artwork_url = raw_artwork_url.replace("{w}", "600").replace("{h}", "600")
            
            return {
                "id": song.get("id"),
                "name": attributes.get("name"),
                "artist": attributes.get("artistName"),
                "preview": preview_url,
                "url": attributes.get("url"), # Deep link to Apple Music
                "isrc": attributes.get("isrc", "NO_ISRC"),
                "durationInMillis": apple_duration_ms,
                "durationFormatted": f"{apple_duration_ms // 60000:02d}:{(apple_duration_ms // 1000) % 60:02d}",
                "albumName": attributes.get("albumName", "Unknown Album"),
                "releaseDate": attributes.get("releaseDate", "Unknown Date"),
                # Join the list of genres into a single string separated by pipes
                "genres": " | ".join(attributes.get("genreNames", [])),
                "artwork_url": artwork_url
            }
        
        print("  No candidates passed the heuristic validation.")
        return None

    except Exception as e:
        print(f"Request error for '{query}': {e}")
        return None

# ==========================================
# MAIN EXECUTION
# ==========================================
def process_single_track():
    print("Generating Developer Token...")
    token = generate_developer_token()
    
    # Initialize the CSV file with headers if it doesn't exist
    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write("Query,SongID,ISRC,DurationMs,DurationFormatted,Name,Artist,Album,ReleaseDate,Genres,PreviewURL,ArtworkURL,AppleMusicURL\n")
            
    print(f"Starting processing for file: {FILENAME}...")

    # Extract the filename without extension to use as the search query
    query, _ = os.path.splitext(FILENAME)

    print(f"Searching Apple Music for query: '{query}'")
    result = search_track(query, token, LOCAL_DURATION_MS)
    
    with open(OUTPUT_FILE, "a", encoding="utf-8") as outfile:
        if result:
            # Escape double quotes inside strings for valid CSV generation
            safe_name = result['name'].replace('"', '""')
            safe_artist = result['artist'].replace('"', '""')
            safe_album = result['albumName'].replace('"', '""')
            
            csv_line = f'"{query}","{result["id"]}","{result["isrc"]}","{result["durationInMillis"]}","{result["durationFormatted"]}","{safe_name}","{safe_artist}","{safe_album}","{result["releaseDate"]}","{result["genres"]}","{result["preview"]}","{result["artwork_url"]}","{result["url"]}"\n'
            outfile.write(csv_line)
            print(f"MATCH: {query} -> ID: {result['id']}")
        else:
            # Write an empty row for tracks not found, preserving the column count
            outfile.write(f'"{query}","NOT_FOUND","","","","","","","","","","",""\n')
            print(f"MISS: {query}")

    print(f"Processing complete. Results saved in: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_single_track()

import pymysql
import re
import json
import random

DB_HOST = "localhost"
DB_USER = "resomix_user"
DB_PASS = "resomix_prod"
DB_NAME = "resomix_prod"

PATHS = [
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Dj_Chart",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/LOSSLESS",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BUZZ_PLAYLIST",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/EXCLUSIVES/FRESH_Exclusives_(bonus_section)/BONUS_SECTION",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/EXCLUSIVES/Label_Discography_(bonus_section)",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/POPULAR/Shops_Section",
    "veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Charts",
    "veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Essential_House"
]

def get_format_pattern(filename):
    """
    Abstracts a filename to its structural pattern.
    Example: '01. Artist Name - Track Title (Mix)' -> 'NN. A A - A A (A)'
    """
    name = filename.rsplit('.', 1)[0]
    name = re.sub(r'[a-zA-Z]+', 'A', name)
    name = re.sub(r'[0-9]+', 'N', name)
    return name

def select_diverse_tracks_from_db():
    collections = {p: {} for p in PATHS}
    
    print("Connecting to database to fetch tracks...")
    # Using SSDictCursor (Server-Side Cursor) prevents loading all 2.3M rows into memory at once
    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        cursorclass=pymysql.cursors.SSDictCursor
    )
    
    try:
        with connection.cursor() as cursor:
            print("Querying all file paths from DB. This will stream results dynamically...")
            query = "SELECT file_path FROM tracks"
            cursor.execute(query)
            
            count = 0
            while True:
                row = cursor.fetchone()
                if not row:
                    break
                
                count += 1
                if count % 100000 == 0:
                    print(f"  Processed {count} rows...")
                    
                full_path = row['file_path']
                
                # Check if this track belongs to one of our target paths
                for p in PATHS:
                    if full_path.startswith(p):
                        filename = full_path.split('/')[-1]
                        
                        # Ignore AppleDouble hidden files
                        if filename.startswith("._"):
                            break
                            
                        pattern = get_format_pattern(filename)
                        
                        if pattern not in collections[p]:
                            collections[p][pattern] = []
                        collections[p][pattern].append(full_path)
                        break
    finally:
        connection.close()

    print("Finished fetching and grouping. Selecting diverse tracks...")
    final_selection = []
    
    for p in PATHS:
        patterns = list(collections[p].keys())
        random.shuffle(patterns)
        
        selected_for_path = []
        
        # First pass: try to pick 1 track from each unique pattern
        for pat in patterns:
            track = random.choice(collections[p][pat])
            selected_for_path.append(track)
            if len(selected_for_path) == 25:
                break
                
        # Second pass: If we still need more tracks, pick randomly from the remaining tracks
        if len(selected_for_path) < 25:
            remaining_tracks = []
            for pat in patterns:
                for track in collections[p][pat]:
                    if track not in selected_for_path:
                        remaining_tracks.append(track)
            
            random.shuffle(remaining_tracks)
            needed = 25 - len(selected_for_path)
            selected_for_path.extend(remaining_tracks[:needed])
            
        final_selection.extend(selected_for_path)
        
    print(f"Selected {len(final_selection)} tracks in total.")
    
    output_file = "scripts/apple_music_tracks_selection.json"
    with open(output_file, "w", encoding="utf-8") as out:
        # Crucial: ensure_ascii=False avoids escaping characters like \u00e9, keeping them intact for precise DB lookups later!
        json.dump(final_selection, out, indent=4, ensure_ascii=False)
        
    print(f"Output saved to {output_file}. You can now safely run python3 scripts/apple_music_test.py!")

if __name__ == '__main__':
    select_diverse_tracks_from_db()

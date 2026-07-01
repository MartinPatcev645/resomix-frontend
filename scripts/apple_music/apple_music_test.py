import os
import time
import jwt
import requests
import json
import csv
import re
import glob
from rapidfuzz import fuzz
from dotenv import load_dotenv

# Standalone script. Sensitive config lives in scripts/.env (one level up from this folder).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, "..", ".env"))

# ==========================================
# CONFIGURATION (Apple creds come from scripts/.env)
# ==========================================
TEAM_ID = os.getenv("APPLE_TEAM_ID", "")
KEY_ID = os.getenv("APPLE_KEY_ID", "")
PRIVATE_KEY_PATH = os.getenv("APPLE_PRIVATE_KEY_PATH", "../../creds/AuthKey.p8")
STOREFRONT = os.getenv("APPLE_STOREFRONT", "us")

FILENAME = "Tim Green - Old Sunshine"   # used only when USE_JSON_LIST = False (single-track test)

USE_JSON_LIST = False
# The JSON (produced by select_diverse_tracks_db.py / enrich_selection_from_db.py) carries all
# the metadata (title/artists/duration/file_path) — this matcher makes NO DB calls. Lives here.
JSON_FILE_PATH = os.path.join(SCRIPT_DIR, "apple_music_tracks_selection.json")
# Results are versioned: results.csv, then results_1.csv, results_2.csv, ... (never overwritten).
RESULTS_DIR = SCRIPT_DIR


def next_results_path(folder):
    """Return the next unused results file: results.csv, else results_<max+1>.csv."""
    nums = []
    for f in glob.glob(os.path.join(folder, "results*.csv")):
        b = os.path.basename(f)
        if b == "results.csv":
            nums.append(0)
        else:
            mo = re.match(r"results_(\d+)\.csv$", b)
            if mo:
                nums.append(int(mo.group(1)))
    if not nums:
        return os.path.join(folder, "results.csv")
    return os.path.join(folder, f"results_{max(nums) + 1}.csv")

# ==========================================
# MATCHER TUNING
# ==========================================
SEARCH_LIMIT = 5           # fetch top-N candidates and score them (not just #1)
FUZZY_THRESHOLD = 85       # min token_set_ratio on "artist title" for a title/artist match
DURATION_TOLERANCE_MS = 10000  # ±10s when artist+title match (relaxed, as requested)

# "(Original Mix)" / "(Extended Mix)" (+ version-word variants) are dropped from the SEARCH QUERY
# and from the fuzzy comparison, since Apple usually lists the plain title. We still DETECT
# extended/radio on the ORIGINAL title to drive the one-sided duration rule.
_ORIG_EXT_RE = re.compile(
    r'[\(\[]\s*(original mix|extended mix|original version|extended version)\s*[\)\]]',
    re.IGNORECASE,
)


def strip_orig_ext(s):
    """Remove generic (Original Mix)/(Extended Mix) tags; keep remixes/dubs/edits/feat."""
    return re.sub(r'\s{2,}', ' ', _ORIG_EXT_RE.sub('', s or '')).strip()


def _norm(s):
    """Normalize a string for fuzzy comparison: drop orig/ext tags, lowercase, squeeze spaces."""
    return re.sub(r'\s{2,}', ' ', strip_orig_ext(s or '')).lower().strip()

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
def _parse_candidate(song):
    """Parse one Apple Music song object into our candidate dict."""
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
        "url": attributes.get("url"),  # Deep link to Apple Music
        "constructed_url": f"https://music.apple.com/{STOREFRONT}/song/{song.get('id')}",
        "isrc": attributes.get("isrc", "NO_ISRC"),
        "durationInMillis": apple_duration_ms,
        "durationFormatted": f"{apple_duration_ms // 60000:02d}:{(apple_duration_ms // 1000) % 60:02d}",
        "albumName": attributes.get("albumName", "Unknown Album"),
        "releaseDate": attributes.get("releaseDate", "Unknown Date"),
        "genres": " | ".join(attributes.get("genreNames", [])),
        "artwork_url": artwork_url,
    }


def search_track(query, token, limit=SEARCH_LIMIT):
    """
    Search Apple Music and return the top-N candidates (parsed), so we can score/pick the
    best one ourselves instead of blindly trusting result #1 (which is often a Dub/Mixed cut).
    Returns a list of candidate dicts (possibly empty).
    """
    url = f"https://api.music.apple.com/v1/catalog/{STOREFRONT}/search"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"types": "songs", "term": query, "limit": limit}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 429:
            print("  [!] Rate limit hit. Backing off for 5 seconds...")
            time.sleep(5)
            return search_track(query, token, limit)

        response.raise_for_status()
        data = response.json()
        results = data.get("results", {}).get("songs", {}).get("data", [])
        return [_parse_candidate(song) for song in results]

    except Exception as e:
        print(f"Request error for '{query}': {e}")
        return []


def pick_best_match(candidates, q_artist, q_title, db_ms, is_ext, is_radio):
    """
    Score the candidates against our query and pick the best one.

    - Fuzzy: token_set_ratio on "artist title" (both sides normalized, orig/ext stripped).
    - Duration: extended/radio → Apple must be <= ours (+tolerance); otherwise within ±tolerance.
    A candidate "qualifies" only if BOTH the fuzzy and duration checks pass.

    Returns (best_candidate, is_match, score, rank) where is_match is True / False / None
    (None = we couldn't judge duration because our duration is missing).
    """
    q = _norm(f"{q_artist} {q_title}")
    scored = []
    for idx, c in enumerate(candidates):
        cand = _norm(f"{c.get('artist', '')} {c.get('name', '')}")
        # token_set_ratio = "is this the right base song?" (ignores extra tokens like "(Dub)",
        # so a Dub and the exact both score ~100). token_sort_ratio DOES penalise extra tokens,
        # so it discriminates versions and keeps the candidate that matches our query's version
        # (we keep the real version in the query — only Original/Extended Mix are stripped).
        score = fuzz.token_set_ratio(q, cand)
        sort_score = fuzz.token_sort_ratio(q, cand)
        a_ms = c.get("durationInMillis") or 0

        if db_ms is None:
            dur_ok = None
        elif is_ext or is_radio:
            dur_ok = a_ms <= db_ms + DURATION_TOLERANCE_MS
        else:
            dur_ok = abs(a_ms - db_ms) <= DURATION_TOLERANCE_MS

        dur_diff = abs(a_ms - db_ms) if db_ms is not None else 10 ** 12
        scored.append((c, score, dur_ok, dur_diff, idx + 1, sort_score))

    # Ranking among candidates that PASSED the duration gate (duration is primary — a high
    # fuzzy score with the wrong duration is already excluded from `qualifying`):
    #   1. token_set  (highest base-song match)
    #   2. closest duration  (duration outranks the title-version tiebreak)
    #   3. token_sort  (only used when fuzzy AND duration are effectively tied — picks the exact
    #      title over a "(Dub)"/"(Mixed)")
    def rank_key(s):
        return (s[1], -s[3], s[5])

    qualifying = [s for s in scored if s[1] >= FUZZY_THRESHOLD and s[2] is True]
    if qualifying:
        best = max(qualifying, key=rank_key)
        return best[0], True, best[1], best[4]

    # Nothing qualifies — surface the best candidate so the row is reviewable, is_match False
    # (or None when our duration is missing).
    best = max(scored, key=rank_key)
    is_match = None if db_ms is None else False
    return best[0], is_match, best[1], best[4]


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

    # Remove [Label] square-bracket segments, but KEEP version/feat info that this catalogue
    # also puts in square brackets (e.g. "[Reborn Mix]", "[Deep Mix]", "[feat. X]", "[... Rework]").
    # Heuristic: a bracket is a label unless it contains a version/feat keyword.
    keep_kw = re.compile(r'\b(mix|remix|rework|re-edit|edit|version|instrumental|dub|bootleg|vip|feat\.?|ft\.?)\b', re.IGNORECASE)
    def _strip_labels(s):
        return re.sub(r'\s*\[([^\]]*)\]', lambda m: m.group(0) if keep_kw.search(m.group(1)) else '', s)
    clean_title = _strip_labels(clean_title)

    # Drop standalone numeric disambiguators like "(2)" (Discogs artist suffixes / dedup markers).
    # These are NOT version tags like "(Original Mix)", which are preserved.
    clean_artists = re.sub(r'\s*\(\s*\d+\s*\)', '', clean_artists)
    clean_title = re.sub(r'\s*\(\s*\d+\s*\)', '', clean_title)

    # Collapse any double spaces left by the removals.
    clean_artists = re.sub(r'\s{2,}', ' ', clean_artists).strip()
    clean_title = re.sub(r'\s{2,}', ' ', clean_title).strip()

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

    output_file = next_results_path(RESULTS_DIR)
    print(f"Results will be written to: {output_file}")

    # We define the strict headers as requested by the user
    headers = [
        "in_house_query",
        "in_house_file_path",
        "is_match",
        "apple_match_score",
        "apple_chosen_rank",
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
    with open(output_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(headers)
            
    tasks = []
    if USE_JSON_LIST:
        # The JSON already carries the metadata (from select_diverse_tracks_db.py /
        # enrich_selection_from_db.py) — NO database calls here. Also tolerates the legacy
        # format (a bare list of path strings) by falling back to filename parsing.
        print(f"Loading tracks from JSON: {JSON_FILE_PATH}")
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            if isinstance(item, dict):
                path = item.get("file_path", "")
                artists = item.get("artists") or ""
                title = item.get("title") or ""
                duration_sec = item.get("duration_sec")
            else:
                path, artists, title, duration_sec = item, "", "", None

            if title:
                clean_artists, clean_title = clean_db_metadata(artists, title, path)
            else:
                # No metadata (legacy path / not in DB) -> parse the filename.
                base, _ = os.path.splitext(os.path.basename(path))
                clean_artists, clean_title = clean_db_metadata("", base, path)

            # Drop (Original Mix)/(Extended Mix) from the search + fuzzy query (Apple lists the
            # plain title); keep clean_title (with version) for the duration rule.
            q_title = strip_orig_ext(clean_title)
            query = f"{clean_artists} - {q_title}".strip(" -") if clean_artists else q_title
            tasks.append({
                "query": query,
                "path": path,
                "q_artist": clean_artists,
                "q_title": q_title,
                "db_title": clean_title,
                "db_duration_sec": duration_sec,
            })
    else:
        base, _ = os.path.splitext(FILENAME)
        clean_artists, clean_title = clean_db_metadata('', base, "")
        q_title = strip_orig_ext(clean_title)
        query = f"{clean_artists} - {q_title}".strip(" -") if clean_artists else q_title
        tasks.append({
            "query": query,
            "path": "",
            "q_artist": clean_artists,
            "q_title": q_title,
            "db_title": clean_title,
            "db_duration_sec": None
        })
            
    print(f"Starting processing for {len(tasks)} track(s)...")

    with open(output_file, "a", encoding="utf-8", newline="") as outfile:
        writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
        
        for idx, task in enumerate(tasks):
            query = task['query']
            path = task['path']
            print(f"[{idx+1}/{len(tasks)}] Searching Apple Music for query: '{query}'")
            candidates = search_track(query, token)

            in_house_duration = format_seconds_to_mmss(task['db_duration_sec'])
            db_ms = int(float(task['db_duration_sec']) * 1000) if task['db_duration_sec'] is not None else None
            in_house_duration_ms = db_ms if db_ms is not None else ""

            # Detect version on the ORIGINAL (un-stripped) title for the one-sided duration rule.
            low = (task['db_title'] or '').lower()
            is_ext = ("extended mix" in low) or ("extended remix" in low)
            is_radio = "radio edit" in low

            if candidates:
                best, is_match_bool, score, rank = pick_best_match(
                    candidates, task['q_artist'], task['q_title'], db_ms, is_ext, is_radio
                )
                is_match = {True: "True", False: "False", None: "N/A"}[is_match_bool]
                apple_duration_ms = best.get('durationInMillis', 0)
                row = [
                    query,
                    path,
                    is_match,
                    round(score, 1),
                    rank,
                    best["id"],
                    best["isrc"],
                    in_house_duration,
                    best["durationFormatted"],
                    best["name"],
                    best["artist"],
                    best["albumName"],
                    best["releaseDate"],
                    best["genres"],
                    best["constructed_url"],
                    best["preview"],
                    best["artwork_url"],
                    best["url"],
                    in_house_duration_ms,
                    apple_duration_ms
                ]
                writer.writerow(row)
                print(f"  -> MATCH r{rank} score={score:.0f} IsMatch={is_match}: {best['artist']} - {best['name']}")
            else:
                # Write an empty row for tracks not found, preserving the column count
                row = [
                    query,
                    path,
                    "N/A",
                    "",  # match_score
                    "",  # chosen_rank
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

    print(f"Processing complete. Results saved in: {output_file}")

if __name__ == "__main__":
    process_tracks()

import os
import time
import jwt
import requests
import json
import csv
import re
import glob
import unicodedata
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

USE_JSON_LIST = True
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

# NOTE: title/artist are used AS-IS from the database (no cleanup). "(Original Mix)"/"(Extended
# Mix)" are removed ONLY for the fuzzy comparison and for detecting the extended/radio one-sided
# duration rule — never from the stored metadata.
_ORIG_EXT_RE = re.compile(
    r'[\(\[]\s*(original mix|extended mix|original version|extended version)\s*[\)\]]',
    re.IGNORECASE,
)


def strip_orig_ext(s):
    """Remove generic (Original Mix)/(Extended Mix) tags; keep remixes/dubs/edits/feat."""
    return re.sub(r'\s{2,}', ' ', _ORIG_EXT_RE.sub('', s or '')).strip()


def clean_unicode(s):
    """NFC-compose (so 'É' is a single codepoint, more likely to match Apple) and drop invisible
    format characters (zero-width spaces etc., Unicode category 'Cf'). Low-priority hardening."""
    s = unicodedata.normalize('NFC', s or '')
    return ''.join(ch for ch in s if unicodedata.category(ch) != 'Cf')


def _norm(s):
    """Normalize for fuzzy comparison only: unicode-clean, drop orig/ext, lowercase, squeeze."""
    s = strip_orig_ext(clean_unicode(s))
    return re.sub(r'\s{2,}', ' ', s).lower().strip()


def title_numbers(s):
    """Set of integer tokens in a title. Numbers in titles are meaningful ('123 BPM' vs '115 Bpm',
    '2Ms', '2 + 2 = 5'), so a number mismatch means a different track."""
    return set(int(n) for n in re.findall(r'\d+', clean_unicode(s or '')))


def parse_from_filename(path):
    """Extract (artist, title) from a filename when the DB metadata has no real artist.
    Filename form is "Artist - Title.ext". A leading track number is removed ONLY when it is
    "N. " (number, dot, space) or "N - " (number, spaced dash) — so an artist that legitimately
    starts with a number (e.g. "20 Dub Person", "01 -Artist") is left intact. Then split on the
    first " - " into artist / title."""
    base = os.path.splitext(os.path.basename(path))[0]
    base = re.sub(r'^\d+\.\s+', '', base)      # "33. Deadfunk..." -> "Deadfunk..."
    base = re.sub(r'^\d+\s+-\s+', '', base)    # "01 - Artist..."  -> "Artist..."
    base = base.strip()
    if ' - ' in base:
        artist, title = base.split(' - ', 1)
        return artist.strip(), title.strip()
    return '', base

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
    Score the candidates and pick the best.

    - Fuzzy: token_set_ratio on "artist title" (compared unicode-cleaned & orig/ext-stripped).
    - Numbers: integer tokens in the title must match (a number mismatch = a different track).
    - Duration: STRICT — |apple - ours| <= tolerance. Exception: if OUR title says Extended Mix /
      Extended Remix / Radio Edit, Apple's shorter cut is acceptable (apple <= ours + tolerance),
      because that's the same song's shorter edit. Otherwise a different duration = different track.
    A candidate "qualifies" only if fuzzy AND numbers AND duration all pass.

    Returns (best_candidate, is_match, score, rank, scored) where is_match is True / False / None
    (None = our duration was missing) and `scored` is the per-candidate detail list (for display).
    """
    q = _norm(f"{q_artist} {q_title}")
    q_nums = title_numbers(q_title)
    scored = []
    for idx, c in enumerate(candidates):
        cand = _norm(f"{c.get('artist', '')} {c.get('name', '')}")
        # token_set_ratio = "is this the right base song?" (ignores extra tokens like "(Dub)");
        # token_sort_ratio DOES penalise extra tokens, so it discriminates versions (tiebreak only).
        # We also take a whitespace-insensitive ratio (spaces stripped) and keep the higher score,
        # so punctuation-spacing quirks like "2 + 2 = 5" vs "2+2=5" don't tank an otherwise-exact
        # match. Taking the max only ever RAISES a score, so nothing that matched before regresses.
        score = max(
            fuzz.token_set_ratio(q, cand),
            fuzz.ratio(q.replace(" ", ""), cand.replace(" ", "")),
        )
        sort_score = fuzz.token_sort_ratio(q, cand)
        a_ms = c.get("durationInMillis") or 0

        if db_ms is None:
            dur_ok = None
        elif is_ext or is_radio:
            # our track is the long/edit-marked version -> Apple's shorter cut is acceptable
            dur_ok = a_ms <= db_ms + DURATION_TOLERANCE_MS
        else:
            dur_ok = abs(a_ms - db_ms) <= DURATION_TOLERANCE_MS

        num_ok = (title_numbers(c.get("name", "")) == q_nums)
        dur_diff = abs(a_ms - db_ms) if db_ms is not None else 10 ** 12
        scored.append({
            "cand": c, "score": score, "sort": sort_score,
            "dur_ok": dur_ok, "dur_diff": dur_diff, "num_ok": num_ok, "rank": idx + 1,
        })

    # Selection priority: numbers match -> token_set -> closest duration -> token_sort.
    def rank_key(s):
        return (s["num_ok"], s["score"], -s["dur_diff"], s["sort"])

    qualifying = [s for s in scored
                  if s["score"] >= FUZZY_THRESHOLD and s["dur_ok"] is True and s["num_ok"]]
    if qualifying:
        best = max(qualifying, key=rank_key)
        return best["cand"], True, best["score"], best["rank"], scored

    # Nothing qualifies — surface the best candidate so the row is reviewable, is_match False
    # (or None when our duration is missing).
    best = max(scored, key=rank_key)
    is_match = None if db_ms is None else False
    return best["cand"], is_match, best["score"], best["rank"], scored


# ==========================================
# FORMATTING HELPERS
# ==========================================
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
        # The JSON carries the DB metadata (title/artists/duration/file_path). We use title and
        # artists EXACTLY as they are in the database — NO cleanup — and build the query from them.
        # NO database calls here.
        print(f"Loading tracks from JSON: {JSON_FILE_PATH}")
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            if isinstance(item, dict):
                path = item.get("file_path", "")
                artists = (item.get("artists") or "").strip()
                title = (item.get("title") or "").strip()
                duration_sec = item.get("duration_sec")
            else:
                # Legacy bare-path fallback (our JSON is enriched, so rarely used).
                path = item
                artists = ""
                title = ""
                duration_sec = None

            # If the DB has no real artist ("Unknown"/empty), extract artist + title from the
            # filename. Otherwise the DB values are used exactly as-is.
            if not artists or artists.lower() == "unknown":
                artists, title = parse_from_filename(path)

            # Query = DB "artists - title". Only generic (Original/Extended Mix) is removed from
            # the search term (Apple lists the plain title); everything else is used AS-IS.
            search_title = strip_orig_ext(title)
            query = clean_unicode(f"{artists} - {search_title}".strip(" -") if artists else search_title)
            tasks.append({
                "query": query,
                "path": path,
                "q_artist": artists,
                "q_title": title,
                "db_title": title,
                "db_duration_sec": duration_sec,
            })
    else:
        # Single-track test: FILENAME is "Artist - Title".
        if " - " in FILENAME:
            artists, title = FILENAME.split(" - ", 1)
        else:
            artists, title = "", FILENAME
        artists, title = artists.strip(), title.strip()
        search_title = strip_orig_ext(title)
        query = clean_unicode(f"{artists} - {search_title}".strip(" -") if artists else search_title)
        tasks.append({
            "query": query,
            "path": "",
            "q_artist": artists,
            "q_title": title,
            "db_title": title,
            "db_duration_sec": None,
        })
            
    print(f"Starting processing for {len(tasks)} track(s)...")

    with open(output_file, "a", encoding="utf-8", newline="") as outfile:
        writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
        
        for idx, task in enumerate(tasks):
            query = task['query']
            path = task['path']

            in_house_duration = format_seconds_to_mmss(task['db_duration_sec'])
            db_ms = int(float(task['db_duration_sec']) * 1000) if task['db_duration_sec'] is not None else None
            in_house_duration_ms = db_ms if db_ms is not None else ""

            print(f"[{idx+1}/{len(tasks)}] Query: '{query}'  (our duration {in_house_duration or '--:--'})")
            candidates = search_track(query, token)

            # Detect version on the title for the one-sided duration rule.
            low = (task['db_title'] or '').lower()
            is_ext = ("extended mix" in low) or ("extended remix" in low)
            is_radio = "radio edit" in low

            if candidates:
                best, is_match_bool, score, rank, scored = pick_best_match(
                    candidates, task['q_artist'], task['q_title'], db_ms, is_ext, is_radio
                )
                is_match = {True: "True", False: "False", None: "N/A"}[is_match_bool]

                # 5 lines: each Apple candidate — artist/title/duration, fuzzy, duration & number check.
                for s in scored:
                    c = s['cand']
                    dur_flag = {True: "dur:OK", False: "dur:NO", None: "dur:? "}[s['dur_ok']]
                    num_flag = "num:OK" if s['num_ok'] else "num:NO"
                    marker = "*" if s['rank'] == rank else " "
                    print(f"   {marker}r{s['rank']} {c['artist']} - {c['name']} ({c['durationFormatted']})"
                          f"  fuzzy={s['score']:>3.0f}  {dur_flag}  {num_flag}")
                for k in range(len(scored) + 1, SEARCH_LIMIT + 1):  # pad if Apple returned fewer than 5
                    print(f"    r{k} -")

                # 7th line: the verdict.
                if is_match_bool is True:
                    print(f"   => MATCHED r{rank}: {best['artist']} - {best['name']}  (fuzzy={score:.0f})")
                elif is_match_bool is False:
                    print(f"   => NO MATCH (best was r{rank}, fuzzy={score:.0f}) — failed number/duration gate")
                else:
                    print(f"   => UNVERIFIED r{rank} (our duration missing)")

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
                for k in range(1, SEARCH_LIMIT + 1):
                    print(f"    r{k} -")
                writer.writerow(row)
                print("   => NOTHING FOUND (no candidates from Apple)")

    print(f"Processing complete. Results saved in: {output_file}")

if __name__ == "__main__":
    process_tracks()

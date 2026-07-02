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

FILENAME = "Greg Gould, Inaya Day, Milk, Sugar - Love Like This (Extended Dub Mix)"   # used only when USE_JSON_LIST = False (single-track test)

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

# A near-exact duration (±2s) is near-proof it's the same track. Such a candidate is accepted with
# a RELAXED fuzzy bar, and among several ±2s candidates the closest duration wins (over raw fuzzy).
TIGHT_DURATION_MS = 2000   # ±2s
RELAXED_FUZZY = 80         # min fuzzy for a ±2s duration-confirmed match

# --- HTTP resilience: retry transient failures (timeouts, connection resets, 429, 5xx) ---
HTTP_TIMEOUT = 15          # seconds per request
HTTP_MAX_RETRIES = 4       # attempts before giving up on a query
HTTP_BACKOFF_BASE = 2      # seconds; wait = base * attempt (linear backoff)

# --- Phase 2: after the first pass, retry the N/A (nothing-found) tracks with query variants ---
RETRY_NA = True

# Live counters (read by the production runner run_apple_matching.py for throughput / rate-limit
# estimates). Every Apple request increments these.
STATS = {"requests": 0, "rate_limited": 0, "server_errors": 0,
         "network_errors": 0, "backoff_seconds": 0.0}

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


# Apple's continuous-mix marker, a standalone bracketed "[Mixed]" / "(Mixed)" tag (a DJ-mix cut,
# usually a shorter edit) — NOT the same as "... Mix" inside a remix name.
_MIXED_TAG_RE = re.compile(r'[\(\[]\s*mixed\s*[\)\]]', re.IGNORECASE)
# Standalone word "extended" (e.g. inside "(Extended Sunshine Mix)").
_EXTENDED_WORD_RE = re.compile(r'\bextended\b', re.IGNORECASE)
# Split a multi-artist string into individual artists.
_ARTIST_SPLIT_RE = re.compile(r'\s*,\s*|\s*&\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+with\s+', re.IGNORECASE)


def is_extended(title):
    """True if the title marks an extended cut anywhere (Extended Mix / Extended Remix /
    Extended <anything> Mix). Drives the one-sided duration rule."""
    return "extended" in (title or "").lower()


def build_search_query(artists, title):
    """Search term from DB artist/title. Removes generic (Original/Extended Mix) AND the standalone
    word 'extended' (so '(Extended Sunshine Mix)' -> '(Sunshine Mix)'); everything else is AS-IS.
    NOTE: 'extended' is dropped only from the SEARCH term — it is kept for the fuzzy comparison so
    an Apple candidate that IS the extended cut is preferred."""
    st = re.sub(r'\s{2,}', ' ', _EXTENDED_WORD_RE.sub('', strip_orig_ext(title))).strip()
    q = f"{artists} - {st}".strip(" -") if artists else st
    return clean_unicode(q)


def split_artists(artists):
    """['Nagano Kitchen', 'Hideo Kobayas'] from 'Nagano Kitchen, Hideo Kobayas'."""
    return [a.strip() for a in _ARTIST_SPLIT_RE.split(artists or "") if a.strip()]


def retry_queries(task):
    """Alternative search terms to try (in order) for a track that returned NOTHING on the first
    pass. (a) the full raw title (restores 'extended' etc. we stripped); (b) one artist at a time
    (Apple often indexes a multi-artist track under just one name). Skips the original query."""
    q_artist = task["q_artist"]
    db_title = task["db_title"]
    alts = [("full-title (extended restored)",
             clean_unicode(f"{q_artist} - {db_title}".strip(" -") if q_artist else db_title))]
    st = build_search_query("", db_title)  # title only, stripped
    for a in split_artists(q_artist):
        alts.append((f"artist='{a}'", clean_unicode(f"{a} - {st}".strip(" -"))))
    seen, out = {task["query"]}, []
    for label, q in alts:
        if q and q not in seen:
            seen.add(q)
            out.append((label, q))
    return out


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

    last_err = None
    for attempt in range(1, HTTP_MAX_RETRIES + 1):
        try:
            STATS["requests"] += 1
            response = requests.get(url, headers=headers, params=params, timeout=HTTP_TIMEOUT)

            # 429 rate limit — honour Retry-After if present, else linear backoff.
            if response.status_code == 429:
                wait = int(response.headers.get("Retry-After") or HTTP_BACKOFF_BASE * attempt)
                STATS["rate_limited"] += 1
                STATS["backoff_seconds"] += wait
                print(f"  [!] 429 rate limit; waiting {wait}s (attempt {attempt}/{HTTP_MAX_RETRIES})")
                time.sleep(wait)
                continue
            # 5xx server errors — transient, retry.
            if 500 <= response.status_code < 600:
                wait = HTTP_BACKOFF_BASE * attempt
                STATS["server_errors"] += 1
                STATS["backoff_seconds"] += wait
                print(f"  [!] server error {response.status_code}; retry in {wait}s "
                      f"(attempt {attempt}/{HTTP_MAX_RETRIES})")
                time.sleep(wait)
                continue

            response.raise_for_status()
            data = response.json()
            results = data.get("results", {}).get("songs", {}).get("data", [])
            return [_parse_candidate(song) for song in results]

        except (requests.exceptions.Timeout,
                requests.exceptions.ConnectionError,
                requests.exceptions.ChunkedEncodingError) as e:
            # Network hiccup (read timeout, connection reset, etc.) — retry with backoff.
            last_err = e
            wait = HTTP_BACKOFF_BASE * attempt
            STATS["network_errors"] += 1
            STATS["backoff_seconds"] += wait
            print(f"  [!] network error ({type(e).__name__}); retry in {wait}s "
                  f"(attempt {attempt}/{HTTP_MAX_RETRIES})")
            time.sleep(wait)
        except requests.exceptions.RequestException as e:
            last_err = e
            wait = HTTP_BACKOFF_BASE * attempt
            print(f"  [!] request error ({e}); retry in {wait}s "
                  f"(attempt {attempt}/{HTTP_MAX_RETRIES})")
            time.sleep(wait)

    print(f"  [x] giving up on '{query}' after {HTTP_MAX_RETRIES} attempts: {last_err}")
    return []


def pick_best_match(candidates, q_artist, q_title, db_ms, is_ext, is_radio):
    """
    Score the candidates and pick the best.

    - Fuzzy: token_set_ratio on "artist title" (compared unicode-cleaned & orig/ext-stripped).
    - Numbers: integer tokens in the title must match (a number mismatch = a different track).
    - Duration: STRICT — |apple - ours| <= tolerance. Exceptions where a SHORTER Apple cut is
      accepted: (a) OUR title says Extended / Radio Edit (we hold the long version); (b) the title
      is essentially IDENTICAL (perfect fuzzy) — a perfect-name match that's merely shorter is the
      same track's shorter cut. A LONGER Apple track is never accepted on these exceptions.
    - Continuous-mix "[Mixed]" cuts are DEPRIORITISED when our query has no such tag.
    A candidate "qualifies" only if fuzzy AND numbers AND duration all pass.

    Returns (best_candidate, is_match, score, rank, scored) where is_match is True / False / None
    (None = our duration was missing) and `scored` is the per-candidate detail list (for display).
    """
    q = _norm(f"{q_artist} {q_title}")
    q_nums = title_numbers(q_title)
    q_has_mixed = bool(_MIXED_TAG_RE.search(q_title or ""))
    scored = []
    for idx, c in enumerate(candidates):
        name = c.get("name", "")
        cand = _norm(f"{c.get('artist', '')} {name}")
        # token_set_ratio = "is this the right base song?" (ignores extra tokens like "(Dub)");
        # token_sort_ratio DOES penalise extra AND missing tokens, so it discriminates versions
        # (e.g. "Good Inside" vs "Inside", or a "[Mixed]" cut) — used as a ranking key, not a gate.
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
        else:
            within = abs(a_ms - db_ms) <= DURATION_TOLERANCE_MS
            apple_shorter = a_ms <= db_ms + DURATION_TOLERANCE_MS   # Apple not longer than ours
            perfect_title = score == 100 and sort_score >= 95       # essentially identical title
            dur_ok = within or (apple_shorter and (is_ext or is_radio or perfect_title))

        num_ok = (title_numbers(name) == q_nums)
        # Apple's "[Mixed]"/"(Mixed)" continuous-mix cut, when our title has no such tag.
        mixed_only = bool(_MIXED_TAG_RE.search(name)) and not q_has_mixed
        dur_diff = abs(a_ms - db_ms) if db_ms is not None else 10 ** 12
        scored.append({
            "cand": c, "score": score, "sort": sort_score, "dur_ok": dur_ok,
            "dur_diff": dur_diff, "num_ok": num_ok, "mixed_only": mixed_only, "rank": idx + 1,
        })

    def is_tight(s):
        """Near-exact duration (±2s) with at least a relaxed fuzzy — duration-confirmed."""
        return s["num_ok"] and s["dur_diff"] <= TIGHT_DURATION_MS and s["score"] >= RELAXED_FUZZY

    # Selection priority:
    #   numbers match -> ±2s duration-confirmed (then CLOSEST duration) -> NOT a "[Mixed]" cut
    #   -> token_set -> closest duration -> token_sort.
    # The ±2s block puts a duration-confirmed candidate first and orders those by closest duration,
    # so an exact-length "[Extended Version]" beats a higher-fuzzy but different "Extended Remix".
    def rank_key(s):
        tight = is_tight(s)
        return (
            s["num_ok"],
            tight,
            -s["dur_diff"] if tight else 0,   # among ±2s candidates, closest duration wins
            not s["mixed_only"],
            s["score"],
            -s["dur_diff"],
            s["sort"],
        )

    def qualifies(s):
        if not s["num_ok"]:
            return False
        if s["score"] >= FUZZY_THRESHOLD and s["dur_ok"] is True:
            return True                       # normal: strong fuzzy + duration gate
        return is_tight(s)                    # relaxed: a ±2s duration match (fuzzy >= 78)

    qualifying = [s for s in scored if qualifies(s)]
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


CSV_HEADERS = [
    "in_house_query", "in_house_file_path", "is_match", "apple_match_score", "apple_chosen_rank",
    "apple_song_id", "apple_isrc", "in_house_duration", "apple_duration", "apple_name",
    "apple_artist", "apple_album", "apple_release_date", "apple_genres", "apple_music_url",
    "apple_preview_url", "apple_artwork_url", "apple_deep_link_url",
    "in_house_duration_ms", "apple_duration_ms",
]


def eval_query(query, q_artist, q_title, db_ms, is_ext, is_radio, token):
    """Search Apple for `query`, score the candidates, and return a result dict."""
    candidates = search_track(query, token)
    if not candidates:
        return {"query": query, "found": False, "best": None,
                "is_match": None, "score": None, "rank": None, "scored": []}
    best, is_match, score, rank, scored = pick_best_match(
        candidates, q_artist, q_title, db_ms, is_ext, is_radio)
    return {"query": query, "found": True, "best": best,
            "is_match": is_match, "score": score, "rank": rank, "scored": scored}


def render_result(res, indent="   "):
    """Print the 5 candidate lines + the verdict line for one search result."""
    if not res["found"]:
        for k in range(1, SEARCH_LIMIT + 1):
            print(f"{indent} r{k} -")
        print(f"{indent}=> NOTHING FOUND (no candidates from Apple)")
        return
    rank = res["rank"]
    for s in res["scored"]:
        c = s["cand"]
        dur_flag = {True: "dur:OK", False: "dur:NO", None: "dur:? "}[s["dur_ok"]]
        num_flag = "num:OK" if s["num_ok"] else "num:NO"
        mix_flag = "  [Mixed]" if s.get("mixed_only") else ""
        marker = "*" if s["rank"] == rank else " "
        print(f"{indent}{marker}r{s['rank']} {c['artist']} - {c['name']} ({c['durationFormatted']})"
              f"  fuzzy={s['score']:>3.0f}  {dur_flag}  {num_flag}{mix_flag}")
    for k in range(len(res["scored"]) + 1, SEARCH_LIMIT + 1):
        print(f"{indent} r{k} -")
    im, best, score = res["is_match"], res["best"], res["score"]
    if im is True:
        print(f"{indent}=> MATCHED r{rank}: {best['artist']} - {best['name']}  (fuzzy={score:.0f})")
    elif im is False:
        print(f"{indent}=> NO MATCH (best was r{rank}, fuzzy={score:.0f}) — failed number/duration gate")
    else:
        print(f"{indent}=> UNVERIFIED r{rank} (our duration missing)")


def build_row(task, res, in_house_duration, in_house_duration_ms):
    """Assemble one CSV row from a task + its (possibly retried) result."""
    if not res["found"]:
        return [res["query"], task["path"], "N/A", "", "", "NOT_FOUND", "", in_house_duration,
                "", "", "", "", "", "", "", "", "", "", in_house_duration_ms, ""]
    best = res["best"]
    is_match = {True: "True", False: "False", None: "N/A"}[res["is_match"]]
    return [
        res["query"], task["path"], is_match, round(res["score"], 1), res["rank"],
        best["id"], best["isrc"], in_house_duration, best["durationFormatted"], best["name"],
        best["artist"], best["albumName"], best["releaseDate"], best["genres"],
        best["constructed_url"], best["preview"], best["artwork_url"], best["url"],
        in_house_duration_ms, best.get("durationInMillis", 0),
    ]


# ==========================================
# MAIN EXECUTION
# ==========================================
def process_tracks():
    print("Generating Developer Token...")
    token = generate_developer_token()

    output_file = next_results_path(RESULTS_DIR)
    print(f"Results will be written to: {output_file}")

    # (CSV columns are defined once in CSV_HEADERS, written at the end.)
    
    # (header + rows are written at the very end, after the phase-2 retries)
            
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

            # Query via build_search_query: drops generic (Original/Extended Mix) + the word
            # "extended" from the SEARCH term (Apple lists the plain title); everything else AS-IS.
            query = build_search_query(artists, title)
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
        query = build_search_query(artists, title)
        tasks.append({
            "query": query,
            "path": "",
            "q_artist": artists,
            "q_title": title,
            "db_title": title,
            "db_duration_sec": None,
        })

    # --- Per-track context (duration + version flags) computed once, reused in retries. ---
    for task in tasks:
        db_ms = int(float(task["db_duration_sec"]) * 1000) if task["db_duration_sec"] is not None else None
        title_low = (task["db_title"] or "").lower()
        task["_ctx"] = {
            "db_ms": db_ms,
            "in_house_duration": format_seconds_to_mmss(task["db_duration_sec"]),
            "in_house_duration_ms": db_ms if db_ms is not None else "",
            "is_ext": is_extended(task["db_title"]),
            "is_radio": "radio edit" in title_low,
        }

    print(f"Starting processing for {len(tasks)} track(s)...")

    # --- Phase 1: search every track once. ---
    results = []
    for idx, task in enumerate(tasks):
        ctx = task["_ctx"]
        print(f"[{idx+1}/{len(tasks)}] Query: '{task['query']}'  "
              f"(our duration {ctx['in_house_duration'] or '--:--'})")
        res = eval_query(task["query"], task["q_artist"], task["q_title"],
                         ctx["db_ms"], ctx["is_ext"], ctx["is_radio"], token)
        render_result(res)
        results.append(res)

    # --- Phase 2: retry the tracks that found NOTHING, with query variants (one by one). ---
    if RETRY_NA:
        na_idx = [i for i, r in enumerate(results) if not r["found"]]
        if na_idx:
            print(f"\n=== Phase 2: retrying {len(na_idx)} N/A track(s) with query variants ===")
            for i in na_idx:
                task = tasks[i]
                ctx = task["_ctx"]
                print(f"\n[retry {i+1}/{len(tasks)}] original: '{task['query']}'")
                for label, altq in retry_queries(task):
                    print(f"   -- trying ({label}): '{altq}'")
                    r2 = eval_query(altq, task["q_artist"], task["q_title"],
                                    ctx["db_ms"], ctx["is_ext"], ctx["is_radio"], token)
                    render_result(r2, indent="      ")
                    if r2["is_match"] is True:
                        results[i] = r2
                        print(f"   ++ retry SUCCESS — adopting this match")
                        break

    # --- Write header + all rows once (final, post-retry). ---
    with open(output_file, "w", encoding="utf-8", newline="") as outfile:
        writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
        writer.writerow(CSV_HEADERS)
        for task, res in zip(tasks, results):
            ctx = task["_ctx"]
            writer.writerow(build_row(task, res, ctx["in_house_duration"], ctx["in_house_duration_ms"]))

    matched = sum(1 for r in results if r["is_match"] is True)
    na = sum(1 for r in results if not r["found"])
    print(f"\nProcessing complete. Results saved in: {output_file}")
    print(f"  matched(True)={matched}  N/A(not found)={na}  of {len(results)} tracks")

if __name__ == "__main__":
    process_tracks()

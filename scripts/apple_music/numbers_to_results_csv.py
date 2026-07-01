"""
Convert the client-facing results.numbers (Apple Numbers) file into a plain results.csv.

Purpose: results.numbers holds our FIRST matcher run (the "before changes" version — limit 1,
DB artist+title query, plain duration match). We want that same data as scripts/apple_music/
results.csv so compare_results.py can score it alongside the newer results_*.csv runs.

Standalone. Requires: pip install numbers-parser

Numbers stores every numeric cell as a float, so it turns apple_song_id 1724739882 into
1724739882.0 and the *_ms columns into floats. We normalise integral floats back to plain ints
(otherwise song-id comparison would never match). Columns are mapped BY NAME into the canonical
results-CSV order, so a different column order inside the .numbers file doesn't matter.
"""
import os
import csv

from numbers_parser import Document

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# results.numbers lives at the repo root (two levels up from scripts/apple_music/).
NUMBERS_FILE = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "results.numbers"))
OUTPUT_CSV = os.path.join(SCRIPT_DIR, "results.csv")
TABLE_NAME = "results"  # the sheet's table; we fall back to the first table if not found

# Canonical old-format column order (matches results_old.csv). The .numbers columns are mapped
# into this order by header name; any missing column is emitted blank.
CANONICAL_COLUMNS = [
    "in_house_query", "in_house_file_path", "is_match",
    "apple_song_id", "apple_isrc", "in_house_duration", "apple_duration",
    "apple_name", "apple_artist", "apple_album", "apple_release_date", "apple_genres",
    "apple_music_url", "apple_preview_url", "apple_artwork_url", "apple_deep_link_url",
    "in_house_duration_ms", "apple_duration_ms",
]


def norm_cell(v):
    """Numbers -> CSV text. Integral floats (ids, *_ms) become plain ints; None -> ''."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "True" if v else "False"
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    if isinstance(v, int):
        return str(v)
    return str(v).strip()


def pick_table(doc):
    for sheet in doc.sheets:
        for table in sheet.tables:
            if table.name == TABLE_NAME:
                return table
    # fallback: first table found
    for sheet in doc.sheets:
        for table in sheet.tables:
            return table
    raise SystemExit("No tables found in the .numbers file.")


def main():
    if not os.path.exists(NUMBERS_FILE):
        raise SystemExit(f"Not found: {NUMBERS_FILE}")

    doc = Document(NUMBERS_FILE)
    table = pick_table(doc)
    rows = table.rows(values_only=True)
    if len(rows) < 2:
        raise SystemExit(f"Table '{table.name}' has no data rows.")

    header = [norm_cell(h) for h in rows[0]]
    idx = {name: i for i, name in enumerate(header)}

    out_rows = []
    for r in rows[1:]:
        # skip fully-empty rows
        if all(c is None or str(c).strip() == "" for c in r):
            continue
        rec = {name: (norm_cell(r[i]) if i < len(r) else "") for name, i in idx.items()}
        out_rows.append([rec.get(col, "") for col in CANONICAL_COLUMNS])

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(CANONICAL_COLUMNS)
        w.writerows(out_rows)

    print(f"Read table '{table.name}' from {os.path.basename(NUMBERS_FILE)}: "
          f"{len(rows) - 1} data rows -> wrote {len(out_rows)} rows.")
    print(f"Output -> {OUTPUT_CSV}")
    # quick sanity: how many have a real apple_song_id
    si = CANONICAL_COLUMNS.index("apple_song_id")
    got = sum(1 for r in out_rows if r[si] and r[si].upper() not in ("NOT_FOUND", "N/A", "NONE", "NULL"))
    print(f"Rows with an apple_song_id: {got}/{len(out_rows)}")


if __name__ == "__main__":
    main()

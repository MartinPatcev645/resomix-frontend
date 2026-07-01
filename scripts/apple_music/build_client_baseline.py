"""
Build client_baseline.csv — the manually-verified ground truth for compare_results.py.

Source of truth: results.numbers (Apple Numbers, at the repo root) which the client filled in with
three columns:  in_house_file_path , in_house_query , PROPER_ID
  - PROPER_ID is the correct Apple Music song id, entered by hand. "not_found"/"Not found"/blank
    means the track is not on Apple Music.

We produce client_baseline.csv with exactly these three columns:
  1. in_house_file_path  -> taken AS-IS from results.numbers.
  2. in_house_query      -> REPLACED with our current query from RESULTS_FOR_QUERY (results_1.csv),
                            joined by file_path, so the baseline reflects the query we search today.
  3. PROPER_ID           -> normalised: Numbers stores numeric ids as floats (1724739882.0) so we
                            strip the ".0"; any not-found marker becomes an empty cell (= not on
                            Apple), matching the convention compare_results.py expects.

Requires: pip install numbers-parser
"""
import os
import csv

from numbers_parser import Document

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NUMBERS_FILE = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "results.numbers"))
RESULTS_FOR_QUERY = os.path.join(SCRIPT_DIR, "results_1.csv")   # where the current query comes from
OUTPUT_CSV = os.path.join(SCRIPT_DIR, "client_baseline.csv")

_NOT_ON_APPLE = {"", "not_found", "notfound", "not found", "n/a", "none", "null"}


def norm_proper_id(v):
    """Numbers cell -> clean id string. Integral floats/ints -> plain int; not-found -> '' (= not
    on Apple); everything else kept as trimmed text."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return ""
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    if isinstance(v, int):
        return str(v)
    s = str(v).strip()
    return "" if s.lower() in _NOT_ON_APPLE else s


def read_numbers():
    """Return ordered [(file_path, proper_id_raw)] from results.numbers."""
    doc = Document(NUMBERS_FILE)
    table = doc.sheets[0].tables[0]
    rows = table.rows(values_only=True)
    hdr = [str(h).strip() if h is not None else "" for h in rows[0]]
    fp_i = hdr.index("in_house_file_path")
    id_i = hdr.index("PROPER_ID")
    out = []
    for r in rows[1:]:
        fp = str(r[fp_i]).strip() if r[fp_i] is not None else ""
        if not fp:
            continue
        out.append((fp, r[id_i]))
    return out


def read_current_queries():
    """Return {file_path: in_house_query} from the current results CSV."""
    q = {}
    with open(RESULTS_FOR_QUERY, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            fp = (row.get("in_house_file_path") or "").strip()
            if fp:
                q[fp] = (row.get("in_house_query") or "").strip()
    return q


def main():
    if not os.path.exists(NUMBERS_FILE):
        raise SystemExit(f"Not found: {NUMBERS_FILE}")
    if not os.path.exists(RESULTS_FOR_QUERY):
        raise SystemExit(f"Not found: {RESULTS_FOR_QUERY}")

    numbers = read_numbers()
    queries = read_current_queries()

    missing_q, with_id, not_on_apple = [], 0, 0
    out_rows = []
    for fp, pid_raw in numbers:
        query = queries.get(fp, "")
        if fp not in queries:
            missing_q.append(fp)
        pid = norm_proper_id(pid_raw)
        if pid:
            with_id += 1
        else:
            not_on_apple += 1
        out_rows.append([fp, query, pid])

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(["in_house_file_path", "in_house_query", "PROPER_ID"])
        w.writerows(out_rows)

    print(f"Wrote {len(out_rows)} rows -> {OUTPUT_CSV}")
    print(f"  PROPER_ID present: {with_id}   not on Apple (blank): {not_on_apple}")
    print(f"  queries pulled from: {os.path.basename(RESULTS_FOR_QUERY)}")
    if missing_q:
        print(f"  WARNING: {len(missing_q)} file_path(s) had no query in the results file:")
        for m in missing_q[:10]:
            print("     " + m[:100])


if __name__ == "__main__":
    main()

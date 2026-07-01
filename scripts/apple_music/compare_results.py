"""
Compare one of our results_*.csv files against the client's manually-verified baseline, and
maintain a cumulative master_results.csv.

Set the two globals below, then run:  python scripts/apple_music/compare_results.py

  CLIENT_CSV   : the client's manual list — file_path + the correct Apple song_id.
                 An empty song_id means "this track is not on Apple Music".
  RESULTS_CSV  : which of OUR results files to score this run (e.g. results.csv, results_2.csv).

For each track it decides "Match" (our song_id == the client's) or "NOT_Match", prints a summary
(+ the wrong ones), and writes/updates master_results.csv:

  file_path | query | client_song_id | <results.csv> | <results_2.csv> | ...

Each results column holds only "Match" / "NOT_Match". Re-running the SAME results file UPDATES its
column (no duplicate). Two summary rows are appended at the bottom with the per-column totals.
"""
import os
import csv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- configure these two ----
CLIENT_CSV = os.path.join(SCRIPT_DIR, "client_baseline.csv")
RESULTS_CSV = os.path.join(SCRIPT_DIR, "results.csv")
# -----------------------------
MASTER_CSV = os.path.join(SCRIPT_DIR, "master_results.csv")

MATCH, NOT_MATCH = "Match", "NOT_Match"
_TOTAL_MATCH_LABEL = "TOTAL MATCHES"
_TOTAL_NOTMATCH_LABEL = "TOTAL NOT-MATCHED"
_TOTAL_LABELS = {_TOTAL_MATCH_LABEL, _TOTAL_NOTMATCH_LABEL}


def _find_col(fieldnames, *cands):
    """Find a column by exact (case-insensitive) name, then by substring."""
    low = {c.lower(): c for c in fieldnames}
    for cand in cands:
        if cand in low:
            return low[cand]
    for c in fieldnames:
        cl = c.lower()
        for cand in cands:
            if cand in cl:
                return c
    return None


def _norm_id(v):
    """Normalize a song id: strip; treat NOT_FOUND / N/A / empty as '' (= not on Apple)."""
    v = (v or "").strip()
    return "" if v.upper() in ("", "NOT_FOUND", "N/A", "NONE", "NULL") else v


def read_client(path):
    """Return ordered list of (file_path, client_song_id)."""
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fp_col = _find_col(reader.fieldnames, "file_path", "path")
        id_col = _find_col(reader.fieldnames, "song_id", "apple_song_id", "id")
        if not fp_col or not id_col:
            raise SystemExit(f"Client CSV must have a path column and a song-id column. Got: {reader.fieldnames}")
        return [(r[fp_col].strip(), (r.get(id_col) or "").strip()) for r in reader if r.get(fp_col)]


def read_results(path):
    """Return {file_path: {'query':..., 'song_id':...}} from one of OUR results files."""
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fp_col = _find_col(reader.fieldnames, "in_house_file_path", "file_path", "path")
        id_col = _find_col(reader.fieldnames, "apple_song_id", "song_id", "id")
        q_col = _find_col(reader.fieldnames, "in_house_query", "query")
        for r in reader:
            fp = (r.get(fp_col) or "").strip()
            if not fp:
                continue
            out[fp] = {"query": (r.get(q_col) or "").strip() if q_col else "",
                       "song_id": _norm_id(r.get(id_col))}
    return out


def load_master(path):
    """Load existing master into (order, rows, columns). Total rows are skipped."""
    order, rows, columns = [], {}, []
    if not os.path.exists(path):
        return order, rows, columns
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            return order, rows, columns
        columns = header[3:]
        for row in reader:
            if not row:
                continue
            fp = row[0].strip()
            if fp == "" or fp in _TOTAL_LABELS:  # skip the total rows
                continue
            verdicts = {columns[i]: (row[3 + i] if 3 + i < len(row) else "") for i in range(len(columns))}
            rows[fp] = {"query": row[1] if len(row) > 1 else "",
                        "client_song_id": row[2] if len(row) > 2 else "",
                        "verdicts": verdicts}
            order.append(fp)
    return order, rows, columns


def main():
    if not os.path.exists(CLIENT_CSV):
        raise SystemExit(f"CLIENT_CSV not found: {CLIENT_CSV}")
    if not os.path.exists(RESULTS_CSV):
        raise SystemExit(f"RESULTS_CSV not found: {RESULTS_CSV}")

    col = os.path.basename(RESULTS_CSV)
    client = read_client(CLIENT_CSV)
    results = read_results(RESULTS_CSV)
    order, rows, columns = load_master(MASTER_CSV)

    if col not in columns:
        columns.append(col)

    wrong = []
    for fp, client_id in client:
        r = results.get(fp, {})
        result_id = _norm_id(r.get("song_id"))
        verdict = MATCH if _norm_id(client_id) == result_id else NOT_MATCH

        if fp not in rows:
            rows[fp] = {"query": r.get("query", ""), "client_song_id": client_id, "verdicts": {}}
            order.append(fp)
        else:
            if r.get("query"):
                rows[fp]["query"] = r["query"]
            rows[fp]["client_song_id"] = client_id
        rows[fp]["verdicts"][col] = verdict

        if verdict == NOT_MATCH:
            wrong.append((fp, _norm_id(client_id), result_id))

    # Per-column totals
    tot_match = {c: 0 for c in columns}
    tot_not = {c: 0 for c in columns}
    for fp in order:
        for c in columns:
            v = rows[fp]["verdicts"].get(c, "")
            if v == MATCH:
                tot_match[c] += 1
            elif v == NOT_MATCH:
                tot_not[c] += 1

    # Write master
    with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(["file_path", "query", "client_song_id"] + columns)
        for fp in order:
            rr = rows[fp]
            w.writerow([fp, rr["query"], rr["client_song_id"]] + [rr["verdicts"].get(c, "") for c in columns])
        w.writerow([_TOTAL_MATCH_LABEL, "", ""] + [tot_match[c] for c in columns])
        w.writerow([_TOTAL_NOTMATCH_LABEL, "", ""] + [tot_not[c] for c in columns])

    # Summary for THIS run
    correct = tot_match[col]
    incorrect = tot_not[col]
    print(f"\nCompared '{col}' against '{os.path.basename(CLIENT_CSV)}' ({len(client)} tracks):")
    print(f"  Correct (Match):     {correct}")
    print(f"  Wrong (NOT_Match):   {incorrect}")
    if wrong:
        print("\n  Wrong ones:")
        for fp, exp, got in wrong:
            print(f"    {fp}")
            print(f"       expected={exp or '(not on Apple)'}   got={got or '(not found)'}")
    print(f"\nMaster updated -> {MASTER_CSV}")


if __name__ == "__main__":
    main()

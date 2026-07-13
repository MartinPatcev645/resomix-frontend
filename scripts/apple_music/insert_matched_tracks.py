"""
Script B of the old-catalogue → new-DB migration — insert the Apple-matched tracks.

Reads ``apple_matches.migrate.jsonl`` (Script A output: every record + ``track_uuid`` = the same
uuid5 the media backfill used) and, for each ACCEPTED match (``is_match == "True"``), writes:

  * fixtures (once)     : parties("electrobuzz") -> ingest_logs -> messages   [DDEX FK parents]
  * genres / labels     : get-or-create, cached                              [from in_house]
  * releases            : get-or-create per (album, display_artist), cached  [in_house album meta]
  * tracks              : uuid=track_uuid, proprietary_id=old id, isrc=Apple's, type="electrobuzz",
                          ingestion_source="csv", source_file_path=in_house file_path (the ONLY ref
                          back to the Electrobuzz master)
  * audio_files         : the 128 kbps preview (StreamingProfile) at internal/previews/{uuid}.mp3
  * track_processing_status : transcode+embedding = completed (backfill produced them); peaks +
                          segments = pending (not served for these — Apple preview_url is used)
  * release_tracks      : track <-> release
  * apple_music_tracks  : the Apple metadata (keyed by track_id)

uuid5 is deterministic and matches the on-disk assets, so NO renaming is ever needed. Idempotent +
resumable: a track whose uuid already exists is skipped; each batch is one transaction.

TODO (deferred): count + de-dupe DUPLICATE Apple matches — two in-house files mapping to the SAME
apple_song_id/isrc are kept as separate rows (isrc is non-unique).

Usage:
    python insert_matched_tracks.py --dry-run   # parse + summarise, NO DB writes (safe anywhere)
    python insert_matched_tracks.py             # real run against the configured DB
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
from datetime import date, datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT = os.path.join(SCRIPT_DIR, "apple_matches.migrate.jsonl")
# Repo root (scripts/apple_music -> repo root) so `app` / `database` import when run directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(SCRIPT_DIR)))

PARTY_ID = "electrobuzz"
PARTY_NAME = "Electrobuzz"
PACKAGE_FOLDER = "legacy/electrobuzz_import"
MESSAGE_ID = "ELECTROBUZZ-IMPORT"
BATCH = 2000
PROGRESS_EVERY = 50_000


# --------------------------------------------------------------------------- parsing
def _to_date(v):
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _to_year(v):
    try:
        y = int(str(v)[:4])
    except (TypeError, ValueError):
        return None
    return y if 1901 <= y <= 2155 else None  # mysql.YEAR range


def _dur_ms(sec):
    try:
        return int(round(float(sec) * 1000))
    except (TypeError, ValueError):
        return None


def _clip(s, n):
    return None if s is None else str(s)[:n]


def parse(rec: dict):
    """Accepted record -> flat field bag, or None if uninsertable (no track_uuid or Apple ISRC)."""
    ih = rec.get("in_house") or {}
    am = rec.get("apple_music") or {}
    rev = rec.get("review") or {}
    u = rec.get("track_uuid")
    isrc = am.get("isrc")
    if not u or not isrc:
        return None
    dur_ms = _dur_ms(ih.get("duration_sec"))
    return {
        "uuid": u, "old_uuid": rec.get("uuid"), "file_path": _clip(rec.get("file_path"), 600),
        "isrc": _clip(isrc, 30), "title": _clip(ih.get("title") or "(untitled)", 1024),
        "display_artist": _clip(ih.get("artists"), 512), "duration_ms": dur_ms,
        "bpm": ih.get("bpm"), "musical_key": _clip(ih.get("musical_key"), 10),
        "year": _to_year(ih.get("year")), "type": _clip(ih.get("type") or "electrobuzz", 50),
        "genre_name": (ih.get("genre") or "").strip() or None,
        "album": (ih.get("album") or "").strip() or None,
        "album_cover": _clip(ih.get("album_cover"), 255),
        "album_release_date": _to_date(ih.get("album_release_date")),
        "label_name": (ih.get("label") or "").strip() or None,
        # apple
        "apple_song_id": _clip(am.get("song_id"), 30), "apple_name": _clip(am.get("name"), 1024),
        "apple_artist": _clip(am.get("artist"), 512), "apple_album": _clip(am.get("album"), 1024),
        "apple_genres": _clip(am.get("genres"), 255), "apple_release_date": _to_date(am.get("release_date")),
        "apple_duration_ms": am.get("duration_ms"), "artwork_url": _clip(am.get("artwork_url"), 500),
        "preview_url": _clip(am.get("preview_url"), 500), "deep_link_url": _clip(am.get("deep_link_url"), 500),
        "match_score": rev.get("match_score"),
    }


def iter_accepted(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if str(rec.get("is_match")) != "True":
                continue
            t = parse(rec)
            if t is not None:
                yield t


def batched(it, n):
    buf = []
    for x in it:
        buf.append(x)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf


# --------------------------------------------------------------------------- dry run
def dry_run():
    n = skipped = 0
    genres, labels, releases = set(), set(), set()
    sample = None
    with open(INPUT, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if str(rec.get("is_match")) != "True":
                continue
            t = parse(rec)
            if t is None:
                skipped += 1
                continue
            n += 1
            if t["genre_name"]:
                genres.add(t["genre_name"])
            if t["label_name"]:
                labels.add(t["label_name"])
            if t["album"]:
                releases.add((t["album"], t["display_artist"]))
            if sample is None:
                sample = t
    print(f"insertable matched tracks : {n}")
    print(f"accepted but SKIPPED (no uuid/isrc): {skipped}")
    print(f"distinct genres {len(genres)} | labels {len(labels)} | releases {len(releases)}")
    print("\nsample track:")
    for k, v in (sample or {}).items():
        print(f"  {k:20} = {v!r}")


# --------------------------------------------------------------------------- real run
def real_run():
    from sqlalchemy import bindparam, text

    from database.connection import engine
    try:
        from app.core.context import set_admin_context
        set_admin_context(True)  # bypass the multi-tenancy failsafe for this batch job
    except Exception:
        pass

    with engine.begin() as c:
        c.execute(text("INSERT IGNORE INTO parties (party_id, party_name, partner_id, is_active) "
                       "VALUES (:pid, :pn, 1, 1)"), {"pid": PARTY_ID, "pn": PARTY_NAME})
        row = c.execute(text("SELECT id FROM ingest_logs WHERE party_id=:pid AND package_folder=:pf "
                             "LIMIT 1"), {"pid": PARTY_ID, "pf": PACKAGE_FOLDER}).first()
        if row:
            log_id = row[0]
        else:
            c.execute(text("INSERT INTO ingest_logs (party_id, package_folder, message_id, status, "
                           "partner_id) VALUES (:pid, :pf, :mid, 'COMPLETED', 1)"),
                      {"pid": PARTY_ID, "pf": PACKAGE_FOLDER, "mid": MESSAGE_ID})
            log_id = c.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        c.execute(text("INSERT IGNORE INTO messages (ingest_log_id, party_id, message_id, "
                       "message_type, partner_id) VALUES (:lid, :pid, :mid, 'LegacyImport', 1)"),
                  {"lid": log_id, "pid": PARTY_ID, "mid": MESSAGE_ID})
    print(f"fixtures ready (ingest_log_id={log_id})", flush=True)

    g_cache, l_cache, r_cache = {}, {}, {}

    def genre_id(name):
        if not name:
            return None
        if name not in g_cache:
            with engine.begin() as c:
                c.execute(text("INSERT IGNORE INTO genres (name) VALUES (:n)"), {"n": name[:80]})
                g_cache[name] = c.execute(text("SELECT id FROM genres WHERE name=:n"), {"n": name[:80]}).scalar()
        return g_cache[name]

    def label_id(name):
        if not name:
            return None
        if name not in l_cache:
            with engine.begin() as c:
                lid = c.execute(text("SELECT id FROM labels WHERE party_id=:p AND label_name=:n LIMIT 1"),
                                {"p": PARTY_ID, "n": name[:512]}).scalar()
                if lid is None:
                    c.execute(text("INSERT INTO labels (party_id, label_name, partner_id) "
                                   "VALUES (:p, :n, 1)"), {"p": PARTY_ID, "n": name[:512]})
                    lid = c.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                l_cache[name] = lid
        return l_cache[name]

    def release_id(t):
        if not t["album"]:
            return None
        key = (t["album"], t["display_artist"] or "")
        if key not in r_cache:
            with engine.begin() as c:
                rid = c.execute(text("SELECT id FROM releases WHERE party_id=:p AND title=:ti "
                                     "AND (display_artist <=> :da) LIMIT 1"),
                                {"p": PARTY_ID, "ti": t["album"][:1024], "da": t["display_artist"]}).scalar()
                if rid is None:
                    c.execute(text(
                        "INSERT INTO releases (label_id, party_id, message_id, title, display_artist, "
                        "release_type, release_date, cover_image, genre_id, partner_id) "
                        "VALUES (:lid, :p, :mid, :ti, :da, 'Album', :rd, :cov, :gid, 1)"),
                        {"lid": label_id(t["label_name"]), "p": PARTY_ID, "mid": MESSAGE_ID,
                         "ti": t["album"][:1024], "da": t["display_artist"], "rd": t["album_release_date"],
                         "cov": t["album_cover"], "gid": genre_id(t["genre_name"])})
                    rid = c.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                r_cache[key] = rid
        return r_cache[key]

    INS_TRACK = text(
        "INSERT INTO tracks (uuid, proprietary_id, source_file_path, isrc, title, display_artist, "
        "party_id, partner_id, duration_ms, bpm, musical_key, genre_id, p_line_year, type, "
        "ingestion_source, is_active) VALUES (:uuid, :old, :sfp, :isrc, :ti, :da, :p, 1, :dur, :bpm, "
        ":mkey, :gid, :yr, :type, 'csv', 1)")
    INS_AUDIO = text(
        "INSERT INTO audio_files (party_id, ingest_log_id, track_id, partner_id, asset_class, "
        "asset_subtype, original_filename, stored_path, mime_type, duration_seconds, bitrate_kbps) "
        "VALUES (:p, :lid, :tid, 1, 'StreamingProfile', 'preview', :ofn, :sp, 'audio/mpeg', :dsec, 128)")
    INS_TPS = text(
        "INSERT INTO track_processing_status (track_id, partner_id, ingest_log_id, audio_filename, "
        "sftp_env, transcode_status, embedding_status, peaks_status, segments_status, faiss_indexed) "
        "VALUES (:tid, 1, :lid, :afn, 'live', 'completed', 'completed', 'pending', 'pending', 0)")
    INS_RT = text("INSERT INTO release_tracks (release_id, track_id, release_context) "
                  "VALUES (:rid, :tid, 'Original')")
    INS_APPLE = text(
        "INSERT INTO apple_music_tracks (track_id, apple_song_id, isrc, name, artist, album, genres, "
        "release_date, duration_ms, artwork_url, preview_url, deep_link_url, match_score) "
        "VALUES (:tid, :sid, :isrc, :nm, :ar, :al, :gn, :rd, :dur, :aw, :pv, :dl, :ms)")

    processed = inserted = 0
    source = iter_accepted(INPUT) if LIMIT is None else itertools.islice(iter_accepted(INPUT), LIMIT)
    for batch in batched(source, BATCH):
        uuids = [t["uuid"] for t in batch]
        with engine.begin() as c:
            existing = {r[0] for r in c.execute(
                text("SELECT uuid FROM tracks WHERE uuid IN :u").bindparams(
                    bindparam("u", expanding=True)), {"u": uuids})}
            todo = [t for t in batch if t["uuid"] not in existing]
            if todo:
                for t in todo:              # resolve fk ids (own commits, cached)
                    t["_gid"] = genre_id(t["genre_name"])
                    t["_rid"] = release_id(t)
                c.execute(INS_TRACK, [{"uuid": t["uuid"], "old": t["old_uuid"], "sfp": t["file_path"],
                    "isrc": t["isrc"], "ti": t["title"], "da": t["display_artist"], "p": PARTY_ID,
                    "dur": t["duration_ms"], "bpm": t["bpm"], "mkey": t["musical_key"],
                    "gid": t["_gid"], "yr": t["year"], "type": t["type"]} for t in todo])
                ids = {r[1]: r[0] for r in c.execute(
                    text("SELECT id, uuid FROM tracks WHERE uuid IN :u").bindparams(
                        bindparam("u", expanding=True)), {"u": [t["uuid"] for t in todo]})}
                audio, tps, rts, apple = [], [], [], []
                for t in todo:
                    tid = ids[t["uuid"]]
                    audio.append({"p": PARTY_ID, "lid": log_id, "tid": tid, "ofn": f"{t['uuid']}.mp3",
                                  "sp": f"internal/previews/{t['uuid']}.mp3",
                                  "dsec": (t["duration_ms"] // 1000) if t["duration_ms"] else None})
                    tps.append({"tid": tid, "lid": log_id, "afn": f"{t['uuid']}.mp3"})
                    if t["_rid"]:
                        rts.append({"rid": t["_rid"], "tid": tid})
                    apple.append({"tid": tid, "sid": t["apple_song_id"], "isrc": t["isrc"],
                                  "nm": t["apple_name"], "ar": t["apple_artist"], "al": t["apple_album"],
                                  "gn": t["apple_genres"], "rd": t["apple_release_date"],
                                  "dur": t["apple_duration_ms"], "aw": t["artwork_url"],
                                  "pv": t["preview_url"], "dl": t["deep_link_url"], "ms": t["match_score"]})
                c.execute(INS_AUDIO, audio)
                c.execute(INS_TPS, tps)
                if rts:
                    c.execute(INS_RT, rts)
                c.execute(INS_APPLE, apple)
                inserted += len(todo)
        processed += len(batch)
        if processed % PROGRESS_EVERY < BATCH:
            print(f"  processed {processed} (inserted {inserted})", flush=True)

    print(f"Done. processed={processed} inserted={inserted} "
          f"(genres={len(g_cache)} labels={len(l_cache)} releases={len(r_cache)})", flush=True)


LIMIT = None  # set by --limit for a small first real run


def main():
    global LIMIT
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="parse + summarise only; no DB writes")
    ap.add_argument("--limit", type=int, default=None,
                    help="insert at most N tracks this run (for a safe first pass; resumable)")
    args = ap.parse_args()
    LIMIT = args.limit
    if not os.path.exists(INPUT):
        sys.exit(f"Input not found: {INPUT} (run add_track_uuid.py first)")
    dry_run() if args.dry_run else real_run()


if __name__ == "__main__":
    main()

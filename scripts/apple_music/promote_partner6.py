#!/usr/bin/env python3
"""
Promote the Apple-matched partner 6 tracks into partner 1, the consumer catalogue.

Step D of docs/OPEN_CATALOGUE_REINGEST_PLAN.md. Run on Alwyzon, from the repo root, with the
repo's own venv. Every step is safe to run again.

    plan              Decide which tracks move. Read-only. Writes the plan files beside this script.
    media             Dry run on the media server. Stages the uuids, reports what would happen.
    media --execute   Start the media job (hardlinks + FAISS additions, inside the live service).
    media --status    Poll the media job until status is "completed".
    db                Dry run of the database move. Read-only.
    db --execute      Repoint the rows to partner 1 and insert apple_music_tracks.
    verify            Final counts from the database and the media job.
    selftest          Check the version-matching rules. No database, no network.

Then rebuild the search index: sudo systemctl start es-reindex-tracks.service

ORDER MATTERS. Media before database. Until the database step runs, the promoted vectors sit in
partner 1's index but Alwyzon still has the tracks on partner 6, so similarity simply cannot
resolve them and leaves them out. The other way round, partner 1 would hold tracks with no
vectors. Search is rebuilt last, so nobody can reach a promoted track before it is complete.

WHICH TRACKS MOVE (George, 17 September 2026)
  * Only accepted Apple matches, from ingest runs 18, 19 and 20, active, with embeddings done.
  * One track per Apple song. Songs already live in partner 1 are skipped.
  * Originals and remixes are different recordings and both stay. Two tracks count as copies of
    each other only when they are the same recording: the same version (remixer names, or both
    originals) and a length within 3 seconds.
  * Where several different versions matched one Apple song, the version that fits Apple's title
    and length is promoted. The others are set aside as "different_version_rematch" rather than
    promoted with a preview of the wrong recording.
  * Where no track's title fits Apple's version AND the length differs from Apple's by more than
    3 seconds, the match is a different recording and the song is held back as
    "apple_version_mismatch". Same length with a different label is promoted.
  * Nothing is deleted. Everything not promoted stays on partner 6, with its reason recorded in
    the parked file.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(SCRIPT_DIR)))  # repo root, so `app` imports

SOURCE_PARTNER = 6
TARGET_PARTNER = 1
INGEST_LOG_IDS = {18, 19, 20}
PARTY_ID = "electrobuzz"
DURATION_TOLERANCE_S = 3.0
DB_CHUNK = 2000
MEDIA_CHUNK = 5000
DEFAULT_JOB_ID = "partner6-to-partner1"

MATCHES = os.path.join(SCRIPT_DIR, "apple_matches.partner6.jsonl")
PLAN = os.path.join(SCRIPT_DIR, "promote_partner6.plan.jsonl")
PARKED = os.path.join(SCRIPT_DIR, "promote_partner6.parked.jsonl")
SUMMARY = os.path.join(SCRIPT_DIR, "promote_partner6.summary.json")


# --------------------------------------------------------------------------- version rules
_FEAT_RE = re.compile(
    r"[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s[^\)\]]*[\)\]]"      # (feat. X) or [feat. X]
    r"|\b(?:feat\.?|ft\.?|featuring)\s+[^\(\)\[\]]*",             # feat. X, up to a bracket
    re.I,
)
_QUALIFIER_RE = re.compile(r"[\(\[]([^\)\]]*)[\)\]]?")
_REMIX_WORDS = {"remix", "rmx", "rework", "refix", "rerub", "bootleg", "flip", "vip", "reedit", "redub", "remode"}
_GENERIC_WORDS = {
    "original", "extended", "ext", "mix", "mixes", "remixes", "edit", "edits", "radio", "club", "version",
    "vocal", "vocals", "instrumental", "inst", "dub", "remaster", "remastered", "demo", "main", "full",
    "short", "long", "album", "single", "clean", "explicit", "the", "and", "a", "of", "vs", "x", "by",
    "pt", "part",
}


def version_of(title: Optional[str]) -> Tuple[bool, frozenset]:
    """(is_remix, remixer name tokens) read from a title's brackets or its " - " suffix.

    "Better (Mark Picchiotti Extended Mix)"  -> (True, {mark, picchiotti})
    "Comin (Original Mix)"                   -> (False, {})
    "Only For A Moment feat. Ekko [Andhim Extended Mix]" -> (True, {andhim})
    A named mix counts as a remix even without the word, and "(Remix)" counts without a name.
    """
    t = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode().lower()
    t = _FEAT_RE.sub(" ", t)
    parts = _QUALIFIER_RE.findall(t)
    if " - " in t:
        parts.append(t.split(" - ", 1)[1])
    text = re.sub(r"\bre[\s-]+(edit|work|mix|fix|rub|dub)\b", r"re\1", " ".join(parts))
    words = re.findall(r"[a-z0-9]+", text)
    names = frozenset(w for w in words if w not in _GENERIC_WORDS and w not in _REMIX_WORDS)
    return (bool(names) or any(w in _REMIX_WORDS for w in words)), names


def versions_compatible(a: Tuple[bool, frozenset], b: Tuple[bool, frozenset]) -> bool:
    """Same kind (both originals, or both remixes), and for remixes the same remixer names.

    One name set inside the other is accepted ("Benji Candelario Demo Mix" against "Benji Candelario
    Remix"). An unnamed "(Remix)" against a named one is not, because that is a guess.
    """
    (ra, na), (rb, nb) = a, b
    if ra != rb:
        return False
    if not ra:
        return True
    return na == nb or bool(na and nb and (na <= nb or nb <= na))


def _seconds(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def same_recording(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    if not versions_compatible(version_of(a["title"]), version_of(b["title"])):
        return False
    da, db = a["dur"], b["dur"]
    return da is None or db is None or abs(da - db) <= DURATION_TOLERANCE_S


# --------------------------------------------------------------------------- small helpers
def _chunks(seq: List[Any], n: int) -> Iterable[List[Any]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def _clip(v: Any, n: int) -> Optional[str]:
    return None if v is None else str(v)[:n]


def _to_date(v: Any):
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _read_jsonl(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        sys.exit(f"Not found: {path}. Run the previous step first.")
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _in_params(prefix: str, values: List[Any]) -> Tuple[str, Dict[str, Any]]:
    names = [f"{prefix}{i}" for i in range(len(values))]
    return ",".join(f":{n}" for n in names), dict(zip(names, values))


async def _session():
    from app.core.context import set_admin_context, set_current_partner_id
    from database.connection import AsyncSessionLocal
    # Deliberate cross-partner operator work: bypass the tenancy failsafe, as the exporter does.
    set_current_partner_id(None)
    set_admin_context(True)
    return AsyncSessionLocal()


# --------------------------------------------------------------------------- plan
async def cmd_plan(_args) -> None:
    from sqlalchemy import text

    accepted: Dict[str, Dict[str, Any]] = {}
    not_accepted: List[Tuple[str, str]] = []
    for r in _read_jsonl(MATCHES):
        verdict = str(r.get("is_match"))
        if verdict != "True":
            not_accepted.append((r["uuid"], "no_match" if verdict == "False" else "unsure_match"))
            continue
        ih, am = r.get("in_house") or {}, r.get("apple_music") or {}
        accepted[r["uuid"]] = {
            "uuid": r["uuid"],
            "title": ih.get("title") or "",
            "dur": _seconds(ih.get("duration_sec")),
            "score": _seconds((r.get("review") or {}).get("match_score")) or 0.0,
            "song_id": str(am.get("song_id") or ""),
            "apple": am,
        }

    async with await _session() as db:
        # Where each accepted track is now.
        info: Dict[str, Dict[str, Any]] = {}
        for chunk in _chunks(list(accepted), DB_CHUNK):
            ph, params = _in_params("u", chunk)
            rows = (await db.execute(text(
                "SELECT t.id, t.uuid, t.partner_id, t.is_active, s.ingest_log_id, s.embedding_status "
                "FROM tracks t LEFT JOIN track_processing_status s ON s.track_id = t.id "
                f"WHERE t.uuid IN ({ph})"), params)).all()
            for tid, uuid, pid, active, log_id, emb in rows:
                info[str(uuid)] = {"track_id": int(tid), "partner_id": int(pid), "active": bool(active),
                                   "log_id": log_id, "embedding": emb}

        # Apple songs already live in partner 1, ignoring tracks this script promoted earlier.
        ours = set(accepted)
        songs = sorted({a["song_id"] for a in accepted.values() if a["song_id"]})
        live: Dict[str, Dict[str, Any]] = {}
        for chunk in _chunks(songs, DB_CHUNK):
            ph, params = _in_params("s", chunk)
            rows = (await db.execute(text(
                "SELECT a.apple_song_id, t.uuid, t.title, t.duration_ms FROM apple_music_tracks a "
                "JOIN tracks t ON t.id = a.track_id "
                f"WHERE t.partner_id = :p AND t.is_active = 1 AND a.apple_song_id IN ({ph})"),
                {**params, "p": TARGET_PARTNER})).all()
            for song, uuid, title, ms in rows:
                if str(uuid) not in ours:
                    live.setdefault(str(song), {"title": title or "", "dur": (ms / 1000.0) if ms else None})

    parked: List[Dict[str, Any]] = [{"uuid": u, "reason": why} for u, why in not_accepted]
    by_song: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for u, a in accepted.items():
        i = info.get(u)
        if i is None:
            parked.append({"uuid": u, "reason": "not_in_database"})
        elif i["partner_id"] == TARGET_PARTNER:
            by_song[a["song_id"]].append({**a, **i})           # promoted by an earlier run
        elif (i["partner_id"] != SOURCE_PARTNER or i["log_id"] not in INGEST_LOG_IDS
              or not i["active"] or i["embedding"] != "completed"):
            parked.append({"uuid": u, "reason": "not_eligible",
                           "detail": {k: i[k] for k in ("partner_id", "active", "log_id", "embedding")}})
        else:
            by_song[a["song_id"]].append({**a, **i})

    plan: List[Dict[str, Any]] = []
    apple_version_misfits = 0
    apple_version_held_back = 0
    for song, rows in by_song.items():
        if song in live:
            for r in rows:
                reason = "already_live" if same_recording(r, live[song]) else "already_live_different_version"
                parked.append({"uuid": r["uuid"], "reason": reason, "song_id": song})
            continue
        apple = rows[0]["apple"]
        apple_v = version_of(apple.get("name"))
        apple_s = (apple.get("duration_ms") or 0) / 1000.0 or None
        fits = [r for r in rows if versions_compatible(version_of(r["title"]), apple_v)]
        misfit = not fits
        if misfit:
            apple_version_misfits += 1
            fits = rows
        anchor = min(fits, key=lambda r: (
            0 if r["partner_id"] == TARGET_PARTNER else 1,       # keep an earlier promotion stable
            abs(r["dur"] - apple_s) if (r["dur"] is not None and apple_s) else 1e9,
            -r["score"],
            r["uuid"],
        ))
        # No track in the group has Apple's version in its title. If the length still matches
        # Apple's, it is the same audio labelled differently ("Room 20-1 (Original Mix)" against
        # "Room 20 - 1") and it is promoted. If the length does not match either, the match is a
        # different recording ("Wavey (Extended Mix)" 271s against Apple's Linska Remix, 166s),
        # so the whole group is held back rather than promoted with the wrong preview.
        # (Agreed 17 September 2026 after reviewing samples: 337 same length, 125 not.)
        if misfit and not (anchor["dur"] is not None and apple_s
                           and abs(anchor["dur"] - apple_s) <= DURATION_TOLERANCE_S):
            apple_version_held_back += 1
            for r in rows:
                parked.append({"uuid": r["uuid"], "reason": "apple_version_mismatch", "song_id": song})
            continue
        am = anchor["apple"]
        plan.append({
            "track_id": anchor["track_id"], "uuid": anchor["uuid"],
            "apple_song_id": _clip(am.get("song_id"), 30), "isrc": _clip(am.get("isrc"), 30),
            "name": _clip(am.get("name"), 1024), "artist": _clip(am.get("artist"), 512),
            "album": _clip(am.get("album"), 1024), "genres": _clip(am.get("genres"), 255),
            "release_date": am.get("release_date"), "duration_ms": am.get("duration_ms"),
            "artwork_url": _clip(am.get("artwork_url"), 500), "preview_url": _clip(am.get("preview_url"), 500),
            "deep_link_url": _clip(am.get("deep_link_url"), 500), "match_score": anchor["score"],
        })
        for r in rows:
            if r is anchor:
                continue
            reason = "duplicate_copy" if same_recording(r, anchor) else "different_version_rematch"
            parked.append({"uuid": r["uuid"], "reason": reason, "song_id": song, "kept_uuid": anchor["uuid"]})

    with open(PLAN, "w", encoding="utf-8") as f:
        for p in plan:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    with open(PARKED, "w", encoding="utf-8") as f:
        for p in parked:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    reasons = Counter(p["reason"] for p in parked)
    summary = {
        "created_at": datetime.utcnow().isoformat() + "Z",
        "matcher_rows": len(accepted) + len(not_accepted),
        "accepted": len(accepted),
        "distinct_apple_songs_accepted": len({a["song_id"] for a in accepted.values()}),
        "songs_already_live": len(live),
        "to_promote": len(plan),
        "already_on_partner1_from_earlier_run": sum(1 for p in plan if info[p["uuid"]]["partner_id"] == TARGET_PARTNER),
        "groups_where_no_track_fits_apple_version": apple_version_misfits,
        "of_those_held_back_length_also_differs": apple_version_held_back,
        "parked": len(parked),
        "parked_by_reason": dict(reasons.most_common()),
    }
    with open(SUMMARY, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))
    print(f"\nplan   -> {PLAN}\nparked -> {PARKED}")


# --------------------------------------------------------------------------- media
def cmd_media(args) -> None:
    import httpx
    from app.core.config import settings

    base = (settings.similarity_server_url or "").rstrip("/")
    key = settings.hetzner_internal_api_key
    if not base or not key:
        sys.exit("SIMILARITY_SERVER_URL or HETZNER_INTERNAL_API_KEY is not set in this app's .env")
    headers = {"Authorization": f"Bearer {key}"}
    job = args.job_id
    url = f"{base}/internal/partner/promotions/{job}"

    with httpx.Client(timeout=300.0, headers=headers) as client:
        if args.status:
            r = client.get(url, params={"target_partner_id": TARGET_PARTNER})
            print(r.status_code, json.dumps(r.json(), indent=2))
            return

        uuids = [p["uuid"] for p in _read_jsonl(PLAN)]
        for i, chunk in enumerate(_chunks(uuids, MEDIA_CHUNK)):
            r = client.post(f"{url}/uuids", json={
                "source_partner_id": SOURCE_PARTNER, "target_partner_id": TARGET_PARTNER,
                "uuids": chunk, "reset": i == 0,
            })
            if r.status_code != 200:
                sys.exit(f"staging failed at chunk {i}: HTTP {r.status_code} {r.text[:500]}")
        print(f"staged {len(uuids):,} uuids as job {job}")

        r = client.post(f"{url}/start", json={"target_partner_id": TARGET_PARTNER, "dry_run": not args.execute})
        print(r.status_code, json.dumps(r.json(), indent=2))
        if args.execute and r.status_code == 202:
            print("\nStarted. Check progress with the --status command until status is completed.")


# --------------------------------------------------------------------------- database
_BLOCKING_TABLES = (
    ("consumption_events", "track_id"),
    ("document_files", "track_id"),
    ("track_analysis_results", "track_id"),
)


async def cmd_db(args) -> None:
    from sqlalchemy import text

    plan = _read_jsonl(PLAN)
    ids = [int(p["track_id"]) for p in plan]
    async with await _session() as db:
        party = (await db.execute(text("SELECT COUNT(*) FROM parties WHERE party_id = :p"), {"p": PARTY_ID})).scalar()
        if not party:
            sys.exit(f"party '{PARTY_ID}' does not exist; stopping")

        where_now = Counter()
        blocking = Counter()
        with_apple = 0
        empty_isrc = 0
        for chunk in _chunks(ids, DB_CHUNK):
            ph, params = _in_params("i", chunk)
            for pid, n in (await db.execute(text(
                    f"SELECT partner_id, COUNT(*) FROM tracks WHERE id IN ({ph}) GROUP BY partner_id"), params)).all():
                where_now[int(pid)] += int(n)
            for table, col in _BLOCKING_TABLES:
                blocking[table] += (await db.execute(text(
                    f"SELECT COUNT(*) FROM {table} WHERE {col} IN ({ph}) AND partner_id = :src"),
                    {**params, "src": SOURCE_PARTNER})).scalar() or 0
            blocking["playlists (seed)"] += (await db.execute(text(
                f"SELECT COUNT(*) FROM playlists WHERE seed_track_id IN ({ph})"), params)).scalar() or 0
            blocking["playlist_tracks"] += (await db.execute(text(
                f"SELECT COUNT(*) FROM playlist_tracks WHERE track_id IN ({ph})"), params)).scalar() or 0
            with_apple += (await db.execute(text(
                f"SELECT COUNT(*) FROM apple_music_tracks WHERE track_id IN ({ph})"), params)).scalar() or 0
            empty_isrc += (await db.execute(text(
                f"SELECT COUNT(*) FROM tracks WHERE id IN ({ph}) AND (isrc IS NULL OR isrc = '')"), params)).scalar() or 0

        print(f"tracks in plan              : {len(ids):,}")
        print(f"  now on partner 6          : {where_now.get(SOURCE_PARTNER, 0):,}")
        print(f"  already on partner 1      : {where_now.get(TARGET_PARTNER, 0):,}")
        other = {k: v for k, v in where_now.items() if k not in (SOURCE_PARTNER, TARGET_PARTNER)}
        print(f"  elsewhere                 : {other or 0}")
        print(f"  missing from tracks       : {len(ids) - sum(where_now.values()):,}")
        print(f"apple_music_tracks present  : {with_apple:,}   to insert: {len(ids) - with_apple:,}")
        print(f"tracks with empty isrc      : {empty_isrc:,}   (filled from Apple)")
        print(f"user data on these tracks   : {dict(blocking)}")
        if other or sum(blocking.values()):
            sys.exit("\nUnexpected rows above. Nothing was changed. Stopping so this can be looked at.")
        if not args.execute:
            print("\nDry run. Nothing was changed.")
            return

        by_id = {int(p["track_id"]): p for p in plan}
        moved = inserted = 0
        for n, chunk in enumerate(_chunks(ids, DB_CHUNK), 1):
            ph, params = _in_params("i", chunk)
            base = {**params, "src": SOURCE_PARTNER, "dst": TARGET_PARTNER, "party": PARTY_ID}
            moved += (await db.execute(text(
                f"UPDATE tracks SET partner_id = :dst, party_id = :party WHERE id IN ({ph}) AND partner_id = :src"),
                base)).rowcount
            await db.execute(text(
                f"UPDATE audio_files SET partner_id = :dst, party_id = :party WHERE track_id IN ({ph}) AND partner_id = :src"),
                base)
            await db.execute(text(
                "UPDATE track_processing_status SET partner_id = :dst, faiss_indexed = 1, "
                "faiss_indexed_at = COALESCE(faiss_indexed_at, UTC_TIMESTAMP()) "
                f"WHERE track_id IN ({ph}) AND partner_id = :src"), base)
            await db.execute(text(
                f"UPDATE track_artifact_status SET partner_id = :dst WHERE track_id IN ({ph}) AND partner_id = :src"),
                base)

            have = {int(r[0]) for r in (await db.execute(text(
                f"SELECT track_id FROM apple_music_tracks WHERE track_id IN ({ph})"), params)).all()}
            rows = []
            for tid in chunk:
                if tid in have:
                    continue
                p = by_id[tid]
                rows.append({
                    "track_id": tid, "apple_song_id": p["apple_song_id"], "isrc": p["isrc"], "name": p["name"],
                    "artist": p["artist"], "album": p["album"], "genres": p["genres"],
                    "release_date": _to_date(p["release_date"]), "duration_ms": p["duration_ms"],
                    "artwork_url": p["artwork_url"], "preview_url": p["preview_url"],
                    "deep_link_url": p["deep_link_url"], "match_score": p["match_score"],
                })
            if rows:
                await db.execute(text(
                    "INSERT INTO apple_music_tracks (track_id, apple_song_id, isrc, name, artist, album, genres, "
                    "release_date, duration_ms, artwork_url, preview_url, deep_link_url, match_score) VALUES "
                    "(:track_id, :apple_song_id, :isrc, :name, :artist, :album, :genres, :release_date, "
                    ":duration_ms, :artwork_url, :preview_url, :deep_link_url, :match_score)"), rows)
                inserted += len(rows)
            isrc_rows = [{"id": tid, "isrc": by_id[tid]["isrc"]} for tid in chunk if by_id[tid]["isrc"]]
            if isrc_rows:
                await db.execute(text(
                    "UPDATE tracks SET isrc = :isrc WHERE id = :id AND (isrc IS NULL OR isrc = '')"), isrc_rows)
            await db.commit()
            if n % 10 == 0:
                print(f"  {min(n * DB_CHUNK, len(ids)):,} / {len(ids):,}", flush=True)

        print(f"\ndone. tracks moved {moved:,}, apple_music_tracks inserted {inserted:,}")


# --------------------------------------------------------------------------- verify
async def cmd_verify(args) -> None:
    from sqlalchemy import text

    plan = _read_jsonl(PLAN)
    ids = [int(p["track_id"]) for p in plan]
    totals = Counter()
    async with await _session() as db:
        for chunk in _chunks(ids, DB_CHUNK):
            ph, params = _in_params("i", chunk)
            row = (await db.execute(text(
                "SELECT SUM(t.partner_id = :dst), SUM(t.partner_id = :dst AND t.is_active = 1), "
                "SUM(a.track_id IS NOT NULL), SUM(a.preview_url IS NOT NULL AND a.preview_url <> ''), "
                "SUM(af.partner_id = :dst) "
                "FROM tracks t LEFT JOIN apple_music_tracks a ON a.track_id = t.id "
                "LEFT JOIN audio_files af ON af.track_id = t.id AND af.asset_class = 'Master' "
                f"WHERE t.id IN ({ph})"), {**params, "dst": TARGET_PARTNER})).one()
            for k, v in zip(("on_partner1", "active_on_partner1", "with_apple_row", "with_preview", "audio_on_partner1"), row):
                totals[k] += int(v or 0)
    print(f"plan tracks: {len(ids):,}")
    for k, v in totals.items():
        print(f"  {k:20}: {v:,}")
    args.status = True
    cmd_media(args)


# --------------------------------------------------------------------------- selftest
def cmd_selftest(_args) -> None:
    v = version_of
    same = [
        ("Better (Mark Picchiotti Remix)", "Better (Mark Picchiotti Extended Mix)"),
        ("Only For A Moment feat. Ekko (andhim Extended Mix)", "Only For A Moment [andhim Extended Mix]"),
        ("Real Love feat. Million Miles (JKriv Remix)", "Real Love (JKriv Remix)"),
        ("Take Me Higher (Benji Candelario Extended Demo Mix)", "Take Me Higher (Benji Candelario Remix)"),
        ("Comin (Original Mix)", "Comin"),
        ("Theo's 9 to 3 (Extended Mix)", "Theo's 9 to 3 (feat. Wuhryn Dumas) [Extended Mix]"),
        ("Drifting (DJ Spen, Thommy Davis, & Gary Hudgins Remix)", "Drifting (DJ Spen, Thommy Davis, & Gary Hudgins Remix)"),
        ("Hold On - Re-Edit", "Hold On (Reedit)"),
    ]
    different = [
        ("Hold (Original Mix)", "Hold (Kerri Chandler Remix)"),
        ("Hold", "Hold (Remix)"),
        ("Hold (Kerri Chandler Remix)", "Hold (Dennis Ferrer Remix)"),
        ("Hold (Remix)", "Hold (Kerri Chandler Remix)"),
    ]
    for a, b in same:
        assert versions_compatible(v(a), v(b)), f"expected the same version: {a!r} / {b!r} -> {v(a)} {v(b)}"
    for a, b in different:
        assert not versions_compatible(v(a), v(b)), f"expected different versions: {a!r} / {b!r}"
    x = {"title": "Mount Zion (Jonathan Kaspar Remix)", "dur": 521.4}
    y = {"title": "Mount Zion (Jonathan Kaspar Remix)", "dur": 280.0}
    z = {"title": "Mount Zion (Jonathan Kaspar Remix)", "dur": 521.37}
    assert not same_recording(x, y) and same_recording(x, z)
    print(f"selftest passed ({len(same) + len(different) + 2} checks)")


# --------------------------------------------------------------------------- main
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("plan")
    m = sub.add_parser("media")
    m.add_argument("--execute", action="store_true")
    m.add_argument("--status", action="store_true")
    m.add_argument("--job-id", default=DEFAULT_JOB_ID)
    d = sub.add_parser("db")
    d.add_argument("--execute", action="store_true")
    vf = sub.add_parser("verify")
    vf.add_argument("--job-id", default=DEFAULT_JOB_ID)
    sub.add_parser("selftest")
    args = ap.parse_args()

    if args.cmd == "plan":
        asyncio.run(cmd_plan(args))
    elif args.cmd == "media":
        if args.execute and args.status:
            sys.exit("choose --execute or --status, not both")
        cmd_media(args)
    elif args.cmd == "db":
        asyncio.run(cmd_db(args))
    elif args.cmd == "verify":
        args.execute = False
        asyncio.run(cmd_verify(args))
    elif args.cmd == "selftest":
        cmd_selftest(args)


if __name__ == "__main__":
    main()

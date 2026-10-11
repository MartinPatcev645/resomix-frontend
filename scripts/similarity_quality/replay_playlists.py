#!/usr/bin/env python3
"""
Turn a similarity replay into the playlists users would actually get, and report.

READ ONLY. The database session is switched to READ ONLY before any query, and
nothing here creates, updates or deletes a row.

The similarity half runs on the media box
(resomix-similarity-open/scripts/search_quality_replay.py) and writes
replay.json.gz: for every seed and every candidate fix, the engine's ranked
candidate list. A user never sees that list. Alwyzon looks the tracks up, filters
their metadata, fetches their Apple ids and removes copies, then keeps the first
100. This script runs that same step, using the same functions the live request
uses (async_get_track_details_by_uuids, apply_response_filtering,
fetch_apple_map, deduplicate_tracks), so the playlists it prints are the ones a
user would have seen.

SUBCOMMANDS
-----------
    export-seeds   seeds of recent production 100-track playlists, so the media box
                   can replay them and this script can prove the replay matches
                   what production stored
    report         build every playlist, compare the fixes, write the baseline TSVs

USAGE
-----
    python scripts/similarity_quality/replay_playlists.py export-seeds --out ~/usman/similarity-quality/prod_seeds.json
    python scripts/similarity_quality/replay_playlists.py report --replay ~/usman/similarity-quality/replay.json.gz
"""
from __future__ import annotations

import argparse
import asyncio
import gzip
import json
import os
import statistics
import sys
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text  # noqa: E402

from app.core.context import set_admin_context, set_current_partner_id  # noqa: E402
from database.connection import AsyncSessionLocal  # noqa: E402

PARTNER = 1
TOP_SK = 100
PROD_TOP_K = 250  # Alwyzon asks the similarity server for 100 + 150 cushion
CUSHION_TEST_TOP_K = 400

CONFIG_LABELS = {
    "e4_ef16": "E4 (Pro) today, efSearch 16",
    "e4_ef512": "E4 (Pro), efSearch 512",
    "e4_exact": "E4 (Pro), perfect search",
    "e5_ef512": "E5 rank fusion, efSearch 512",
    "e6_ef512": "E6 MAEST + Discogs candidates, efSearch 512",
    "e4_centered": "E4 on mean-removed vectors, perfect search",
    "e1_ef512": "MAEST only, efSearch 512",
    "e2_ef512": "Discogs only, efSearch 512",
}
BASELINE_PLAYLISTS = {
    "solina": "2185da24-6baa-4eef-abf8-dee00325c32b",
    "bedevilment": "aa9b9245-8a4e-4cb8-97cc-e701e3c3b523",
}


async def read_only_session():
    """
    A session MariaDB itself will refuse to write through.

    The whole run is one explicit READ ONLY transaction that is never committed or
    rolled back until close, so the session keeps the same connection throughout
    and any write attempt fails with "Cannot execute statement in a READ ONLY
    transaction" instead of landing in production.
    """
    db = AsyncSessionLocal()
    await db.execute(text("START TRANSACTION READ ONLY"))
    return db


def scoped():
    """Same tenancy scope as a live frontend request: partner 1, not admin."""
    set_admin_context(False)
    set_current_partner_id(PARTNER)


# ---------------------------------------------------------------------- export
async def export_seeds(args) -> None:
    scoped()
    db = await read_only_session()
    try:
        since = datetime.utcnow() - timedelta(days=args.days)
        rows = (await db.execute(text(
            "SELECT p.uuid, t.uuid, p.created_at "
            "FROM playlists p JOIN tracks t ON t.id = p.seed_track_id "
            "WHERE p.type = 'similarity' AND p.partner_id = :pid AND p.deleted_at IS NULL "
            "  AND p.fork_id IS NULL AND p.num_tracks = :n AND t.type = 'electrobuzz' "
            "  AND p.created_at >= :since "
            "ORDER BY p.created_at DESC LIMIT 2000"
        ), {"pid": PARTNER, "n": TOP_SK, "since": since})).all()
    finally:
        await db.close()
    out, seen = [], set()
    for playlist_uuid, seed_uuid, created in rows:
        if seed_uuid in seen:
            continue
        seen.add(seed_uuid)
        out.append({"playlist_uuid": playlist_uuid, "seed_uuid": seed_uuid,
                    "created_at": created.isoformat() if created else None})
        if len(out) >= args.limit:
            break
    Path(args.out).expanduser().parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).expanduser().write_text(json.dumps(out, indent=1))
    print(f"{len(out)} seeds from 100-track playlists created in the last {args.days} days "
          f"-> {args.out}")


# ---------------------------------------------------------------------- playlist building
class Builder:
    """Runs Alwyzon's own post-search steps on a replayed candidate list."""

    def __init__(self, db):
        from app.repositories.similarity_repository import SimilarityRepository
        from app.repositories.track_repository import TrackRepository

        self.db = db
        self.sim_repo = SimilarityRepository()
        self.track_repo = TrackRepository()
        self.details: Dict[str, Optional[Dict[str, Any]]] = {}
        self.apple: Dict[int, Dict[str, Any]] = {}
        self.refs: Dict[str, Optional[Dict[str, Any]]] = {}

    async def warm(self, uuids: List[str]) -> None:
        """Look every candidate up once, in batches, exactly as the live request does."""
        from app.services.apple_music_enrichment import fetch_apple_map

        todo = [u for u in dict.fromkeys(uuids) if u not in self.details]
        for i in range(0, len(todo), 2000):
            chunk = todo[i:i + 2000]
            found = await self.sim_repo.async_get_track_details_by_uuids(
                self.db, chunk, partner_id=PARTNER)
            for u in chunk:
                self.details[u] = found.get(u)
            ids = [d.get("track_id") for d in found.values() if d and d.get("track_id") is not None]
            ids = [i for i in ids if i not in self.apple]
            if ids:
                self.apple.update(await fetch_apple_map(self.db, ids) or {})
            print(f"\r  looked up {min(i + 2000, len(todo)):,}/{len(todo):,} tracks", end="", flush=True)
        if todo:
            print()

    async def reference(self, seed_uuid: str) -> Optional[Dict[str, Any]]:
        """The seed as get_similarity_by_path loads it: by uuid to path, then by path."""
        from app.services.apple_music_enrichment import fetch_apple_map

        if seed_uuid not in self.refs:
            path = await self.track_repo.async_get_track_path_by_uuid(self.db, seed_uuid, partner_id=PARTNER)
            ref = None
            if path:
                ref = await self.sim_repo.async_get_reference_track_details_by_path(
                    self.db, path, partner_id=PARTNER)
            if ref and ref.get("track_id") is not None and ref["track_id"] not in self.apple:
                self.apple.update(await fetch_apple_map(self.db, [ref["track_id"]]) or {})
            self.refs[seed_uuid] = ref
        return self.refs[seed_uuid]

    def playlist(self, ref, ranked: List[tuple], top_k: int) -> List[Dict[str, Any]]:
        """
        get_similarity_by_path from the similarity response onward, minus the write.

        The enrichment dict below is copied field for field from that method, so
        the dedup layers see exactly what they see live.
        """
        from app.utils.similarity_filters import filter_track_title
        from app.utils.similarity_utils import deduplicate_tracks

        filtered = self._filtered(ranked, top_k)
        ids = [t.get("track_id") for t in filtered if t.get("track_id") is not None]
        if ref and ref.get("track_id") is not None:
            ids.append(ref.get("track_id"))
        apple_map = {i: self.apple[i] for i in ids if i in self.apple}
        # live: target = top_k - duplication_threshold = 250 - 150 = 100
        return deduplicate_tracks(
            filtered, TOP_SK, reference_track=ref,
            filter_title_func=filter_track_title, apple_by_track_id=apple_map,
        )

    def _filtered(self, ranked: List[tuple], top_k: int) -> List[Dict[str, Any]]:
        """The candidate dicts exactly as the live request builds them, then filtered."""
        from app.utils.similarity_filters import apply_response_filtering

        enriched = []
        for rank, (uuid, score) in enumerate(ranked[:top_k], 1):
            d = self.details.get(uuid)
            if not d:
                continue
            enriched.append({
                "rank": rank, "score": score, "id": d.get("id"), "track_id": d.get("track_id"),
                "label": d.get("label"), "genre": d.get("genre"), "album": d.get("album"),
                "duration": d.get("duration"), "artist": d.get("artist"), "title": d.get("title"),
                "year": d.get("year"), "type": d.get("type"),
            })
        return apply_response_filtering(enriched)

    def length_only_merges(self, ranked: List[tuple], top_k: int) -> int:
        """
        Different songs the first de-dup layer removes only because their length matches.

        That layer keys on (filename, duration), but the live candidate dicts carry no
        filename, so the key is ("", duration). Any later track with the same length
        as an earlier one is dropped, same song or not. Counted here as drops where
        the two tracks share no song identity (Apple id, ISRC, artist + title).
        """
        first: Dict[Any, Dict[str, Any]] = {}
        wrong = 0
        for t in self._filtered(ranked, top_k):
            key = ("", t.get("duration", -1))
            if key in first:
                if not ((self.song_keys(t) - {("track", t.get("id"))})
                        & (self.song_keys(first[key]) - {("track", first[key].get("id"))})):
                    wrong += 1
            else:
                first[key] = t
        return wrong

    def song_keys(self, track: Dict[str, Any]) -> set:
        """
        Identities that make two catalogue tracks the same song, the same three the
        de-duplication uses: Apple song id, ISRC, or normalised artist + title.
        """
        from app.utils.similarity_filters import filter_track_title
        from app.utils.similarity_utils import _artist_title_key

        a = self.apple.get(track.get("track_id")) or {}
        keys = {("track", track.get("id"))}
        if a.get("apple_song_id"):
            keys.add(("apple", str(a["apple_song_id"])))
        if a.get("isrc"):
            keys.add(("isrc", str(a["isrc"])))
        at = _artist_title_key(track, a or None, filter_track_title)
        if at[0] and at[1]:
            keys.add(("name", at))
        return keys

    def song_overlap(self, a: List[Dict], b: List[Dict]) -> Optional[float]:
        """Share of A's songs also in B, so a different copy of the same song is not a change."""
        if not a or not b:
            return None
        bk = set().union(*(self.song_keys(t) for t in b))
        return sum(1 for t in a if self.song_keys(t) & bk) / len(a)

    def display(self, track: Dict[str, Any]) -> Dict[str, Any]:
        """What the API shows for a track: Apple's artist, title and album where matched."""
        from app.services.apple_music_enrichment import _merge_apple_into_track

        t = dict(track)
        _merge_apple_into_track(t, self.apple.get(t.get("track_id")))
        return t


# ---------------------------------------------------------------------- metrics
def concentration(tracks: List[Dict]) -> Dict[str, int]:
    def top(key):
        c = Counter((t.get(key) or "").strip().lower() for t in tracks)
        c.pop("", None)
        return max(c.values()) if c else 0
    return {"label": top("label"), "artist": top("artist"), "album": top("album")}


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def pct(x):
    return "n/a" if x is None else f"{100 * x:.0f}%"


def num(x, f="{:.1f}"):
    return "n/a" if x is None else f.format(x)


async def stored_playlist(db, playlist_uuid: str) -> List[str]:
    rows = (await db.execute(text(
        "SELECT t.uuid FROM playlists p JOIN playlist_tracks pt ON pt.playlist_id = p.id "
        "JOIN tracks t ON t.id = pt.track_id WHERE p.uuid = :u ORDER BY pt.position"
    ), {"u": playlist_uuid})).all()
    return [r[0] for r in rows]


# ---------------------------------------------------------------------- report
async def report(args) -> None:
    from app.utils.similarity_filters import filter_track_title
    from app.utils.similarity_utils import _artist_title_key

    scoped()
    with gzip.open(Path(args.replay).expanduser(), "rt", encoding="utf-8") as fh:
        rep = json.load(fh)
    meta, uuids, seeds, runs = rep["meta"], rep["uuids"], rep["seeds"], rep["runs"]
    configs = [c for c in meta["configs"] if c in runs]
    out_dir = Path(args.out_dir).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"replay from {meta['started_utc']} UTC: {len(seeds)} seeds, {len(configs)} configs")

    db = await read_only_session()
    b = Builder(db)
    try:
        all_uuids = [uuids[i] for c in configs for rows in runs[c].values() for i, _ in rows[:CUSHION_TEST_TOP_K]]
        pair_uuids = [u for p in rep.get("copy_pairs", []) for u in (p["a"], p["b"])]
        await b.warm(all_uuids + pair_uuids + [s["uuid"] for s in seeds])

        final: Dict[str, Dict[str, List[Dict]]] = {c: {} for c in configs}
        cushion: Dict[str, Dict[str, int]] = {c: {} for c in ("e4_ef16", "e4_ef512", "e4_exact")}
        for n, s in enumerate(seeds, 1):
            u = s["uuid"]
            ref = await b.reference(u)
            for c in configs:
                rows = runs[c].get(u)
                if rows is None:
                    continue
                ranked = [(uuids[i], sc) for i, sc in rows]
                final[c][u] = b.playlist(ref, ranked, PROD_TOP_K)
                if c in cushion:
                    cushion[c][u] = len(b.playlist(ref, ranked, CUSHION_TEST_TOP_K))
            if n % 25 == 0 or n == len(seeds):
                print(f"\r  built playlists for {n}/{len(seeds)} seeds", end="", flush=True)
        print()

        groups = {}
        for s in seeds:
            groups.setdefault(s["group"].split(":")[0], []).append(s)
        random_seeds = [s["uuid"] for s in groups.get("random", [])]

        md = [
            "# Similarity replay, playlists as users would get them",
            "",
            f"Replay {meta['started_utc']} UTC, report {time.strftime('%Y-%m-%d %H:%M')} UTC. "
            "Read only. Built with Alwyzon's own lookup, filtering and de-duplication, "
            f"{PROD_TOP_K} candidates in, {TOP_SK} tracks out, as a live 100-track search does.",
            "",
        ]

        # 1. proof the replay is faithful
        md += ["## 1. Does the replay reproduce production?", "",
               "E4 at efSearch 16 is what production runs. If the replay is right, its playlist for a seed",
               "matches the playlist production stored for that seed.", "",
               "| seed | stored | same tracks | same order |", "|---|---|---|---|"]
        checks = []
        for s in seeds:
            g = s["group"]
            if g.startswith("baseline:"):
                pl = BASELINE_PLAYLISTS.get(g.split(":", 1)[1])
            elif g.startswith("prod:"):
                pl = g.split(":", 1)[1]
            else:
                continue
            got = final["e4_ef16"].get(s["uuid"]) or []
            want = await stored_playlist(db, pl) if pl else []
            if not want or not got:
                md.append(f"| {g} | {len(want)} | not comparable, "
                          f"{'stored playlist not found' if not want else 'replay produced nothing'} | |")
                continue
            gu = [t["id"] for t in got]
            same = len(set(gu) & set(want)) / max(len(want), 1)
            order = sum(1 for x, y in zip(gu, want) if x == y) / max(len(want), 1)
            checks.append((g, same, order, len(want)))
        for g, same, order, n_want in [c for c in checks if c[0].startswith("baseline")]:
            md.append(f"| {g.split(':', 1)[1]} | {n_want} | {pct(same)} | {pct(order)} |")
        prod = [c for c in checks if c[0].startswith("prod")]
        if prod:
            md.append(f"| {len(prod)} recent production playlists, median | 100 | "
                      f"{pct(med([c[1] for c in prod]))} | {pct(med([c[2] for c in prod]))} |")
            md.append(f"| ... of which identical track sets | | {sum(c[1] >= 0.999 for c in prod)}/{len(prod)} | |")
        md += ["", "> Anything well below 100% means the replay is not faithful and the rest of this report "
               "should not be trusted until that is explained. Playlists made before the last index "
               "change can legitimately differ.", ""]

        # 2. how much each fix changes what users get
        md += ["## 2. What each fix changes, over the random seeds", "",
               f"{len(random_seeds)} random catalogue tracks as seeds. Overlap is against today's playlist for the same seed, counted by song, so a different copy of the same song is not a change.", "",
               "| config | same songs as today | playlists short of 100 | most from one label | most by one artist | most from one album |",
               "|---|---|---|---|---|---|"]
        base = final.get("e4_ef16", {})
        for c in configs:
            ov, short, lab, art, alb = [], 0, [], [], []
            for u in random_seeds:
                pl = final[c].get(u)
                if pl is None:
                    continue
                ov.append(b.song_overlap(pl, base.get(u)) if c != "e4_ef16" else 1.0)
                short += len(pl) < TOP_SK
                conc = concentration([b.display(t) for t in pl])
                lab.append(conc["label"]); art.append(conc["artist"]); alb.append(conc["album"])
            md.append(f"| {CONFIG_LABELS.get(c, c)} | {pct(med(ov))} | {short}/{len(lab)} | "
                      f"{num(mean(lab))} | {num(mean(art))} | {num(mean(alb))} |")
        md += ["", "> Label, artist and album columns are the average, per playlist, of the largest number of "
               "tracks sharing one label, one artist or one album. They show whether a fix makes playlists more "
               "or less clustered.", ""]

        # 3. cushion
        md += ["## 3. Is the 150-track cushion enough once search finds more copies?", "",
               "| config | short of 100 with 250 candidates (today) | short with 400 candidates |", "|---|---|---|"]
        for c, per in cushion.items():
            if not per:
                continue
            short250 = sum(len(final[c].get(u) or []) < TOP_SK for u in random_seeds if u in per)
            short400 = sum(per[u] < TOP_SK for u in random_seeds if u in per)
            md.append(f"| {CONFIG_LABELS[c]} | {short250}/{len(random_seeds)} | {short400}/{len(random_seeds)} |")
        md.append("")

        # 4. George's close-sound case
        md += ["## 4. Do close-sound searches return the same tracks? (George's case)", "",
               "Each anchor is a random track. Its related seeds are other tracks close to it in sound, the "
               "Nth closest distinct track. Overlap is between the anchor's playlist and the related seed's.", "",
               "| config | " + " | ".join(f"Nth = {r}" for r in meta.get("related_ranks", [])) + " |",
               "|---|" + "---|" * len(meta.get("related_ranks", []))]
        rel = [s for s in seeds if s["group"].startswith("related:")]
        for c in configs:
            cells = []
            for r in meta.get("related_ranks", []):
                vals = []
                for s in rel:
                    _, anchor, rr = s["group"].split(":")
                    if int(rr) == r:
                        vals.append(b.song_overlap(final[c].get(anchor) or [], final[c].get(s["uuid"]) or []))
                cells.append(pct(mean(vals)))
            md.append(f"| {CONFIG_LABELS.get(c, c)} | " + " | ".join(cells) + " |")
        md += ["", "> If efSearch 16 made close searches converge on the same tracks, today's row would sit clearly "
               "above the perfect-search row. Similar overlap in both rows means the overlap comes from the "
               "music being similar, which is expected.", ""]

        # 5. copies
        pairs = rep.get("copy_pairs", [])
        if pairs:
            md += ["## 5. Are the 0.999 neighbours really the same recording?", "",
                   "Pairs of different catalogue tracks, sampled by how close their MAEST vectors are.", "",
                   "| band | pairs | same Apple song | same ISRC | same artist + title | length within 1 s | any of these |",
                   "|---|---|---|---|---|---|---|"]
            for band, label in (("copy", "0.999 and above"), ("near", "0.99 to 0.999"), ("control", "0.95 to 0.99")):
                ps = [p for p in pairs if p["band"] == band]
                tally = Counter()
                for p in ps:
                    da, db_ = b.details.get(p["a"]), b.details.get(p["b"])
                    if not da or not db_:
                        tally["missing"] += 1
                        continue
                    aa, ab = b.apple.get(da.get("track_id")) or {}, b.apple.get(db_.get("track_id")) or {}
                    hits = {
                        "apple": bool(aa.get("apple_song_id")) and aa.get("apple_song_id") == ab.get("apple_song_id"),
                        "isrc": bool(aa.get("isrc")) and aa.get("isrc") == ab.get("isrc"),
                        "name": _artist_title_key(da, aa or None, filter_track_title)
                        == _artist_title_key(db_, ab or None, filter_track_title),
                        "len": da.get("duration") is not None and db_.get("duration") is not None
                        and abs(float(da["duration"]) - float(db_["duration"])) <= 1.0,
                    }
                    for k, v in hits.items():
                        tally[k] += v
                    tally["any"] += any(hits.values())
                    tally["n"] += 1
                n = max(tally["n"], 1)
                md.append(f"| {label} | {tally['n']} | {pct(tally['apple'] / n)} | {pct(tally['isrc'] / n)} | "
                          f"{pct(tally['name'] / n)} | {pct(tally['len'] / n)} | **{pct(tally['any'] / n)}** |")
            md.append("")

        # 6. weights from the media box
        w = rep.get("weights", {})
        if w:
            md += ["## 6. What the 70/30 blend really weighs (from the media box)", "",
                   "| | E4 efSearch 512 | E4 perfect search |", "|---|---|---|"]
            for label, key, f in (("MAEST score spread", "sd_maest_median", "{:.4f}"),
                                  ("Discogs score spread", "sd_discogs_median", "{:.4f}"),
                                  ("MAEST's effective share", "maest_effective_share_median", "{:.0%}"),
                                  ("final order vs MAEST order", "rho_blend_vs_maest_median", "{:.2f}"),
                                  ("final order vs Discogs order", "rho_blend_vs_discogs_median", "{:.2f}")):
                md.append(f"| {label} | " + " | ".join(
                    num(w.get(c, {}).get(key), f) for c in ("e4_ef512", "e4_exact")) + " |")
            md.append("")

        # 7. baseline playlists under every config
        md += ["## 7. The two baseline playlists under each fix", "",
               "TSV files in the same format as the saved baselines are written next to this report. "
               "Diff them on the Mac with compare_playlists.py.", "",
               "| config | Solina, same songs as today | Bedevilment, same songs as today |", "|---|---|---|"]
        bl = {s["group"].split(":", 1)[1]: s["uuid"] for s in seeds if s["group"].startswith("baseline:")}
        for c in configs:
            cells = []
            for name in ("solina", "bedevilment"):
                u = bl.get(name)
                cells.append(pct(b.song_overlap(final[c].get(u) or [], base.get(u) or [])) if u else "n/a")
            md.append(f"| {CONFIG_LABELS.get(c, c)} | " + " | ".join(cells) + " |")
            for name, u in bl.items():
                pl = final[c].get(u)
                if not pl:
                    continue
                ref = b.refs.get(u) or {}
                lines = [
                    "# Baseline playlist for similarity-approach comparison",
                    f"# seed_id\t{u}",
                    f"# seed\t{ref.get('artist', '')} - {ref.get('title', '')}",
                    f"# approach\t{CONFIG_LABELS.get(c, c)} (offline replay)",
                    f"# captured\t{meta['started_utc'][:10]}",
                    "rank\tscore\tid\tartist\ttitle\tlabel\talbum",
                ]
                for i, t in enumerate(pl, 1):
                    d = b.display(t)
                    cells_t = [str(i), f"{float(d.get('score') or 0):.8f}", str(d.get("id") or ""),
                               d.get("artist") or "", d.get("title") or "", d.get("label") or "", d.get("album") or ""]
                    lines.append("\t".join(x.replace("\t", " ") for x in cells_t))
                (out_dir / f"{name}__{c.replace('_', '-')}.tsv").write_text("\n".join(lines) + "\n")
        md.append("")

        # 8. the length-only de-dup layer
        merges, no_len = [], 0
        for u in random_seeds:
            rows = runs.get("e4_ef16", {}).get(u)
            if not rows:
                continue
            ranked = [(uuids[i], sc) for i, sc in rows]
            merges.append(b.length_only_merges(ranked, PROD_TOP_K))
            no_len += sum(1 for t in b._filtered(ranked, PROD_TOP_K) if t.get("duration") in (None, -1))
        md += ["## 8. The first de-dup layer merges tracks by length alone", "",
               "deduplicate_tracks keys its first layer on (filename, duration), but no filename reaches it "
               "in the live request, so any two candidates with the same length are merged. Today's E4, "
               f"{len(merges)} random seeds, {PROD_TOP_K} candidates each.", "",
               "| | value |", "|---|---|",
               f"| different songs removed only for matching length, average per search | {num(mean(merges), '{:.2f}')} |",
               f"| searches where it happened at least once | {sum(m > 0 for m in merges)}/{len(merges)} |",
               f"| candidates with no length at all (these all share one key) | {no_len} |", ""]

        (out_dir / "replay_report.md").write_text("\n".join(md) + "\n")
        with gzip.open(out_dir / "final_playlists.json.gz", "wt", encoding="utf-8") as fh:
            json.dump({c: {u: [t["id"] for t in pl] for u, pl in per.items()} for c, per in final.items()}, fh)
        print(f"written {out_dir / 'replay_report.md'} and {len(list(out_dir.glob('*.tsv')))} baseline TSVs")
    finally:
        await db.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export-seeds")
    e.add_argument("--days", type=int, default=7)
    e.add_argument("--limit", type=int, default=40)
    e.add_argument("--out", default="~/usman/similarity-quality/prod_seeds.json")
    r = sub.add_parser("report")
    r.add_argument("--replay", default="~/usman/similarity-quality/replay.json.gz")
    r.add_argument("--out-dir", default="~/usman/similarity-quality/out")
    args = ap.parse_args()
    asyncio.run(export_seeds(args) if args.cmd == "export-seeds" else report(args))


if __name__ == "__main__":
    main()

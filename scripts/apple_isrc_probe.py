#!/usr/bin/env python3
"""Ask Apple exactly what our export asked it, for one track. READ-ONLY.

WHY

2026-09-08: George exported a 100-track playlist from a `gr` storefront. Position 2 came
back as a completely unrelated song:

    ours   1149004988  Cristian Vogel - Hold        (isrc DEX181600071)
    added  1450300101  Ed Prosek - I Could Never

Verified independently (public iTunes lookup): id 1149004988 resolves to Cristian Vogel -
Hold in BOTH `us` and `gr`. So the stored id was already valid in the user's storefront and
the export replaced it with a wrong one.

The export does that because `same_storefront` is false (catalogue `us`, user `gr`), which
sends every track with an ISRC through `_resolve_songs_by_isrc`, and anything that misses
there falls through to a title+artist search that returns `songs[0]` UNVERIFIED.

So there are exactly two ways position 2 became Ed Prosek:

  A. Apple's ISRC index in `gr` returns Ed Prosek for DEX181600071 (bad/duplicated ISRC
     data on Apple's side). We would then have used it faithfully, because nothing checks
     that what came back is the same recording.
  B. The ISRC lookup returned nothing usable (no match, or no `attributes.isrc` to key on),
     the track fell through to the search fallback, and `songs[0]` was Ed Prosek.

They need different fixes, so this prints the raw evidence for both instead of guessing.
Run it on Alwyzon, where the Apple credentials live.

USAGE

    python scripts/apple_isrc_probe.py --isrc DEX181600071 --song-id 1149004988 \
        --title "Hold" --artist "Cristian Vogel" --storefront gr

    # compare the two storefronts side by side
    python scripts/apple_isrc_probe.py --isrc DEX181600071 --song-id 1149004988 \
        --title "Hold" --artist "Cristian Vogel" --storefront gr --also-storefront us
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional

import time  # noqa: E402

import jwt  # noqa: E402
import requests  # noqa: E402

APPLE_API = "https://api.music.apple.com"


def mint_dev_token() -> str:
    """Mint an Apple developer token from the same env the service uses.

    Deliberately does NOT import the app. Pulling in AppleMusicTransferService drags the
    whole repository/service graph in with it, so an unrelated broken import anywhere in
    the app stops a read-only diagnostic from running. The token is 20 lines of JWT.

    Claims are iss/iat/exp ONLY, matching _generate_developer_token: any extra claim makes
    MusicKit reject the token. The catalog API used here tolerates extras, but keeping the
    two identical means this probe tests the same token the export actually sends.
    """
    team = (os.getenv("APPLE_TEAM_ID") or "").strip()
    kid = (os.getenv("APPLE_KEY_ID") or "").strip()
    pem = os.getenv("APPLE_PRIVATE_KEY_PEM")
    path = (os.getenv("APPLE_PRIVATE_KEY_PATH") or "").strip()

    if not team or not kid:
        raise RuntimeError("APPLE_TEAM_ID and APPLE_KEY_ID must be set")
    if not pem:
        if not path:
            raise RuntimeError("Set APPLE_PRIVATE_KEY_PEM or APPLE_PRIVATE_KEY_PATH")
        if not os.path.exists(path):
            raise RuntimeError(f"Apple private key not found at {path}")
        with open(path, "r") as fh:
            pem = fh.read()

    now = int(time.time())
    tok = jwt.encode({"iss": team, "iat": now, "exp": now + 3600},
                     pem, algorithm="ES256", headers={"alg": "ES256", "kid": kid})
    return tok.decode("utf-8") if isinstance(tok, bytes) else tok


def apple_headers(dev_token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {dev_token}", "Accept": "application/json"}


def show(songs: List[Dict[str, Any]], indent: str = "    ") -> None:
    if not songs:
        print(f"{indent}(nothing returned)")
        return
    for s in songs:
        a = s.get("attributes") or {}
        # `isrc` is the field the export keys its mapping on. If Apple omits it, the export
        # silently drops the song and falls through to the search path, so print it even
        # when it is absent.
        isrc = a.get("isrc", "<ABSENT FROM RESPONSE>")
        dur = a.get("durationInMillis")
        print(f"{indent}id={s.get('id'):<12} isrc={isrc:<16} "
              f"{a.get('artistName')} - {a.get('name')}"
              + (f"  [{a.get('albumName')}]" if a.get("albumName") else "")
              + (f"  {dur // 1000}s" if dur else ""))


def get(url: str, headers: Dict[str, str], params: Optional[Dict[str, Any]] = None):
    try:
        r = requests.get(url, headers=headers, params=params, timeout=30)
        return r
    except Exception as exc:
        print(f"    request failed: {exc}")
        return None


def probe(dev_token: str, sf: str, args) -> None:
    headers = apple_headers(dev_token)
    print(f"\n{'=' * 78}\nSTOREFRONT: {sf}\n{'=' * 78}")

    # 1. The exact call the export makes for a cross-storefront track.
    print(f"\n1. filter[isrc]={args.isrc}   (what _resolve_songs_by_isrc asks)")
    r = get(f"{APPLE_API}/v1/catalog/{sf}/songs", headers, {"filter[isrc]": args.isrc})
    if r is not None:
        print(f"    HTTP {r.status_code}")
        if r.ok:
            data = (r.json().get("data") or [])
            print(f"    {len(data)} song(s) returned"
                  + ("  <-- the export takes the FIRST of these" if data else ""))
            show(data)
        else:
            print(f"    {r.text[:300]}")

    # 2. Our stored id, looked up in this storefront.
    if args.song_id:
        print(f"\n2. songs/{args.song_id}   (our stored apple_song_id, used directly)")
        r = get(f"{APPLE_API}/v1/catalog/{sf}/songs/{args.song_id}", headers)
        if r is not None:
            print(f"    HTTP {r.status_code}")
            show((r.json().get("data") or []) if r.ok else [])

    # 3. The equivalent-id endpoint the export does NOT currently use. This is the correct
    #    tool for translating an id between storefronts and needs no ISRC at all.
    if args.song_id:
        print(f"\n3. filter[equivalents]={args.song_id}   (endpoint we do NOT use yet)")
        r = get(f"{APPLE_API}/v1/catalog/{sf}/songs", headers,
                {"filter[equivalents]": args.song_id})
        if r is not None:
            print(f"    HTTP {r.status_code}")
            show((r.json().get("data") or []) if r.ok else [])

    # 4. The unverified fallback. The export takes songs[0] with no title/artist check.
    if args.title:
        term = f"{args.title} {args.artist}".strip() if args.artist else args.title
        print(f"\n4. search term={term!r}   (fallback; export takes result #1 unchecked)")
        r = get(f"{APPLE_API}/v1/catalog/{sf}/search", headers,
                {"term": term, "limit": 3, "types": "songs"})
        if r is not None:
            print(f"    HTTP {r.status_code}")
            songs = ((((r.json().get("results") or {}).get("songs") or {}).get("data")) or []) if r.ok else []
            for i, s in enumerate(songs, 1):
                a = s.get("attributes") or {}
                mark = "  <-- THIS ONE IS USED" if i == 1 else ""
                print(f"    {i}. id={s.get('id'):<12} {a.get('artistName')} - {a.get('name')}{mark}")
            if not songs:
                print("    (nothing returned)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--isrc", required=True)
    ap.add_argument("--song-id", help="Our stored apple_song_id.")
    ap.add_argument("--title")
    ap.add_argument("--artist")
    ap.add_argument("--storefront", default="gr")
    ap.add_argument("--also-storefront", help="Second storefront to compare against, e.g. us.")
    args = ap.parse_args()

    try:
        dev_token = mint_dev_token()
    except Exception as exc:
        print(f"Could not mint an Apple developer token: {exc}\n"
              f"This needs APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY_PATH set, so run "
              f"it on Alwyzon.", file=sys.stderr)
        return 1

    probe(dev_token, args.storefront, args)
    if args.also_storefront:
        probe(dev_token, args.also_storefront, args)

    print(f"\n{'=' * 78}\nHOW TO READ THIS\n{'=' * 78}")
    print("Section 1 returns Ed Prosek        -> cause A: Apple's ISRC data is wrong, and we")
    print("                                      trusted it over an id we already knew was good.")
    print("Section 1 empty / no isrc field    -> cause B: the lookup missed, and section 4")
    print("                                      shows what the unverified fallback picked.")
    print("Section 2 returns Cristian Vogel   -> the stored id was valid here all along, so the")
    print("                                      re-resolution was unnecessary for this track.")
    print("Section 3 returns Cristian Vogel   -> filter[equivalents] is the correct fix: it")
    print("                                      translates ids between storefronts directly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

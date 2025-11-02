"""
- Issues Apple Music developer token (JWT ES256) at GET /apple/developer-token
- Transfers a playlist to user's Apple Music library at POST /apple/transfer
  by creating a playlist and adding mapped tracks

All comments are in English.

Environment variables:
  APPLE_TEAM_ID            (required) Apple Developer Team ID
  APPLE_KEY_ID             (required) MusicKit Key ID
  APPLE_PRIVATE_KEY_PATH   (optional) Path to AuthKey_*.p8
  APPLE_PRIVATE_KEY_PEM    (optional) Raw PEM (if not using path)
  APPLE_TOKEN_TTL          (optional) TTL in seconds (default 15552000 ~ 180 days)
  APPLE_STOREFRONT         (optional) Catalog storefront (default 'us')
  CORS_ALLOW_ORIGINS       (optional) CSV list of origins or '*' (default '*')

  RESOMIX_FETCH_URL_TEMPLATE (optional) URL template to fetch tracks by playlist_id.
                               You can use placeholders: {playlist_id} and {api_key}
  RESOMIX_API_KEY            (optional) API key to inject into template

Run:
  uvicorn apple_music_backend:app --host 0.0.0.0 --port 8000 --reload
or:
  python apple_music_backend.py

Request examples:
  GET  /apple/developer-token
  POST /apple/transfer
    {
      "playlist_id": "abc123",
      "music_user_token": "<MUSIC_USER_TOKEN>",
      "developer_token": null,  // optional, backend will generate if missing
      "playlist_name": "My Imported Playlist",
      "tracks": [
        {"isrc": "USUM71705355", "title": "Something Just Like This", "artist": "The Chainsmokers"},
        {"title": "Around the World", "artist": "Daft Punk"}
      ]
    }

Response schema:
  {
    "success": true/false,
    "message": "...",
    "error": "...",
    "data": {
      "created_playlist_id": "...",
      "created_playlist_name": "...",
      "storefront": "...",
      "matched": 10,
      "unmatched": 2,
      "errors": [...optional...]
    }
  }
"""

import os
import time
import json
from typing import List, Optional, Dict, Any, Tuple

import requests
import jwt  # PyJWT
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APPLE_API = "https://api.music.apple.com"
APPLE_AUDIENCE = "https://music.apple.com"

# ----------------------------
# Config & token cache
# ----------------------------
TEAM_ID = os.getenv("APPLE_TEAM_ID", "").strip()
KEY_ID = os.getenv("APPLE_KEY_ID", "").strip()
PRIVATE_KEY_PATH = os.getenv("APPLE_PRIVATE_KEY_PATH", "").strip()
PRIVATE_KEY_PEM = os.getenv("APPLE_PRIVATE_KEY_PEM", "").strip()
TOKEN_TTL = int(os.getenv("APPLE_TOKEN_TTL", "15552000"))  # 180 days by default
STOREFRONT = os.getenv("APPLE_STOREFRONT", "us").lower()

CORS_ORIGINS_ENV = os.getenv("CORS_ALLOW_ORIGINS", "*")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_ENV.split(",")] if CORS_ORIGINS_ENV != "*" else ["*"]

RESOMIX_FETCH_URL_TEMPLATE = os.getenv("RESOMIX_FETCH_URL_TEMPLATE", "").strip()
RESOMIX_API_KEY = os.getenv("RESOMIX_API_KEY", "").strip()

_token_cache: Dict[str, Any] = {
    "token": None,
    "exp_ms": 0,
}

# ----------------------------
# Models
# ----------------------------
class InTrack(BaseModel):
    isrc: Optional[str] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None


class TransferRequest(BaseModel):
    playlist_id: str = Field(..., description="ResomiX playlist id (or external id)")
    music_user_token: str = Field(..., description="Apple Music User Token (from MusicKit.authorize())")
    developer_token: Optional[str] = Field(None, description="Developer token (if omitted, backend will generate)")
    playlist_name: Optional[str] = Field(None, description="Custom playlist name")
    tracks: Optional[List[InTrack]] = Field(None, description="Optional tracks to import (if omitted, backend may fetch via RESOMIX_FETCH_URL_TEMPLATE)")


class TransferResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# ----------------------------
# Helpers
# ----------------------------
def _load_private_key() -> str:
    if PRIVATE_KEY_PEM:
        return PRIVATE_KEY_PEM
    if PRIVATE_KEY_PATH and os.path.exists(PRIVATE_KEY_PATH):
        with open(PRIVATE_KEY_PATH, "r") as f:
            return f.read()
    raise RuntimeError("Missing Apple private key (set APPLE_PRIVATE_KEY_PATH or APPLE_PRIVATE_KEY_PEM)")


def _generate_developer_token() -> Tuple[str, int]:
    """
    Returns (token, expires_at_ms)
    """
    if not TEAM_ID or not KEY_ID:
        raise RuntimeError("APPLE_TEAM_ID and APPLE_KEY_ID are required")

    private_key = _load_private_key()
    now = int(time.time())
    payload = {
        "iss": TEAM_ID,
        "iat": now,
        "exp": now + TOKEN_TTL,
        "aud": APPLE_AUDIENCE,
    }
    headers = {
        "alg": "ES256",
        "kid": KEY_ID,
    }
    token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    expires_at_ms = (now + TOKEN_TTL) * 1000
    return token, expires_at_ms


def get_or_create_dev_token() -> Tuple[str, int]:
    """
    Returns cached or newly generated developer token and expiry in ms.
    Regenerates if expiring within 5 minutes.
    """
    now_ms = int(time.time() * 1000)
    if _token_cache["token"] and now_ms < _token_cache["exp_ms"] - 5 * 60 * 1000:
        return _token_cache["token"], _token_cache["exp_ms"]

    token, exp_ms = _generate_developer_token()
    _token_cache["token"] = token
    _token_cache["exp_ms"] = exp_ms
    return token, exp_ms


def apple_headers(dev_token: str, user_token: Optional[str] = None) -> Dict[str, str]:
    h = {
        "Authorization": f"Bearer {dev_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if user_token:
        h["Music-User-Token"] = user_token
    return h


def search_song(dev_token: str, isrc: Optional[str] = None, title: Optional[str] = None, artist: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Tries to find a catalog song:
      1) By ISRC (fast and accurate)
      2) By search term "title artist" (best effort)
    Returns first matched song object with id and type 'songs' or None.
    """
    session = requests.Session()

    # 1) ISRC filter
    if isrc:
        url = f"{APPLE_API}/v1/catalog/{STOREFRONT}/songs"
        params = { "filter[isrc]": isrc, "limit": 1 }
        r = session.get(url, headers=apple_headers(dev_token), params=params, timeout=30)
        if r.ok:
            js = r.json()
            items = js.get("data") or []
            if items:
                return items[0]

    # 2) Search by title+artist
    if title and artist:
        term = f"{title} {artist}"
    elif title:
        term = title
    else:
        term = None

    if term:
        url = f"{APPLE_API}/v1/catalog/{STOREFRONT}/search"
        params = { "term": term, "limit": 3, "types": "songs" }
        r = session.get(url, headers=apple_headers(dev_token), params=params, timeout=30)
        if r.ok:
            js = r.json()
            songs = (((js.get("results") or {}).get("songs") or {}).get("data")) or []
            if songs:
                return songs[0]

    return None


def create_playlist(dev_token: str, user_token: str, name: str, description: Optional[str] = None) -> str:
    """
    Creates a library playlist and returns its library id.
    """
    url = f"{APPLE_API}/v1/me/library/playlists"
    payload = {
        "attributes": {
            "name": name,
        }
    }
    if description:
        payload["attributes"]["description"] = description

    r = requests.post(url, headers=apple_headers(dev_token, user_token), data=json.dumps(payload), timeout=30)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"Failed to create playlist: {r.text}")

    js = r.json()
    data = js.get("data") or []
    if not data:
        raise HTTPException(status_code=500, detail=f"Empty response while creating playlist: {js}")
    playlist_id = data[0].get("id")
    if not playlist_id:
        raise HTTPException(status_code=500, detail=f"No playlist id returned: {js}")
    return playlist_id


def add_tracks_to_playlist(dev_token: str, user_token: str, playlist_id: str, catalog_song_ids: List[str]) -> None:
    """
    Adds catalog songs (type 'songs') to a user library playlist in batches of 100.
    """
    if not catalog_song_ids:
        return

    url = f"{APPLE_API}/v1/me/library/playlists/{playlist_id}/tracks"
    batch_size = 100
    for i in range(0, len(catalog_song_ids), batch_size):
        batch = catalog_song_ids[i:i + batch_size]
        payload = {
            "data": [{"id": sid, "type": "songs"} for sid in batch]
        }
        r = requests.post(url, headers=apple_headers(dev_token, user_token), data=json.dumps(payload), timeout=30)
        if not r.ok:
            raise HTTPException(status_code=r.status_code, detail=f"Failed to add tracks batch: {r.text}")


def fetch_tracks_from_resomix(playlist_id: str) -> List[InTrack]:
    """
    Optional helper: fetches tracks from external service via RESOMIX_FETCH_URL_TEMPLATE.
    Expected that response JSON contains a list of tracks with fields compatible with InTrack
    (e.g., [{ "isrc": "...", "title": "...", "artist": "..." }, ...]).
    """
    if not RESOMIX_FETCH_URL_TEMPLATE:
        raise HTTPException(status_code=400, detail="tracks not provided and RESOMIX_FETCH_URL_TEMPLATE not configured")

    url = RESOMIX_FETCH_URL_TEMPLATE
    url = url.replace("{playlist_id}", requests.utils.quote(playlist_id, safe=""))
    url = url.replace("{api_key}", requests.utils.quote(RESOMIX_API_KEY or "", safe=""))

    r = requests.get(url, timeout=60)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=f"Failed to fetch tracks from template: {r.text}")

    js = r.json()
    # Accept either direct list, or { tracks: [...] }
    if isinstance(js, list):
        lst = js
    else:
        lst = js.get("tracks") or []

    tracks: List[InTrack] = []
    for o in lst:
        tracks.append(InTrack(
            isrc=o.get("isrc"),
            title=o.get("title"),
            artist=o.get("artist") or o.get("artists") or o.get("artist_name"),
            album=o.get("album") or o.get("album_name"),
        ))
    return tracks


# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title="Minimal Apple Music Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "storefront": STOREFRONT}


@app.get("/apple/developer-token")
def get_developer_token():
    try:
        token, exp_ms = get_or_create_dev_token()
        return {"token": token, "expires_at": exp_ms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/apple/transfer", response_model=TransferResponse)
def transfer(req: TransferRequest):
    """
    Creates a new library playlist for the user and adds matched tracks.
    """
    # 1) Ensure developer token
    if req.developer_token:
        dev_token = req.developer_token
        exp_ms = int(time.time() * 1000) + 60 * 60 * 1000  # unknown; not used
    else:
        try:
            dev_token, exp_ms = get_or_create_dev_token()
        except Exception as e:
            return TransferResponse(success=False, error=f"Failed to generate developer token: {e}")

    # 2) Resolve tracks
    try:
        if req.tracks and len(req.tracks) > 0:
            tracks = req.tracks
        else:
            tracks = fetch_tracks_from_resomix(req.playlist_id)
    except HTTPException as he:
        return TransferResponse(success=False, error=f"Tracks fetch error: {he.detail}")
    except Exception as e:
        return TransferResponse(success=False, error=f"Tracks fetch error: {e}")

    if not tracks:
        return TransferResponse(success=False, error="No tracks to import")

    # 3) Map tracks to Apple catalog song ids
    matched_ids: List[str] = []
    unmatched: List[Dict[str, Any]] = []
    for t in tracks:
        try:
            song = search_song(dev_token, isrc=t.isrc, title=t.title, artist=t.artist)
            if song and song.get("id"):
                matched_ids.append(song["id"])
            else:
                unmatched.append(t.dict())
        except Exception as e:
            unmatched.append({**t.dict(), "_error": str(e)})

    # 4) Create playlist
    playlist_name = req.playlist_name or f"ResomiX import {time.strftime('%Y-%m-%d %H:%M')}"
    try:
        pl_id = create_playlist(dev_token, req.music_user_token, playlist_name, description="Imported via ResomiX")
    except HTTPException as he:
        return TransferResponse(success=False, error=he.detail)
    except Exception as e:
        return TransferResponse(success=False, error=f"Failed to create playlist: {e}")

    # 5) Add tracks (if any matched)
    try:
        add_tracks_to_playlist(dev_token, req.music_user_token, pl_id, matched_ids)
    except HTTPException as he:
        return TransferResponse(success=False, error=he.detail, data={
            "created_playlist_id": pl_id,
            "created_playlist_name": playlist_name,
            "storefront": STOREFRONT,
            "matched": len(matched_ids),
            "unmatched": len(unmatched),
            "errors": ["Failed while adding tracks"],
        })
    except Exception as e:
        return TransferResponse(success=False, error=f"Failed to add tracks: {e}", data={
            "created_playlist_id": pl_id,
            "created_playlist_name": playlist_name,
            "storefront": STOREFRONT,
            "matched": len(matched_ids),
            "unmatched": len(unmatched),
        })

    return TransferResponse(
        success=True,
        message="Playlist transferred to Apple Music",
        data={
            "created_playlist_id": pl_id,
            "created_playlist_name": playlist_name,
            "storefront": STOREFRONT,
            "matched": len(matched_ids),
            "unmatched": len(unmatched),
            "unmatched_examples": unmatched[:5],
        },
    )


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("apple_music_backend:app", host=host, port=port, reload=True)

"""
Chunked, idempotent, concurrency-safe persistence of validated ingestion records.
==================================================================================

This is the live-path port of ``scripts/finalize_ingest_log.py`` — the logic that
got the 48k open-tracks batch into the DB after the single-transaction
``apply_ingestion_result`` hung. Used by ``apply_ingestion_result`` so a 50–100k
partner batch can't hang the admin poll.

Why it can't hang:
  • **Fresh session per chunk** — a chunk that errors is discarded, never poisoning
    the others (this is what avoided the MissingGreenlet cascade the one-transaction
    path hit). Each chunk commits independently.
  • **Skip-existing by uuid** — re-running (the next poll, or a retry) resumes instead
    of restarting, and concurrent polls converge (a uuid another poll already inserted
    is counted as done, not a failure).
  • **Bounded per call** — ``max_chunks`` caps how much one poll does, so the admin
    request returns quickly; the remainder is finished by subsequent polls.

Correctness fixes folded in (vs the old inline persist):
  • ``stored_path`` is uuid-keyed (``internal/raw/<uuid><ext>``) → no uq_audio_path
    collision on duplicate filenames.
  • ``p_line_year`` clamped to the mysql.YEAR range.
  • genres created in their own committed session → no dangling FK on chunk rollback.
"""

import logging
import os
import uuid as _uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, text

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.models.track_processing_status import TrackProcessingStatus

logger = logging.getLogger(__name__)

# Process-wide genre cache: lowercased name -> genres.id.
_GENRE_CACHE: Dict[str, int] = {}


async def _ensure_genre(name) -> Optional[int]:
    """Resolve a genre name -> genres.id, creating it in its OWN committed session so
    the id is valid even if a caller's chunk later rolls back."""
    if not name or not str(name).strip():
        return None
    key = str(name).strip().lower()
    if key in _GENRE_CACHE:
        return _GENRE_CACHE[key]
    clean = str(name).strip()[:80]
    async with AsyncSessionLocal() as gdb:
        await gdb.execute(text("INSERT IGNORE INTO genres (name) VALUES (:n)"), {"n": clean})
        await gdb.commit()
        row = (await gdb.execute(text("SELECT id FROM genres WHERE name = :n"), {"n": clean})).first()
    gid = row[0] if row else None
    if gid:
        _GENRE_CACHE[key] = gid
    return gid


def _safe_year(y) -> Optional[int]:
    """mysql.YEAR accepts 1901..2155; clamp anything else to NULL."""
    try:
        yi = int(y)
    except (TypeError, ValueError):
        return None
    return yi if 1901 <= yi <= 2155 else None


def _stored_path_for(uuid_val: str, audio_fn: str) -> str:
    """Unique, uuid-keyed stored path (the file physically lives at raw/<uuid>.mp3)."""
    ext = os.path.splitext(audio_fn or "")[1].lower()
    return f"internal/raw/{uuid_val}{ext}"


async def _persist_one(db, rec: Dict[str, Any], party_id, partner_id: int, env: str, log_id: int) -> None:
    """Insert Track + AudioFile + TrackProcessingStatus for one record. Caller owns the
    transaction. Mirrors the field mapping of the original inline persist."""
    genre_id_val = await _ensure_genre(rec.get("genre"))
    sub_genre_id_val = await _ensure_genre(rec.get("sub_genre"))
    audio_fn = rec.get("audio_filename")
    track_uuid = rec.get("track_uuid") or str(_uuid.uuid4())

    new_track = Track(
        uuid=track_uuid,
        isrc=(rec.get("isrc") or "").upper(),
        title=rec.get("title"),
        version_title=rec.get("version_title"),
        display_artist=rec.get("display_artist"),
        partner_id=partner_id,
        duration_ms=rec.get("duration_ms"),
        bpm=rec.get("bpm"),
        musical_key=rec.get("musical_key"),
        genre_id=genre_id_val,
        sub_genre_id=sub_genre_id_val,
        mix_name=rec.get("mix_name") or "Original Mix",
        parental_warning=rec.get("parental_warning") or "NotExplicit",
        is_explicit=bool(rec.get("is_explicit")),
        is_instrumental=bool(rec.get("is_instrumental")),
        audio_language=rec.get("audio_language") or "xx",
        language_of_lyrics=rec.get("language_of_lyrics"),
        p_line_year=_safe_year(rec.get("p_line_year")),
        p_line_text=rec.get("p_line_text"),
        ingestion_source="csv",
        track_type="electrobuzz",
    )
    db.add(new_track)
    await db.flush()  # populate track.id

    mime = ("audio/wav" if str(audio_fn).endswith(".wav")
            else "audio/mpeg" if str(audio_fn).endswith(".mp3") else "audio/flac")
    db.add(AudioFile(
        party_id=party_id,
        ingest_log_id=log_id,
        track_id=new_track.id,
        partner_id=partner_id,
        asset_class="Master",
        asset_subtype="master",
        original_filename=audio_fn,
        stored_path=_stored_path_for(track_uuid, audio_fn),
        file_size_bytes=rec.get("file_size_bytes") or 0,
        mime_type=mime,
    ))
    db.add(TrackProcessingStatus(
        track_id=new_track.id,
        partner_id=partner_id,
        ingest_log_id=log_id,
        audio_filename=audio_fn,
        sftp_env=env,
    ))


async def _track_exists(partner_id: int, track_uuid: str) -> bool:
    async with AsyncSessionLocal() as db:
        set_admin_context(True)
        set_current_partner_id(partner_id)
        return bool((await db.execute(
            select(Track.id).where(Track.uuid == track_uuid, Track.partner_id == partner_id)
        )).first())


def _max_chunks_per_poll() -> int:
    try:
        return max(1, int(os.getenv("INGEST_PERSIST_MAX_CHUNKS_PER_POLL", "40") or 40))
    except ValueError:
        return 40


async def persist_records_chunked(
    *,
    partner_id: int,
    party_id,
    log_id: int,
    records: List[Dict[str, Any]],
    env: str = "live",
    chunk_size: int = 500,
    max_chunks: Optional[int] = None,
) -> Dict[str, Any]:
    """Persist not-yet-existing records in committed chunks (fresh session each).

    Returns ``{total, already, todo, inserted, failures, remaining, done}``. ``done`` is
    True when every outstanding record was attempted this call. ``max_chunks=None`` (the
    default, used by the background task) processes the WHOLE batch; a bounded caller can
    cap it. Safe to call repeatedly — it resumes from disk-of-record (the DB).
    """
    async with AsyncSessionLocal() as db:
        set_admin_context(True)
        set_current_partner_id(partner_id)
        existing = set((await db.execute(
            select(Track.uuid).where(Track.partner_id == partner_id)
        )).scalars().all())

    todo = [r for r in records if (r.get("track_uuid") or "") not in existing]
    inserted = 0
    failures: List[Dict[str, str]] = []
    attempted = 0
    chunks_done = 0

    for start in range(0, len(todo), chunk_size):
        if max_chunks is not None and chunks_done >= max_chunks:
            break
        chunk = todo[start:start + chunk_size]
        chunks_done += 1
        attempted += len(chunk)
        try:
            async with AsyncSessionLocal() as db:
                set_admin_context(True)
                set_current_partner_id(partner_id)
                for rec in chunk:
                    await _persist_one(db, rec, party_id, partner_id, env, log_id)
                await db.commit()
            inserted += len(chunk)
        except Exception as exc:
            logger.warning("[ingestion_persist] chunk failed (%s); isolating per-record", str(exc)[:120])
            for rec in chunk:
                try:
                    async with AsyncSessionLocal() as db:
                        set_admin_context(True)
                        set_current_partner_id(partner_id)
                        await _persist_one(db, rec, party_id, partner_id, env, log_id)
                        await db.commit()
                    inserted += 1
                except Exception as exc2:
                    # A concurrent poll may have inserted it already → not a failure.
                    if await _track_exists(partner_id, rec.get("track_uuid") or ""):
                        inserted += 1
                    else:
                        failures.append({
                            "audio_filename": rec.get("audio_filename") or rec.get("track_uuid") or "?",
                            "error": f"{type(exc2).__name__}: {str(exc2)[:160]}",
                        })

    remaining = len(todo) - attempted
    return {
        "total": len(records),
        "already": len(existing),
        "todo": len(todo),
        "inserted": inserted,
        "failures": failures,
        "remaining": remaining,
        "done": remaining <= 0,
    }

"""
One-shot finalize for a completed-on-Hetzner ingestion log.
===========================================================

Background
----------
When Hetzner finishes a batch it writes ``status: completed`` + the validated
``records`` into its job-state JSON. Alwyzon only persists Track/AudioFile rows
when its status poll *sees* that completed snapshot and runs
``apply_ingestion_result``.

For a very large batch (e.g. the ~48k open-tracks load) the admin frontend polls
the status endpoint every couple seconds; each poll restarts a 48k-row insert
that takes far longer than the poll interval, so the attempts overlap, get
cancelled/rolled back, and the DB never commits — the log stays PROCESSING with
0 tracks even though Hetzner is done.

This script runs the persist exactly once, to completion, with no HTTP timeout
and no competing poller. It calls the *same* ``apply_ingestion_result`` the API
uses, so the result is identical — it just actually finishes and commits.

  - Idempotent on the remote side: it re-reads Hetzner's completed snapshot.
  - Safe to re-run *only if* the log is still non-terminal (PROCESSING). Once it
    succeeds the log is COMPLETED and a re-run will short-circuit (no duplicate
    inserts) because apply_ingestion_result is a no-op... NOTE: it is the *log
    status* gate at the API layer that prevents re-entry, not this script — so do
    NOT re-run after a successful COMPLETED unless you have wiped the tracks,
    or you will double-insert.

Usage
-----
    python scripts/finalize_ingest_log.py <ingest_log_id>
    python scripts/finalize_ingest_log.py 7
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.b2b import IngestLog
from app.services.ingestion_service import apply_ingestion_result
from app.services.hetzner_service import HetznerService


async def main(log_id: int) -> int:
    set_admin_context(True)
    hetzner = HetznerService()

    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, log_id)
        if log is None:
            print(f"ERROR: ingest_log {log_id} not found.")
            return 2

        set_current_partner_id(log.partner_id)
        print(
            f"ingest_log {log.id}: partner={log.partner_id} "
            f"status={log.status} stage={log.stage} track_count={log.track_count}"
        )

        if log.status in ("COMPLETED", "FAILED"):
            print(
                f"Log is already terminal ({log.status}); refusing to re-persist "
                f"(would risk duplicate inserts). Nothing done."
            )
            return 0

        print("Fetching completed job snapshot from Hetzner ...")
        remote = await hetzner.get_ingestion_status(log.partner_id, log.id)
        if not remote.get("success"):
            print(f"ERROR: could not fetch media status: {remote.get('error')} "
                  f"{remote.get('detail', '')}")
            return 3

        state = remote["data"]
        rstatus = (state.get("status") or "").lower()
        nrecords = len(state.get("records") or [])
        print(f"Media snapshot: status={rstatus} records={nrecords} "
              f"processing_dir={state.get('processing_dir')}")

        if rstatus not in ("completed", "failed"):
            print(f"Media job is still '{rstatus}' (not terminal); nothing to persist yet.")
            return 0

        print(f"Persisting {nrecords} record(s) via apply_ingestion_result "
              f"(single transaction, this may take a minute) ...")
        log = await apply_ingestion_result(db, log, state)

        await db.refresh(log)
        print(
            f"DONE. ingest_log {log.id}: status={log.status} stage={log.stage} "
            f"track_count={log.track_count} error={log.error_message}"
        )
        return 0 if log.status == "COMPLETED" else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/finalize_ingest_log.py <ingest_log_id>")
        sys.exit(64)
    sys.exit(asyncio.run(main(int(sys.argv[1]))))

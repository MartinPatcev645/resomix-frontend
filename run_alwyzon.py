"""
run_alwyzon.py — single-command launcher for the Alwyzon backend.

Starts the FastAPI app (``app.main:app``) via uvicorn AND spawns + supervises the Celery worker
as a child process, so one command runs the whole backend and stopping this process also stops
the worker — no orphaned workers. The worker is what fills the analysis summary row
(``persist_analysis_summary``) and generates the similarity sibling playlist
(``generate_similarity_sibling``); without it those stay pending.

    python run_alwyzon.py

Stop it with Ctrl+C or a normal ``kill <pid>`` (SIGTERM): the launcher catches it, lets uvicorn
shut down, then tears the worker down too. ``kill -9`` skips that cleanup and can orphan the worker.

Toggles (env vars):
    ALWYZON_HOST                 bind host (default 0.0.0.0)
    ALWYZON_PORT                 bind port (default 8001)
    ALWYZON_LOG_LEVEL            uvicorn log level (default info)
    ALWYZON_RELOAD               force autoreload (default: on only when RESOMIX_ENV=development)
    ALWYZON_EMBED_WORKER=0       do NOT spawn the Celery worker here (run it separately instead —
                                 the right choice on multi-node / k8s / docker-compose deploys where
                                 the worker is its own service; see the compose 'celery_worker' profile)
    ALWYZON_WORKER_CONCURRENCY   worker process count (default 2)

NOTE: reload mode (local dev) uses uvicorn's autoreloader, which can intercept Ctrl+C such that the
worker-teardown below may not run — a dev-only annoyance. In staging/production (reload off) the
launcher returns from ``uvicorn.run`` on the signal and cleanly stops the worker with it.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys

import uvicorn

from app.core.config import settings


def _truthy(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _is_development() -> bool:
    return str(getattr(settings, "resomix_env", "development")).strip().lower() in ("development", "local", "dev")


def _start_worker() -> "subprocess.Popen | None":
    """Spawn the Celery worker in its own process group (so we can stop the whole tree later)."""
    if not _truthy("ALWYZON_EMBED_WORKER", "1"):
        return None
    concurrency = os.getenv("ALWYZON_WORKER_CONCURRENCY", "2")
    cmd = [
        sys.executable, "-m", "celery",
        "-A", "app.tasks.celery_app",
        "worker", "--loglevel=INFO", f"--concurrency={concurrency}",
    ]
    # macOS: the Objective-C runtime aborts a forked child unless this is set — harmless on Linux,
    # so we always set it to keep the prefork worker stable in local dev.
    env = {**os.environ, "OBJC_DISABLE_INITIALIZE_FORK_SAFETY": "YES"}
    print(f"[run_alwyzon] starting Celery worker: {' '.join(cmd)}", flush=True)
    # start_new_session=True → the worker and celery's pool children get their own process group,
    # which we signal as a unit on shutdown.
    return subprocess.Popen(cmd, start_new_session=True, env=env)


def _stop_worker(proc: "subprocess.Popen | None") -> None:
    if proc is None or proc.poll() is not None:
        return
    print("[run_alwyzon] stopping Celery worker…", flush=True)
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)   # graceful: let an in-flight task finish
        proc.wait(timeout=20)
    except Exception:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass


def main() -> None:
    host = os.getenv("ALWYZON_HOST", "0.0.0.0")
    port = int(os.getenv("ALWYZON_PORT", "8001"))
    log_level = os.getenv("ALWYZON_LOG_LEVEL", "info").lower()
    reload = _truthy("ALWYZON_RELOAD", "1" if _is_development() else "0")

    worker = _start_worker()
    try:
        # reload=False → uvicorn runs in-process and returns from run() on SIGINT/SIGTERM, so the
        # `finally` below runs and the worker is stopped with us.
        uvicorn.run("app.main:app", host=host, port=port, log_level=log_level, reload=reload)
    finally:
        _stop_worker(worker)


if __name__ == "__main__":
    main()

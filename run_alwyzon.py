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
                                 the worker is its own service; see the compose 'celery_worker' profile).
                                 Also disables the stray-worker sweep below, so a deliberately
                                 separate worker is left alone.

When embedding the worker (the default), startup first stops any OTHER Celery worker running from
this same checkout. Those are invisible to `systemctl restart` — they sit outside the unit's cgroup
— yet they keep consuming the same Redis queue, so a share of every job silently runs whatever code
they were started with. See `_sweep_stray_workers`.
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
import time

import uvicorn

from app.core.config import settings


def _truthy(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _is_development() -> bool:
    return str(getattr(settings, "resomix_env", "development")).strip().lower() in ("development", "local", "dev")


def _stray_worker_pids() -> "list[int]":
    """PIDs of Celery workers already running from THIS checkout (excluding us and our children).

    Matched on this interpreter's venv prefix, so it can only ever see processes belonging to this
    installation — never another service on the box.
    """
    if not os.path.isdir("/proc"):  # Linux-only sweep; a no-op for local macOS dev.
        return []
    try:
        found = subprocess.run(
            ["pgrep", "-f", "celery"], capture_output=True, text=True, timeout=10
        ).stdout.split()
    except Exception:
        return []

    ours = os.getpgid(0)
    pids = []
    for raw in found:
        try:
            pid = int(raw)
        except ValueError:
            continue
        if pid == os.getpid():
            continue
        try:
            cmdline = open(f"/proc/{pid}/cmdline", "rb").read().replace(b"\0", b" ").decode()
            # Never signal our own process group — that would take this launcher down with it.
            if os.getpgid(pid) == ours:
                continue
        except (OSError, ProcessLookupError):
            continue
        if "celery" in cmdline and sys.prefix in cmdline:
            pids.append(pid)
    return pids


def _sweep_stray_workers() -> None:
    """Stop any Celery worker for this checkout that we are not supervising.

    A worker started outside this launcher — by hand with `nohup`, from a tmux session, or by an
    older unit — keeps consuming the SAME Redis queue indefinitely, and `systemctl restart alwyzon`
    can never stop it because it is not in the unit's cgroup. Tasks then round-robin between the
    current worker and the stale one, so a share of them silently run weeks-old code. That presents
    as an application bug (a task that "does nothing", a job stuck half-done) with no error anywhere
    in the service log, because the stale worker logs somewhere else entirely.

    Sweeping at startup makes `systemctl restart alwyzon` mean what it looks like it means: exactly
    one worker afterwards.
    """
    strays = _stray_worker_pids()
    if not strays:
        return
    print(
        f"[run_alwyzon] found {len(strays)} unsupervised Celery worker(s) from this checkout "
        f"{strays} — stopping them so they cannot consume tasks with stale code",
        flush=True,
    )
    # Escalate through Celery's own shutdown ladder. SIGTERM alone is NOT enough: it asks for a
    # *warm* shutdown, which waits for in-flight tasks — and a stray wedged on a stuck task simply
    # ignores it forever (we found one that had outlived SIGTERM by weeks). SIGQUIT is Celery's cold
    # shutdown; SIGKILL is the last resort, and costs us the broker connection closing cleanly, so
    # any tasks it still held stay reserved until the visibility timeout.
    for sig, grace in ((signal.SIGTERM, 8), (signal.SIGQUIT, 5), (signal.SIGKILL, 3)):
        alive = _stray_worker_pids()
        if not alive:
            print("[run_alwyzon] stray workers stopped", flush=True)
            return
        for pid in alive:
            try:
                os.killpg(os.getpgid(pid), sig)  # whole group: prefork parent + its pool children
            except (OSError, ProcessLookupError):
                pass
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            if not _stray_worker_pids():
                print(f"[run_alwyzon] stray workers stopped ({sig.name})", flush=True)
                return
            time.sleep(0.5)

    # Always state the outcome. Falling out of the ladder without a word is indistinguishable in the
    # log from returning early, which makes a slow-but-successful sweep look like a failed one.
    remaining = _stray_worker_pids()
    if remaining:
        print(
            f"[run_alwyzon] WARNING: could not stop stray Celery worker(s) {remaining} — they will "
            "keep taking tasks with stale code; stop them by hand",
            flush=True,
        )
    else:
        print("[run_alwyzon] stray workers stopped (full escalation)", flush=True)


def _start_workers() -> "list[subprocess.Popen]":
    """Spawn the Celery workers, each in its own process group (so we stop the whole tree later).

    TWO workers, not one, because they serve different urgencies:

      * ``similarity`` — foreground uploads. Someone is watching a spinner for these.
      * ``celery``     — everything else: analysis siblings, ingestion, webhooks, purges.

    They are kept apart because ``generate_track_analysis`` occupies a slot for up to 240s and
    every similarity upload enqueues one. Sharing a pool would let background work starve the
    foreground path under exactly the burst it is meant to survive.
    """
    if not _truthy("ALWYZON_EMBED_WORKER", "1"):
        return []
    _sweep_stray_workers()

    # macOS: the Objective-C runtime aborts a forked child unless this is set — harmless on Linux,
    # so we always set it to keep the prefork worker stable in local dev.
    env = {**os.environ, "OBJC_DISABLE_INITIALIZE_FORK_SAFETY": "YES"}

    # Concurrency 1 each — TWO pool children in total, the same as the single concurrency-2
    # worker this replaced, but now isolated by queue.
    #
    # Raising it is counter-productive here. These tasks are not IO-bound waits: they push large
    # audio files around and the box also runs ClamAV, ffprobe and mutagen for every upload
    # inside the API process. Four pool children took CPU away from uvicorn, and on 2026-08-13
    # both upload endpoints degraded together as a result. The GPU serialises this work anyway
    # (one inference per process), so extra Celery slots buy queue depth, not throughput.
    specs = (
        # (queue, node name, concurrency env var, default concurrency)
        ("similarity", "foreground", "ALWYZON_SIMILARITY_CONCURRENCY", "1"),
        ("celery", "background", "ALWYZON_WORKER_CONCURRENCY", "1"),
    )
    procs: "list[subprocess.Popen]" = []
    for queue, node, env_var, default in specs:
        cmd = [
            sys.executable, "-m", "celery",
            "-A", "app.tasks.celery_app",
            "worker", "--loglevel=INFO",
            f"--concurrency={os.getenv(env_var, default)}",
            "-Q", queue,
            # Distinct node names — two workers on one host otherwise collide and Celery reports
            # it only as a DuplicateNodenameWarning (see RUNBOOK).
            "-n", f"{node}@%h",
        ]
        # Celery's prefork pool is unsupported on Windows: tasks are reserved but never start.
        if sys.platform == "win32":
            cmd.append("--pool=solo")
        print(f"[run_alwyzon] starting Celery worker: {' '.join(cmd)}", flush=True)
        # start_new_session=True → the worker and celery's pool children get their own process
        # group, which we signal as a unit on shutdown.
        procs.append(subprocess.Popen(cmd, start_new_session=True, env=env))
    return procs


def _stop_workers(procs: "list[subprocess.Popen]") -> None:
    for proc in procs or []:
        if proc is None or proc.poll() is not None:
            continue
        print("[run_alwyzon] stopping Celery worker…", flush=True)
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)  # graceful: let an in-flight task finish
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

    workers = _start_workers()
    try:
        # reload=False → uvicorn runs in-process and returns from run() on SIGINT/SIGTERM, so the
        # `finally` below runs and the workers are stopped with us.
        uvicorn.run("app.main:app", host=host, port=port, log_level=log_level, reload=reload)
    finally:
        _stop_workers(workers)


if __name__ == "__main__":
    main()

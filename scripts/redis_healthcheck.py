"""
Redis health check
==================

Answers one question: **is the Redis this app talks to the one you think it is, and is it holding
only what it should?**

Redis is shared here — usage counters, the entitlement cache, sessions, the cart, rate limits and
telemetry all live in the same database. That makes two things worth knowing before every deploy:

* an eviction policy that evicts will silently drop usage counters (rehydration exists precisely
  because that happens, but it is a repair, not a plan); and
* a stray key namespace usually means a second app, an old config, or a leftover experiment
  pointing at the same database.

    PYTHONPATH="$PWD" .venv/bin/python scripts/redis_healthcheck.py

Read-only. It never writes or deletes anything. Add ``--sample`` to print a few example keys per
namespace, and ``--scan-limit N`` to bound the scan on a large database (default 200_000).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from collections import Counter, defaultdict
from typing import Dict, List

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

# Namespaces this codebase actually creates. Anything else is worth explaining.
KNOWN: Dict[str, str] = {
    "usage": "entitlement counters (pricing v2.1) — per subject/feature/period",
    "entl": "entitlement map cache, keyed by plan id + entitlements_version",
    "quota": "quota worker",
    "ratelimit": "request rate limiting",
    "user_cart": "track cart",
    "ingest": "ingest pipeline",
    "delete_playlist": "playlist deletion jobs",
}

# Not ours, but expected: the Celery worker is supervised alongside uvicorn (see RUNBOOK) and uses
# this same database as its broker. Named explicitly so it does not read as an orphan — but it does
# mean a `FLUSHDB` aimed at Celery would take every usage counter with it.
CELERY = ("celery", "_kombu", "unacked", "unacked_index", "unacked_mutex")

# Namespaces that MUST expire. A counter without a TTL outlives its own period and enforces
# yesterday's usage forever.
MUST_EXPIRE = ("usage", "ratelimit")


def mask(url: str) -> str:
    return re.sub(r"://([^:@/]*):([^@]*)@", r"://\1:***@", url or "")


def ns_of(key: str) -> str:
    return key.split(":", 1)[0] if ":" in key else "(no namespace)"


async def main(sample: bool, scan_limit: int) -> int:
    try:
        from redis import asyncio as aioredis
    except ImportError:
        from app.services import redis_counter  # noqa: F401
        print("Could not import redis.asyncio — check the venv.")
        return 2

    url = settings.redis_url
    print(f"Configured REDIS_URL : {mask(url)}")
    db_index = 0
    m = re.search(r"/(\d+)\s*$", url or "")
    if m:
        db_index = int(m.group(1))
    print(f"Database index       : {db_index}\n")

    client = aioredis.from_url(url, decode_responses=True)
    try:
        await client.ping()
    except Exception as exc:  # noqa: BLE001
        print(f"CANNOT CONNECT: {exc}")
        return 1

    info = await client.info()
    mem = await client.info("memory")
    stats = await client.info("stats")
    ks = await client.info("keyspace")

    print("── server ─────────────────────────────────────────────────────────────")
    print(f"  version           {info.get('redis_version')}")
    print(f"  mode              {info.get('redis_mode')}   role={info.get('role')}")
    print(f"  uptime            {int(info.get('uptime_in_seconds', 0)) // 86400}d "
          f"{(int(info.get('uptime_in_seconds', 0)) % 86400) // 3600}h")
    print(f"  clients           {info.get('connected_clients')}")
    print(f"  used_memory       {mem.get('used_memory_human')}  of  "
          f"{mem.get('maxmemory_human') or 'unlimited'}")

    policy = mem.get("maxmemory_policy")
    evicted = int(stats.get("evicted_keys", 0) or 0)
    print(f"  maxmemory_policy  {policy}")
    print(f"  evicted_keys      {evicted}")
    if policy and policy != "noeviction":
        print("     ⚠ This policy EVICTS. Usage counters can disappear mid-period; the gate")
        print("       rehydrates them from usage_period_history, but that is a repair, not a plan.")
    if evicted:
        print("     ⚠ Keys HAVE been evicted on this instance. If any were `usage:*`, some")
        print("       subjects were handed a fresh allowance before rehydration existed.")

    print("\n── databases in use ───────────────────────────────────────────────────")
    if not ks:
        print("  (all empty)")
    for name, detail in sorted(ks.items()):
        marker = "  ← ours" if name == f"db{db_index}" else "  ← NOT ours"
        print(f"  {name}: {detail}{marker}")
    others = [n for n in ks if n != f"db{db_index}"]
    if others:
        print("     ⚠ Another database on this instance holds data. That is usually a second app,")
        print("       an old config, or a leftover experiment — worth identifying before a FLUSHALL.")

    print(f"\n── key namespaces (scanning, limit {scan_limit:,}) ─────────────────────")
    counts: Counter = Counter()
    no_ttl: Counter = Counter()
    samples: Dict[str, List[str]] = defaultdict(list)
    scanned = 0
    async for key in client.scan_iter(count=1000):
        ns = ns_of(key)
        counts[ns] += 1
        if len(samples[ns]) < 3:
            samples[ns].append(key)
        if ns in MUST_EXPIRE and await client.ttl(key) < 0:
            no_ttl[ns] += 1
        scanned += 1
        if scanned >= scan_limit:
            print(f"  (stopped at the {scan_limit:,} key scan limit — counts below are partial)")
            break

    if not counts:
        print("  (no keys)")
    unknown, celery_present = [], False
    for ns, n in counts.most_common():
        keys_here = samples[ns]
        is_celery = ns in CELERY or any(k.startswith(CELERY) for k in keys_here)
        known = ns in KNOWN
        if is_celery:
            celery_present = True
            label, mark = "Celery broker (expected — shares this database)", "○"
        elif known:
            label, mark = KNOWN[ns], "✓"
        else:
            label, mark = "UNKNOWN — not created by this codebase", "?"
            unknown.append(ns)
        print(f"  {mark} {ns:<18} {n:>8,}  {label}")
        if sample:
            for k in samples[ns]:
                print(f"      e.g. {k}")

    print("\n── verdict ────────────────────────────────────────────────────────────")
    problems = 0
    if unknown:
        problems += 1
        print(f"  ⚠ Unrecognised namespace(s): {', '.join(unknown)}")
        print("    Re-run with --sample to see examples. If they belong to another service, give it")
        print("    its own database index — sharing one means any FLUSHDB takes both down.")
    for ns, n in no_ttl.items():
        problems += 1
        print(f"  ⚠ {n:,} `{ns}:*` key(s) have NO TTL. Those outlive their period and keep")
        print("    enforcing a window that has already passed.")
    if policy and policy != "noeviction":
        problems += 1
    if others:
        problems += 1
    if celery_present:
        print("  ○ Celery shares this database. Expected, but it means `FLUSHDB` to clear a Celery")
        print("    backlog would also wipe every usage counter. Clear queues by name, never the DB.")
    if not problems:
        print("  ✓ Only known namespaces, everything expiring as it should.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Read-only Redis health check.")
    ap.add_argument("--sample", action="store_true", help="Print example keys per namespace.")
    ap.add_argument("--scan-limit", type=int, default=200_000, help="Max keys to scan.")
    a = ap.parse_args()
    raise SystemExit(asyncio.run(main(a.sample, a.scan_limit)))

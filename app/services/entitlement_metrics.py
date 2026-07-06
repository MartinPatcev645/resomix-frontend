"""
Entitlement Metrics (Phase 9 observability)
==========================================

Lightweight, dependency-free in-process counters for the entitlement layer — enough to see gate
allow/deny rates, soft-gate reasons, fail-open events (Redis down), and cache hit/miss without
standing up Prometheus. Thread-safe; resets on process restart. Read via the admin metrics
endpoint (`GET /api/v1/admin/entitlements/metrics`).

Event keys (namespaced):
  gate.deny.login_required · gate.deny.upgrade_required · gate.fail_open
  entl.cache.hit · entl.cache.miss
"""

import threading
from collections import Counter
from typing import Dict

_lock = threading.Lock()
_counters: Counter = Counter()


def incr(event: str, n: int = 1) -> None:
    with _lock:
        _counters[event] += n


def snapshot() -> Dict[str, int]:
    with _lock:
        return dict(_counters)


def reset() -> None:
    with _lock:
        _counters.clear()

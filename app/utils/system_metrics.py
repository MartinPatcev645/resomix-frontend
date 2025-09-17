import os
from typing import Dict, Any

import psutil

_process = psutil.Process(os.getpid())


def snapshot() -> Dict[str, Any]:
    """Return a dict with system-wide and current-process CPU / memory / net stats."""
    # Non-blocking cpu_percent (uses internal diff from previous call)
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    net = psutil.net_io_counters()

    proc_cpu_percent = _process.cpu_percent(interval=None)
    proc_mem = _process.memory_info()

    return {
        "cpu_percent": cpu_percent,
        "mem_percent": mem.percent,
        "mem_used": mem.used,
        "mem_total": mem.total,
        "net_bytes_sent": net.bytes_sent,
        "net_bytes_recv": net.bytes_recv,
        "proc_cpu_percent": proc_cpu_percent,
        "proc_rss": proc_mem.rss,
    }

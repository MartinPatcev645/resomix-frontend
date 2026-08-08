"""
Request metadata
================

Who a request actually came from, once proxies are accounted for.

``request.client.host`` is the last hop — behind nginx or Cloudflare that is the proxy, not the
person. Every audit trail that records it unqualified records the wrong address.

This logic already existed, copied into three routers (`billing.py`, `partner.py`,
`partner_audit.py`). New code uses this one; those three are worth folding in, but they sit on
payment and partner paths and are not worth disturbing as a side effect of an unrelated change.
"""

from typing import Optional

from fastapi import Request


def client_ip(request: Optional[Request]) -> Optional[str]:
    """The originating client IP, honouring upstream proxy headers.

    ``X-Forwarded-For`` is a chain — the first entry is the original client, the rest are proxies.
    Returns None rather than "unknown" so a column can hold a real absence.
    """
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:45]
    return request.client.host[:45] if request.client else None


def user_agent(request: Optional[Request]) -> Optional[str]:
    """The browser string, truncated to the column width."""
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:500] if ua else None

"""
Context Management
==================

This module provides ContextVars for storing request-scoped data, 
such as the current partner ID for multi-tenant data isolation.
"""

from contextvars import ContextVar
from typing import Optional

# ContextVar to store the current partner ID for the duration of a request
partner_id_context: ContextVar[Optional[int]] = ContextVar("partner_id_context", default=None)

# ContextVar to track if the current request is an administrative operation
admin_context: ContextVar[bool] = ContextVar("admin_context", default=False)

def set_current_partner_id(partner_id: Optional[int]) -> None:
    """Set the current partner ID in the context."""
    partner_id_context.set(partner_id)

def get_current_partner_id() -> Optional[int]:
    """Get the current partner ID from the context."""
    return partner_id_context.get()

def set_admin_context(is_admin: bool) -> None:
    """Set the administrative status in the context."""
    admin_context.set(is_admin)

def is_admin_context() -> bool:
    """Check if the current context is administrative."""
    return admin_context.get()


def bind_task_tenancy(partner_id: Optional[int]) -> None:
    """Bind the tenancy context a background task cannot inherit from a request.

    MUST be the first statement of any Celery task body that touches a
    partner-scoped model. The SQL failsafe in ``database/connection.py``
    **raises** when ``partner_id`` is None, and a task that swallows the
    exception still reports success — so the work commits and the status rows
    that tell the UI about it are silently lost. Measured on production
    2026-09-08: 72 "Multi-tenancy violation" errors in 7 days, one per upload,
    leaving Library capsules spinning on analyses that had already completed.

    Lives here rather than in a task module so every task can share it without
    importing another task module.
    """
    if partner_id is not None:
        set_current_partner_id(partner_id)
        set_admin_context(False)
    else:
        # No partner: an internally initiated job. Admin context satisfies the
        # failsafe without narrowing to a tenant that does not apply.
        set_admin_context(True)

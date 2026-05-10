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

def set_current_partner_id(partner_id: Optional[int]) -> None:
    """Set the current partner ID in the context."""
    partner_id_context.set(partner_id)

def get_current_partner_id() -> Optional[int]:
    """Get the current partner ID from the context."""
    return partner_id_context.get()

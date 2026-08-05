"""pricing v2.1 — search meter goes daily, Pro uploads 100 -> 50

Two data changes, no schema:

1. ``search_playlists_per_month`` switches to a **daily** window with new values
   (guest 3 / free 3 / pro unlimited). The KEY IS DELIBERATELY NOT RENAMED — it is referenced by
   ``entitlement_seed``, every gate call site and ``FEATURE_KEYS`` in the frontend, and renaming it
   buys nothing a visitor can see. Only ``window``, ``name`` and ``description`` move.

2. ``uploads_per_month`` on Pro: 100 -> 50, applied to everyone. No grandfathering: a subscriber
   already at 75 this period is simply over the new cap and creates no more until it resets. They
   keep everything they made — the cap governs creation, never deletion.

``-1`` means unlimited (``EntitlementGate.UNLIMITED``). ``0`` still denies, which is why the
sentinel could not be ``0``: several plans legitimately sit at 0 today.

``entitlements_version`` is bumped so the Redis entitlement cache is invalidated — without it the
old limits keep serving until the TTL expires.

Guarded (a re-run re-applies the same values) and reversible. ``key`` / ``window`` are backticked
(reserved words); every value is a bound parameter.

Revision ID: d6a7b8c9e0f1
Revises: c5f6a7b8d9e0
Create Date: 2026-08-05
"""

from alembic import op
from sqlalchemy import text

revision = "d6a7b8c9e0f1"
down_revision = "c5f6a7b8d9e0"
branch_labels = None
depends_on = None

SEARCH = "search_playlists_per_month"
UPLOADS = "uploads_per_month"

# Values BEFORE this migration, read from resomix_prod on 2026-08-05 — the downgrade restores
# exactly these rather than a guess at what they might have been.
_OLD = {
    SEARCH: {"guest": 5, "free": 15, "basic": 100, "pro": 300, "max": 1000},
    UPLOADS: {"pro": 100},
}
_NEW = {
    # basic / max are inactive plans; kept proportionate so they are not nonsense if ever enabled.
    SEARCH: {"guest": 3, "free": 3, "basic": 30, "pro": -1, "max": -1},
    UPLOADS: {"pro": 50},
}


def _set_window(conn, key: str, window: str, name: str, desc: str) -> None:
    conn.execute(
        text("UPDATE features SET `window` = :w, name = :n, description = :d WHERE `key` = :k"),
        {"w": window, "n": name, "d": desc, "k": key},
    )


def _set_values(conn, values: dict) -> None:
    for feature_key, per_plan in values.items():
        for plan_code, val in per_plan.items():
            conn.execute(
                text(
                    "UPDATE plan_entitlements pe "
                    "JOIN plans p ON p.id = pe.plan_id "
                    "JOIN features f ON f.id = pe.feature_id "
                    "SET pe.int_value = :val "
                    "WHERE f.`key` = :fk AND p.code = :code"
                ),
                {"val": int(val), "fk": feature_key, "code": plan_code},
            )


def upgrade() -> None:
    conn = op.get_bind()
    _set_window(
        conn,
        SEARCH,
        "daily",
        "Search playlists per day",
        "Max SEARCH playlists (catalogue similarity, not upload) per UTC day. "
        "UTC deliberately: a DST zone would make one day 23 hours and another 25. -1 = unlimited.",
    )
    _set_values(conn, _NEW)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))


def downgrade() -> None:
    conn = op.get_bind()
    _set_window(
        conn,
        SEARCH,
        "monthly",
        "Search playlists per month",
        "Max SEARCH playlists (catalog similarity, not upload) per monthly period "
        "(resets on the subject's billing anchor).",
    )
    _set_values(conn, _OLD)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))

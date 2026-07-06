"""daily -> monthly usage windows (playlists + analysis)

Renames the two counted features to a monthly window and resets their per-plan values to sensible
monthly defaults (the old daily numbers would otherwise mean e.g. "1 playlist per MONTH"). Plan
entitlement rows are matched by (plan.code, feature.key); ``entitlements_version`` is bumped so the
Redis entitlement cache is invalidated.

Guarded (WHERE on the old key → no-op if already applied) + reversible. Values mirror
``app/services/entitlement_seed.py`` (admin-editable). ``key`` / ``window`` are backticked
(reserved words); all values are bound parameters (no string interpolation).

Revision ID: f0a1b2c3d4e5
Revises: e2a3b4c5d6e7
Create Date: 2026-07-05
"""

from alembic import op
from sqlalchemy import text

revision = "f0a1b2c3d4e5"
down_revision = "e2a3b4c5d6e7"
branch_labels = None
depends_on = None

# feature_key -> {plan_code: monthly_value}
_MONTHLY_VALUES = {
    "playlists_per_month": {"guest": 5, "free": 15, "basic": 100, "pro": 300, "max": 1000},
    "analysis_per_month":  {"guest": 0, "free": 10, "basic": 50,  "pro": 200, "max": 1000},
}
# feature_key -> {plan_code: legacy_daily_value} (for downgrade)
_DAILY_VALUES = {
    "playlists_per_day": {"guest": 1, "free": 2, "basic": 5, "pro": 15, "max": 50},
    "analysis_per_day":  {"guest": 0, "free": 1, "basic": 5, "pro": 10, "max": 50},
}


def _rename_feature(conn, old_key, new_key, name, window, desc):
    conn.execute(
        text(
            "UPDATE features SET `key` = :nk, name = :nm, `window` = :w, description = :d "
            "WHERE `key` = :ok"
        ),
        {"nk": new_key, "nm": name, "w": window, "d": desc, "ok": old_key},
    )


def _set_values(conn, values):
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
    _rename_feature(conn, "playlists_per_day", "playlists_per_month", "Playlists per month",
                    "monthly", "Max playlists creatable per monthly period (resets on the billing anchor).")
    _rename_feature(conn, "analysis_per_day", "analysis_per_month", "Track analyses per month",
                    "monthly", "Monthly analysis allowance (resets on the billing anchor).")
    _set_values(conn, _MONTHLY_VALUES)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))


def downgrade() -> None:
    conn = op.get_bind()
    _rename_feature(conn, "playlists_per_month", "playlists_per_day", "Playlists per day",
                    "daily", "Max playlists creatable per day.")
    _rename_feature(conn, "analysis_per_month", "analysis_per_day", "Track analyses per day",
                    "daily", "Daily analysis allowance.")
    _set_values(conn, _DAILY_VALUES)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))

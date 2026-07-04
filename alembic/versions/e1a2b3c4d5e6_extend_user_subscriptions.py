"""extend user_subscriptions into a proper consumer subscription

Adds plan_id + lifecycle/period fields to the existing (empty) user_subscriptions stub, so a
paid consumer subscription can carry the plan it grants. Designed now, populated in the
paid-billing phase. Guarded + additive.

Revision ID: e1a2b3c4d5e6
Revises: e0a1b2c3d4e5
Create Date: 2026-07-04 00:00:01.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "user_subscriptions"


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def _fk_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_schema = DATABASE() AND table_name = :t "
                "AND constraint_name = :n AND constraint_type = 'FOREIGN KEY'"
            ),
            {"t": table, "n": name},
        ).first()
    )


_COLUMNS = [
    ("plan_id", lambda: sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=True)),
    ("status", lambda: sa.Column("status", sa.String(20), nullable=False, server_default="active")),
    ("stripe_customer_id", lambda: sa.Column("stripe_customer_id", sa.String(255), nullable=True)),
    ("current_period_start", lambda: sa.Column("current_period_start", sa.DateTime(), nullable=True)),
    ("current_period_end", lambda: sa.Column("current_period_end", sa.DateTime(), nullable=True)),
    ("cancel_at_period_end", lambda: sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default="0")),
    ("updated_at", lambda: sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp())),
]


def upgrade() -> None:
    for name, col in _COLUMNS:
        if not _column_exists(_TABLE, name):
            op.add_column(_TABLE, col())
    if not _fk_exists(_TABLE, "fk_user_subscriptions_plan"):
        op.create_foreign_key(
            "fk_user_subscriptions_plan", _TABLE, "plans", ["plan_id"], ["id"], ondelete="RESTRICT"
        )
    # index status + plan_id for effective-plan lookups
    bind = op.get_bind()
    for idx, cols in (("ix_user_subscriptions_status", "status"), ("ix_user_subscriptions_plan", "plan_id")):
        exists = bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i"
            ),
            {"t": _TABLE, "i": idx},
        ).first()
        if not exists:
            op.create_index(idx, _TABLE, [cols])


def downgrade() -> None:
    if _fk_exists(_TABLE, "fk_user_subscriptions_plan"):
        op.drop_constraint("fk_user_subscriptions_plan", _TABLE, type_="foreignkey")
    for name, _ in reversed(_COLUMNS):
        if _column_exists(_TABLE, name):
            op.drop_column(_TABLE, name)

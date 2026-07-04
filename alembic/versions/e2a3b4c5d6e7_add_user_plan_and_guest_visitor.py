"""add users.plan_id and playlists.guest_visitor_id

users.plan_id (nullable FK → plans; NULL resolves to the default/free plan at read time, so
no risky backfill). playlists.guest_visitor_id tags guest-created playlists for limit
enforcement + reparenting to a user on login. Guarded + additive.

Revision ID: e2a3b4c5d6e7
Revises: e1a2b3c4d5e6
Create Date: 2026-07-04 00:00:02.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = "e2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"),
        {"t": table, "c": column},
    ).first())


def _index_exists(table: str, index: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(
        sa.text("SELECT 1 FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i"),
        {"t": table, "i": index},
    ).first())


def _fk_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(
        sa.text("SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_schema = DATABASE() AND table_name = :t "
                "AND constraint_name = :n AND constraint_type = 'FOREIGN KEY'"),
        {"t": table, "n": name},
    ).first())


def upgrade() -> None:
    # users.plan_id
    if not _column_exists("users", "plan_id"):
        op.add_column("users", sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=True))
    if not _index_exists("users", "ix_users_plan_id"):
        op.create_index("ix_users_plan_id", "users", ["plan_id"])
    if not _fk_exists("users", "fk_users_plan"):
        op.create_foreign_key("fk_users_plan", "users", "plans", ["plan_id"], ["id"], ondelete="SET NULL")

    # playlists.guest_visitor_id
    if not _column_exists("playlists", "guest_visitor_id"):
        op.add_column("playlists", sa.Column("guest_visitor_id", sa.String(64), nullable=True))
    if not _index_exists("playlists", "ix_playlists_guest_visitor_id"):
        op.create_index("ix_playlists_guest_visitor_id", "playlists", ["guest_visitor_id"])


def downgrade() -> None:
    if _index_exists("playlists", "ix_playlists_guest_visitor_id"):
        op.drop_index("ix_playlists_guest_visitor_id", table_name="playlists")
    if _column_exists("playlists", "guest_visitor_id"):
        op.drop_column("playlists", "guest_visitor_id")

    if _fk_exists("users", "fk_users_plan"):
        op.drop_constraint("fk_users_plan", "users", type_="foreignkey")
    if _index_exists("users", "ix_users_plan_id"):
        op.drop_index("ix_users_plan_id", table_name="users")
    if _column_exists("users", "plan_id"):
        op.drop_column("users", "plan_id")

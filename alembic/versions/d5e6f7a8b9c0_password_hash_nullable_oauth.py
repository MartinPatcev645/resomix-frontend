"""password_hash nullable for social login + ensure user_auth_providers

(1) users.password_hash → NULLABLE. Social-login (Google, and later Apple/GitHub) accounts have
    no local password until the user explicitly sets one via the reset-password flow.
(2) user_auth_providers — the identity-link table (user_id, provider, provider_uid). It already
    exists in most environments; this creates it defensively (guarded) so an Alembic-only fresh
    deploy also gets it. Composite PK (user_id, provider) = one identity per provider per user;
    UNIQUE (provider, provider_uid) = a given provider account maps to exactly one user.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = :t"
            ),
            {"t": table},
        ).first()
    )


def _column_is_nullable(table: str, column: str) -> bool:
    bind = op.get_bind()
    row = bind.execute(
        sa.text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return bool(row) and str(row[0]).upper() == "YES"


def upgrade() -> None:
    # (1) Make password_hash nullable (idempotent).
    if not _column_is_nullable("users", "password_hash"):
        op.alter_column(
            "users",
            "password_hash",
            existing_type=mysql.VARCHAR(length=255),
            nullable=True,
        )

    # (2) Ensure the OAuth identity-link table exists.
    if not _table_exists("user_auth_providers"):
        op.create_table(
            "user_auth_providers",
            sa.Column("user_id", mysql.INTEGER(unsigned=True), primary_key=True, nullable=False),
            sa.Column("provider", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("provider_uid", sa.String(length=100), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("provider", "provider_uid", name="uk_provider_uid"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )


def downgrade() -> None:
    # Reverting password_hash to NOT NULL will fail if any social-login rows have a NULL password —
    # that is expected once Google users exist. Left best-effort on purpose.
    if _column_is_nullable("users", "password_hash"):
        op.alter_column(
            "users",
            "password_hash",
            existing_type=mysql.VARCHAR(length=255),
            nullable=False,
        )

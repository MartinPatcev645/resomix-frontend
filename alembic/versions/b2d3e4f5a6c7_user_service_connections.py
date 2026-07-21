"""create user_service_connections (provider-agnostic linked music services)

One table for every external music service a user links/exports to — Apple Music now, Spotify /
Tidal / rekordbox / Beatport / Deezer later — so new providers need NO schema change. One row per
(user_id, provider); tokens stored encrypted. Idempotent: only creates the table if missing.

Revision ID: b2d3e4f5a6c7
Revises: a1c2e3f4b5d6
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = "b2d3e4f5a6c7"
down_revision = "a1c2e3f4b5d6"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    row = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :t"
        ),
        {"t": table},
    ).scalar()
    return bool(row)


def upgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "user_service_connections"):
        return

    op.create_table(
        "user_service_connections",
        sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
        sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("access_token_enc", sa.Text(), nullable=False),
        sa.Column("refresh_token_enc", sa.Text(), nullable=True),
        sa.Column("token_type", sa.String(length=40), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("external_account_id", sa.String(length=191), nullable=True),
        sa.Column("region", sa.String(length=10), nullable=True),
        sa.Column("scopes", sa.String(length=500), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_service_connection"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_user_service_connections_user_id", "user_service_connections", ["user_id"])
    op.create_index("ix_user_service_connections_provider", "user_service_connections", ["provider"])


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "user_service_connections"):
        return
    op.drop_index("ix_user_service_connections_provider", table_name="user_service_connections")
    op.drop_index("ix_user_service_connections_user_id", table_name="user_service_connections")
    op.drop_table("user_service_connections")

"""add_partner_notifications

Partner/admin notification audit log. One row per notification email sent about
a partner operation (ingestion / embedding / peaks / upload-rejection / …),
tagged with audience (partner|admin) and partner_id for filtering.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-20 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
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


def upgrade() -> None:
    """Idempotent: create the table only if it isn't already present."""
    if _table_exists("partner_notifications"):
        return
    op.create_table(
        "partner_notifications",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
        sa.Column("partner_id", mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("audience", sa.String(length=10), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False, server_default="email"),
        sa.Column("recipient", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("details", mysql.JSON(), nullable=True),
        sa.Column("reference_path", sa.String(length=512), nullable=True),
        sa.Column("delivered", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"], ondelete="CASCADE"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_pn_partner_time", "partner_notifications", ["partner_id", "created_at"])
    op.create_index("idx_pn_event_status", "partner_notifications", ["event_type", "status"])


def downgrade() -> None:
    if _table_exists("partner_notifications"):
        op.drop_table("partner_notifications")

"""add_sftp_user_limits

Adds per-account SFTP limit columns to ``sftp_users`` so an admin can customise a
partner's quota and bandwidth/transfer/session caps at provision time (defaults come
from the partner's plan/tier; these columns hold the resolved values).

All nullable: NULL means "not customised" — the auth hook falls back to the tier
default (quota) or omits the limit. ``0`` means unlimited (SFTPGo convention).

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (column name, SQLAlchemy type, comment)
_COLUMNS = [
    ("quota_bytes", mysql.BIGINT(unsigned=True), "Storage quota in bytes; NULL = tier default, 0 = unlimited"),
    ("quota_files", mysql.INTEGER(unsigned=True), "Max file count; NULL = unset, 0 = unlimited"),
    ("upload_bandwidth", mysql.INTEGER(unsigned=True), "Upload bandwidth cap in KB/s; NULL = unset, 0 = unlimited"),
    ("download_bandwidth", mysql.INTEGER(unsigned=True), "Download bandwidth cap in KB/s; NULL = unset, 0 = unlimited"),
    ("max_sessions", mysql.INTEGER(unsigned=True), "Max concurrent sessions; NULL = unset, 0 = unlimited"),
    ("upload_data_transfer", mysql.INTEGER(unsigned=True), "Total upload allowed in MB; NULL = unset, 0 = unlimited"),
    ("download_data_transfer", mysql.INTEGER(unsigned=True), "Total download allowed in MB; NULL = unset, 0 = unlimited"),
    ("total_data_transfer", mysql.INTEGER(unsigned=True), "Total combined transfer in MB; NULL = unset, 0 = unlimited"),
]


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() "
                "AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def upgrade() -> None:
    """Idempotent: add each limit column only if it isn't already present."""
    for name, coltype, comment in _COLUMNS:
        if not _column_exists("sftp_users", name):
            op.add_column("sftp_users", sa.Column(name, coltype, nullable=True, comment=comment))


def downgrade() -> None:
    for name, _coltype, _comment in reversed(_COLUMNS):
        if _column_exists("sftp_users", name):
            op.drop_column("sftp_users", name)

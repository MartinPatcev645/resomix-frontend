"""create_track_analysis_results

Single-value analysis summary, one row per analysed uploaded track. Full canonical JSON lives
in the Hetzner served cache (tokenized retrieval); this table powers fast library lists,
ownership, and future "share analysis" (see docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md §4-5).

The musical-key column is ``music_key`` (not ``key``) to avoid the SQL reserved word.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
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
    if _table_exists("track_analysis_results"):
        return
    op.create_table(
        "track_analysis_results",
        sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
        # Linkage
        sa.Column("track_id", mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column("analysis_uuid", sa.String(length=36), nullable=False),
        sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=True),
        sa.Column("partner_id", mysql.INTEGER(unsigned=True), nullable=False, server_default=sa.text("1")),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        # Single-value summary
        sa.Column("bpm", mysql.FLOAT(), nullable=True),
        sa.Column("music_key", sa.String(length=8), nullable=True),
        sa.Column("scale", sa.String(length=16), nullable=True),
        sa.Column("camelot", sa.String(length=8), nullable=True),
        sa.Column("loudness_lufs", mysql.FLOAT(), nullable=True),
        sa.Column("top_genre", sa.String(length=128), nullable=True),
        sa.Column("top_style", sa.String(length=128), nullable=True),
        sa.Column("top_mood", sa.String(length=128), nullable=True),
        sa.Column("top_instrument", sa.String(length=128), nullable=True),
        sa.Column("danceability", mysql.FLOAT(), nullable=True),
        sa.Column("valence", mysql.FLOAT(), nullable=True),
        sa.Column("arousal", mysql.FLOAT(), nullable=True),
        sa.Column("voice_score", mysql.FLOAT(), nullable=True),
        sa.Column("voice_instrumental", sa.String(length=16), nullable=True),
        sa.Column("duration_ms", mysql.FLOAT(), nullable=True),
        sa.Column("sample_rate_hz", mysql.INTEGER(unsigned=True), nullable=True),
        sa.Column("bit_rate", mysql.INTEGER(unsigned=True), nullable=True),
        sa.Column("channels", mysql.SMALLINT(unsigned=True), nullable=True),
        sa.Column("codec", sa.String(length=32), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("analysis_uuid", name="uq_tar_analysis_uuid"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_tar_track", "track_analysis_results", ["track_id"])
    op.create_index("idx_tar_user", "track_analysis_results", ["user_id"])
    op.create_index("idx_tar_partner", "track_analysis_results", ["partner_id"])


def downgrade() -> None:
    if _table_exists("track_analysis_results"):
        op.drop_table("track_analysis_results")

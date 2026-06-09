"""partner_scope_audio_path_unique

Makes ``audio_files.uq_audio_path`` partner-scoped.

The old constraint was a global UNIQUE on ``stored_path(512)`` only. Because
``stored_path`` holds the bare audio filename, two different partners ingesting
a file with the same name (e.g. "07 - Phone Booth Robbers - I Can't Sleep.flac")
collided on the global unique key, blocking the second partner's ingestion with
a 1062 Duplicate entry error. That broke multi-tenant isolation.

This migration drops the global unique and recreates it as a composite
UNIQUE on ``(partner_id, stored_path(512))`` so the same filename is allowed
across partners while still preventing dupes *within* a single partner.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-08 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: global stored_path unique -> (partner_id, stored_path)."""
    # Drop the old global unique on stored_path(512).
    op.drop_index('uq_audio_path', table_name='audio_files')
    # Recreate it partner-scoped. The 512-char prefix on stored_path is preserved
    # (stored_path is VARCHAR(1024); MySQL/MariaDB unique-index prefix limits apply).
    op.create_index(
        'uq_audio_path',
        'audio_files',
        ['partner_id', 'stored_path'],
        unique=True,
        mysql_length={'stored_path': 512},
    )


def downgrade() -> None:
    """Downgrade schema: restore the global stored_path unique."""
    op.drop_index('uq_audio_path', table_name='audio_files')
    op.create_index(
        'uq_audio_path',
        'audio_files',
        ['stored_path'],
        unique=True,
        mysql_length={'stored_path': 512},
    )

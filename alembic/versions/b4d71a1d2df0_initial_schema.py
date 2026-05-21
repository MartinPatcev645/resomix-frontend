"""Initial schema from new_database.sql

Revision ID: b4d71a1d2df0
Revises: 
Create Date: 2026-04-30 12:19:42.100923

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import os

# revision identifiers, used by Alembic.
revision: str = 'b4d71a1d2df0'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Path to the SQL file relative to this script
    sql_file_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    
    if not os.path.exists(sql_file_path):
        raise FileNotFoundError(f"SQL file not found at {sql_file_path}")
        
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    import re

    # 1. Remove block comments: /* ... */
    sql_clean = re.sub(r'/\*.*?\*/', '', sql_content, flags=re.DOTALL)

    # 2. Remove line comments: -- ...  (but only outside string literals).
    #    A simple line-by-line strip is safe here because the schema uses
    #    single-line -- comments exclusively (no -- inside string values).
    lines = []
    for line in sql_clean.splitlines():
        # Strip -- comment suffix while preserving any preceding SQL on the line.
        # We must not strip '--' that appears inside a quoted string, but the
        # schema does not have such cases, so a simple find is sufficient.
        comment_pos = line.find('--')
        if comment_pos != -1:
            line = line[:comment_pos]
        lines.append(line)
    sql_clean = '\n'.join(lines)

    # 3. Split on ';' and execute each non-empty statement.
    statements = sql_clean.split(';')
    for statement in statements:
        stripped = statement.strip()
        if stripped:
            op.execute(stripped)

def downgrade() -> None:
    # Downgrade would ideally drop all tables in reverse order
    # But since this is a "fresh start" migration, we might just drop everything
    # For now, we leave it empty or add a generic drop if needed.
    pass

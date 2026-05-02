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
        
    # Split by semicolon to execute individual statements
    # Split by semicolon and execute non-empty statements
    # We strip block comments to avoid skipping statements that start with them
    import re
    
    # Remove block comments: /* ... */
    sql_clean = re.sub(r'/\*.*?\*/', '', sql_content, flags=re.DOTALL)
    
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

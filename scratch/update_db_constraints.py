import asyncio
from sqlalchemy import text
from database.connection import get_async_db

async def update_constraints():
    async with await get_async_db() as db:
        tables = [
            "users", "parties", "ingest_logs", "contributors", "tracks", 
            "releases", "audio_files", "image_files", "document_files", 
            "playlists", "ingestion_errors"
        ]
        
        for table in tables:
            print(f"Updating constraints for table: {table}")
            try:
                # 1. Discover existing constraint name for partner_id
                # Note: This is for MariaDB/MySQL
                result = await db.execute(text(f"""
                    SELECT CONSTRAINT_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = 'resomix_db'
                    AND TABLE_NAME = '{table}'
                    AND COLUMN_NAME = 'partner_id'
                    AND REFERENCED_TABLE_NAME = 'partners'
                """))
                
                constraint_names = [row[0] for row in result.fetchall()]
                
                for constraint_name in constraint_names:
                    print(f"  Dropping and recreating constraint: {constraint_name}")
                    # 2. Drop existing constraint
                    await db.execute(text(f"ALTER TABLE {table} DROP FOREIGN KEY {constraint_name}"))
                    
                    # 3. Add new constraint with ON DELETE RESTRICT
                    await db.execute(text(f"""
                        ALTER TABLE {table} 
                        ADD CONSTRAINT fk_{table}_partner 
                        FOREIGN KEY (partner_id) REFERENCES partners(id) 
                        ON DELETE RESTRICT
                    """))
                
                if not constraint_names:
                    print(f"  No existing partner_id constraint found for {table}. Adding new one.")
                    await db.execute(text(f"""
                        ALTER TABLE {table} 
                        ADD CONSTRAINT fk_{table}_partner 
                        FOREIGN KEY (partner_id) REFERENCES partners(id) 
                        ON DELETE RESTRICT
                    """))
                
                await db.commit()
                print(f"Successfully updated {table}")
                
            except Exception as e:
                print(f"  Error updating {table}: {e}")
                await db.rollback()

if __name__ == "__main__":
    asyncio.run(update_constraints())

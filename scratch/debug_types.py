
import asyncio
from sqlalchemy import text
from database.connection import async_engine

async def check_data_types():
    async with async_engine.connect() as conn:
        result = await conn.execute(text("SELECT id, uuid, title FROM tracks LIMIT 1"))
        row = result.fetchone()
        if row:
            print(f"ID: {row.id} ({type(row.id)})")
            print(f"UUID: {row.uuid} ({type(row.uuid)})")
            print(f"Title: {row.title} ({type(row.title)})")
        
        result = await conn.execute(text("SELECT id, uuid, name, is_public FROM playlists LIMIT 1"))
        row = result.fetchone()
        if row:
            print(f"Playlist ID: {row.id} ({type(row.id)})")
            print(f"Playlist UUID: {row.uuid} ({type(row.uuid)})")
            print(f"Playlist Name: {row.name} ({type(row.name)})")
            print(f"Is Public: {row.is_public} ({type(row.is_public)})")

if __name__ == "__main__":
    asyncio.run(check_data_types())

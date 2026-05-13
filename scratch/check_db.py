import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

MARIA_DB_USER = os.getenv("MARIA_DB_USER", "root")
MARIA_DB_PASS = os.getenv("MARIA_DB_PASS", "test")
MARIA_DB_HOST = os.getenv("MARIA_DB_HOST", "127.0.0.1")
MARIA_DB_PORT = os.getenv("MARIA_DB_PORT", "3306")
MARIA_DB_NAME = os.getenv("MARIA_DB_NAME", "resomix_db")

DATABASE_URL = f"mysql+aiomysql://{MARIA_DB_USER}:{MARIA_DB_PASS}@{MARIA_DB_HOST}:{MARIA_DB_PORT}/{MARIA_DB_NAME}"

async def check_db():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Connection successful: {result.fetchone()}")
            
            # Check users table
            result = await conn.execute(text("SELECT email, username, is_email_verified FROM users"))
            users = result.fetchall()
            print(f"Users found: {len(users)}")
            for u in users:
                print(f" - {u}")
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())

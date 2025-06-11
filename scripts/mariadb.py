import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

DATABASE_URL = (
    "mysql+aiomysql://{user}:{pwd}@{host}:{port}/{db}?charset=utf8mb4"
).format(
    user=os.getenv("DB_USER", "resomixAdmin"),
    pwd=os.getenv("DB_PASS", "G351vVD-usman2212!"),
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=os.getenv("DB_PORT", "3306"),
    db=os.getenv("DB_NAME", "resomix_db"),
)

engine = create_async_engine(DATABASE_URL, pool_recycle=1800)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Display all tables
async def display_tables():
    async with SessionLocal() as db:
        result = await db.execute(text("SHOW TABLES"))
        tables = result.fetchall()
        for table in tables:
            print(table[0])

# Display all tables
if __name__ == "__main__":
    import asyncio
    asyncio.run(display_tables())


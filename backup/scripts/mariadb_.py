# db.py
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_URL = (
    "mariadb+mariadbconnector://{user}:{password}@{host}:{port}/{db}"
    .format(
        user=os.getenv("MARIA_DB_USER"),
        password=os.getenv("MARIA_DB_PASS"),
        host=os.getenv("MARIA_DB_HOST"),
        port=os.getenv("MARIA_DB_PORT"),
        db=os.getenv("MARIA_DB_NAME"),
    )
)

engine = create_engine(
    DB_URL,
    pool_pre_ping=True,      # helps with stale connections
    future=True,             # SQLAlchemy 2.x style
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def list_tables() -> list[str]:
    insp = inspect(engine)
    return insp.get_table_names()

if __name__ == "__main__":
    print(list_tables())

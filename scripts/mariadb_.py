# db.py
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
import os

DB_URL = (
    "mariadb+mariadbconnector://{user}:{password}@{host}:{port}/{db}"
    .format(
        user=os.getenv("MARIA_DB_USER", "resomixAdmin"),
        password=os.getenv("MARIA_DB_PASS", "G351vVD-usman2212!"),
        host=os.getenv("MARIA_DB_HOST", "127.0.0.1"),
        port=os.getenv("MARIA_DB_PORT", "3306"),
        db=os.getenv("MARIA_DB_NAME", "resomix_db"),
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


import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# Load backend environment variables.
load_dotenv(Path(__file__).resolve().parent / ".env")


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set"
    )


# Use psycopg 3 with PostgreSQL URLs.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql+psycopg://",
        1
    )

elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1
    )


engine_options = {
    "pool_pre_ping": True,
    "pool_recycle": 1800
}

if DATABASE_URL.startswith("postgresql+psycopg://"):
    engine_options["connect_args"] = {
        "connect_timeout": 10
    }


engine = create_engine(
    DATABASE_URL,
    **engine_options
)


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)


Base = declarative_base()

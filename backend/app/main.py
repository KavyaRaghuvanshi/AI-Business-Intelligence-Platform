import os
import math
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from uuid import uuid4

import pandas as pd
from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.concurrency import run_in_threadpool

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import engine, Base, SessionLocal
import models

from schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    LoginRequest
)

from security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)

from app.insight_engine import generate_evidence
from app.ai_explaner import explain_findings

from app.storage import (
    upload_dataset as upload_to_storage,
    download_dataset as download_from_storage,
    delete_dataset as delete_from_storage,
    test_storage_connection,
    get_bucket_name
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

# Load environment variables BEFORE reading them.
load_dotenv(BACKEND_DIR / ".env")

# Local fallback for older datasets and demo datasets.
# New CSV uploads are stored in Neon Object Storage.
UPLOAD_DIR = Path(
    os.getenv(
        "UPLOAD_DIR",
        str(BACKEND_DIR / "uploads")
    )
).expanduser().resolve()

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_SIZE_MB = int(
    os.getenv("MAX_UPLOAD_SIZE_MB", "25")
)

MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://ai-business-intelligence-platform-opal.vercel.app"
    ).split(",")
    if origin.strip()
]


# --------------------------------------------------
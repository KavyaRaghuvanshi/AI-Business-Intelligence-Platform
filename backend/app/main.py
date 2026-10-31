
import os
import math
from contextlib import asynccontextmanager
from pathlib import Path
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
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"

load_dotenv(BACKEND_DIR / ".env")

MAX_UPLOAD_SIZE_MB = int(
    os.getenv("MAX_UPLOAD_SIZE_MB", "25")
)

MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]


# --------------------------------------------------
# APPLICATION STARTUP
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates missing tables but does not modify
    # existing PostgreSQL table structures.
    Base.metadata.create_all(bind=engine)

    yield


app = FastAPI(
    title="AI Business Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# DATABASE DEPENDENCY
# --------------------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# COMMON DATASET FUNCTIONS
# --------------------------------------------------

def get_dataset_or_404(dataset_id: int, db: Session):
    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .first()
    )

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    return dataset


def get_dataset_path(dataset):
    stored_path = Path(
        str(dataset.file_path or "").replace("\\", "/")
    )

    if stored_path.is_absolute():
        return stored_path

    file_path = (BACKEND_DIR / stored_path).resolve()

    # Prevent relative paths from escaping the backend folder.
    try:
        file_path.relative_to(BACKEND_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid dataset file path"
        )

    return file_path


def read_dataset(dataset):
    file_path = get_dataset_path(dataset)

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Dataset file not found on the server"
        )

    try:
        return pd.read_csv(file_path)

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="The CSV file is empty"
        )

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the dataset as a valid CSV file"
        )


def safe_number(value):
    number = float(value)

    if math.isfinite(number):
        return number

    return None


def convert_to_legacy_insights(findings):
    """
    Retains the response structure previously used by
    /datasets/{dataset_id}/insights.
    """

    insights = []

    for finding in findings:
        evidence = finding.get("evidence", {})

        item = {
            "type": finding["category"],
            "severity": finding["severity"],
            "title": finding["title"],
            "description": finding["claim"],
            "recommendation": finding["recommendation"]
        }

        if finding["id"] == "missing_values":
            item["columns"] = list(
                evidence.get("affected_columns", {}).keys()
            )

        elif finding["category"] == "numeric_analysis":
            item.update({
                "column": evidence.get("column"),
                "mean": evidence.get("mean"),
                "minimum": evidence.get("minimum"),
                "maximum": evidence.get("maximum")
            })

        elif finding["category"] == "outlier_detection":
            item.update({
                "column": evidence.get("column"),
                "outlier_count": evidence.get("outlier_count")
            })

        insights.append(item)

    return insights


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Business Intelligence Platform API is running"
    }


# --------------------------------------------------
# USER MANAGEMENT
# --------------------------------------------------

@app.post("/users", response_model=UserResponse)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == user.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )

    new_user = models.User(
        name=user.name,
        email=user.email,
        hashed_password=hash_password(user.password)
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )


@app.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user


@app.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user: UserUpdate,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if existing_user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    existing_user.name = user.name
    existing_user.email = user.email

    try:
        db.commit()
        db.refresh(existing_user)

        return existing_user

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully"
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/login")
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):
    db_user = (
        db.query(models.User)
        .filter(models.User.email == user.email)
        .first()
    )

    if (
        db_user is None
        or not verify_password(
            user.password,
            db_user.hashed_password
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={"sub": str(db_user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security_scheme
    ),
    db: Session = Depends(get_db)
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    current_user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if current_user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return current_user


@app.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: models.User = Depends(get_current_user)
):
    return current_user


# --------------------------------------------------
# DASHBOARD
# --------------------------------------------------

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_datasets = db.query(models.Dataset).count()

    return {
        "total_users": total_users,
        "total_datasets": total_datasets
    }


# --------------------------------------------------
# DATASET UPLOAD
# --------------------------------------------------

@app.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    original_filename = (
        file.filename or ""
    ).replace("\\", "/")

    original_filename = Path(original_filename).name.strip()

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename"
        )

    if Path(original_filename).suffix.lower() != ".csv":
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # A unique internal filename prevents accidental overwriting.
    file_path = UPLOAD_DIR / f"{uuid4().hex}.csv"

    total_size = 0
    chunk_size = 1024 * 1024

    try:
        with file_path.open("wb") as destination:
            while True:
                chunk = await file.read(chunk_size)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"File exceeds the {MAX_UPLOAD_SIZE_MB} MB "
                            "upload limit"
                        )
                    )

                destination.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        # Validate CSV format before registering the dataset.
        try:
            pd.read_csv(file_path, nrows=5)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is not a valid CSV"
            )

        dataset = models.Dataset(
            filename=original_filename,
            file_path=Path(
                "uploads",
                file_path.name
            ).as_posix()
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        return {
            "message": "Dataset uploaded successfully",
            "dataset_id": dataset.id,
            "filename": dataset.filename
        }

    except HTTPException:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise

    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Could not save the uploaded dataset"
        )

    finally:
        await file.close()


# --------------------------------------------------
# LIST DATASETS
# --------------------------------------------------

@app.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    return (
        db.query(models.Dataset)
        .order_by(models.Dataset.uploaded_at.desc())
        .all()
    )


# --------------------------------------------------
# DATASET PREVIEW
# --------------------------------------------------

@app.get("/datasets/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    dataset = get_dataset_or_404(dataset_id, db)
    df = read_dataset(dataset)

    preview_df = df.head(10).astype(object)

    preview_df = preview_df.where(
        pd.notna(preview_df),
        None
    )

    return {
        "dataset_id": dataset.id,
        "filename": dataset.filename,
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "columns": [str(column) for column in df.columns],
        "preview": preview_df.to_dict(orient="records")
    }


# --------------------------------------------------
# DATASET ANALYSIS
# --------------------------------------------------

@app.get("/datasets/{dataset_id}/analysis")
def analyze_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    dataset = get_dataset_or_404(dataset_id, db)
    df = read_dataset(dataset)

    missing_values = {
        str(column): int(count)
        for column, count in df.isnull().sum().items()
    }

    column_types = {
        str(column): str(dtype)
        for column, dtype in df.dtypes.items()
    }

    numeric_columns = df.select_dtypes(
        include="number"
    ).columns

    numeric_summary = {}

    for column in numeric_columns:
        values = df[column].dropna()

        numeric_summary[str(column)] = {
            "mean": (
                None if values.empty
                else safe_number(values.mean())
            ),
            "minimum": (
                None if values.empty
                else safe_number(values.min())
            ),
            "maximum": (
                None if values.empty
                else safe_number(values.max())
            )
        }

    return {
        "dataset_id": dataset.id,
        "filename": dataset.filename,
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_values": missing_values,
        "column_types": column_types,
        "numeric_summary": numeric_summary
    }


# --------------------------------------------------
# DATASET EXPORT
# --------------------------------------------------

@app.get("/datasets/{dataset_id}/export/csv")
def export_dataset_csv(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    dataset = get_dataset_or_404(dataset_id, db)
    file_path = get_dataset_path(dataset)

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Dataset file not found"
        )

    if file_path.suffix.lower() != ".csv":
        raise HTTPException(
            status_code=400,
            detail="Only CSV files can be exported"
        )

    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=Path(dataset.filename).name
    )


# --------------------------------------------------
# DATASET INSIGHTS
# --------------------------------------------------

@app.get("/datasets/{dataset_id}/insights")
def get_dataset_insights(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    dataset = get_dataset_or_404(dataset_id, db)
    df = read_dataset(dataset)

    findings = generate_evidence(df)
    insights = convert_to_legacy_insights(findings)

    return {
        "dataset_id": dataset_id,
        "filename": dataset.filename,
        "total_insights": len(insights),
        "insights": insights
    }


# --------------------------------------------------
# INSIGHTTRACE AI
# --------------------------------------------------

@app.get("/datasets/{dataset_id}/insighttrace")
def get_insighttrace(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    dataset = get_dataset_or_404(dataset_id, db)
    df = read_dataset(dataset)

    findings = generate_evidence(df)

    ai_result = explain_findings(findings)

    return {
        "dataset_id": dataset_id,
        "filename": dataset.filename,
        "engine": "InsightTrace AI",
        "total_findings": len(findings),
        "findings": findings,
        "ai": ai_result
    }


# --------------------------------------------------
# DEMO DATASET REGISTRATION
# --------------------------------------------------

@app.post("/datasets/demo/register")
def register_demo_datasets(
    db: Session = Depends(get_db)
):
    demo_folder = PROJECT_ROOT / "data"

    demo_filenames = [
        "BankCredit.csv",
        "Loan.csv"
    ]

    registered = []

    try:
        for filename in demo_filenames:
            file_path = demo_folder / filename

            if not file_path.is_file():
                raise HTTPException(
                    status_code=404,
                    detail=f"Demo file not found: {filename}"
                )

            # Validate before registering.
            pd.read_csv(file_path, nrows=5)

            absolute_path = str(file_path.resolve())

            existing = (
                db.query(models.Dataset)
                .filter(
                    models.Dataset.file_path == absolute_path
                )
                .first()
            )

            if existing:
                dataset = existing
            else:
                dataset = models.Dataset(
                    filename=filename,
                    file_path=absolute_path
                )

                db.add(dataset)
                db.flush()

            registered.append({
                "id": dataset.id,
                "filename": dataset.filename,
                "file_path": dataset.file_path
            })

        db.commit()

        return {
            "message": "Demo datasets are ready.",
            "datasets": registered
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not register demo datasets"
        )

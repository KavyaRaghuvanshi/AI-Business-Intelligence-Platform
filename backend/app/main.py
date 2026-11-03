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
# APPLICATION STARTUP
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="AI Business Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)


# CORS MUST BE CONFIGURED ONLY ONCE.
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


def get_neon_object_key(dataset):
    """Return the Neon object key for cloud-stored datasets."""

    stored_path = str(dataset.file_path or "").replace("\\", "/")

    if not stored_path.startswith("neon://"):
        return None

    object_key = stored_path[len("neon://"):].lstrip("/")
    key_parts = PurePosixPath(object_key).parts

    if (
        not object_key
        or not key_parts
        or key_parts[0] != "datasets"
        or ".." in key_parts
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid cloud dataset file path"
        )

    return object_key


def get_dataset_path(dataset):

    stored_path_text = str(dataset.file_path or "").replace("\\", "/")

    if not stored_path_text:
        raise HTTPException(
            status_code=400,
            detail="Dataset file path is missing"
        )

    stored_path = Path(stored_path_text)

    # Preserve existing absolute paths, including demo dataset paths.
    if stored_path.is_absolute():
        return stored_path.resolve()

    # Preserve support for older local uploads stored as uploads/name.csv.
    if stored_path.parts and stored_path.parts[0] == "uploads":
        filename = stored_path.name
        file_path = (UPLOAD_DIR / filename).resolve()

        try:
            file_path.relative_to(UPLOAD_DIR)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid dataset file path"
            )

        return file_path

    # Backward compatibility for other relative paths.
    file_path = (BACKEND_DIR / stored_path).resolve()

    try:
        file_path.relative_to(BACKEND_DIR)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid dataset file path"
        )

    return file_path


def read_dataset(dataset):
    """Read a dataset from Neon Object Storage or a legacy local path."""

    object_key = get_neon_object_key(dataset)

    if object_key:
        try:
            csv_source = download_from_storage(object_key)
        except Exception as exc:
            print("Neon Object Storage download error:", exc)
            raise HTTPException(
                status_code=503,
                detail="Could not download this dataset from permanent storage. "
                       "Check the Neon storage configuration."
            )
    else:
        file_path = get_dataset_path(dataset)

        if not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="Dataset file not found on the server. "
                       "Please upload the CSV file again."
            )

        csv_source = file_path

    try:
        return pd.read_csv(csv_source)

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="The CSV file is empty"
        )

    except HTTPException:
        raise

    except Exception as exc:
        print("Dataset CSV read error:", exc)
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
# HOME AND STORAGE CHECK
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "AI Business Intelligence Platform API is running"
    }


@app.get("/storage/health")
def storage_health():
    """Check Neon storage access without exposing credentials."""

    try:
        connected = test_storage_connection()

        if not connected:
            raise RuntimeError("Storage bucket check did not succeed")

        return {
            "storage": "connected",
            "provider": "Neon Object Storage",
            "bucket": get_bucket_name()
        }

    except Exception as exc:
        print("Neon Object Storage health check error:", exc)
        raise HTTPException(
            status_code=503,
            detail="Neon Object Storage is not reachable. "
                   "Check the Render storage environment variables."
        )


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
# DATASET UPLOAD - NEON OBJECT STORAGE
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

    total_size = 0
    chunk_size = 1024 * 1024
    object_key = f"datasets/{uuid4().hex}.csv"
    storage_upload_completed = False

    try:
        # The temporary file is only used while handling this request.
        # It is not the permanent dataset location.
        with tempfile.SpooledTemporaryFile(
            max_size=5 * 1024 * 1024,
            mode="w+b"
        ) as temporary_file:

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

                temporary_file.write(chunk)

            if total_size == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file is empty"
                )

            # Validate that the file can be read as CSV before cloud upload.
            temporary_file.seek(0)

            try:
                pd.read_csv(temporary_file, nrows=5)
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file is not a valid CSV"
                )

            # Upload the validated file to permanent Neon Object Storage.
            temporary_file.seek(0)

            try:
                await run_in_threadpool(
                    upload_to_storage,
                    temporary_file,
                    object_key,
                    "text/csv"
                )
                storage_upload_completed = True

            except Exception as exc:
                print("Neon dataset upload error:", exc)
                raise HTTPException(
                    status_code=502,
                    detail="Could not upload the CSV to permanent storage. "
                           "Please check the Neon storage configuration."
                )

        # Store only the cloud object key in PostgreSQL, not a Render path.
        dataset = models.Dataset(
            filename=original_filename,
            file_path=f"neon://{object_key}"
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

        if storage_upload_completed:
            try:
                await run_in_threadpool(
                    delete_from_storage,
                    object_key
                )
            except Exception as cleanup_error:
                print("Cloud object cleanup error:", cleanup_error)

        raise

    except Exception as exc:
        db.rollback()
        print("Dataset upload/database error:", exc)

        if storage_upload_completed:
            try:
                await run_in_threadpool(
                    delete_from_storage,
                    object_key
                )
            except Exception as cleanup_error:
                print("Cloud object cleanup error:", cleanup_error)

        raise HTTPException(
            status_code=500,
            detail="Could not save the uploaded dataset record"
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
    filename = Path(dataset.filename).name
    object_key = get_neon_object_key(dataset)

    if object_key:
        try:
            file_data = download_from_storage(object_key)

        except Exception as exc:
            print("Neon export download error:", exc)
            raise HTTPException(
                status_code=503,
                detail="Could not retrieve the dataset from permanent storage"
            )

        return StreamingResponse(
            iter([file_data.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f"attachment; filename*=UTF-8''{quote(filename)}"
                )
            }
        )

    # Backward compatibility for local/demo datasets.
    file_path = get_dataset_path(dataset)

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Dataset file not found on the server"
        )

    if file_path.suffix.lower() != ".csv":
        raise HTTPException(
            status_code=400,
            detail="Only CSV files can be exported"
        )

    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=filename
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

    except Exception as exc:
        db.rollback()
        print("Demo dataset registration error:", exc)

        raise HTTPException(
            status_code=500,
            detail="Could not register demo datasets"
        )

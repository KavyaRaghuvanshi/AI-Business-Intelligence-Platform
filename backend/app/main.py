from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
import os
import shutil
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal
import models

from schemas import UserCreate, UserUpdate, UserResponse, LoginRequest
from security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import pandas as pd
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "FastAPI is working"}

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    hashed_password = hash_password(user.password)

    new_user = models.User(
        name=user.name,
        email=user.email,
        hashed_password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@app.get("/users",response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return users

@app.get("/users/{user_id}",response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user

@app.put("/users/{user_id}",response_model=UserResponse)
def update_user(
    user_id: int,
    user: UserUpdate,
    db: Session = Depends(get_db)
):
    existing_user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if existing_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing_user.name = user.name
    existing_user.email = user.email

    db.commit()
    db.refresh(existing_user)

    return existing_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}


# Login endpoint
@app.post("/login")
def login(user: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(user.password, db_user.hashed_password):
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


security_scheme = HTTPBearer()

# Get the current authenticated user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    current_user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if current_user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return current_user


# Protected route
@app.get("/me")
def get_my_profile(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email
    }

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_datasets = db.query(models.Dataset).count()

    return {
        "total_users": total_users,
        "total_datasets": total_datasets
    }

@app.post("/datasets/upload")
def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        return {"error": "Only CSV files are allowed"}

    upload_folder = "uploads"
    os.makedirs(upload_folder, exist_ok=True)

    file_path = os.path.join(upload_folder, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    dataset = models.Dataset(
        filename=file.filename,
        file_path=file_path
    )

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return {
        "message": "Dataset uploaded successfully",
        "dataset_id": dataset.id,
        "filename": dataset.filename
    }

@app.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    datasets = db.query(models.Dataset).all()

    return datasets


@app.get("/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: int, db: Session = Depends(get_db)):
    # Find the dataset in the database
    dataset = db.query(models.Dataset).filter(
        models.Dataset.id == dataset_id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    # Locate the uploaded CSV file
    file_path = Path(dataset.file_path)

    if not file_path.is_absolute():
        file_path = Path(__file__).resolve().parent.parent / file_path

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="CSV file not found on the server"
        )

    try:
        # Read the CSV file
        df = pd.read_csv(file_path)

        # Replace missing values with None for JSON
        preview_data = df.head(10).astype(object).where(
            pd.notna(df.head(10)), None
        )

        return {
            "dataset_id": dataset.id,
            "filename": dataset.filename,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": df.columns.tolist(),
            "preview": preview_data.to_dict(orient="records")
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read CSV file: {str(e)}"
        )



@app.get("/datasets/{dataset_id}/analysis")
def analyze_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(models.Dataset).filter(
        models.Dataset.id == dataset_id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    file_path = Path(dataset.file_path)

    if not file_path.is_absolute():
        file_path = Path(__file__).resolve().parent.parent / file_path

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="CSV file not found on the server"
        )

    try:
        df = pd.read_csv(file_path)

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
                "mean": None if values.empty else float(values.mean()),
                "minimum": None if values.empty else float(values.min()),
                "maximum": None if values.empty else float(values.max())
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

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset analysis failed: {str(e)}"
        )


@app.get("/datasets/{dataset_id}/insights")
def get_dataset_insights(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    import os
    import pandas as pd
    from fastapi import HTTPException

    # Find the dataset in the database
    dataset = db.query(models.Dataset).filter(
        models.Dataset.id == dataset_id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    # Locate the uploaded CSV file
    file_path = dataset.file_path

    if not os.path.isabs(file_path):
        file_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            file_path
        )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Dataset file not found"
        )

    try:
        df = pd.read_csv(file_path)

        insights = []

        # 1. Dataset overview
        insights.append({
            "type": "overview",
            "severity": "info",
            "title": "Dataset Overview",
            "description": (
                f"The dataset contains {len(df)} rows "
                f"and {len(df.columns)} columns."
            ),
            "recommendation": (
                "Review the columns and identify the metrics "
                "most relevant to your business."
            )
        })

        # 2. Missing value detection
        missing = df.isnull().sum()
        missing_total = int(missing.sum())

        if missing_total > 0:
            affected_columns = [
                str(column)
                for column in missing[missing > 0].index
            ]

            insights.append({
                "type": "data_quality",
                "severity": "warning",
                "title": "Missing Values Detected",
                "description": (
                    f"Found {missing_total} missing values "
                    f"across {len(affected_columns)} columns."
                ),
                "recommendation": (
                    "Review the affected columns and decide "
                    "whether to fill or remove missing values."
                ),
                "columns": affected_columns
            })
        else:
            insights.append({
                "type": "data_quality",
                "severity": "success",
                "title": "No Missing Values",
                "description": (
                    "No missing values were found in the dataset."
                ),
                "recommendation": (
                    "Continue checking duplicates and unusual values."
                )
            })

        # 3. Duplicate row detection
        duplicate_count = int(df.duplicated().sum())

        if duplicate_count > 0:
            insights.append({
                "type": "data_quality",
                "severity": "warning",
                "title": "Duplicate Records",
                "description": (
                    f"Found {duplicate_count} duplicate rows."
                ),
                "recommendation": (
                    "Inspect duplicate rows before removing them "
                    "to avoid deleting legitimate records."
                )
            })
        else:
            insights.append({
                "type": "data_quality",
                "severity": "success",
                "title": "No Duplicate Rows",
                "description": (
                    "No completely duplicated rows were found."
                ),
                "recommendation": (
                    "Continue monitoring data quality as new data arrives."
                )
            })

        # 4. Numeric column insights
        numeric_df = df.select_dtypes(include="number")

        for column in numeric_df.columns:
            values = numeric_df[column].dropna()

            if len(values) == 0:
                continue

            mean_value = float(values.mean())
            min_value = float(values.min())
            max_value = float(values.max())

            insights.append({
                "type": "numeric_analysis",
                "severity": "info",
                "title": f"{column}: Statistical Summary",
                "description": (
                    f"Average: {mean_value:.2f}, "
                    f"minimum: {min_value:.2f}, "
                    f"maximum: {max_value:.2f}."
                ),
                "recommendation": (
                    "Compare these statistics with business targets "
                    "to identify areas that may need attention."
                ),
                "column": str(column),
                "mean": mean_value,
                "minimum": min_value,
                "maximum": max_value
            })

        # 5. Potential outlier detection using IQR
        for column in numeric_df.columns:
            values = numeric_df[column].dropna()

            if len(values) < 4:
                continue

            q1 = values.quantile(0.25)
            q3 = values.quantile(0.75)
            iqr = q3 - q1

            if iqr == 0:
                continue

            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            outlier_count = int(
                ((values < lower_bound) |
                 (values > upper_bound)).sum()
            )

            if outlier_count > 0:
                insights.append({
                    "type": "outlier_detection",
                    "severity": "warning",
                    "title": f"Potential Outliers: {column}",
                    "description": (
                        f"Found {outlier_count} values outside "
                        "the usual IQR range."
                    ),
                    "recommendation": (
                        "Investigate these values before removing them. "
                        "They may represent errors or legitimate "
                        "unusual business cases."
                    ),
                    "column": str(column),
                    "outlier_count": outlier_count
                })

        return {
            "dataset_id": dataset_id,
            "filename": dataset.filename,
            "total_insights": len(insights),
            "insights": insights
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate insights: {str(error)}"
        )

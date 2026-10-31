
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from passlib.context import CryptContext
from jose import JWTError, jwt


load_dotenv(Path(__file__).resolve().parent / ".env")


SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not configured in the environment"
    )


ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(data: dict) -> str:
    payload = data.copy()

    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload.update({
        "exp": expiration
    })

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(
    token: str
) -> Optional[dict]:

    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

    except JWTError:
        return None

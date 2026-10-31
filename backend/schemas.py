
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty")

        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()


class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty")

        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    model_config = ConfigDict(
        from_attributes=True
    )

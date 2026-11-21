from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    is_active: bool
    roles: list[str]
    created_at: datetime
    updated_at: datetime


class UpdateUserRoleRequest(BaseModel):
    role: str


class UpdateUserActiveRequest(BaseModel):
    is_active: bool

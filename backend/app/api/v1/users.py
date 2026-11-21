from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.dependencies.authentication import get_current_user
from app.dependencies.authorization import require_admin
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.schemas.user import (
    UpdateUserActiveRequest,
    UpdateUserRoleRequest,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    return serialize_user(user)


@router.get("", response_model=list[UserResponse])
async def list_users(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> list[UserResponse]:
    users = await AuthRepository(session).list_users()
    return [serialize_user(user) for user in users]


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    payload: UpdateUserRoleRequest,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    repository = AuthRepository(session)
    user = await repository.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    role = await repository.get_role(payload.role.strip().lower())
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found.")
    user = await repository.set_user_role(user, role)
    return serialize_user(user)


@router.patch("/{user_id}/active", response_model=UserResponse)
async def update_user_active(
    user_id: UUID,
    payload: UpdateUserActiveRequest,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    repository = AuthRepository(session)
    user = await repository.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user = await repository.set_user_active(user, payload.is_active)
    return serialize_user(user)

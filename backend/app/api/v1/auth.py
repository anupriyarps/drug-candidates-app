from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuthService:
    return AuthService(AuthRepository(session))


def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    settings = get_settings()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.secure_auth_cookies,
        samesite="lax",
        max_age=settings.jwt_access_lifetime_seconds,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_auth_cookies,
        samesite="lax",
        max_age=settings.jwt_refresh_lifetime_seconds,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = await service.register(payload.email, payload.password)
    return user_response(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service),
) -> LoginResponse:
    user, access_token, refresh_token = await service.login(
        payload.email,
        payload.password,
    )
    set_auth_cookies(response, access_token, refresh_token)
    return LoginResponse(
        status="authenticated",
        user=user_response(user),
    )


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    if not refresh_token:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"status": "refresh_token_missing"}

    _user, access_token, new_refresh_token = await service.refresh(refresh_token)
    set_auth_cookies(response, access_token, new_refresh_token)
    return {"status": "refreshed"}


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    settings = get_settings()
    if refresh_token:
        await service.logout(refresh_token)
    response.delete_cookie(
        "access_token",
        path="/",
        secure=settings.secure_auth_cookies,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth",
        secure=settings.secure_auth_cookies,
        httponly=True,
        samesite="lax",
    )
    return {"status": "logged_out"}

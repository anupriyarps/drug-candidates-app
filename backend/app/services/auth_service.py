from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_session import RefreshSession
from app.models.role import Role
from app.models.user import User
from app.repositories.auth_repository import AuthRepository


class AuthenticationError(ValueError):
    pass


class ConflictError(ValueError):
    pass


class RoleConfigurationError(RuntimeError):
    pass


class AuthRepositoryProtocol(Protocol):
    async def get_user_by_email(self, email: str) -> User | None: ...
    async def get_user_by_id(self, user_id: UUID) -> User | None: ...
    async def get_role(self, name: str) -> Role | None: ...
    async def create_user(self, user: User) -> User: ...
    async def create_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> RefreshSession: ...
    async def get_refresh_session(
        self,
        token_hash: str,
    ) -> RefreshSession | None: ...
    async def revoke_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> bool: ...


class AuthService:
    def __init__(self, repository: AuthRepositoryProtocol) -> None:
        self.repository = repository

    async def register(self, email: str, password: str) -> User:
        return await self._create_user_with_role(email, password, "viewer")

    async def create_admin(self, email: str, password: str) -> User:
        return await self._create_user_with_role(email, password, "admin")

    async def _create_user_with_role(
        self,
        email: str,
        password: str,
        role_name: str,
    ) -> User:
        normalized_email = email.strip().lower()
        existing = await self.repository.get_user_by_email(normalized_email)
        if existing is not None:
            raise ConflictError("A user with this email already exists.")

        role = await self.repository.get_role(role_name)
        if role is None:
            raise RoleConfigurationError(f"The {role_name} role is not configured.")

        user = User(
            id=uuid4(),
            email=normalized_email,
            password_hash=hash_password(password),
            is_active=True,
            roles=[role],
        )
        try:
            return await self.repository.create_user(user)
        except IntegrityError:
            raise ConflictError("A user with this email already exists.") from None

    async def login(self, email: str, password: str) -> tuple[User, str, str]:
        user = await self.repository.get_user_by_email(email)
        if (
            user is None
            or not user.is_active
            or not verify_password(password, user.password_hash)
        ):
            raise AuthenticationError("Invalid email or password.")

        return await self.issue_session(user)

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        token_hash = hash_refresh_token(refresh_token)
        session = await self.repository.get_refresh_session(token_hash)
        if session is None:
            raise AuthenticationError("Refresh session is invalid.")

        if session.expires_at <= datetime.now(UTC):
            await self.repository.revoke_refresh_session(session)
            raise AuthenticationError("Refresh session is expired.")

        user = await self.repository.get_user_by_id(session.user_id)
        if user is None or not user.is_active:
            await self.repository.revoke_refresh_session(session)
            raise AuthenticationError("User account is inactive.")

        if not await self.repository.revoke_refresh_session(session):
            raise AuthenticationError("Refresh session is invalid.")
        return await self.issue_session(user)

    async def logout(self, refresh_token: str) -> None:
        session = await self.repository.get_refresh_session(
            hash_refresh_token(refresh_token)
        )
        if session is not None:
            await self.repository.revoke_refresh_session(session)

    async def issue_session(
        self,
        user: User,
    ) -> tuple[User, str, str]:
        settings = get_settings()
        roles = {role.name for role in user.roles}
        access_token = create_access_token(user.id, roles)
        refresh_token, token_hash = create_refresh_token()
        refresh_session = RefreshSession(
            id=uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC)
            + timedelta(seconds=settings.jwt_refresh_lifetime_seconds),
        )
        await self.repository.create_refresh_session(refresh_session)
        return user, access_token, refresh_token

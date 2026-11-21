from uuid import UUID, uuid4

import pytest

from app.core.security import verify_password
from app.models.role import Role
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services.auth_service import (
    AuthService,
    ConflictError,
    RoleConfigurationError,
)


class InMemoryAuthRepository:
    def __init__(self, roles: list[Role]) -> None:
        self.roles = {role.name: role for role in roles}
        self.users: dict[str, User] = {}
        self.create_user_calls = 0

    async def get_user_by_email(self, email: str) -> User | None:
        return self.users.get(email.strip().lower())

    async def get_role(self, name: str) -> Role | None:
        return self.roles.get(name)

    async def create_user(self, user: User) -> User:
        self.create_user_calls += 1
        self.users[user.email] = user
        return user

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        del user_id
        return None

    async def create_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> RefreshSession:
        return refresh_session

    async def get_refresh_session(
        self,
        token_hash: str,
    ) -> RefreshSession | None:
        del token_hash
        return None

    async def revoke_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> bool:
        del refresh_session
        return True

    async def revoke_user_sessions(self, user_id: UUID) -> None:
        del user_id


@pytest.mark.asyncio
async def test_create_admin_uses_argon2_and_assigns_admin_role() -> None:
    repository = InMemoryAuthRepository(
        [Role(id=uuid4(), name="admin"), Role(id=uuid4(), name="viewer")]
    )
    service = AuthService(repository)

    user = await service.create_admin(
        "  Admin@Example.com ",
        "a-strong-admin-password",
    )

    assert user.email == "admin@example.com"
    assert [role.name for role in user.roles] == ["admin"]
    assert user.password_hash != "a-strong-admin-password"
    assert verify_password("a-strong-admin-password", user.password_hash)
    assert repository.create_user_calls == 1


@pytest.mark.asyncio
async def test_create_admin_does_not_change_an_existing_account() -> None:
    viewer_role = Role(id=uuid4(), name="viewer")
    repository = InMemoryAuthRepository([viewer_role, Role(id=uuid4(), name="admin")])
    existing_user = User(
        id=uuid4(),
        email="admin@example.com",
        password_hash="existing-password-hash",
        is_active=True,
        roles=[viewer_role],
    )
    repository.users[existing_user.email] = existing_user
    service = AuthService(repository)

    with pytest.raises(ConflictError):
        await service.create_admin("ADMIN@example.com", "another-secure-password")

    assert repository.users[existing_user.email] is existing_user
    assert existing_user.password_hash == "existing-password-hash"
    assert existing_user.roles == [viewer_role]
    assert repository.create_user_calls == 0


@pytest.mark.asyncio
async def test_create_admin_requires_migrated_admin_role() -> None:
    repository = InMemoryAuthRepository([Role(id=uuid4(), name="viewer")])
    service = AuthService(repository)

    with pytest.raises(RoleConfigurationError, match="admin role"):
        await service.create_admin("admin@example.com", "a-strong-admin-password")

    assert repository.users == {}
    assert repository.create_user_calls == 0

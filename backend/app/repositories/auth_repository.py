from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.refresh_session import RefreshSession
from app.models.role import Role
from app.models.user import User


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> User | None:
        statement = (
            select(User)
            .where(User.email == email.strip().lower())
            .options(selectinload(User.roles))
        )
        return cast(User | None, await self.session.scalar(statement))

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        statement = (
            select(User).where(User.id == user_id).options(selectinload(User.roles))
        )
        return cast(User | None, await self.session.scalar(statement))

    async def get_role(self, name: str) -> Role | None:
        return cast(
            Role | None,
            await self.session.scalar(select(Role).where(Role.name == name)),
        )

    async def create_user(self, user: User) -> User:
        self.session.add(user)
        try:
            await self.session.flush()
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(user, attribute_names=["roles"])
        return user

    async def list_users(self) -> list[User]:
        result = await self.session.scalars(
            select(User).options(selectinload(User.roles)).order_by(User.email)
        )
        return list(result.all())

    async def update_user(self, user: User) -> User:
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(user, attribute_names=["roles"])
        return user

    async def set_user_active(self, user: User, is_active: bool) -> User:
        user.is_active = is_active
        await self.session.flush()
        if not is_active:
            await self.session.execute(
                update(RefreshSession)
                .where(
                    RefreshSession.user_id == user.id,
                    RefreshSession.revoked_at.is_(None),
                )
                .values(revoked_at=datetime.now(UTC))
            )
        await self.session.commit()
        await self.session.refresh(user, attribute_names=["roles"])
        return user

    async def set_user_role(self, user: User, role: Role) -> User:
        user.roles = [role]
        return await self.update_user(user)

    async def create_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> RefreshSession:
        self.session.add(refresh_session)
        await self.session.flush()
        await self.session.commit()
        return refresh_session

    async def get_refresh_session(
        self,
        token_hash: str,
    ) -> RefreshSession | None:
        return cast(
            RefreshSession | None,
            await self.session.scalar(
                select(RefreshSession).where(
                    RefreshSession.token_hash == token_hash,
                    RefreshSession.revoked_at.is_(None),
                )
            ),
        )

    async def revoke_refresh_session(
        self,
        refresh_session: RefreshSession,
    ) -> bool:
        result = await self.session.execute(
            update(RefreshSession)
            .where(
                RefreshSession.id == refresh_session.id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
            .returning(RefreshSession.id)
        )
        revoked = result.scalar_one_or_none() is not None
        await self.session.commit()
        return revoked

    async def revoke_user_sessions(self, user_id: UUID) -> None:
        await self.session.execute(
            update(RefreshSession)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )
        await self.session.commit()

from math import ceil
from typing import Literal, cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate, CandidateStatus
from app.repositories.interfaces import (
    ICandidateRepository,
    PaginatedCandidates,
)


class CandidateRepository(ICandidateRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates:
        statement = select(Candidate)

        if search:
            statement = statement.where(
                func.lower(Candidate.name).contains(search.strip().lower())
            )
        if status:
            statement = statement.where(Candidate.status == status)

        count_statement = select(func.count()).select_from(statement.subquery())
        total_records = await self.session.scalar(count_statement)

        sort_column = Candidate.name if sort_by == "name" else Candidate.status
        sort_expression = (
            sort_column.asc() if sort_order == "asc" else sort_column.desc()
        )
        statement = (
            statement.order_by(sort_expression, Candidate.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await self.session.scalars(statement)
        data = list(result.all())
        total = total_records or 0

        return PaginatedCandidates(
            data=data,
            page=page,
            page_size=page_size,
            total_records=total,
            total_pages=ceil(total / page_size) if total else 0,
        )

    async def get_candidate_by_id(
        self,
        candidate_id: UUID,
    ) -> Candidate | None:
        return await self.session.get(Candidate, candidate_id)

    async def get_candidate_by_name(self, name: str) -> Candidate | None:
        statement = select(Candidate).where(
            func.lower(Candidate.name) == name.strip().lower()
        )
        return cast(Candidate | None, await self.session.scalar(statement))

    async def create_candidate(self, candidate: Candidate) -> Candidate:
        self.session.add(candidate)
        try:
            await self.session.flush()
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        return candidate

    async def update_candidate(self, candidate: Candidate) -> Candidate:
        try:
            await self.session.flush()
            await self.session.commit()
            await self.session.refresh(candidate)
        except IntegrityError:
            await self.session.rollback()
            raise
        return candidate

    async def delete_candidate(self, candidate: Candidate) -> None:
        await self.session.delete(candidate)
        await self.session.flush()
        await self.session.commit()

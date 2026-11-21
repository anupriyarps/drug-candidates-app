from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

from app.models.candidate import Candidate, CandidateStatus


@dataclass(frozen=True)
class PaginatedCandidates:
    data: list[Candidate]
    page: int
    page_size: int
    total_records: int
    total_pages: int

    @property
    def has_next_page(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_previous_page(self) -> bool:
        return self.page > 1 and self.total_pages > 0


class ICandidateRepository(Protocol):
    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates: ...

    async def get_candidate_by_id(
        self,
        candidate_id: UUID,
    ) -> Candidate | None: ...

    async def get_candidate_by_name(self, name: str) -> Candidate | None: ...

    async def create_candidate(self, candidate: Candidate) -> Candidate: ...

    async def update_candidate(self, candidate: Candidate) -> Candidate: ...

    async def delete_candidate(self, candidate: Candidate) -> None: ...

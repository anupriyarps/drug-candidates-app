from typing import Literal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.candidate import Candidate, CandidateStatus
from app.repositories.interfaces import PaginatedCandidates
from app.services.candidate_service import (
    CandidateConflictError,
    CandidateCreateData,
    CandidateNotFoundError,
    CandidatePatchData,
    CandidateService,
    CandidateUpdateData,
)


class InMemoryCandidateRepository:
    def __init__(self) -> None:
        self.candidates: dict[object, Candidate] = {}

    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates:
        data = list(self.candidates.values())
        if search:
            data = [item for item in data if search.lower() in item.name.lower()]
        if status:
            data = [item for item in data if item.status == status]
        total = len(data)
        return PaginatedCandidates(
            data=data,
            page=page,
            page_size=page_size,
            total_records=total,
            total_pages=(total + page_size - 1) // page_size,
        )

    async def get_candidate_by_id(self, candidate_id: UUID) -> Candidate | None:
        return self.candidates.get(candidate_id)

    async def get_candidate_by_name(self, name: str) -> Candidate | None:
        normalized = name.strip().lower()
        return next(
            (
                item
                for item in self.candidates.values()
                if item.name.lower() == normalized
            ),
            None,
        )

    async def create_candidate(self, candidate: Candidate) -> Candidate:
        self.candidates[candidate.id] = candidate
        return candidate

    async def update_candidate(self, candidate: Candidate) -> Candidate:
        self.candidates[candidate.id] = candidate
        return candidate

    async def delete_candidate(self, candidate: Candidate) -> None:
        del self.candidates[candidate.id]


class IntegrityCandidateRepository(InMemoryCandidateRepository):
    async def create_candidate(self, candidate: Candidate) -> Candidate:
        raise IntegrityError("insert", {}, Exception("duplicate"))


def candidate(name: str = "NovaCure") -> Candidate:
    return Candidate(
        id=uuid4(),
        name=name,
        status=CandidateStatus.IN_DEVELOPMENT,
        description="Illustrative description.",
        mechanism_of_action="Illustrative mechanism.",
        side_effects=["Headache"],
    )


@pytest.mark.asyncio
async def test_create_candidate_normalizes_name_and_side_effects() -> None:
    repository = InMemoryCandidateRepository()
    service = CandidateService(repository)

    created = await service.create_candidate(
        CandidateCreateData(
            name="  NovaCure  ",
            status=CandidateStatus.IN_DEVELOPMENT,
            description="  Description  ",
            mechanism_of_action="  Mechanism  ",
            side_effects=[" Headache ", "", " Fatigue "],
        )
    )

    assert created.name == "NovaCure"
    assert created.description == "Description"
    assert created.mechanism_of_action == "Mechanism"
    assert created.side_effects == ["Headache", "Fatigue"]


@pytest.mark.asyncio
async def test_create_candidate_rejects_duplicate_name() -> None:
    repository = InMemoryCandidateRepository()
    existing = candidate()
    repository.candidates[existing.id] = existing
    service = CandidateService(repository)

    with pytest.raises(CandidateConflictError):
        await service.create_candidate(
            CandidateCreateData(
                name="novacure",
                status=CandidateStatus.APPROVED,
                description="Description",
                mechanism_of_action="Mechanism",
                side_effects=[],
            )
        )


@pytest.mark.asyncio
async def test_create_candidate_maps_database_integrity_conflict() -> None:
    service = CandidateService(IntegrityCandidateRepository())

    with pytest.raises(CandidateConflictError):
        await service.create_candidate(
            CandidateCreateData(
                name="NovaCure",
                status=CandidateStatus.APPROVED,
                description="Description",
                mechanism_of_action="Mechanism",
                side_effects=[],
            )
        )


@pytest.mark.asyncio
async def test_update_candidate_replaces_all_fields() -> None:
    repository = InMemoryCandidateRepository()
    existing = candidate()
    repository.candidates[existing.id] = existing
    service = CandidateService(repository)

    updated = await service.update_candidate(
        existing.id,
        CandidateUpdateData(
            name="Updated",
            status=CandidateStatus.APPROVED,
            description="New description",
            mechanism_of_action="New mechanism",
            side_effects=["Dizziness"],
        ),
    )

    assert updated.name == "Updated"
    assert updated.status is CandidateStatus.APPROVED
    assert updated.side_effects == ["Dizziness"]


@pytest.mark.asyncio
async def test_patch_candidate_updates_only_supplied_fields() -> None:
    repository = InMemoryCandidateRepository()
    existing = candidate()
    repository.candidates[existing.id] = existing
    service = CandidateService(repository)

    patched = await service.patch_candidate(
        existing.id,
        CandidatePatchData(status=CandidateStatus.CLINICAL_TRIAL),
    )

    assert patched.status is CandidateStatus.CLINICAL_TRIAL
    assert patched.description == "Illustrative description."


@pytest.mark.asyncio
async def test_missing_candidate_raises_not_found() -> None:
    service = CandidateService(InMemoryCandidateRepository())

    with pytest.raises(CandidateNotFoundError):
        await service.get_candidate(uuid4())

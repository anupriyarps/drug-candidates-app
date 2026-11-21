from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Protocol
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.models.candidate import Candidate, CandidateStatus
from app.repositories.interfaces import (
    ICandidateRepository,
    PaginatedCandidates,
)
from app.services.candidate_cache import (
    CandidateCache,
    build_candidate_detail_cache_key,
    build_candidate_list_cache_key,
)


class CandidateNotFoundError(LookupError):
    pass


class CandidateConflictError(ValueError):
    pass


class CandidateCacheProtocol(Protocol):
    async def get(self, key: str) -> dict[str, Any] | None: ...
    async def set(
        self,
        key: str,
        value: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def delete_pattern(self, pattern: str) -> None: ...


@dataclass(frozen=True)
class CandidateCreateData:
    name: str
    status: CandidateStatus
    description: str
    mechanism_of_action: str
    side_effects: list[str]


@dataclass(frozen=True)
class CandidateUpdateData:
    name: str
    status: CandidateStatus
    description: str
    mechanism_of_action: str
    side_effects: list[str]


@dataclass(frozen=True)
class CandidatePatchData:
    name: str | None = None
    status: CandidateStatus | None = None
    description: str | None = None
    mechanism_of_action: str | None = None
    side_effects: list[str] | None = None


class CandidateService:
    def __init__(
        self,
        repository: ICandidateRepository,
        cache: CandidateCacheProtocol | None = None,
    ) -> None:
        self.repository = repository
        self.cache = cache

    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates:
        cache_key = build_candidate_list_cache_key(
            search,
            status.value if status else None,
            page,
            page_size,
            sort_by,
            sort_order,
        )
        if self.cache is not None:
            cached = await self.cache.get(cache_key)
            if cached is not None:
                try:
                    return PaginatedCandidates(
                        data=[
                            self._deserialize_candidate(candidate)
                            for candidate in cached["data"]
                        ],
                        page=cached["page"],
                        page_size=cached["page_size"],
                        total_records=cached["total_records"],
                        total_pages=cached["total_pages"],
                    )
                except (KeyError, TypeError, ValueError):
                    pass

        result = await self.repository.get_candidates(
            search=search,
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        if self.cache is not None:
            await self.cache.set(
                cache_key,
                {
                    "data": [
                        self._serialize_candidate(candidate)
                        for candidate in result.data
                    ],
                    "page": result.page,
                    "page_size": result.page_size,
                    "total_records": result.total_records,
                    "total_pages": result.total_pages,
                },
            )
        return result

    async def get_candidate(self, candidate_id: UUID) -> Candidate:
        if self.cache is not None:
            cached = await self.cache.get(
                build_candidate_detail_cache_key(str(candidate_id))
            )
            if cached is not None:
                try:
                    return self._deserialize_candidate(cached)
                except (KeyError, TypeError, ValueError):
                    pass

        candidate = await self.repository.get_candidate_by_id(candidate_id)
        if candidate is None:
            raise CandidateNotFoundError("Candidate not found.")
        if self.cache is not None:
            await self.cache.set(
                build_candidate_detail_cache_key(str(candidate_id)),
                self._serialize_candidate(candidate),
            )
        return candidate

    async def create_candidate(self, data: CandidateCreateData) -> Candidate:
        name = data.name.strip()
        await self._ensure_name_available(name)
        try:
            candidate = await self.repository.create_candidate(
                Candidate(
                    id=uuid4(),
                    name=name,
                    status=data.status,
                    description=data.description.strip(),
                    mechanism_of_action=data.mechanism_of_action.strip(),
                    side_effects=self._normalize_side_effects(data.side_effects),
                )
            )
        except IntegrityError:
            raise CandidateConflictError(
                "A candidate with this name already exists."
            ) from None
        await self._invalidate_candidates()
        return candidate

    async def update_candidate(
        self,
        candidate_id: UUID,
        data: CandidateUpdateData,
    ) -> Candidate:
        candidate = await self.get_candidate(candidate_id)
        name = data.name.strip()
        await self._ensure_name_available(name, candidate.id)

        candidate.name = name
        candidate.status = data.status
        candidate.description = data.description.strip()
        candidate.mechanism_of_action = data.mechanism_of_action.strip()
        candidate.side_effects = self._normalize_side_effects(data.side_effects)
        try:
            candidate = await self.repository.update_candidate(candidate)
        except IntegrityError:
            raise CandidateConflictError(
                "A candidate with this name already exists."
            ) from None
        await self._invalidate_candidate(candidate)
        return candidate

    async def patch_candidate(
        self,
        candidate_id: UUID,
        data: CandidatePatchData,
    ) -> Candidate:
        candidate = await self.get_candidate(candidate_id)

        if data.name is not None:
            name = data.name.strip()
            await self._ensure_name_available(name, candidate.id)
            candidate.name = name
        if data.status is not None:
            candidate.status = data.status
        if data.description is not None:
            candidate.description = data.description.strip()
        if data.mechanism_of_action is not None:
            candidate.mechanism_of_action = data.mechanism_of_action.strip()
        if data.side_effects is not None:
            candidate.side_effects = self._normalize_side_effects(data.side_effects)

        try:
            candidate = await self.repository.update_candidate(candidate)
        except IntegrityError:
            raise CandidateConflictError(
                "A candidate with this name already exists."
            ) from None
        await self._invalidate_candidate(candidate)
        return candidate

    async def delete_candidate(self, candidate_id: UUID) -> None:
        candidate = await self.get_candidate(candidate_id)
        await self.repository.delete_candidate(candidate)
        await self._invalidate_candidate(candidate)

    async def _ensure_name_available(
        self,
        name: str,
        existing_candidate_id: UUID | None = None,
    ) -> None:
        existing = await self.repository.get_candidate_by_name(name)
        if existing is not None and existing.id != existing_candidate_id:
            raise CandidateConflictError("A candidate with this name already exists.")

    @staticmethod
    def _normalize_side_effects(effects: list[str]) -> list[str]:
        return [effect.strip() for effect in effects if effect.strip()]

    @staticmethod
    def _serialize_candidate(candidate: Candidate) -> dict[str, Any]:
        return {
            "id": str(candidate.id),
            "name": candidate.name,
            "status": candidate.status.value,
            "description": candidate.description,
            "mechanism_of_action": candidate.mechanism_of_action,
            "side_effects": candidate.side_effects,
            "created_at": candidate.created_at.isoformat(),
            "updated_at": candidate.updated_at.isoformat(),
        }

    @staticmethod
    def _deserialize_candidate(payload: dict[str, Any]) -> Candidate:
        return Candidate(
            id=UUID(payload["id"]),
            name=payload["name"],
            status=CandidateStatus(payload["status"]),
            description=payload["description"],
            mechanism_of_action=payload["mechanism_of_action"],
            side_effects=list(payload["side_effects"]),
            created_at=datetime.fromisoformat(str(payload["created_at"])),
            updated_at=datetime.fromisoformat(str(payload["updated_at"])),
        )

    async def _invalidate_candidate(self, candidate: Candidate) -> None:
        if self.cache is None:
            return
        await self.cache.delete(build_candidate_detail_cache_key(str(candidate.id)))
        await self._invalidate_candidates()

    async def _invalidate_candidates(self) -> None:
        if self.cache is not None:
            await self.cache.delete_pattern("drug-candidates:list:*")

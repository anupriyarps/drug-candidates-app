from datetime import UTC, datetime
from collections.abc import Generator
from typing import Literal
from uuid import UUID
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.services.candidate_cache as candidate_cache_module
from app.dependencies.authentication import get_current_user
from app.dependencies.candidates import get_candidate_service
from app.main import app
from app.models.candidate import Candidate, CandidateStatus
from app.models.role import Role
from app.models.user import User
from app.repositories.interfaces import PaginatedCandidates
from app.services.candidate_cache import CandidateCache
from app.services.candidate_service import CandidateService


class ApiCandidateRepository:
    def __init__(self) -> None:
        self.candidates: dict[object, Candidate] = {}
        self.last_query: dict[str, object] = {}
        self.fail_candidate_reads = False

    def sample(self) -> Candidate:
        now = datetime.now(UTC)
        return Candidate(
            id=uuid4(),
            name="NovaCure",
            status=CandidateStatus.IN_DEVELOPMENT,
            description="Description",
            mechanism_of_action="Mechanism",
            side_effects=["Headache"],
            created_at=now,
            updated_at=now,
        )

    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates:
        if self.fail_candidate_reads:
            raise ConnectionError("PostgreSQL unavailable")

        data = list(self.candidates.values())
        self.last_query = {
            "search": search,
            "status": status,
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }
        if search:
            data = [item for item in data if search.lower() in item.name.lower()]
        if status:
            data = [item for item in data if item.status == status]
        total = len(data)
        reverse = sort_order == "desc"
        data.sort(key=lambda item: getattr(item, sort_by), reverse=reverse)
        start = (page - 1) * page_size
        data = data[start : start + page_size]
        return PaginatedCandidates(
            data=data,
            page=page,
            page_size=page_size,
            total_records=total,
            total_pages=(total + page_size - 1) // page_size if total else 0,
        )

    async def get_candidate_by_id(
        self,
        candidate_id: UUID,
    ) -> Candidate | None:
        return self.candidates.get(candidate_id)

    async def get_candidate_by_name(self, name: str) -> Candidate | None:
        normalized = name.lower()
        return next(
            (
                candidate
                for candidate in self.candidates.values()
                if candidate.name.lower() == normalized
            ),
            None,
        )

    async def create_candidate(self, candidate: Candidate) -> Candidate:
        now = datetime.now(UTC)
        candidate.created_at = now
        candidate.updated_at = now
        self.candidates[candidate.id] = candidate
        return candidate

    async def update_candidate(self, candidate: Candidate) -> Candidate:
        candidate.updated_at = datetime.now(UTC)
        self.candidates[candidate.id] = candidate
        return candidate

    async def delete_candidate(self, candidate: Candidate) -> None:
        del self.candidates[candidate.id]


ApiClientFixture = tuple[TestClient, ApiCandidateRepository, Candidate]


@pytest.fixture
def api_client() -> Generator[
    tuple[TestClient, ApiCandidateRepository, Candidate],
    None,
    None,
]:
    repository = ApiCandidateRepository()
    existing = repository.sample()
    repository.candidates[existing.id] = existing
    service = CandidateService(repository)

    async def override_service() -> CandidateService:
        return service

    app.dependency_overrides[get_candidate_service] = override_service
    admin_role = Role(id=uuid4(), name="admin")
    now = datetime.now(UTC)
    admin = User(
        id=uuid4(),
        email="admin@example.com",
        password_hash="unused",
        is_active=True,
        roles=[admin_role],
        created_at=now,
        updated_at=now,
    )
    app.dependency_overrides[get_current_user] = lambda: admin
    with TestClient(app) as test_client:
        yield test_client, repository, existing
    app.dependency_overrides.clear()


def test_list_candidates(api_client: ApiClientFixture) -> None:
    test_client, _repository, _existing = api_client

    response = test_client.get("/api/v1/candidates")

    assert response.status_code == 200
    assert response.json()["pagination"]["totalRecords"] == 1
    assert response.json()["data"][0]["name"] == "NovaCure"


def test_list_candidates_maps_pagination_and_sorting_query(
    api_client: ApiClientFixture,
) -> None:
    test_client, repository, _existing = api_client
    second = repository.sample()
    second.name = "CardioZen"
    second.status = CandidateStatus.APPROVED
    repository.candidates[second.id] = second

    response = test_client.get(
        "/api/v1/candidates",
        params={
            "page": 2,
            "page_size": 1,
            "sort_by": "name",
            "sort_order": "desc",
        },
    )

    assert response.status_code == 200
    assert repository.last_query == {
        "search": None,
        "status": None,
        "page": 2,
        "page_size": 1,
        "sort_by": "name",
        "sort_order": "desc",
    }
    assert response.json()["data"][0]["name"] == "CardioZen"
    assert response.json()["pagination"] == {
        "page": 2,
        "pageSize": 1,
        "totalRecords": 2,
        "totalPages": 2,
        "hasNextPage": False,
        "hasPreviousPage": True,
    }


def test_candidate_list_search_and_status_work_when_redis_is_unavailable(
    api_client: ApiClientFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, repository, _existing = api_client
    approved = repository.sample()
    approved.name = "CardioZen"
    approved.status = CandidateStatus.APPROVED
    repository.candidates[approved.id] = approved

    class UnavailableRedis:
        def __init__(self) -> None:
            self.get_calls = 0
            self.set_calls = 0

        async def get(self, _key: str) -> str:
            self.get_calls += 1
            raise ConnectionError("Redis unavailable")

        async def set(self, _key: str, _value: str, ex: int) -> None:
            self.set_calls += 1
            raise ConnectionError("Redis unavailable")

    redis = UnavailableRedis()
    monkeypatch.setattr(
        candidate_cache_module,
        "get_redis_client",
        lambda: redis,
    )
    service = CandidateService(repository, CandidateCache())
    app.dependency_overrides[get_candidate_service] = lambda: service

    all_candidates = test_client.get("/api/v1/candidates")
    searched = test_client.get(
        "/api/v1/candidates",
        params={"search": "Nova"},
    )
    filtered = test_client.get(
        "/api/v1/candidates",
        params={"status": "Approved"},
    )

    assert all_candidates.status_code == 200
    assert all_candidates.json()["pagination"]["totalRecords"] == 2
    assert searched.status_code == 200
    assert [item["name"] for item in searched.json()["data"]] == ["NovaCure"]
    assert filtered.status_code == 200
    assert [item["name"] for item in filtered.json()["data"]] == ["CardioZen"]
    assert redis.get_calls == 1
    assert redis.set_calls == 0


def test_candidate_list_returns_application_error_on_database_failure(
    api_client: ApiClientFixture,
) -> None:
    _test_client, repository, _existing = api_client
    repository.fail_candidate_reads = True

    response = TestClient(app, raise_server_exceptions=False).get("/api/v1/candidates")

    assert response.status_code == 500


def test_get_candidate(api_client: ApiClientFixture) -> None:
    test_client, _repository, existing = api_client

    response = test_client.get(f"/api/v1/candidates/{existing.id}")

    assert response.status_code == 200
    assert response.json()["data"]["id"] == str(existing.id)


def test_create_candidate(api_client: ApiClientFixture) -> None:
    test_client, _repository, _existing = api_client
    test_client.cookies.set("access_token", "admin-session")

    response = test_client.post(
        "/api/v1/candidates",
        headers={"Origin": "http://testserver"},
        json={
            "name": "CardioZen",
            "status": "Clinical Trial",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": ["Dizziness"],
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "CardioZen"


def test_viewer_cannot_create_candidate(api_client: ApiClientFixture) -> None:
    test_client, _repository, _existing = api_client
    now = datetime.now(UTC)
    viewer = User(
        id=uuid4(),
        email="viewer@example.com",
        password_hash="unused",
        is_active=True,
        roles=[Role(id=uuid4(), name="viewer")],
        created_at=now,
        updated_at=now,
    )
    app.dependency_overrides[get_current_user] = lambda: viewer
    test_client.cookies.set("access_token", "viewer-session")

    response = test_client.post(
        "/api/v1/candidates",
        headers={"Origin": "http://testserver"},
        json={
            "name": "RestrictedCandidate",
            "status": "Clinical Trial",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": [],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin permission required."


def test_cookie_authenticated_mutation_rejects_untrusted_origin(
    api_client: ApiClientFixture,
) -> None:
    test_client, _repository, _existing = api_client
    test_client.cookies.set("access_token", "admin-session")

    response = test_client.post(
        "/api/v1/candidates",
        headers={"Origin": "https://attacker.example"},
        json={
            "name": "CrossOriginCandidate",
            "status": "Clinical Trial",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": [],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Origin not allowed."


def test_cookie_authenticated_mutation_requires_origin(
    api_client: ApiClientFixture,
) -> None:
    test_client, _repository, _existing = api_client
    test_client.cookies.set("access_token", "admin-session")

    response = test_client.post(
        "/api/v1/candidates",
        json={
            "name": "MissingOriginCandidate",
            "status": "Clinical Trial",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": [],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Origin not allowed."


def test_create_duplicate_returns_conflict(api_client: ApiClientFixture) -> None:
    test_client, _repository, _existing = api_client

    response = test_client.post(
        "/api/v1/candidates",
        json={
            "name": "NovaCure",
            "status": "Approved",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": [],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_invalid_status_returns_validation_error(
    api_client: ApiClientFixture,
) -> None:
    test_client, _repository, _existing = api_client

    response = test_client.post(
        "/api/v1/candidates",
        json={
            "name": "Invalid",
            "status": "Unknown",
            "description": "Description",
            "mechanism_of_action": "Mechanism",
            "side_effects": [],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_missing_candidate_returns_not_found(api_client: ApiClientFixture) -> None:
    test_client, _repository, _existing = api_client

    response = test_client.get(f"/api/v1/candidates/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_patch_candidate(api_client: ApiClientFixture) -> None:
    test_client, _repository, existing = api_client

    response = test_client.patch(
        f"/api/v1/candidates/{existing.id}",
        json={"status": "Approved"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "Approved"


def test_delete_candidate(api_client: ApiClientFixture) -> None:
    test_client, _repository, existing = api_client

    response = test_client.delete(f"/api/v1/candidates/{existing.id}")

    assert response.status_code == 204

from __future__ import annotations

import json
import sys
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import Select

from app.models.candidate import Candidate
from scripts import import_candidates


class InMemorySession:
    def __init__(self, candidates: dict[UUID, Candidate]) -> None:
        self.candidates = candidates

    async def __aenter__(self) -> InMemorySession:
        return self

    async def __aexit__(
        self,
        _exc_type: object,
        _exc_value: object,
        _traceback: object,
    ) -> None:
        return None

    async def scalar(
        self,
        statement: Select[tuple[Candidate]],
    ) -> Candidate | None:
        candidate_id = next(iter(statement.compile().params.values()))
        return self.candidates.get(candidate_id)

    async def scalars(
        self,
        statement: Select[tuple[Candidate]],
    ) -> list[Candidate]:
        del statement
        return list(self.candidates.values())

    def add(self, candidate: Candidate) -> None:
        self.candidates[candidate.id] = candidate

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None


class InMemorySessionFactory:
    def __init__(self) -> None:
        self.candidates: dict[UUID, Candidate] = {}

    def __call__(self) -> InMemorySession:
        return InMemorySession(self.candidates)


def test_default_dataset_path_is_independent_of_working_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)

    default_path = (
        Path(import_candidates.__file__).resolve().parents[1]
        / "data"
        / "candidates.json"
    )
    assert import_candidates.get_default_dataset_path() == default_path
    assert import_candidates.resolve_dataset_path(None) == default_path
    assert default_path.is_file()


@pytest.mark.asyncio
async def test_import_is_repeatable_and_skips_duplicate_ids(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dataset_path = tmp_path / "candidates.json"
    record = {
        "id": "drug-001",
        "name": "NovaCure",
        "status": "In Development",
        "description": "Description",
        "mechanismOfAction": "Mechanism",
        "sideEffects": ["Headache"],
    }
    dataset_path.write_text(json.dumps([record, record]), encoding="utf-8")
    session_factory = InMemorySessionFactory()
    monkeypatch.setattr(import_candidates, "session_factory", session_factory)

    assert await import_candidates.import_candidates(dataset_path) == 1
    assert await import_candidates.import_candidates(dataset_path) == 0
    assert len(session_factory.candidates) == 1


@pytest.mark.asyncio
async def test_import_skips_duplicate_names(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dataset_path = tmp_path / "candidates.json"
    dataset_path.write_text(
        json.dumps(
            [
                {
                    "id": "drug-001",
                    "name": "NovaCure",
                    "status": "In Development",
                    "description": "Description",
                    "mechanismOfAction": "Mechanism",
                    "sideEffects": ["Headache"],
                },
                {
                    "id": "drug-002",
                    "name": "  novacure  ",
                    "status": "Approved",
                    "description": "Description",
                    "mechanismOfAction": "Mechanism",
                    "sideEffects": [],
                },
            ]
        ),
        encoding="utf-8",
    )
    session_factory = InMemorySessionFactory()
    monkeypatch.setattr(import_candidates, "session_factory", session_factory)

    assert await import_candidates.import_candidates(dataset_path) == 1


@pytest.mark.asyncio
async def test_main_imports_default_seed_repeatably_from_any_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["import_candidates"])
    session_factory = InMemorySessionFactory()
    monkeypatch.setattr(import_candidates, "session_factory", session_factory)

    await import_candidates.main()
    assert len(session_factory.candidates) == 4

    await import_candidates.main()
    assert len(session_factory.candidates) == 4

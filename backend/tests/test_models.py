from typing import Any, Callable, cast

from sqlalchemy import Enum
from sqlalchemy.dialects.postgresql import dialect

from app.models.base import Base
from app.models.candidate import Candidate, CandidateStatus
from app.models.role import Role
from app.models.user import User


def test_database_model_registry() -> None:
    assert {
        "candidates",
        "roles",
        "users",
        "user_roles",
    }.issubset(Base.metadata.tables)


def test_candidate_status_values() -> None:
    assert CandidateStatus("In Development") is CandidateStatus.IN_DEVELOPMENT
    assert CandidateStatus("Clinical Trial") is CandidateStatus.CLINICAL_TRIAL
    assert CandidateStatus("Approved") is CandidateStatus.APPROVED


def test_candidate_status_model_persists_migration_enum_values() -> None:
    status_type = cast(Enum, Candidate.__table__.c.status.type)

    assert status_type.name == "candidate_status"
    assert list(status_type.enums) == [
        "In Development",
        "Clinical Trial",
        "Approved",
    ]

    status_type_any = cast(Any, status_type)
    dialect_factory = cast(Callable[[], Any], dialect)
    dialect_instance = dialect_factory()

    bind_processor = cast(
        Callable[[Any], Any] | None,
        status_type_any.bind_processor(dialect_instance),
    )

    assert bind_processor is not None
    assert bind_processor(CandidateStatus.IN_DEVELOPMENT) == "In Development"
    
def test_candidate_model_maps_expected_columns() -> None:
    column_names = set(Candidate.__table__.columns.keys())

    assert {
        "id",
        "name",
        "status",
        "description",
        "mechanism_of_action",
        "side_effects",
        "created_at",
        "updated_at",
    }.issubset(column_names)


def test_user_and_role_models_are_registered() -> None:
    assert "email" in User.__table__.columns
    assert "password_hash" in User.__table__.columns
    assert "name" in Role.__table__.columns

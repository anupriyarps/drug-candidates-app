from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Enum, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CandidateStatus(StrEnum):
    IN_DEVELOPMENT = "In Development"
    CLINICAL_TRIAL = "Clinical Trial"
    APPROVED = "Approved"


class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"
    __table_args__ = (Index("ix_candidates_status_name", "status", "name"),)

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    status: Mapped[CandidateStatus] = mapped_column(
        Enum(
            CandidateStatus,
            name="candidate_status",
            validate_strings=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    mechanism_of_action: Mapped[str] = mapped_column(Text, nullable=False)
    side_effects: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

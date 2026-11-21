from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.candidate import CandidateStatus


class CandidateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    status: CandidateStatus
    description: str = Field(min_length=1)
    mechanism_of_action: str = Field(min_length=1)
    side_effects: list[str] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name must not be blank.")
        return normalized

    @field_validator("description", "mechanism_of_action")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Text must not be blank.")
        return normalized

    def normalize(self) -> None:
        self.name = self.name.strip()
        self.description = self.description.strip()
        self.mechanism_of_action = self.mechanism_of_action.strip()
        self.side_effects = [
            effect.strip() for effect in self.side_effects if effect.strip()
        ]


class CandidateUpdate(CandidateCreate):
    pass


class CandidatePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: CandidateStatus | None = None
    description: str | None = Field(default=None, min_length=1)
    mechanism_of_action: str | None = Field(default=None, min_length=1)
    side_effects: list[str] | None = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name must not be blank.")
        return normalized

    @field_validator("description", "mechanism_of_action")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Text must not be blank.")
        return normalized

    def normalize(self) -> None:
        if self.name is not None:
            self.name = self.name.strip()
        if self.description is not None:
            self.description = self.description.strip()
        if self.mechanism_of_action is not None:
            self.mechanism_of_action = self.mechanism_of_action.strip()
        if self.side_effects is not None:
            self.side_effects = [
                effect.strip() for effect in self.side_effects if effect.strip()
            ]


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    status: CandidateStatus
    description: str
    mechanism_of_action: str
    side_effects: list[str]
    created_at: datetime
    updated_at: datetime


class PaginationMetadata(BaseModel):
    page: int
    pageSize: int
    totalRecords: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool


class PaginatedCandidateResponse(BaseModel):
    data: list[CandidateResponse]
    pagination: PaginationMetadata


class CandidateDataResponse(BaseModel):
    data: CandidateResponse

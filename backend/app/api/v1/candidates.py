from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.dependencies.authorization import require_admin, require_viewer
from app.dependencies.candidates import get_candidate_service
from app.models.candidate import Candidate, CandidateStatus
from app.models.user import User
from app.repositories.interfaces import PaginatedCandidates
from app.schemas.candidate import (
    CandidateCreate,
    CandidateDataResponse,
    CandidatePatch,
    CandidateResponse,
    CandidateUpdate,
    PaginatedCandidateResponse,
    PaginationMetadata,
)
from app.services.candidate_service import (
    CandidateCreateData,
    CandidatePatchData,
    CandidateService,
    CandidateUpdateData,
)

router = APIRouter(prefix="/candidates", tags=["candidates"])


def candidate_response(candidate: Candidate) -> CandidateResponse:
    return CandidateResponse.model_validate(candidate)


@router.get("", response_model=PaginatedCandidateResponse)
async def list_candidates(
    search: str | None = Query(default=None, max_length=255),
    candidate_status: CandidateStatus | None = Query(
        default=None,
        alias="status",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: Literal["name", "status"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    service: CandidateService = Depends(get_candidate_service),
    _viewer: User = Depends(require_viewer),
) -> PaginatedCandidateResponse:
    result: PaginatedCandidates = await service.get_candidates(
        search=search,
        status=candidate_status,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PaginatedCandidateResponse(
        data=[candidate_response(candidate) for candidate in result.data],
        pagination=PaginationMetadata(
            page=result.page,
            pageSize=result.page_size,
            totalRecords=result.total_records,
            totalPages=result.total_pages,
            hasNextPage=result.has_next_page,
            hasPreviousPage=result.has_previous_page,
        ),
    )


@router.get("/{candidate_id}", response_model=CandidateDataResponse)
async def get_candidate(
    candidate_id: UUID,
    service: CandidateService = Depends(get_candidate_service),
    _viewer: User = Depends(require_viewer),
) -> CandidateDataResponse:
    candidate = await service.get_candidate(candidate_id)
    return CandidateDataResponse(data=candidate_response(candidate))


@router.post(
    "",
    response_model=CandidateDataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_candidate(
    payload: CandidateCreate,
    service: CandidateService = Depends(get_candidate_service),
    _admin: User = Depends(require_admin),
) -> CandidateDataResponse:
    payload.normalize()
    candidate = await service.create_candidate(
        CandidateCreateData(
            name=payload.name,
            status=payload.status,
            description=payload.description,
            mechanism_of_action=payload.mechanism_of_action,
            side_effects=payload.side_effects,
        )
    )
    return CandidateDataResponse(data=candidate_response(candidate))


@router.put("/{candidate_id}", response_model=CandidateDataResponse)
async def replace_candidate(
    candidate_id: UUID,
    payload: CandidateUpdate,
    service: CandidateService = Depends(get_candidate_service),
    _admin: User = Depends(require_admin),
) -> CandidateDataResponse:
    payload.normalize()
    candidate = await service.update_candidate(
        candidate_id,
        CandidateUpdateData(
            name=payload.name,
            status=payload.status,
            description=payload.description,
            mechanism_of_action=payload.mechanism_of_action,
            side_effects=payload.side_effects,
        ),
    )
    return CandidateDataResponse(data=candidate_response(candidate))


@router.patch("/{candidate_id}", response_model=CandidateDataResponse)
async def patch_candidate(
    candidate_id: UUID,
    payload: CandidatePatch,
    service: CandidateService = Depends(get_candidate_service),
    _admin: User = Depends(require_admin),
) -> CandidateDataResponse:
    payload.normalize()
    candidate = await service.patch_candidate(
        candidate_id,
        CandidatePatchData(
            name=payload.name,
            status=payload.status,
            description=payload.description,
            mechanism_of_action=payload.mechanism_of_action,
            side_effects=payload.side_effects,
        ),
    )
    return CandidateDataResponse(data=candidate_response(candidate))


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: UUID,
    service: CandidateService = Depends(get_candidate_service),
    _admin: User = Depends(require_admin),
) -> Response:
    await service.delete_candidate(candidate_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

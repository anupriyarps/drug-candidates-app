from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.repositories.candidate_repository import CandidateRepository
from app.services.candidate_cache import CandidateCache
from app.services.candidate_service import CandidateService

_candidate_cache: CandidateCache | None = None


def _get_candidate_cache() -> CandidateCache:
    global _candidate_cache
    if _candidate_cache is None:
        _candidate_cache = CandidateCache()
    return _candidate_cache


async def get_candidate_service(
    session: AsyncSession = Depends(get_db_session),
) -> CandidateService:
    repository = CandidateRepository(session)
    cache = _get_candidate_cache() if get_settings().cache_enabled else None
    return CandidateService(repository, cache)

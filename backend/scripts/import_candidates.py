import asyncio
import json
import sys
from pathlib import Path
from uuid import UUID, uuid5

from sqlalchemy import select

from app.core.database import session_factory
from app.models.candidate import Candidate, CandidateStatus

LEGACY_ID_NAMESPACE = UUID("d7e5bf56-cdd7-5d8d-a6d3-2d4e5eb5c7a1")


def get_default_dataset_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "candidates.json"


def resolve_dataset_path(argument: str | None) -> Path:
    if argument is None:
        return get_default_dataset_path()
    return Path(argument).expanduser().resolve()


def candidate_uuid(legacy_id: str) -> UUID:
    return uuid5(LEGACY_ID_NAMESPACE, legacy_id)


async def import_candidates(dataset_path: Path) -> int:
    payload = await asyncio.to_thread(
        lambda: json.loads(dataset_path.read_text(encoding="utf-8"))
    )
    if not isinstance(payload, list):
        raise ValueError("Candidate dataset must contain a JSON list.")

    imported = 0
    async with session_factory() as session:
        try:
            existing_result = await session.scalars(select(Candidate))
            existing_candidates = list(existing_result)
            existing_ids = {candidate.id for candidate in existing_candidates}
            existing_names = {
                candidate.name.strip().lower() for candidate in existing_candidates
            }

            for record in payload:
                legacy_id = record["id"]
                candidate_id = candidate_uuid(str(legacy_id))
                name = record["name"].strip()
                normalized_name = name.lower()
                if candidate_id in existing_ids or normalized_name in existing_names:
                    continue

                session.add(
                    Candidate(
                        id=candidate_id,
                        name=name,
                        status=CandidateStatus(record["status"]),
                        description=record["description"].strip(),
                        mechanism_of_action=record["mechanismOfAction"].strip(),
                        side_effects=list(record["sideEffects"]),
                    )
                )
                existing_ids.add(candidate_id)
                existing_names.add(normalized_name)
                imported += 1

            await session.commit()
        except Exception:
            await session.rollback()
            raise
    return imported


async def main() -> None:
    dataset_path = await asyncio.to_thread(
        resolve_dataset_path,
        sys.argv[1] if len(sys.argv) > 1 else None,
    )
    imported = await import_candidates(dataset_path)
    print(f"Imported {imported} candidate records.")


if __name__ == "__main__":
    asyncio.run(main())

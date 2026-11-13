
import "server-only";

import type { ICandidateRepository } from "@/repositories/interfaces/ICandidateRepository";
import { JsonCandidateRepository } from "@/repositories/implementations/JsonCandidateRepository";

let candidateRepository: ICandidateRepository | null = null;

export function getCandidateRepository(): ICandidateRepository {
  if (!candidateRepository) {
    candidateRepository = new JsonCandidateRepository();
  }

  return candidateRepository;
}

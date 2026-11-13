
import type {
  CandidateSearchParams,
  DrugCandidate,
  PaginatedCandidates,
} from "@/types/candidate";

export interface ICandidateRepository {
  getCandidates(
    params: CandidateSearchParams,
  ): Promise<PaginatedCandidates>;

  getCandidateById(
    id: string,
  ): Promise<DrugCandidate | null>;
}


import "server-only";

import candidates from "@/data/candidates.json";
import type {
  CandidateSearchParams,
  DrugCandidate,
} from "@/types/candidate";

const candidateData = candidates as DrugCandidate[];

export async function getCandidates(
  params: CandidateSearchParams = {},
): Promise<DrugCandidate[]> {
  let result = [...candidateData];

  if (params.search?.trim()) {
    const searchTerm = params.search.trim().toLowerCase();

    result = result.filter((candidate) =>
      candidate.name.toLowerCase().includes(searchTerm),
    );
  }

  if (params.status) {
    result = result.filter(
      (candidate) => candidate.status === params.status,
    );
  }

  return result;
}

export async function getCandidateById(
  id: string,
): Promise<DrugCandidate | null> {
  return (
    candidateData.find((candidate) => candidate.id === id) ?? null
  );
}

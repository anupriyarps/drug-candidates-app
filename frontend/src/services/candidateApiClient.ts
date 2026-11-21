
import { serializeFastApiCandidateSearchParams } from "@/lib/candidateSearchParams";
import { mapFastApiCandidate } from "@/lib/candidateMapping";
import {
  authFetch,
} from "@/services/authService";
import type {
  CandidateSearchParams,
  FastApiPaginatedCandidates,
  PaginatedCandidates,
} from "@/types/candidate";

export async function searchCandidates(
  searchParams: CandidateSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedCandidates> {
  const query = serializeFastApiCandidateSearchParams(searchParams);
  const response = await authFetch(`/api/v1/candidates?${query}`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Unable to search drug candidates.");
  }

  const result: FastApiPaginatedCandidates =
    await response.json();

  return {
    data: result.data.map(mapFastApiCandidate),
    pagination: result.pagination,
  };
}

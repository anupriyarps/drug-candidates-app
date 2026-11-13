
import { serializeCandidateSearchParams } from "@/lib/candidateSearchParams";
import type {
  CandidateApiResponse,
  CandidateSearchParams,
  PaginatedCandidates,
} from "@/types/candidate";

export async function searchCandidates(
  searchParams: CandidateSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedCandidates> {
  const query = serializeCandidateSearchParams(searchParams);
  const response = await fetch(
    `/api/candidates?${query}`,
    {
      method: "GET",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Unable to search drug candidates.");
  }

  const result: CandidateApiResponse = await response.json();

  return result;
}


import type { DrugCandidate } from "@/types/candidate";

interface CandidatesResponse {
  data: DrugCandidate[];
  total: number;
}

export async function searchCandidates(
  search: string,
  signal?: AbortSignal,
): Promise<DrugCandidate[]> {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const response = await fetch(
    `/api/candidates?${params.toString()}`,
    {
      method: "GET",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Unable to search drug candidates.");
  }

  const result: CandidatesResponse = await response.json();

  return result.data;
}

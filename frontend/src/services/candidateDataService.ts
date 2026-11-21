import "server-only";

import { cookies } from "next/headers";

import {
  authFetch,
  type AuthenticatedUser,
} from "@/services/authService";
import { serializeFastApiCandidateSearchParams } from "@/lib/candidateSearchParams";
import { mapFastApiCandidate } from "@/lib/candidateMapping";
import type {
  CandidateSearchParams,
  DrugCandidate,
  FastApiCandidate,
  FastApiPaginatedCandidates,
  PaginatedCandidates,
} from "@/types/candidate";

async function getCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const values = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  return values.length > 0 ? values.join("; ") : undefined;
}

async function backendFetch(pathname: string): Promise<Response> {
  const cookieHeader = await getCookieHeader();
  return authFetch(pathname, {
    method: "GET",
    cookieHeader,
    refreshOnUnauthorized: false,
  });
}

export async function getAuthenticatedUser(): Promise<
  AuthenticatedUser | null
> {
  const response = await backendFetch("/api/v1/users/me");
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthenticatedUser;
}

export async function getCandidates(
  params: CandidateSearchParams = {},
): Promise<PaginatedCandidates> {
  const query = serializeFastApiCandidateSearchParams(params);
  const response = await backendFetch(
    `/api/v1/candidates?${query}`,
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve candidates from FastAPI.");
  }

  const result: FastApiPaginatedCandidates =
    await response.json();

  return {
    data: result.data.map(mapFastApiCandidate),
    pagination: result.pagination,
  };
}

export async function getCandidateById(
  id: string,
): Promise<DrugCandidate | null> {
  const response = await backendFetch(
    `/api/v1/candidates/${encodeURIComponent(id)}`,
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Unable to retrieve candidate from FastAPI.");
  }

  const result: { data: FastApiCandidate } =
    await response.json();
  return mapFastApiCandidate(result.data);
}

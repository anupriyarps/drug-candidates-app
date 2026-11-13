
import { NextRequest, NextResponse } from "next/server";
import { getCandidates } from "@/services/candidateDataService";
import type {
  CandidateSearchParams,
  CandidateStatus,
} from "@/types/candidate";

export const dynamic = "force-dynamic";

const VALID_STATUSES: CandidateStatus[] = [
  "In Development",
  "Clinical Trial",
  "Approved",
];

const VALID_SORT_FIELDS = ["name", "status"] as const;
const VALID_SORT_ORDERS = ["asc", "desc"] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number | null {
  if (value === null) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get("search")?.trim() || undefined;
  const status = searchParams.get("status")?.trim() || undefined;

  const page = parsePositiveInteger(
    searchParams.get("page"),
    DEFAULT_PAGE,
  );

  const requestedPageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
  );

  const sortBy = searchParams.get("sortBy") || "name";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  if (status && !VALID_STATUSES.includes(status as CandidateStatus)) {
    return NextResponse.json(
      { error: "Invalid candidate status." },
      { status: 400 },
    );
  }

  if (page === null || requestedPageSize === null) {
    return NextResponse.json(
      { error: "Page and pageSize must be positive integers." },
      { status: 400 },
    );
  }

  if (requestedPageSize > MAX_PAGE_SIZE) {
    return NextResponse.json(
      { error: `pageSize cannot exceed ${MAX_PAGE_SIZE}.` },
      { status: 400 },
    );
  }

  if (
    !VALID_SORT_FIELDS.includes(
      sortBy as (typeof VALID_SORT_FIELDS)[number],
    )
  ) {
    return NextResponse.json(
      { error: "Invalid sort field." },
      { status: 400 },
    );
  }

  if (
    !VALID_SORT_ORDERS.includes(
      sortOrder as (typeof VALID_SORT_ORDERS)[number],
    )
  ) {
    return NextResponse.json(
      { error: "Invalid sort order." },
      { status: 400 },
    );
  }

  const params: CandidateSearchParams = {
    search,
    status: status as CandidateStatus | undefined,
    page,
    pageSize: requestedPageSize,
    sortBy: sortBy as "name" | "status",
    sortOrder: sortOrder as "asc" | "desc",
  };

  try {
    const result = await getCandidates(params);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Redis owns the shared cache for this endpoint.
        // Avoid a second, uncontrolled HTTP cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to retrieve candidates:", error);

    return NextResponse.json(
      { error: "Unable to retrieve candidates." },
      { status: 500 },
    );
  }
}

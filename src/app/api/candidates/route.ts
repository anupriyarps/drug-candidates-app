
import { NextRequest, NextResponse } from "next/server";
import { getCandidates } from "@/services/candidateDataService";
import type { CandidateStatus } from "@/types/candidate";

export const dynamic = "force-dynamic";

const VALID_STATUSES: CandidateStatus[] = [
  "In Development",
  "Clinical Trial",
  "Approved",
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get("search")?.trim() || undefined;
  const status = searchParams.get("status")?.trim() || undefined;

  if (status && !VALID_STATUSES.includes(status as CandidateStatus)) {
    return NextResponse.json(
      { error: "Invalid candidate status." },
      { status: 400 },
    );
  }

  try {
    const candidates = await getCandidates({
      search,
      status: status as CandidateStatus | undefined,
    });

    return NextResponse.json(
      {
        data: candidates,
        total: candidates.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to retrieve candidates:", error);

    return NextResponse.json(
      { error: "Unable to retrieve candidates." },
      { status: 500 },
    );
  }
}

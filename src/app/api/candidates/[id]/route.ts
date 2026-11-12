
import { NextResponse } from "next/server";
import { getCandidateById } from "@/services/candidateDataService";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Candidate ID is required." },
        { status: 400 },
      );
    }

    const candidate = await getCandidateById(id);

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: candidate },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to retrieve candidate:", error);

    return NextResponse.json(
      { error: "Unable to retrieve candidate." },
      { status: 500 },
    );
  }
}

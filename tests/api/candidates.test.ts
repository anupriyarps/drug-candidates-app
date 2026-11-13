/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../../src/app/api/candidates/route";
import { getCandidates } from "../../src/services/candidateDataService";

jest.mock("server-only", () => ({}));

jest.mock("../../src/services/candidateDataService", () => ({
  getCandidates: jest.fn(),
  getCandidateById: jest.fn(),
}));

const mockGetCandidates =
  getCandidates as jest.MockedFunction<typeof getCandidates>;

describe("GET /api/candidates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return all candidates successfully", async () => {
    mockGetCandidates.mockResolvedValue([
      {
        id: "drug-001",
        name: "NovaCure",
        status: "In Development",
        description: "Targeted treatment candidate.",
        mechanismOfAction: "Blocks a signaling pathway.",
        sideEffects: ["Headache"],
      },
    ]);

    const request = new NextRequest(
      "http://localhost:3000/api/candidates",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.data[0].name).toBe("NovaCure");
  });

  it("should pass the search parameter to the service", async () => {
    mockGetCandidates.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost:3000/api/candidates?search=NovaCure",
    );

    await GET(request);

    expect(mockGetCandidates).toHaveBeenCalledWith({
      search: "NovaCure",
      status: undefined,
    });
  });

  it("should reject an invalid candidate status", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/candidates?status=Unknown",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid candidate status.");
    expect(mockGetCandidates).not.toHaveBeenCalled();
  });

  it("should return an internal server error when service fails", async () => {
    mockGetCandidates.mockRejectedValue(
      new Error("Database unavailable"),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/candidates",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to retrieve candidates.");
  });
});

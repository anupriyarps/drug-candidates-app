/**
 * @jest-environment node
 */
import { GET } from "../../src/app/api/candidates/[id]/route";
import { getCandidateById } from "../../src/services/candidateDataService";

jest.mock("server-only", () => ({}));

jest.mock("../../src/services/candidateDataService", () => ({
  getCandidates: jest.fn(),
  getCandidateById: jest.fn(),
}));

const mockGetCandidateById =
  getCandidateById as jest.MockedFunction<typeof getCandidateById>;

describe("GET /api/candidates/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a candidate when a valid ID is provided", async () => {
    mockGetCandidateById.mockResolvedValue({
      id: "drug-001",
      name: "NovaCure",
      status: "In Development",
      description: "Targeted treatment candidate.",
      mechanismOfAction: "Blocks a signaling pathway.",
      sideEffects: ["Headache", "Nausea"],
    });

    const response = await GET(
      new Request("http://localhost:3000/api/candidates/drug-001"),
      {
        params: Promise.resolve({ id: "drug-001" }),
      },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("NovaCure");
    expect(mockGetCandidateById).toHaveBeenCalledWith("drug-001");
  });

  it("should return 404 when the candidate does not exist", async () => {
    mockGetCandidateById.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/candidates/invalid-id"),
      {
        params: Promise.resolve({ id: "invalid-id" }),
      },
    );

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Candidate not found.");
  });

  it("should return 400 when the candidate ID is empty", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/candidates/ "),
      {
        params: Promise.resolve({ id: " " }),
      },
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Candidate ID is required.");
    expect(mockGetCandidateById).not.toHaveBeenCalled();
  });

  it("should return 500 when the service throws an error", async () => {
    mockGetCandidateById.mockRejectedValue(
      new Error("Service unavailable"),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/candidates/drug-001"),
      {
        params: Promise.resolve({ id: "drug-001" }),
      },
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to retrieve candidate.");
  });
});

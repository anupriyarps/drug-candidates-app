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

const mockCandidate = {
  id: "drug-001",
  name: "NovaCure",
  status: "In Development" as const,
  description: "Targeted treatment candidate.",
  mechanismOfAction: "Blocks a signaling pathway.",
  sideEffects: ["Headache"],
};

const mockResult = {
  data: [mockCandidate],
  pagination: {
    page: 1,
    pageSize: 20,
    totalRecords: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

describe("GET /api/candidates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return all candidates successfully", async () => {
    mockGetCandidates.mockResolvedValue(mockResult);

    const request = new NextRequest(
      "http://localhost:3000/api/candidates",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination.totalRecords).toBe(1);
    expect(body.data[0].name).toBe("NovaCure");
    expect(mockGetCandidates).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  it("should pass the search parameter to the service", async () => {
    mockGetCandidates.mockResolvedValue({
      ...mockResult,
      data: [],
      pagination: { ...mockResult.pagination, totalRecords: 0, totalPages: 0 },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/candidates?search=NovaCure",
    );

    await GET(request);

    expect(mockGetCandidates).toHaveBeenCalledWith({
      search: "NovaCure",
      status: undefined,
      page: 1,
      pageSize: 20,
      sortBy: "name",
      sortOrder: "asc",
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

  it.each([
    ["page=invalid", "Page and pageSize must be positive integers."],
    ["page=0", "Page and pageSize must be positive integers."],
    ["page=9007199254740992", "Page and pageSize must be positive integers."],
    ["pageSize=101", "pageSize cannot exceed 100."],
    ["sortBy=unknown", "Invalid sort field."],
    ["sortOrder=sideways", "Invalid sort order."],
  ])("should reject invalid query parameter %s", async (query, error) => {
    const request = new NextRequest(
      `http://localhost:3000/api/candidates?${query}`,
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(error);
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

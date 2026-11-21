import { searchCandidates } from "../../src/services/candidateApiClient";

const fastApiResult = {
  data: [
    {
      id: "drug-001",
      name: "NovaCure",
      status: "In Development" as const,
      description: "Description",
      mechanism_of_action: "Mechanism",
      side_effects: ["Headache"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalRecords: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

function createResponse(body: unknown, ok: boolean, statusOverride?: number): Response {
  return {
    ok,
    status: statusOverride ?? (ok ? 200 : 401),
    json: async () => body,
    headers: new Headers(),
  } as Response;
}

describe("searchCandidates", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  it("calls FastAPI and maps snake_case candidate fields", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(fastApiResult, true));

    const result = await searchCandidates({
      search: "Nova",
      status: "In Development",
      page: 2,
      pageSize: 50,
      sortBy: "status",
      sortOrder: "desc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/candidates?search=Nova&status=In+Development&page=2&page_size=50&sort_by=status&sort_order=desc",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
    expect(result.data[0]).toEqual({
      id: "drug-001",
      name: "NovaCure",
      status: "In Development",
      description: "Description",
      mechanismOfAction: "Mechanism",
      sideEffects: ["Headache"],
    });
  });

  it("throws when FastAPI rejects the request", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(null, false, 500));

    await expect(searchCandidates({ search: "Nova" })).rejects.toThrow(
      "Unable to search drug candidates.",
    );
  });

  it("refreshes an expired session and retries the candidate request", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(createResponse(null, false))
      .mockResolvedValueOnce(createResponse(null, true))
      .mockResolvedValueOnce(createResponse(fastApiResult, true));

    await expect(
      searchCandidates({
        page: 1,
        pageSize: 20,
        sortBy: "name",
        sortOrder: "asc",
      }),
    ).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

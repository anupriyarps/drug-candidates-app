/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    getAll: () => [],
  })),
}));

import {
  getCandidateById,
  getCandidates,
} from "../../src/services/candidateDataService";

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

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("candidateDataService", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  it("fetches candidate lists from FastAPI", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(fastApiResult));

    const result = await getCandidates({
      search: "Nova",
      page: 2,
      pageSize: 50,
      sortBy: "status",
      sortOrder: "desc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/candidates?search=Nova&page=2&page_size=50&sort_by=status&sort_order=desc",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(result.data[0].mechanismOfAction).toBe("Mechanism");
  });

  it("returns null for a missing candidate", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse({ error: "missing" }, 404));

    await expect(getCandidateById("missing")).resolves.toBeNull();
  });

  it("maps a candidate detail response", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      createResponse({ data: fastApiResult.data[0] }),
    );

    const candidate = await getCandidateById("drug-001");

    expect(candidate?.name).toBe("NovaCure");
    expect(candidate?.mechanismOfAction).toBe("Mechanism");
  });
});

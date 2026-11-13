import { searchCandidates } from "../../src/services/candidateApiClient";
import type { PaginatedCandidates } from "../../src/types/candidate";

const mockResult: PaginatedCandidates = {
  data: [],
  pagination: {
    page: 2,
    pageSize: 50,
    totalRecords: 75,
    totalPages: 2,
    hasNextPage: false,
    hasPreviousPage: true,
  },
};

function createResponse(body: unknown, ok: boolean): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("searchCandidates", () => {
  let fetchDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    if (fetchDescriptor) {
      Object.defineProperty(globalThis, "fetch", fetchDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  it("sends search, status, pagination, and sorting parameters", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(mockResult, true));
    const controller = new AbortController();

    const result = await searchCandidates(
      {
        search: "  Nova Cure ",
        status: "Clinical Trial",
        page: 2,
        pageSize: 50,
        sortBy: "status",
        sortOrder: "desc",
      },
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/candidates?search=Nova+Cure&status=Clinical+Trial&page=2&pageSize=50&sortBy=status&sortOrder=desc",
      { method: "GET", signal: controller.signal },
    );
    expect(result).toEqual(mockResult);
  });

  it("uses default pagination and sorting when no parameters are provided", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(mockResult, true));

    await searchCandidates({});

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/candidates?page=1&pageSize=20&sortBy=name&sortOrder=asc",
      { method: "GET", signal: undefined },
    );
  });

  it("throws when the API request fails", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(null, false));

    await expect(searchCandidates({ search: "Nova" })).rejects.toThrow(
      "Unable to search drug candidates.",
    );
  });
});

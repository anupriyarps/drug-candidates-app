import {
  getCandidateDetailsHref,
  getCandidateListHref,
  parseCandidateSearchParams,
  serializeCandidateSearchParams,
  serializeFastApiCandidateSearchParams,
} from "@/lib/candidateSearchParams";

describe("candidateSearchParams", () => {
  it("parses supported query values and applies defaults", () => {
    expect(
      parseCandidateSearchParams({
        search: [" cardio ", "ignored"],
        status: "Clinical Trial",
        page: "2",
        pageSize: "50",
        sortBy: "status",
        sortOrder: "desc",
      }),
    ).toEqual({
      search: "cardio",
      status: "Clinical Trial",
      page: 2,
      pageSize: 50,
      sortBy: "status",
      sortOrder: "desc",
    });

    expect(parseCandidateSearchParams({})).toEqual({
      search: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  it("falls back safely for invalid query values", () => {
    expect(
      parseCandidateSearchParams({
        status: "Unknown",
        page: "0",
        pageSize: "not-a-number",
        sortBy: "id",
        sortOrder: "sideways",
      }),
    ).toEqual({
      search: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(
      parseCandidateSearchParams({ pageSize: "200" }).pageSize,
    ).toBe(100);
  });

  it("serializes filter state for list and detail URLs", () => {
    const params = {
      search: "Nova Cure",
      status: "In Development" as const,
      page: 2,
      pageSize: 50,
      sortBy: "status" as const,
      sortOrder: "desc" as const,
    };
    const query =
      "search=Nova+Cure&status=In+Development&page=2&pageSize=50&sortBy=status&sortOrder=desc";

    expect(serializeCandidateSearchParams(params)).toBe(query);
    expect(getCandidateListHref(params)).toBe(`/?${query}`);
    expect(getCandidateDetailsHref("drug-001", params)).toBe(
      `/candidates/drug-001?${query}`,
    );
    expect(getCandidateDetailsHref("drug/id", params)).toContain(
      "/candidates/drug%2Fid?",
    );
  });

  it("maps public pagination and sorting names to FastAPI names", () => {
    expect(
      serializeFastApiCandidateSearchParams({
        page: 3,
        pageSize: 50,
        sortBy: "status",
        sortOrder: "desc",
      }),
    ).toBe(
      "page=3&page_size=50&sort_by=status&sort_order=desc",
    );
  });
});

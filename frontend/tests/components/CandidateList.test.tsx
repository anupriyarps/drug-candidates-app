import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateList from "../../src/components/CandidateList";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));
import { searchCandidates } from "../../src/services/candidateApiClient";
import type {
  CandidateSearchParams,
  DrugCandidate,
  PaginatedCandidates,
} from "../../src/types/candidate";

jest.mock("../../src/services/candidateApiClient", () => ({
  searchCandidates: jest.fn(),
}));

const mockSearchCandidates =
  searchCandidates as jest.MockedFunction<typeof searchCandidates>;

const mockCandidates: DrugCandidate[] = [
  {
    id: "drug-001",
    name: "NovaCure",
    status: "In Development",
    description: "Targeted treatment candidate.",
    mechanismOfAction: "Blocks a cellular signaling pathway.",
    sideEffects: ["Headache", "Nausea"],
  },
  {
    id: "drug-002",
    name: "CardioZen",
    status: "Clinical Trial",
    description: "Cardiovascular treatment candidate.",
    mechanismOfAction: "Regulates cardiac activity.",
    sideEffects: ["Dizziness"],
  },
];

function createResult(
  data: DrugCandidate[],
  page = 1,
  totalPages = data.length > 0 ? 1 : 0,
): PaginatedCandidates {
  return {
    data,
    pagination: {
      page,
      pageSize: 20,
      totalRecords: data.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}

function renderCandidateList(
  initialResult = createResult(mockCandidates),
  initialParams: CandidateSearchParams = {},
) {
  return render(
    <CandidateList
      initialResult={initialResult}
      initialParams={initialParams}
    />,
  );
}

describe("CandidateList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("should render the initial candidates", () => {
    renderCandidateList();

    expect(screen.getByText("NovaCure")).toBeInTheDocument();
    expect(screen.getByText("CardioZen")).toBeInTheDocument();
    expect(screen.getByText("2 results")).toBeInTheDocument();
  });

  it("should display the search input and development status filter", () => {
    renderCandidateList();

    expect(
      screen.getByRole("searchbox", { name: /search candidates/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /development status/i }),
    ).toBeInTheDocument();
  });

  it("should initialize filters from URL params and preserve them in detail links", () => {
    const initialParams: CandidateSearchParams = {
      search: "cardio",
      status: "Clinical Trial",
      page: 2,
      pageSize: 50,
      sortBy: "status",
      sortOrder: "desc",
    };
    renderCandidateList(
      createResult([mockCandidates[1]], 2, 2),
      initialParams,
    );

    expect(screen.getByRole("searchbox")).toHaveValue("cardio");
    expect(screen.getByLabelText("Development status")).toHaveValue(
      "Clinical Trial",
    );
    expect(screen.getByLabelText("Rows per page")).toHaveValue("50");
    expect(
      screen.getByRole("combobox", { name: /sort candidates/i }),
    ).toHaveValue("status:desc");
    expect(
      screen.getByRole("link", { name: /view details/i }),
    ).toHaveAttribute(
      "href",
      "/candidates/drug-002?search=cardio&status=Clinical+Trial&page=2&pageSize=50&sortBy=status&sortOrder=desc",
    );
  });

  it("should keep current filters, pagination, and sorting in the URL", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([mockCandidates[0]]));
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Nova");
    await user.selectOptions(
      screen.getByLabelText("Development status"),
      "In Development",
    );
    await user.selectOptions(screen.getByLabelText("Rows per page"), "50");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /sort candidates/i }),
      "status:desc",
    );

    await waitFor(() => {
      expect(window.location.search).toBe(
        "?search=Nova&status=In+Development&page=1&pageSize=50&sortBy=status&sortOrder=desc",
      );
    });
  });

  it("should not go to a previous page when the current page is the first", () => {
    const staleResult = createResult(mockCandidates);
    staleResult.pagination.page = 2;
    staleResult.pagination.totalPages = 2;
    staleResult.pagination.hasPreviousPage = true;

    render(
      <CandidateList
        initialResult={staleResult}
        initialParams={{}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();
  });

  it("should search candidates after the debounce delay", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([mockCandidates[0]]));
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Nova");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "Nova",
          status: undefined,
          page: 1,
          pageSize: 20,
          sortBy: "name",
          sortOrder: "asc",
        } satisfies CandidateSearchParams,
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("1 results")).toBeInTheDocument();
  });

  it("should display an empty state when no candidates match", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([]));
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Unknown");

    expect(
      await screen.findByText(
        "No candidates found. Try changing your search or status filter.",
      ),
    ).toBeInTheDocument();
  });

  it("should display an error when the API request fails", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockRejectedValue(new Error("API request failed"));
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Nova");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load candidates. Please try again.",
    );
  });

  it("should restore all candidates when search is cleared", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([mockCandidates[0]]));
    renderCandidateList();
    const searchInput = screen.getByRole("searchbox");

    await user.type(searchInput, "Nova");

    await waitFor(() => {
      expect(screen.getByText("1 results")).toBeInTheDocument();
    });

    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText("CardioZen")).toBeInTheDocument();
      expect(screen.getByText("2 results")).toBeInTheDocument();
    });
  });

  it("should display a loading indicator while searching", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockImplementation(
      () => new Promise<PaginatedCandidates>(() => {}),
    );
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Nova");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading candidates...",
    );
  });

  it("should ignore an aborted search request", async () => {
    const user = userEvent.setup();
    const abortError = new Error("Request cancelled");
    abortError.name = "AbortError";
    mockSearchCandidates
      .mockImplementationOnce(
        (_params, signal) =>
          new Promise<PaginatedCandidates>((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => reject(abortError),
              { once: true },
            );
          }),
      )
      .mockResolvedValue(createResult(mockCandidates));
    renderCandidateList();

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Nova");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenCalledTimes(1);
    });
    await user.type(searchInput, " Cure");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("should filter candidates by development status", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([mockCandidates[1]]));
    renderCandidateList();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /development status/i }),
      "Clinical Trial",
    );

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "",
          status: "Clinical Trial",
          page: 1,
          pageSize: 20,
          sortBy: "name",
          sortOrder: "asc",
        },
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("CardioZen")).toBeInTheDocument();
    expect(screen.queryByText("NovaCure")).not.toBeInTheDocument();
  });

  it("should combine candidate name search and status filtering", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult([mockCandidates[0]]));
    renderCandidateList();

    await user.type(screen.getByRole("searchbox"), "Nova");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /development status/i }),
      "In Development",
    );

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "Nova",
          status: "In Development",
          page: 1,
          pageSize: 20,
          sortBy: "name",
          sortOrder: "asc",
        },
        expect.any(AbortSignal),
      );
    });
  });

  it("should request the selected page size", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult(mockCandidates));
    renderCandidateList();

    await user.selectOptions(screen.getByLabelText("Rows per page"), "50");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "",
          status: undefined,
          page: 1,
          pageSize: 50,
          sortBy: "name",
          sortOrder: "asc",
        },
        expect.any(AbortSignal),
      );
    });
  });

  it("should request candidates using the selected sort order", async () => {
    const user = userEvent.setup();
    mockSearchCandidates.mockResolvedValue(createResult(mockCandidates));
    renderCandidateList();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /sort candidates/i }),
      "status:desc",
    );

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "",
          status: undefined,
          page: 1,
          pageSize: 20,
          sortBy: "status",
          sortOrder: "desc",
        },
        expect.any(AbortSignal),
      );
    });
  });

  it("should navigate between result pages", async () => {
    const user = userEvent.setup();
    mockSearchCandidates
      .mockResolvedValueOnce(createResult(mockCandidates, 2, 2))
      .mockResolvedValueOnce(createResult(mockCandidates, 1, 2));
    renderCandidateList(createResult(mockCandidates, 1, 2));

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        {
          search: "",
          status: undefined,
          page: 2,
          pageSize: 20,
          sortBy: "name",
          sortOrder: "asc",
        },
        expect.any(AbortSignal),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
      expect(mockSearchCandidates).toHaveBeenCalledTimes(1);
    });
  });
});

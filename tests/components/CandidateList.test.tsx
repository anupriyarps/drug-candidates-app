
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateList from "../../src/components/CandidateList";
import { searchCandidates } from "../../src/services/candidateApiClient";
import type { DrugCandidate } from "../../src/types/candidate";

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

describe("CandidateList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the initial candidates", () => {
    render(<CandidateList initialCandidates={mockCandidates} />);

    expect(screen.getByText("NovaCure")).toBeInTheDocument();
    expect(screen.getByText("CardioZen")).toBeInTheDocument();
    expect(screen.getByText("2 results")).toBeInTheDocument();
  });

  it("should display the search input", () => {
    render(<CandidateList initialCandidates={mockCandidates} />);

    expect(
      screen.getByRole("searchbox", {
        name: /search candidates/i,
      }),
    ).toBeInTheDocument();
  });

  it("should display the development status filter", () => {
    render(<CandidateList initialCandidates={mockCandidates} />);

    expect(
      screen.getByRole("combobox", {
        name: /development status/i,
      }),
    ).toBeInTheDocument();
  });

  it("should search candidates after the debounce delay", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockResolvedValue([mockCandidates[0]]);

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Nova");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenCalledWith(
        "Nova",
        undefined,
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("NovaCure")).toBeInTheDocument();
  });

  it("should display an empty state when no candidates match", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockResolvedValue([]);

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Unknown");

    expect(
      await screen.findByText(
        "No candidates found. Try changing your search or status filter.",
      ),
    ).toBeInTheDocument();
  });

  it("should display an error when the API request fails", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockRejectedValue(
      new Error("API request failed"),
    );

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Nova");

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Unable to load candidates. Please try again.");
  });

  it("should restore all candidates when search is cleared", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockResolvedValue([mockCandidates[0]]);

    render(<CandidateList initialCandidates={mockCandidates} />);

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
      () => new Promise<DrugCandidate[]>(() => {}),
    );

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Nova");

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("Searching candidates...");
  });

  it("should ignore an aborted search request", async () => {
    const user = userEvent.setup();

    const abortError = new Error("Request cancelled");
    abortError.name = "AbortError";

    mockSearchCandidates.mockRejectedValue(abortError);

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Nova");

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenCalled();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("should filter candidates by development status", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockResolvedValue([mockCandidates[1]]);

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /development status/i,
      }),
      "Clinical Trial",
    );

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenCalledWith(
        "",
        "Clinical Trial",
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("CardioZen")).toBeInTheDocument();
    expect(screen.queryByText("NovaCure")).not.toBeInTheDocument();
  });

  it("should combine candidate name search and status filtering", async () => {
    const user = userEvent.setup();

    mockSearchCandidates.mockResolvedValue([mockCandidates[0]]);

    render(<CandidateList initialCandidates={mockCandidates} />);

    await user.type(screen.getByRole("searchbox"), "Nova");

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /development status/i,
      }),
      "In Development",
    );

    await waitFor(() => {
      expect(mockSearchCandidates).toHaveBeenLastCalledWith(
        "Nova",
        "In Development",
        expect.any(AbortSignal),
      );
    });
  });
});

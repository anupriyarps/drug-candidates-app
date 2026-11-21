
import { render, screen } from "@testing-library/react";
import CandidateCard from "../../src/components/CandidateCard";
import type { DrugCandidate } from "../../src/types/candidate";

const mockCandidate: DrugCandidate = {
  id: "drug-001",
  name: "NovaCure",
  status: "In Development",
  description:
    "A candidate designed to support targeted treatment.",
  mechanismOfAction:
    "Blocks a specific cellular signaling pathway.",
  sideEffects: ["Headache", "Nausea"],
};

describe("CandidateCard", () => {
  it("should render the candidate name", () => {
    render(<CandidateCard candidate={mockCandidate} />);

    expect(
      screen.getByRole("heading", { name: "NovaCure" }),
    ).toBeInTheDocument();
  });

  it("should render the candidate description", () => {
    render(<CandidateCard candidate={mockCandidate} />);

    expect(
      screen.getByText(mockCandidate.description),
    ).toBeInTheDocument();
  });

  it("should display the candidate status", () => {
    render(<CandidateCard candidate={mockCandidate} />);

    expect(
      screen.getByText("In Development"),
    ).toBeInTheDocument();
  });

  it("should navigate to the correct candidate details page", () => {
    render(<CandidateCard candidate={mockCandidate} />);

    const detailsLink = screen.getByRole("link", {
      name: /view details/i,
    });

    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute(
      "href",
      "/candidates/drug-001",
    );
  });
});

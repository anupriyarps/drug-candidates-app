jest.mock("server-only", () => ({}));

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

import { readFile } from "node:fs/promises";
import { JsonCandidateRepository } from "@/repositories/implementations/JsonCandidateRepository";
import type { DrugCandidate } from "@/types/candidate";

const mockReadFile = jest.mocked(readFile);

const candidates: DrugCandidate[] = [
  {
    id: "drug-001",
    name: "Beta",
    status: "Approved",
    description: "Candidate beta.",
    mechanismOfAction: "Mechanism beta.",
    sideEffects: [],
  },
  {
    id: "drug-002",
    name: "Alpha",
    status: "Approved",
    description: "Candidate alpha.",
    mechanismOfAction: "Mechanism alpha.",
    sideEffects: [],
  },
  {
    id: "drug-003",
    name: "Gamma",
    status: "Clinical Trial",
    description: "Candidate gamma.",
    mechanismOfAction: "Mechanism gamma.",
    sideEffects: [],
  },
];

describe("JsonCandidateRepository", () => {
  let originalDataset: string | undefined;

  beforeEach(() => {
    originalDataset = process.env.CANDIDATE_DATASET;
    delete process.env.CANDIDATE_DATASET;
    mockReadFile.mockReset();
  });

  afterEach(() => {
    if (originalDataset === undefined) {
      delete process.env.CANDIDATE_DATASET;
    } else {
      process.env.CANDIDATE_DATASET = originalDataset;
    }
  });

  it("rejects a JSON file that is not an array", async () => {
    process.env.CANDIDATE_DATASET = "large";
    mockReadFile.mockResolvedValue("{}");

    const repository = new JsonCandidateRepository();

    await expect(repository.getCandidates()).rejects.toThrow(
      "Invalid candidate dataset format.",
    );
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining("candidates.large.json"),
      "utf8",
    );
  });

  it("retries after a failed load and filters, sorts, and paginates data", async () => {
    mockReadFile
      .mockRejectedValueOnce(new Error("File unavailable"))
      .mockResolvedValueOnce(JSON.stringify(candidates));

    const repository = new JsonCandidateRepository();

    await expect(repository.getCandidates()).rejects.toThrow(
      "File unavailable",
    );

    const result = await repository.getCandidates({
      search: "a",
      status: "Approved",
      page: 2,
      pageSize: 1,
      sortBy: "name",
      sortOrder: "desc",
    });

    expect(result.data.map((candidate) => candidate.name)).toEqual([
      "Alpha",
    ]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 1,
      totalRecords: 2,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockReadFile).toHaveBeenLastCalledWith(
      expect.stringContaining("candidates.json"),
      "utf8",
    );
  });
});

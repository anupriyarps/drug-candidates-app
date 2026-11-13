
jest.mock("server-only", () => ({}));

jest.mock("../../src/lib/cache/candidateCache", () => ({
  buildCandidateCacheKey: jest.fn(() => "candidate-cache-key"),
  buildCandidateDetailCacheKey: jest.fn(() => "candidate-detail-cache-key"),
  getCachedValue: jest.fn().mockResolvedValue(null),
  setCachedValue: jest.fn().mockResolvedValue(undefined),
}));

import {
  getCandidates,
  getCandidateById,
} from "../../src/services/candidateDataService";
import {
  buildCandidateCacheKey,
  getCachedValue,
} from "../../src/lib/cache/candidateCache";
import type {
  DrugCandidate,
  PaginatedCandidates,
} from "../../src/types/candidate";

const mockGetCachedValue =
  getCachedValue as jest.MockedFunction<typeof getCachedValue>;
const mockBuildCandidateCacheKey =
  buildCandidateCacheKey as jest.MockedFunction<
    typeof buildCandidateCacheKey
  >;

describe("candidateDataService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCandidates", () => {
    it("should return cached candidate results", async () => {
      const cachedResult: PaginatedCandidates = {
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockGetCachedValue.mockResolvedValueOnce(cachedResult);

      const result = await getCandidates();

      expect(result).toBe(cachedResult);
    });

    it("should include the configured dataset in the cache key", async () => {
      const originalDataset = process.env.CANDIDATE_DATASET;
      const cachedResult: PaginatedCandidates = {
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      process.env.CANDIDATE_DATASET = "large";
      mockGetCachedValue.mockResolvedValueOnce(cachedResult);

      try {
        await getCandidates();
      } finally {
        if (originalDataset === undefined) {
          delete process.env.CANDIDATE_DATASET;
        } else {
          process.env.CANDIDATE_DATASET = originalDataset;
        }
      }

      expect(mockBuildCandidateCacheKey).toHaveBeenLastCalledWith(
        expect.objectContaining({ dataset: "large" }),
      );
    });

    it("should return all candidates when no filters are provided", async () => {
      const result = await getCandidates();

      expect(result.pagination.totalRecords).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should filter candidates by name", async () => {
      const result = await getCandidates({
        search: "NovaCure",
      });

      expect(result.pagination.totalRecords).toBe(1);
      expect(result.data[0].name).toBe("NovaCure");
    });

    it("should return an empty array when no candidate matches", async () => {
      const result = await getCandidates({
        search: "UnknownDrug",
      });

      expect(result.pagination.totalRecords).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it("should filter candidates by status", async () => {
      const result = await getCandidates({
        status: "Approved",
      });

      expect(result.pagination.totalRecords).toBeGreaterThan(0);
      expect(
        result.data.every(
          (candidate) => candidate.status === "Approved",
        ),
      ).toBe(true);
    });
  });

  describe("getCandidateById", () => {
    it("should return a cached candidate", async () => {
      const cachedCandidate: DrugCandidate = {
        id: "drug-cached",
        name: "CachedCandidate",
        status: "Approved",
        description: "Cached candidate.",
        mechanismOfAction: "Cached mechanism.",
        sideEffects: [],
      };
      mockGetCachedValue.mockResolvedValueOnce(cachedCandidate);

      const candidate = await getCandidateById("drug-cached");

      expect(candidate).toBe(cachedCandidate);
    });

    it("should return a candidate for a valid ID", async () => {
      const candidate = await getCandidateById("drug-001");

      expect(candidate).not.toBeNull();
      expect(candidate?.name).toBe("NovaCure");
    });

    it("should return null for an invalid ID", async () => {
      const candidate = await getCandidateById("invalid-id");

      expect(candidate).toBeNull();
    });
  });
});

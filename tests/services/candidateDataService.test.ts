
import {
  getCandidates,
  getCandidateById,
} from "../../src/services/candidateDataService";

describe("candidateDataService", () => {
  describe("getCandidates", () => {
    it("should return all candidates when no filters are provided", async () => {
      const candidates = await getCandidates();

      expect(candidates.length).toBeGreaterThan(0);
    });

    it("should filter candidates by name", async () => {
      const candidates = await getCandidates({
        search: "NovaCure",
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe("NovaCure");
    });

    it("should return an empty array when no candidate matches", async () => {
      const candidates = await getCandidates({
        search: "UnknownDrug",
      });

      expect(candidates).toHaveLength(0);
    });

    it("should filter candidates by status", async () => {
      const candidates = await getCandidates({
        status: "Approved",
      });

      expect(candidates.length).toBeGreaterThan(0);
      expect(
        candidates.every(
          (candidate) => candidate.status === "Approved",
        ),
      ).toBe(true);
    });
  });

  describe("getCandidateById", () => {
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

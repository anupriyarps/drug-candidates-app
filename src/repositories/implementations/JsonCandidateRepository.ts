import type { ICandidateRepository } from "@/repositories/interfaces/ICandidateRepository";
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  CandidateSearchParams,
  DrugCandidate,
  PaginatedCandidates,
} from "@/types/candidate";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type DatasetName = "small" | "large";

let candidateDataPromise: Promise<DrugCandidate[]> | null = null;

function getDatasetName(): DatasetName {
  return process.env.CANDIDATE_DATASET === "large"
    ? "large"
    : "small";
}

async function loadCandidateData(): Promise<DrugCandidate[]> {
  const filename =
    getDatasetName() === "large"
      ? "candidates.large.json"
      : "candidates.json";

  const filePath = path.join(
    process.cwd(),
    "src",
    "data",
    filename,
  );

  const content = await readFile(filePath, "utf8");
  const parsedData: unknown = JSON.parse(content);

  if (!Array.isArray(parsedData)) {
    throw new Error("Invalid candidate dataset format.");
  }

  return parsedData as DrugCandidate[];
}

async function getCandidateData(): Promise<DrugCandidate[]> {
  if (!candidateDataPromise) {
    candidateDataPromise = loadCandidateData().catch((error) => {
      candidateDataPromise = null;
      throw error;
    });
  }

  return candidateDataPromise;
}

export class JsonCandidateRepository implements ICandidateRepository {
  async getCandidates(
    params: CandidateSearchParams = {},
  ): Promise<PaginatedCandidates> {
    const page = Math.max(
      DEFAULT_PAGE,
      Math.floor(params.page ?? DEFAULT_PAGE),
    );

    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const search = params.search?.trim().toLowerCase() ?? "";
    const status = params.status;
    const sortBy = params.sortBy ?? "name";
    const sortOrder = params.sortOrder ?? "asc";

    const candidateData = await getCandidateData();

    let result = [...candidateData];

    if (search) {
      result = result.filter((candidate) =>
        candidate.name.toLowerCase().includes(search),
      );
    }

    if (status) {
      result = result.filter(
        (candidate) => candidate.status === status,
      );
    }

    result.sort((a, b) => {
      const comparison = a[sortBy].localeCompare(b[sortBy]);

      return sortOrder === "desc" ? -comparison : comparison;
    });

    const totalRecords = result.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const startIndex = (page - 1) * pageSize;

    return {
      data: result.slice(startIndex, startIndex + pageSize),
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    };
  }

  async getCandidateById(
    id: string,
  ): Promise<DrugCandidate | null> {
    const candidateData = await getCandidateData();

    return (
      candidateData.find((candidate) => candidate.id === id) ?? null
    );
  }
}

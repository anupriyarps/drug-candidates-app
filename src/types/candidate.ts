
export type CandidateStatus =
  | "In Development"
  | "Clinical Trial"
  | "Approved";

export interface DrugCandidate {
  id: string;
  name: string;
  status: CandidateStatus;
  description: string;
  mechanismOfAction: string;
  sideEffects: string[];
}

export interface CandidateSearchParams {
  search?: string;
  status?: CandidateStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedCandidates {
  data: DrugCandidate[];
  pagination: PaginationMetadata;
}

export interface CandidateApiResponse extends PaginatedCandidates {
  error?: string;
}

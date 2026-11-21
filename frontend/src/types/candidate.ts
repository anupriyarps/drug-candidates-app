
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

export interface FastApiCandidate {
  id: string;
  name: string;
  status: CandidateStatus;
  description: string;
  mechanism_of_action: string;
  side_effects: string[];
  created_at: string;
  updated_at: string;
}

export interface FastApiPaginatedCandidates {
  data: FastApiCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

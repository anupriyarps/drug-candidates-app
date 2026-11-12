
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
}

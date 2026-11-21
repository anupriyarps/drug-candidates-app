import type {
  DrugCandidate,
  FastApiCandidate,
} from "@/types/candidate";

export function mapFastApiCandidate(
  candidate: FastApiCandidate,
): DrugCandidate {
  return {
    id: candidate.id,
    name: candidate.name,
    status: candidate.status,
    description: candidate.description,
    mechanismOfAction: candidate.mechanism_of_action,
    sideEffects: candidate.side_effects,
  };
}

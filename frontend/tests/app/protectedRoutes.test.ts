jest.mock("next/navigation", () => ({
  redirect: jest.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  notFound: jest.fn(),
}));

jest.mock("../../src/services/candidateDataService", () => ({
  getAuthenticatedUser: jest.fn(),
  getCandidates: jest.fn(),
  getCandidateById: jest.fn(),
}));

jest.mock("../../src/components/CandidateList", () => ({
  __esModule: true,
  default: () => null,
}));

import HomePage from "../../src/app/page";
import CandidateDetailsPage from "../../src/app/candidates/[id]/page";
import {
  getAuthenticatedUser,
  getCandidates,
} from "../../src/services/candidateDataService";
import { AuthenticationRequiredError } from "../../src/services/authService";

describe("protected candidate routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects a missing session to login with next", async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    await expect(
      HomePage({
        searchParams: Promise.resolve({
          page: "2",
          pageSize: "50",
        }),
      }),
    ).rejects.toThrow(
      "REDIRECT:/login?next=%2F%3Fpage%3D2%26pageSize%3D50%26sortBy%3Dname%26sortOrder%3Dasc",
    );
    expect(getCandidates).not.toHaveBeenCalled();
  });

  it("hands an expired home session to the same-origin refresh route", async () => {
    (getAuthenticatedUser as jest.Mock).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    await expect(
      HomePage({
        searchParams: Promise.resolve({ page: "2" }),
      }),
    ).rejects.toThrow(
      "REDIRECT:/api/v1/auth/refresh?next=%2F%3Fpage%3D2%26pageSize%3D20%26sortBy%3Dname%26sortOrder%3Dasc",
    );
  });

  it("redirects unauthenticated candidate details with the full destination", async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    await expect(
      CandidateDetailsPage({
        params: Promise.resolve({ id: "drug-001" }),
        searchParams: Promise.resolve({
          search: "Nova",
          page: "2",
        }),
      }),
    ).rejects.toThrow(
      "REDIRECT:/login?next=%2Fcandidates%2Fdrug-001%3Fsearch%3DNova%26page%3D2%26pageSize%3D20%26sortBy%3Dname%26sortOrder%3Dasc",
    );
  });

  it("hands an expired details session to refresh with its destination", async () => {
    (getAuthenticatedUser as jest.Mock).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    await expect(
      CandidateDetailsPage({
        params: Promise.resolve({ id: "drug-001" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    ).rejects.toThrow(
      "REDIRECT:/api/v1/auth/refresh?next=%2Fcandidates%2Fdrug-001%3Fpage%3D2%26pageSize%3D20%26sortBy%3Dname%26sortOrder%3Dasc",
    );
  });
});

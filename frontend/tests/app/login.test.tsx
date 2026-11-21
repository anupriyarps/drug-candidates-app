import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const replace = jest.fn();
const refresh = jest.fn();
const get = jest.fn((key: string) =>
  key === "next" ? "/candidates/drug-001?page=2" : null,
);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => ({ get }),
}));

jest.mock("../../src/services/authService", () => ({
  login: jest.fn(),
  initializeSession: jest.fn().mockResolvedValue({
    id: "viewer",
  }),
}));

import LoginPage from "../../src/app/login/page";
import { login } from "../../src/services/authService";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state and redirects to the requested destination", async () => {
    const loginMock = login as jest.MockedFunction<typeof login>;
    loginMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          setTimeout(
            () => resolve({ ok: true } as Response),
            20,
          );
        }),
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      screen.getByRole("button", { name: "Signing in..." }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/candidates/drug-001?page=2",
      );
    });
  });

  it("prevents duplicate submissions while login is pending", async () => {
    let resolveLogin: ((value: Response) => void) | undefined;
    const loginMock = login as jest.MockedFunction<typeof login>;
    loginMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });

    const button = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(button);
    fireEvent.click(
      screen.getByRole("button", { name: "Signing in..." }),
    );

    expect(loginMock).toHaveBeenCalledTimes(1);
    resolveLogin?.({ ok: true } as Response);
  });

  it("renders an API error after invalid credentials", async () => {
    const loginMock = login as jest.MockedFunction<typeof login>;
    loginMock.mockResolvedValue({ ok: false } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Unable to sign in");
  });
});

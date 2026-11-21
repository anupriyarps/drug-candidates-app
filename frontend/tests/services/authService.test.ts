/** @jest-environment node */

import {
  AuthenticationRequiredError,
  authFetch,
  getFrontendAuthenticationState,
  initializeSession,
  login,
  logout,
} from "../../src/services/authService";
import { NextRequest } from "next/server";
import {
  GET as getRefreshHandoff,
  POST as refreshHandoff,
} from "../../src/app/api/v1/auth/refresh/route";

function createResponse(status: number, body: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as Response;
}

describe("authService", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  it("initializes frontend session state from /users/me", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      createResponse(200, {
        id: "viewer",
        email: "viewer@example.com",
        is_active: true,
        roles: ["viewer"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );

    await expect(initializeSession()).resolves.toMatchObject({
      email: "viewer@example.com",
    });
    expect(getFrontendAuthenticationState()).toMatchObject({
      roles: ["viewer"],
    });
  });

  it("uses the browser hostname for local login requests", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    const originalBackendUrl = process.env.FASTAPI_BACKEND_URL;
    const originalPublicBackendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL;
    const originalWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      "window",
    );
    delete process.env.FASTAPI_BACKEND_URL;
    process.env.NEXT_PUBLIC_FASTAPI_URL = "http://127.0.0.1:8000";
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "http://localhost:3000" } },
    });
    fetchMock.mockResolvedValue(
      createResponse(200, { status: "authenticated" }),
    );

    try {
      await login("viewer@example.com", "correct-password");

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "viewer@example.com",
            password: "correct-password",
          }),
        }),
      );
    } finally {
      if (originalBackendUrl === undefined) {
        delete process.env.FASTAPI_BACKEND_URL;
      } else {
        process.env.FASTAPI_BACKEND_URL = originalBackendUrl;
      }
      if (originalPublicBackendUrl === undefined) {
        delete process.env.NEXT_PUBLIC_FASTAPI_URL;
      } else {
        process.env.NEXT_PUBLIC_FASTAPI_URL = originalPublicBackendUrl;
      }
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  it("refreshes once and retries the original request", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(200))
      .mockResolvedValueOnce(createResponse(200, { data: [] }));

    await expect(
      authFetch("/api/v1/candidates"),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh request for simultaneous 401 responses", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(401))
      .mockImplementationOnce(() => refreshResponse)
      .mockResolvedValueOnce(createResponse(200))
      .mockResolvedValueOnce(createResponse(200));

    const first = authFetch("/api/v1/candidates");
    const second = authFetch("/api/v1/users/me");
    await Promise.resolve();
    await Promise.resolve();
    resolveRefresh?.(createResponse(200));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2][0]).toContain("/api/v1/auth/refresh");
  });

  it("does not refresh inside server-rendered requests", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(401));

    await expect(
      authFetch("/api/v1/candidates", {
        cookieHeader: "access_token=expired",
        refreshOnUnauthorized: false,
      }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws without retrying when refresh fails", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(createResponse(200, {
      id: "viewer",
      email: "viewer@example.com",
      is_active: true,
      roles: ["viewer"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));
    await initializeSession();
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(401));

    await expect(
      authFetch("/api/v1/candidates"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getFrontendAuthenticationState()).toBeNull();
  });

  it("preserves frontend authentication state when refresh returns 500", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(createResponse(200, {
      id: "viewer",
      email: "viewer@example.com",
      is_active: true,
      roles: ["viewer"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));
    await initializeSession();
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(500));

    await expect(
      authFetch("/api/v1/candidates"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(getFrontendAuthenticationState()).not.toBeNull();
  });

  it("preserves frontend authentication state when refresh returns 503", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(createResponse(200, {
      id: "viewer",
      email: "viewer@example.com",
      is_active: true,
      roles: ["viewer"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));
    await initializeSession();
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(503));

    await expect(
      authFetch("/api/v1/candidates"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(getFrontendAuthenticationState()).not.toBeNull();
  });

  it("preserves frontend authentication state on refresh network failure", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(createResponse(200, {
      id: "viewer",
      email: "viewer@example.com",
      is_active: true,
      roles: ["viewer"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));
    await initializeSession();
    fetchMock
      .mockResolvedValueOnce(createResponse(401))
      .mockRejectedValueOnce(new TypeError("network unavailable"));

    await expect(
      authFetch("/api/v1/candidates"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(getFrontendAuthenticationState()).not.toBeNull();
  });

  it("calls logout and clears frontend authentication state", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(createResponse(200, {
      status: "logged_out",
    }));

    await expect(logout()).resolves.toBeDefined();
    expect(getFrontendAuthenticationState()).toBeNull();
  });

  it("propagates refreshed HttpOnly cookies through the server handoff", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "access_token=new-access; HttpOnly; Path=/; SameSite=lax",
    );
    headers.append(
      "set-cookie",
      "refresh_token=new-refresh; HttpOnly; Path=/api/v1/auth; SameSite=lax",
    );
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers,
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/v1/auth/refresh",
      {
        method: "POST",
        headers: {
          cookie: "access_token=old; refresh_token=refresh",
          origin: "null",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          next: "/candidates/drug-001?page=2",
        }),
      },
    );

    const response = await refreshHandoff(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/candidates/drug-001?page=2",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "access_token=new-access",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "refresh_token=new-refresh",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/refresh"),
      expect.objectContaining({
        headers: {
          Cookie: "access_token=old; refresh_token=refresh",
          Origin: "http://localhost:3000",
        },
      }),
    );
  });

  it("uses a non-mutating GET handoff before the refresh POST", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    const request = new NextRequest(
      "http://localhost:3000/api/v1/auth/refresh?next=%2Fcandidates%2Fdrug-001",
      { headers: { host: "127.0.0.1:3000" } },
    );

    const response = await getRefreshHandoff(request);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action http://127.0.0.1:3000",
    );
    expect(html).toContain('method="post"');
    expect(html).toContain('name="next" value="/candidates/drug-001"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin refresh handoffs", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    const request = new NextRequest(
      "http://localhost:3000/api/v1/auth/refresh",
      {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ next: "/" }),
      },
    );

    const response = await refreshHandoff(request);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to login and clears cookies for invalid refresh credentials", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(createResponse(401));

    const request = new NextRequest(
      "http://localhost:3000/api/v1/auth/refresh",
      {
        method: "POST",
        headers: {
          cookie: "access_token=old; refresh_token=expired",
          origin: "http://localhost:3000",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ next: "/?page=2" }),
      },
    );

    const response = await refreshHandoff(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login?next=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([500, 503])(
    "preserves cookies when the backend returns HTTP %i",
    async (status) => {
      const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValueOnce(createResponse(status));

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/refresh",
        {
          method: "POST",
          headers: {
            cookie: "access_token=potentially-valid; refresh_token=retry-later",
            origin: "http://localhost:3000",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ next: "/?page=2" }),
        },
      );

      const response = await refreshHandoff(request);

      expect(response.status).toBe(503);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("location")).toBeNull();
      expect(await response.text()).toContain("temporarily unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves cookies when the backend is unreachable", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const request = new NextRequest(
      "http://localhost:3000/api/v1/auth/refresh",
      {
        method: "POST",
        headers: {
          cookie: "access_token=potentially-valid; refresh_token=retry-later",
          origin: "http://localhost:3000",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ next: "/?page=2" }),
      },
    );

    const response = await refreshHandoff(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toContain("temporarily unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

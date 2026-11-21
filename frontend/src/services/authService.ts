export interface AuthenticatedUser {
  id: string;
  email: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
  updated_at: string;
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

let currentUser: AuthenticatedUser | null | undefined;
const refreshRequests = new Map<string, Promise<Response>>();

export function getFrontendAuthenticationState():
  | AuthenticatedUser
  | null
  | undefined {
  return currentUser;
}

export function clearFrontendAuthenticationState(): void {
  currentUser = null;
}

export async function initializeSession(): Promise<
  AuthenticatedUser | null
> {
  const user = await getCurrentUser();
  currentUser = user;
  return user;
}

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const pageUrl = new URL(window.location.origin);
    const publicBackendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL;
    const backendUrl = publicBackendUrl
      ? new URL(publicBackendUrl)
      : new URL(pageUrl.origin);
    if (!publicBackendUrl) {
      backendUrl.port = "8000";
    }

    const localHosts = ["localhost", "127.0.0.1"];
    if (
      localHosts.includes(pageUrl.hostname) &&
      localHosts.includes(backendUrl.hostname)
    ) {
      backendUrl.hostname = pageUrl.hostname;
    }
    return backendUrl.toString().replace(/\/$/, "");
  }

  return (
    process.env.FASTAPI_BACKEND_URL ??
    process.env.NEXT_PUBLIC_FASTAPI_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export function getAuthRefreshHref(destination: string): string {
  return `/api/v1/auth/refresh?next=${encodeURIComponent(destination)}`;
}

function mergeHeaders(
  headers: HeadersInit | undefined,
  cookieHeader: string | undefined,
): Headers {
  const merged = new Headers(headers);
  merged.set("Accept", "application/json");
  if (cookieHeader) {
    merged.set("Cookie", cookieHeader);
  }
  return merged;
}

async function refreshSession(
  cookieHeader?: string,
): Promise<Response> {
  return fetch(`${getBackendUrl()}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: mergeHeaders(
      { "Content-Type": "application/json" },
      cookieHeader,
    ),
  });
}

function getRefreshResponse(
  cookieHeader?: string,
): Promise<Response> {
  const key = cookieHeader ?? "browser-session";
  const activeRequest = refreshRequests.get(key);
  if (activeRequest) {
    return activeRequest;
  }

  const refreshRequest = refreshSession(cookieHeader).finally(() => {
    if (refreshRequests.get(key) === refreshRequest) {
      refreshRequests.delete(key);
    }
  });
  refreshRequests.set(key, refreshRequest);
  return refreshRequest;
}

export async function authFetch(
  pathname: string,
  options: RequestInit & {
    cookieHeader?: string;
    refreshOnUnauthorized?: boolean;
  } = {},
): Promise<Response> {
  const {
    headers,
    cookieHeader: initialCookieHeader,
    refreshOnUnauthorized = true,
    ...fetchOptions
  } = options;
  const cookieHeader = initialCookieHeader;
  const request = async (): Promise<Response> =>
    fetch(`${getBackendUrl()}${pathname}`, {
      ...fetchOptions,
      credentials: "include",
      cache: fetchOptions.cache ?? "no-store",
      headers: mergeHeaders(headers, cookieHeader),
    });

  let response = await request();
  if (
    response.status === 401 &&
    refreshOnUnauthorized &&
    !pathname.startsWith("/api/v1/auth/")
  ) {
    try {
      const refreshResponse = await getRefreshResponse(cookieHeader);
      if (refreshResponse.ok) {
        response = await request();
      } else if (refreshResponse.status === 401) {
        clearFrontendAuthenticationState();
        throw new AuthenticationRequiredError();
      }
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }
      // Network and unexpected refresh failures are temporary. Preserve
      // potentially valid frontend authentication state.
    }
  }

  if (
    response.status === 401 &&
    pathname !== "/api/v1/auth/login"
  ) {
    throw new AuthenticationRequiredError();
  }
  return response;
}

export async function login(
  email: string,
  password: string,
): Promise<Response> {
  return authFetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
}

export async function logout(
  cookieHeader?: string,
): Promise<Response> {
  try {
    return await authFetch("/api/v1/auth/logout", {
      method: "POST",
      cookieHeader,
    });
  } finally {
    clearFrontendAuthenticationState();
  }
}

export async function getCurrentUser(
  cookieHeader?: string,
): Promise<AuthenticatedUser | null> {
  try {
    const response = await authFetch("/api/v1/users/me", {
      cookieHeader,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AuthenticatedUser;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return null;
    }
    throw error;
  }
}

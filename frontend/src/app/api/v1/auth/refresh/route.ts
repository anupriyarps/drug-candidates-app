import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/services/authService";

export const runtime = "nodejs";

function getSafeDestination(
  value: string | null,
  requestUrl: URL,
): URL {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return new URL("/", requestUrl);
  }

  const destination = new URL(value, requestUrl);
  return destination.origin === requestUrl.origin
    ? destination
    : new URL("/", requestUrl);
}

function getRequestUrl(request: NextRequest): URL {
  const requestUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!host) {
    return requestUrl;
  }

  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.slice(0, -1);
  try {
    const origin = new URL(`${protocol}://${host}`);
    return origin.protocol === "http:" || origin.protocol === "https:"
      ? origin
      : requestUrl;
  } catch {
    return requestUrl;
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (headersWithGetSetCookie.getSetCookie) {
    return headersWithGetSetCookie.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function appendSetCookies(
  response: NextResponse,
  headers: Headers,
): boolean {
  const cookies = getSetCookieHeaders(headers);
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return cookies.length > 0;
}

function clearAuthCookies(response: NextResponse): void {
  const secure =
    process.env.AUTH_COOKIE_SECURE?.toLowerCase() === "true" ||
    process.env.NODE_ENV === "production";
  response.cookies.set("access_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 0,
  });
}

function loginDestination(destination: URL): URL {
  const loginUrl = new URL("/login", destination);
  loginUrl.searchParams.set(
    "next",
    `${destination.pathname}${destination.search}`,
  );
  return loginUrl;
}

function temporaryRefreshFailure(): Response {
  return new Response("Authentication service is temporarily unavailable.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestUrl = getRequestUrl(request);
  const destination = getSafeDestination(
    request.nextUrl.searchParams.get("next"),
    requestUrl,
  );
  const nonce = crypto.randomUUID();
  const action = "/api/v1/auth/refresh";
  const next = `${destination.pathname}${destination.search}`;
  const escapedNext = next
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>Refreshing session</title></head><body><form method="post" action="${action}"><input type="hidden" name="next" value="${escapedNext}"></form><script nonce="${nonce}">document.forms[0].requestSubmit()</script></body></html>`;

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${requestUrl.origin}; base-uri 'none'`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestUrl = getRequestUrl(request);
  const origin = request.headers.get("origin");
  const isSameOrigin =
    origin !== null &&
    origin !== "null" &&
    (() => {
      try {
        return new URL(origin).origin === requestUrl.origin;
      } catch {
        return false;
      }
    })();
  const isSameOriginFormNavigation =
    origin === "null" &&
    request.headers.get("sec-fetch-site") === "same-origin" &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.headers.get("sec-fetch-dest") === "document";
  if (!isSameOrigin && !isSameOriginFormNavigation) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const destination = getSafeDestination(
    formData.get("next")?.toString() ?? null,
    requestUrl,
  );
  const cookies = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name === "access_token" ||
        cookie.name === "refresh_token",
    )
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  const cookieHeader =
    cookies.length > 0 ? cookies.join("; ") : undefined;
  const backendHeaders: Record<string, string> = {
    Origin: requestUrl.origin,
  };
  if (cookieHeader) {
    backendHeaders.Cookie = cookieHeader;
  }

  try {
    const refreshResponse = await fetch(
      `${getBackendUrl()}/api/v1/auth/refresh`,
      {
        method: "POST",
        headers: backendHeaders,
        cache: "no-store",
      },
    );
    if (refreshResponse.ok) {
      const response = NextResponse.redirect(destination, 303);
      appendSetCookies(response, refreshResponse.headers);
      return response;
    }

    if (refreshResponse.status !== 401) {
      return temporaryRefreshFailure();
    }

    const response = NextResponse.redirect(loginDestination(destination), 303);
    clearAuthCookies(response);
    return response;
  } catch {
    return temporaryRefreshFailure();
  }
}

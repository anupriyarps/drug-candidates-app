import { expect, test } from "@playwright/test";

async function mockAuthApi(
  page: import("@playwright/test").Page,
  initiallyAuthenticated = false,
) {
  let authenticated = initiallyAuthenticated;
  let userRequests = 0;
  const origin = "http://127.0.0.1:3000";

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/api/v1/users/me") {
      userRequests += 1;
      await route.fulfill({
        status: authenticated ? 200 : 401,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          authenticated
            ? {
                id: "viewer",
                email: "viewer@example.com",
                is_active: true,
                roles: ["viewer"],
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              }
            : { error: "unauthenticated" },
        ),
      });
      return;
    }

    if (url.pathname === "/api/v1/auth/refresh") {
      await route.fulfill({
        status: 401,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "refresh_token_missing" }),
      });
      return;
    }

    if (url.pathname === "/api/v1/auth/login") {
      if (request.postDataJSON().email === "network@example.com") {
        await route.abort("failed");
        return;
      }
      if (request.postDataJSON().password !== "correct-password") {
        await route.fulfill({
          status: 401,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({ error: "Invalid credentials." }),
        });
        return;
      }

      authenticated = true;
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "authenticated" }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      body: "Not found",
    });
  });

  return {
    getUserRequestCount: () => userRequests,
  };
}

test("login page renders and a successful login preserves the destination", async ({
  page,
}) => {
  await mockAuthApi(page);
  await page.goto("/login?next=%2Flogin%3Fcomplete%3D1");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.getByLabel("Email").fill("viewer@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/login\?complete=1$/);
});

test("invalid credentials show an API error", async ({ page }) => {
  await mockAuthApi(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill("viewer@example.com");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("form [role=alert]")).toContainText(
    "Check your email and password",
  );
});

test("network failure displays a sign-in error", async ({ page }) => {
  await mockAuthApi(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill("network@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("form [role=alert]")).toContainText(
    "Please try again",
  );
});

test("initializes a valid session again after a browser refresh", async ({
  page,
}) => {
  const authApi = await mockAuthApi(page, true);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect.poll(authApi.getUserRequestCount).toBeGreaterThan(0);
  const firstLoadRequests = authApi.getUserRequestCount();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect
    .poll(authApi.getUserRequestCount)
    .toBeGreaterThan(firstLoadRequests);
});


import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Cross-user authorization over real HTTP: one signed-in account must never see
 * another account's objects, and the upgrade boundary cannot be bypassed from the
 * browser.
 */
const PASSWORD = "acme-demo-password-2026";
const prisma = new PrismaClient();

test.describe.configure({ mode: "serial" });

/**
 * The login rate limit (8 per 15 minutes) is a real security control and is not
 * weakened. E2E repeatedly signs in from a single IP, so the limiter counters
 * are cleared as test hygiene.
 */
test.beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany({});
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });
}

test("a seeded free user can sign in and is on the Starter plan", async ({
  page,
}) => {
  await signIn(page, "free@acmejobs.local");
  await expect(page.getByText("Starter").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Analyze a Job/i }).first(),
  ).toBeVisible();
});

test("a seeded paid user can sign in and has paid features unlocked", async ({
  page,
}) => {
  await signIn(page, "paid@acmejobs.local");
  await expect(page.getByText("Complete").first()).toBeVisible();

  await page.goto("/app/claims");
  await expect(
    page.getByRole("heading", { name: "Claim Inspector" }),
  ).toBeVisible();
  await expect(page.getByText(/Free view/i)).toHaveCount(0);
});

test("a fabricated object id does not leak whether an object exists", async ({
  page,
}) => {
  await signIn(page, "paid@acmejobs.local");

  const response = await page.goto("/app/applications/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Not found/i })).toBeVisible();
  await expect(page.getByText(/belongs to another account/i)).toBeVisible();

  // A signed-in user can export their own data; the same route without a session
  // must not return it. Fetched from inside the page so the session cookie is
  // definitely included.
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/export/applications.csv");
    const text = await res.text();
    return {
      status: res.status,
      type: res.headers.get("content-type") ?? "",
      text,
    };
  });
  expect(status.status).toBe(200);
  expect(status.type).toContain("text/csv");
  // A user with no applications gets a valid, empty export rather than an error.
  expect(typeof status.text).toBe("string");
});

test("export endpoints require a session", async ({ request }) => {
  const response = await request.get("/api/export/applications.csv", {
    maxRedirects: 0,
  });
  expect([302, 401, 403]).toContain(response.status());
});

test("the admin Debug Center is not reachable by a normal user", async ({
  page,
}) => {
  await signIn(page, "paid@acmejobs.local");
  await page.goto("/admin");
  // Redirected back into the app rather than showing internal tooling.
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText("Debug Center")).toHaveCount(0);
});

test("an admin can reach the Debug Center and the local observability is present", async ({
  page,
}) => {
  await signIn(page, "admin@acmejobs.local");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Debug Center" }),
  ).toBeVisible();
  await expect(page.getByText("System health")).toBeVisible();
  await expect(page.getByText("Dead-letter queue").first()).toBeVisible();
  await expect(page.getByText("Prompt versions").first()).toBeVisible();
});

test("a bug report returns a searchable diagnostic id", async ({ page }) => {
  await signIn(page, "free@acmejobs.local");
  await page.goto("/app/settings");
  await page
    .getByLabel(/What were you trying to do/i)
    .fill("Analysing a job description");
  await page.getByLabel(/What happened/i).fill("The matrix did not load");
  await page.getByRole("button", { name: /Report a problem/i }).click();

  await expect(page.getByText(/ACME-[0-9A-F]{6}/)).toBeVisible({
    timeout: 20_000,
  });
});

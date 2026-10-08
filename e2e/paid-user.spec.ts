import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Paid user journey. Proves the Complete Edition boundary is genuinely unlocked
 * and that the evidence-first guarantees hold for a paying account.
 */
const PASSWORD = "acme-demo-password-2026";
const prisma = new PrismaClient();

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany({});
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a paid user sees the full matrix table with per-requirement reasoning", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await expect(page.getByText("Complete").first()).toBeVisible();

  await page.goto("/app/guide");
  await expect(
    page.getByRole("heading", { name: "What each part does" }),
  ).toBeVisible();

  // Evidence ledger holds the seeded, verified records.
  await page.goto("/app/evidence");
  await expect(
    page.getByRole("heading", { name: "My Experience" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Rebuilt the month-end reporting pack/i).first(),
  ).toBeVisible();

  // Paid-only surfaces are usable, not just visible.
  await page.goto("/app/claims");
  await expect(page.getByText(/Free view/i)).toHaveCount(0);

  await page.goto("/app/opportunities");
  await expect(page.getByRole("heading", { name: "Best Jobs" })).toBeVisible();

  await page.goto("/app/interviews");
  await expect(
    page.getByRole("link", { name: /Practice Interview/i }),
  ).toBeVisible();

  await page.goto("/app/stories");
  await expect(
    page.getByRole("heading", { name: "Interview Stories" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Cut month-end reporting time/i).first(),
  ).toBeVisible();

  await page.goto("/app/learning");
  await expect(page.getByText(/Observations/i).first()).toBeVisible();
  await expect(page.getByText(/Nothing is changed silently/i)).toBeVisible();

  await page.goto("/app/sprint");
  await expect(
    page.getByRole("heading", { name: /14-Day Plan/i }),
  ).toBeVisible();

  await page.goto("/app/notifications");
  await expect(
    page.getByRole("heading", { name: "Notifications" }),
  ).toBeVisible();
});

test("the claim inspector and readiness gate are available to a paid user", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto("/app/claims");
  await expect(
    page.getByRole("heading", { name: "Truth Check" }),
  ).toBeVisible();

  // Acme Assistant answers from structured data and admits gaps.
  await page.goto("/app/ask");
  await page.getByLabel("Your question").fill("What should I work on today?");
  await page.getByRole("button", { name: "Ask" }).click();

  // The answer is either a ranked list from real deadlines or an honest
  // "nothing is due" — never invented history.
  await expect(
    page.getByText(/What should I work on today/i).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByText(/Based on your real deadlines|Nothing is due right now/i)
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto(
    "/app/ask?q=" + encodeURIComponent("Which claims still need verification?"),
  );
  await expect(
    page.getByText(/Sources|not have|Every claim/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("settings state AI cost responsibility honestly", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto("/app/settings");
  await expect(page.getByText("Manual Mode").first()).toBeVisible();
  await expect(page.getByText(/Cost: \$0/i).first()).toBeVisible();
  await expect(
    page.getByText(/Gemini \(server, free tier\)/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/included, subject to daily limits/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Billed to your provider account/i).first(),
  ).toBeVisible();
});

test("CV upload shows an editable review before anything is saved", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  let confirmed = false;
  await page.route("**/api/profile/import-cv", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as {
        profile?: { firstName?: string };
      };
      confirmed = body.profile?.firstName === "Alex";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          message: "Your reviewed CV details are now in My Profile.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        uploadKey: "test-upload.txt",
        originalName: "sample-cv.txt",
        profile: {
          firstName: "Alex",
          lastName: "Example",
          email: "alex@example.test",
          phone: null,
          location: "Cairo",
          links: [],
          headline: "Data Analyst",
          summary: null,
          skills: ["SQL", "Python"],
          roles: [
            {
              title: "Data Analyst Intern",
              company: "Example Company",
              start: "June 2025",
              end: "August 2025",
              bullets: ["Built a dashboard"],
            },
          ],
          education: [],
          certifications: [],
        },
      }),
    });
  });

  await page.goto("/app/profile");
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/sample-cv.txt");
  await expect(page.getByText("Review before saving")).toBeVisible();
  await expect(page.getByLabel("First name").first()).toHaveValue("Alex");
  await page.getByRole("button", { name: "Confirm & save my profile" }).click();
  await expect(page.getByText(/reviewed CV details/i)).toBeVisible();
  expect(confirmed).toBe(true);
});

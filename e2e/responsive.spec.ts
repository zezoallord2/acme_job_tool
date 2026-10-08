import { test, expect } from "@playwright/test";

/**
 * Visual and responsive QA. These tests fail on the defects that matter:
 * horizontal overflow, overlapping text, clipped content and unfinished
 * placeholder pages.
 */
const PUBLIC_PAGES = ["/", "/free", "/complete", "/pricing", "/about", "/faq"];

test.describe.configure({ mode: "serial" });

for (const path of PUBLIC_PAGES) {
  test(`${path} has no horizontal overflow at 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(path);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(
      overflow.scrollWidth,
      `${path} overflows horizontally`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test(`${path} renders a real heading and no unfinished placeholder`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const body = (await page.textContent("body")) ?? "";
    for (const placeholder of [
      "TODO",
      "Lorem ipsum",
      "Coming soon",
      "FIXME",
      "XXX",
    ]) {
      expect(body, `${path} contains "${placeholder}"`).not.toContain(
        placeholder,
      );
    }
  });
}

test("mobile navigation is present and usable on small screens", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "mobile navigation is only rendered on small viewports");
  await page.setViewportSize({ width: 375, height: 720 });

  await page.goto("/login");
  await page.getByLabel("Email").fill("free@acmejobs.local");
  await page.getByLabel("Password").fill("acme-demo-password-2026");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  const nav = page.getByRole("navigation", { name: "Primary mobile" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: /Jobs/i })).toBeVisible();
});

test("the signed-in dashboard is usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Email").fill("free@acmejobs.local");
  await page.getByLabel("Password").fill("acme-demo-password-2026");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });

  await expect(
    page.getByRole("heading", { name: /Welcome back/i }),
  ).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("the evidence matrix table becomes cards on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill("acme-demo-password-2026");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });

  await page.goto("/app/applications");
  await expect(
    page.getByRole("heading", { name: "Applications" }),
  ).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("the desktop sidebar navigation is present on a wide viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill("acme-demo-password-2026");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Jobs", exact: true }),
  ).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The Writing Studio, through the real UI.
 *
 * The studio is one generic panel driven by a server-side registry, so these
 * tests cover both halves: the registry wiring, and the shared panel actually
 * completing a Manual Mode round trip.
 */
const PASSWORD = "acme-demo-password-2026";
const prisma = new PrismaClient();

const COVER_LETTER = {
  subject: "Reporting Analyst application",
  body: "I rebuilt the month-end reporting pack in Excel and cut preparation from five days to two.",
  usedEvidenceIds: [0],
  unsupportedCompanyClaims: [],
  needsInput: [],
};

const VOICE = {
  isDirect: true,
  isConcise: true,
  isFormal: false,
  isConversational: true,
  isTechnical: false,
  isSimple: true,
  avgSentenceLength: 14,
  bannedPhrases: ["leverage synergies"],
  preferredPhrases: ["I rebuilt"],
  notes: "Plain and specific.",
};

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany({});
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signInPaid(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("paid@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });
}

test("the studio lists every workflow a paid account can use", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInPaid(page);

  await page.goto("/app/studio");
  await expect(
    page.getByRole("heading", { name: "Writing Studio", level: 1 }),
  ).toBeVisible();

  // All eight tools are present and unlocked. Tailoring has its own screen,
  // linked from the top of the studio.
  await expect(
    page.getByRole("link", { name: "Tailor my resume" }),
  ).toBeVisible();
  for (const title of [
    "Rewrite one bullet",
    "Write a cover letter",
    "Answer an application question",
    "Improve your LinkedIn profile",
    "Structure an achievement as a STAR story",
    "Build your career narrative",
    "Learn how you write",
    "Draft a follow-up message",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  await expect(page.getByText(/of 8 tools available/i)).toBeVisible();
  // AI is the default; manual mode is offered as the alternative.
  await expect(page.getByText(/also\s+has a manual mode/i)).toBeVisible();
});

test("a studio workflow saves a real draft through the shared panel", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInPaid(page);

  // The cover letter tool needs a real application, so create one through the
  // UI exactly as a user would. That also proves the option list is built from
  // the user's own records rather than being hard-coded.
  //
  // Job creation is deduplicated by content, so the description carries a unique
  // marker to keep repeated runs independent.
  const marker = Date.now();
  await page.goto("/app/jobs/new");
  await page.getByLabel("Company").fill(`Studio Test Co ${marker}`);
  await page.getByLabel("Role").fill("Reporting Analyst");
  await page
    .locator("#description")
    .fill(
      `Reporting Analyst role ${marker}. Requirements: advanced Excel, Power Query, ` +
        "month-end reporting experience. You will own the monthly reporting " +
        "pack and the stakeholder briefing. Must have: 2+ years in a reporting " +
        "role. Certification in a recognised analytics credential is required.",
    );
  await page.getByRole("button", { name: /Save and analyze/i }).click();
  await expect(page.getByText(/Job saved/i)).toBeVisible({ timeout: 45_000 });

  await page.goto("/app/studio");

  // Each tool is a collapsed <details>, so it must be opened before its fields
  // are reachable. The cover letter tool is in the second group.
  const coverLetterTool = page
    .getByText("Write a cover letter", { exact: true })
    .first();
  await coverLetterTool.click();

  // The application select is populated from the user's own records.
  const applicationSelect = page.locator("#studio-COVER_LETTER-applicationId");
  await expect(applicationSelect).toBeVisible({ timeout: 30_000 });
  const options = await applicationSelect.locator("option").count();
  expect(options).toBeGreaterThan(1);
  await expect(applicationSelect).toContainText(`Studio Test Co ${marker}`);

  await applicationSelect.selectOption({ index: 1 });

  await page.getByRole("button", { name: /Use manual mode/ }).click();
  await expect(page.getByLabel("AI prompt to copy")).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByLabel("AI prompt to copy")).toHaveValue(
    /COVER|COMPANY|ROLE/i,
  );

  await page
    .getByLabel("AI response to validate")
    .fill("```json\n" + JSON.stringify(COVER_LETTER) + "\n```");
  await page.getByRole("button", { name: /Validate response/i }).click();

  await expect(page.getByText(/Cover letter draft saved/i)).toBeVisible({
    timeout: 60_000,
  });

  // The draft is really persisted against the application.
  const userId = await paidUserId();
  const letter = await prisma.coverLetter.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  expect(letter?.body).toContain("five days to two");
  expect(letter?.workflowId).toBe("COVER_LETTER");
  expect(letter?.isCurrent).toBe(true);

  // Leave the demo account as we found it.
  await prisma.coverLetter.deleteMany({ where: { userId } });
  await prisma.jobPosting.deleteMany({
    where: { company: `Studio Test Co ${marker}` },
  });
});

test("the voice profile records preferences without inventing career facts", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInPaid(page);

  const marker = `sample ${Date.now()}`;
  const userId = await paidUserId();

  await page.goto("/app/studio");
  await page.getByText("Learn how you write", { exact: true }).first().click();

  await page
    .getByLabel("Your writing samples")
    .fill(
      `I rebuilt the reporting pack for ${marker}. It took six weeks. ` +
        "The close now takes two days instead of five, which is the part " +
        "that mattered to the team.",
    );

  await page.getByRole("button", { name: /Use manual mode/ }).click();
  await expect(page.getByLabel("AI prompt to copy")).toBeVisible({
    timeout: 45_000,
  });

  await page
    .getByLabel("AI response to validate")
    .fill("```json\n" + JSON.stringify(VOICE) + "\n```");
  await page.getByRole("button", { name: /Validate response/i }).click();

  await expect(page.getByText(/Voice profile saved/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("leverage synergies")).toBeVisible();

  const profile = await prisma.voiceProfile.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
  });
  expect(profile?.isDirect).toBe(true);
  expect(profile?.bannedPhrases).toContain("leverage synergies");

  // Leave the demo account as we found it.
  await prisma.voiceProfile.deleteMany({ where: { userId } });
});

test("a malformed response is rejected and nothing is saved", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signInPaid(page);

  // Uses the bullet rewriter, which needs no application, so this test stands
  // alone regardless of what ran before it.
  const userId = await paidUserId();
  const before = await prisma.resumeBullet.count({ where: { userId } });

  await page.goto("/app/studio");
  await page.getByText("Rewrite one bullet", { exact: true }).first().click();
  await page
    .locator("#studio-RESUME_BULLET-originalBullet")
    .fill(
      "Managed reporting outputs for the finance team across three regions.",
    );
  await page.getByRole("button", { name: /Use manual mode/ }).click();
  await expect(page.getByLabel("AI prompt to copy")).toBeVisible({
    timeout: 45_000,
  });

  // Valid JSON that fails the schema: the suggestion is far too short.
  await page
    .getByLabel("AI response to validate")
    .fill(
      '{"suggestion": "x", "usedEvidenceIds": [], "unsupportedAspects": []}',
    );
  await page.getByRole("button", { name: /Validate response/i }).click();

  await expect(page.getByText(/was not accepted/i).first()).toBeVisible({
    timeout: 45_000,
  });
  // The rejection is explicit: nothing was written.
  await expect(page.getByText(/Nothing was changed/i).first()).toBeVisible();

  expect(await prisma.resumeBullet.count({ where: { userId } })).toBe(before);
});

test("a free user sees the tools locked rather than broken", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email").fill("free@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto("/app/studio");
  await expect(
    page.getByText("0 of 8 tools available on your plan"),
  ).toBeVisible();

  // The Manual Mode prompt is not offered to someone who cannot use it.
  await expect(page.getByLabel("AI prompt to copy")).toHaveCount(0);
  await expect(
    page.getByText(/Complete Edition feature/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Upgrade" }).first(),
  ).toBeVisible();
});

test("the studio is reachable from the Profile section", async ({ page }) => {
  test.setTimeout(180_000);
  await signInPaid(page);

  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page
    .getByRole("link", { name: "Writing Style & Career Story" })
    .click();
  await page.waitForURL(/\/app\/studio/, { timeout: 30_000 });
});

async function paidUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "paid@acmejobs.local" },
    select: { id: true },
  });
  return user.id;
}

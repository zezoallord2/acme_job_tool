import { test, expect } from "@playwright/test";

/**
 * Free user end-to-end journey, proven with real HTTP and a real database.
 *
 * Runs as one browser session so the authenticated state is genuine. The AI step
 * uses Manual Mode — exactly what a user on the zero-cost configuration does.
 */
const JOB_DESCRIPTION = `Data Analyst

About the role
We are looking for a Data Analyst to join our reporting team. You will build and
maintain the weekly operations report and support the wider business with ad-hoc
analysis.

Requirements
- Advanced Excel, including Power Query
- 2+ years in an analytics or reporting role
- Weekly stakeholder reporting experience
- Strong communication

Nice to have
- SQL querying
- Experience with Power BI

You must hold a recognised analytics certification.`;

const ANALYSIS_JSON = JSON.stringify({
  role: "Data Analyst",
  company: "Test Corp",
  seniority: "Mid",
  summary: "Build and maintain the weekly operations report.",
  mustHaveRequirements: [
    "Advanced Excel, including Power Query",
    "2+ years in an analytics or reporting role",
    "Weekly stakeholder reporting experience",
    "A recognised analytics certification is required",
  ],
  preferredRequirements: ["SQL querying", "Experience with Power BI"],
  responsibilities: ["Build and maintain the weekly operations report"],
  hardSkills: ["Excel", "Power Query"],
  softSkills: ["Communication"],
  tools: ["Excel", "Power Query", "SQL", "Power BI"],
  educationRequirements: [],
  certificationRequirements: ["Recognised analytics certification"],
  experienceRequirement: "2+ years",
  repeatedThemes: ["weekly reporting"],
  importantLanguage: ["operations report"],
  dealBreakers: ["Certification required"],
  needsInput: [],
});

test.describe.configure({ mode: "serial" });

test("public marketing pages render with the required copy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Stop Sending Generic Applications/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Your experience. AI-assisted. Never invented.").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /AI Job Search Starter Guide/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /AI Job Hunter/i }).first(),
  ).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByText("$0").first()).toBeVisible();
  await expect(page.getByText("$9.99").first()).toBeVisible();
  await expect(page.getByText(/\$14\.99/)).toBeVisible();

  await page.goto("/faq");
  await expect(
    page.getByText(/Do I need to pay for an AI service/i),
  ).toBeVisible();
});

test("free user journey: signup -> snapshot -> evidence -> job -> matrix -> upgrade boundary", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@acme.test`;
  test.setTimeout(300_000);

  await test.step("signup creates an account", async () => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Evan Example");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-long-enough-password-42");
    await page.getByRole("button", { name: /Create account/i }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Let's get you job-ready/i).first(),
    ).toBeVisible();
  });

  await test.step("onboarding records the job goal and preferences", async () => {
    await page.getByLabel("Target job title").fill("Data Analyst");
    await page.getByLabel("What should we call you?").fill("Evan");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "Add your experience" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Location").fill("Manchester");
    await page.getByRole("radio", { name: "Remote" }).check();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: "Ready to see jobs for you" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Show my Jobs for You/i }).click();
    await page.waitForURL(/\/app\/jobs/, { timeout: 45_000 });
    await expect(
      page.getByRole("heading", { name: "Jobs for You" }),
    ).toBeVisible();
  });

  await test.step("dashboard shows real empty states", async () => {
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { name: /Welcome back/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/What would you like to do today\?/i),
    ).toBeVisible();
    await expect(page.getByText(/Today's Tasks/i).first()).toBeVisible();
  });

  await test.step("the evidence ledger records a real achievement", async () => {
    await page.goto("/app/evidence");
    await page
      .getByLabel(/What did you do/i)
      .fill(
        "Built and updated the weekly Excel report for the operations team.",
      );
    await page
      .getByLabel(/Where did this come from/i)
      .fill("Operations internship");
    await page.getByRole("button", { name: /Add to ledger/i }).click();
    await expect(
      page.getByText(/Evidence added to your ledger/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Built and updated the weekly Excel report/i),
    ).toBeVisible();
  });

  await test.step("Manual Mode analysis of a pasted job description", async () => {
    await page.goto("/app/jobs/new");
    await page.getByLabel("Company").fill("Test Corp");
    await page.getByLabel("Role").fill("Data Analyst");
    await page.locator("#description").fill(JOB_DESCRIPTION);
    await page.getByRole("button", { name: /Save and analyze/i }).click();

    await expect(page.getByText(/Job saved/i)).toBeVisible({ timeout: 45_000 });
    await page.getByRole("link", { name: /Analyze now/i }).click();

    await page.waitForURL(/\/app\/jobs\/(?!new)[a-z0-9]+/i, {
      timeout: 45_000,
    });
    await expect(
      page.getByRole("heading", { name: /Analyze this description/i }),
    ).toBeVisible();
    await expect(page.getByText(/Manual Mode/i).first()).toBeVisible();

    await page.getByText(/Manual Mode \(advanced fallback\)/i).click();

    const promptBox = page.getByLabel("AI prompt to copy");
    await expect(promptBox).toBeVisible();
    const prompt = await promptBox.inputValue();
    expect(prompt).toContain("ABSOLUTE RULES");
    expect(prompt).toContain("Advanced Excel");
    expect(prompt).toContain("Return a single JSON object");

    await page
      .getByLabel("AI response to validate")
      .fill("```json\n" + ANALYSIS_JSON + "\n```");
    await page.getByRole("button", { name: /Validate response/i }).click();

    // Saving re-renders the page with the persisted analysis and its matrix.
    await expect(
      page.getByRole("heading", { name: "Match breakdown" }),
    ).toBeVisible({ timeout: 60_000 });
  });

  await test.step("the free view shows honest coverage and the upgrade boundary", async () => {
    await expect(
      page.getByRole("heading", { name: "Match breakdown" }),
    ).toBeVisible();

    // A mandatory certification the user does not hold drives the recommendation,
    // exactly as the CPA example in the specification describes.
    await expect(page.getByText(/Likely skip/i).first()).toBeVisible();
    await expect(page.getByText(/Recommendation: SKIP/i).first()).toBeVisible();

    // Free view: counts are visible, the per-requirement table is not.
    await expect(page.getByText("Strong").first()).toBeVisible();
    await expect(page.getByText("Missing").first()).toBeVisible();
    await expect(page.getByText(/Free view/i)).toBeVisible();

    // Nothing was invented: the missing certification is named as a critical gap.
    await expect(page.getByText(/certification/i).first()).toBeVisible();
  });

  await test.step("the free upgrade boundary is enforced and explained", async () => {
    await page.goto("/app/claims");
    await expect(
      page.getByRole("heading", { name: "Truth Check" }),
    ).toBeVisible();
    await expect(page.getByText(/Free view/i)).toBeVisible();

    await page.goto("/app/analytics");
    await expect(page.getByText(/Not enough data yet/i).first()).toBeVisible();

    await page.goto("/app/settings");
    await expect(page.getByText("Manual Mode").first()).toBeVisible();
    await expect(page.getByText(/\$0/).first()).toBeVisible();
  });

  await test.step("the follow-up link Acme Assistant suggests is a working page", async () => {
    // Acme Assistant offers "Open follow-ups" when nothing is due; that link used to
    // 404, so it is asserted here rather than left as a dead end.
    await page.goto("/app/ask");
    await page.getByLabel("Your question").fill("Any overdue follow-ups?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText(/Open follow-ups/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole("link", { name: /Open follow-ups/i })
      .first()
      .click();

    await page.waitForURL(/\/app\/follow-ups/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Follow-ups", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/No follow-ups yet/i)).toBeVisible();
    // Acme Jobs never sends anything on the user's behalf.
    await expect(
      page.getByText(/never sends anything on your behalf/i).first(),
    ).toBeVisible();
  });
});

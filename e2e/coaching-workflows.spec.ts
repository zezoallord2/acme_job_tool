import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The five coaching workflows, exercised through the real Manual Mode UI.
 *
 * Each test pastes a response the way a $0 user would — copy the prompt, use any
 * assistant, paste it back — and asserts the guarantee that matters: the result
 * becomes a proposal, never a fact, and a bad verdict is allowed.
 */
const PASSWORD = "acme-demo-password-2026";
const prisma = new PrismaClient();

const DEFENSE_JSON = {
  verdict: "OVERSTATED",
  reason: "You claim to have led the migration, but you built it yourself.",
  whatHappened: "The reporting stack was replaced.",
  whatYouDid: "You rebuilt the pack and migrated the queries.",
  whatWasTheResult: "Reporting took 30 percent less time.",
  suggestedHonestWording: "Rebuilt the month-end reporting pack in Excel.",
};

const QUESTIONS_JSON = {
  questions: [
    {
      question: "Walk me through the month-end reporting rebuild.",
      category: "RESUME_BASED",
      rationale: "It is the strongest thing on your resume.",
      expectedSignals: ["a specific number", "what you personally did"],
    },
  ],
};

const COACH_JSON = {
  relevance: 4,
  specificity: 2,
  evidence: 1,
  structure: 3,
  clarity: 3,
  wasVague: true,
  unsupportedClaims: ["Reduced costs by 40 percent"],
  followUpQuestion: "Which specific reporting step did you remove?",
  coachNote: "Strong framing, no numbers, and one claim you cannot support.",
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

/** Builds the prompt, then pastes a response back through the Manual Mode panel. */
async function runManualWorkflow(
  page: import("@playwright/test").Page,
  buildButton: import("@playwright/test").Locator,
  response: string,
) {
  await buildButton.click();
  await expect(page.getByLabel("AI prompt to copy")).toBeVisible({
    timeout: 45_000,
  });
  await page
    .getByLabel("AI response to validate")
    .fill("```json\n" + response + "\n```");
  await page.getByRole("button", { name: /Validate response/i }).click();
}

test("evidence extraction files proposals and never writes to the ledger", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signInPaid(page);

  const userId = await paidUserId();
  const before = await prisma.evidence.count({ where: { userId } });

  // Unique per run, because the tool correctly refuses to propose a statement it
  // has already seen. The proposal is removed again at the end so the demo
  // account is left exactly as it was found.
  const marker = `run ${Date.now()}`;
  const extraction = {
    statements: [
      {
        statement: `Rebuilt the vendor scorecard for ${marker}.`,
        claimType: "ACHIEVEMENT",
        metricValue: null,
        metricUnit: null,
        tags: ["reporting"],
      },
    ],
    needsInput: ["Which team owned the process before?"],
  };

  await page.goto("/app/evidence/discover");
  await expect(
    page.getByRole("heading", { name: "Discover evidence", level: 1 }),
  ).toBeVisible();

  await page
    .getByLabel("Describe the work in your own words")
    .fill(
      `I rebuilt the vendor scorecard for ${marker} because the old one broke ` +
        "every close. It took about six weeks and reporting afterwards took " +
        "roughly a third less time to produce.",
    );

  await runManualWorkflow(
    page,
    page.getByRole("button", { name: "Build the prompt" }).first(),
    JSON.stringify(extraction),
  );

  await expect(page.getByText(/Statements extracted/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/added as proposals/i).first()).toBeVisible();
  await expect(
    page.getByText(`Rebuilt the vendor scorecard for ${marker}.`),
  ).toBeVisible();

  // The promise the product makes: proposals, not facts.
  const after = await prisma.evidence.count({ where: { userId } });
  expect(after).toBe(before);

  const proposals = await prisma.evidenceProposal.findMany({
    where: { userId, proposedStatement: { contains: marker } },
  });
  expect(proposals).toHaveLength(1);
  expect(proposals[0]?.status).toBe("PENDING");
  // Inferred content starts low-confidence until a human confirms it.
  expect(proposals[0]?.confidence).toBe("LOW");

  await prisma.evidenceProposal.deleteMany({
    where: { userId, proposedStatement: { contains: marker } },
  });
});

test("claim defense can return an OVERSTATED verdict and edits nothing", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signInPaid(page);

  await page.goto("/app/claims/defend");
  await expect(
    page.getByRole("heading", { name: "Claim Defense", level: 1 }),
  ).toBeVisible();

  await page
    .getByLabel("The claim as it appears on your resume")
    .fill(
      "Led the migration of the entire reporting stack across three teams.",
    );
  await page
    .getByLabel("Your account of what really happened")
    .fill("I rebuilt the pack and migrated the queries myself.");

  await runManualWorkflow(
    page,
    page.getByRole("button", { name: "Build the prompt" }).first(),
    JSON.stringify(DEFENSE_JSON),
  );

  await expect(page.getByText(/Verdict: overstated/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("What you can actually say")).toBeVisible();
  await expect(page.getByText(/suggestion, not a change/i)).toBeVisible();
});

test("the question builder persists questions and the coach scores an answer", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInPaid(page);

  await page.goto("/app/interviews/prep");
  await expect(
    page.getByRole("heading", { name: "Interview Prep", level: 1 }),
  ).toBeVisible();

  // --- Question Builder ---
  await page.getByLabel("How many").fill("1");
  await runManualWorkflow(
    page,
    page.getByRole("button", { name: "Build the prompt" }).first(),
    JSON.stringify(QUESTIONS_JSON),
  );

  await expect(page.getByText(/Questions ready/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("Walk me through the month-end reporting rebuild."),
  ).toBeVisible();
  await expect(page.getByText(/Listen for:/i)).toBeVisible();

  // The question really was stored against a real session.
  const questions = await prisma.interviewQuestion.count({
    where: { question: { contains: "month-end reporting rebuild" } },
  });
  expect(questions).toBeGreaterThan(0);

  // --- Answer Coach ---
  // The Question Builder panel has been replaced by its results, so this is now
  // the only "Build the prompt" button on the page.
  await page
    .getByLabel("The question you were asked")
    .fill("Walk me through the month-end reporting rebuild.");
  await page
    .getByLabel("The answer you gave")
    .fill(
      "I rebuilt it. It was fine. We reduced costs by 40 percent which was " +
        "great for the business overall.",
    );

  await runManualWorkflow(
    page,
    page.getByRole("button", { name: "Build the prompt" }).first(),
    JSON.stringify(COACH_JSON),
  );

  await expect(page.getByText(/too vague/i).first()).toBeVisible({
    timeout: 60_000,
  });
  // Five criteria are reported.
  for (const label of [
    "Relevance",
    "Specificity",
    "Evidence",
    "Structure",
    "Clarity",
  ]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }
  // Each criterion is scored out of five.
  await expect(page.getByText("/5").first()).toBeVisible();
  // The unsupported claim is named rather than quietly accepted.
  await expect(
    page.getByText(/Claims your evidence does not support/i),
  ).toBeVisible();
  await expect(page.getByText("Reduced costs by 40 percent")).toBeVisible();
  // One follow-up question, not a lecture.
  await expect(page.getByText(/Practise the follow-up/i)).toBeVisible();

  // Never a hire probability.
  await expect(page.getByText(/chance of being hired/i)).toHaveCount(0);
});

test("the mock interview records answers against real question rows", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signInPaid(page);

  const userId = await paidUserId();
  const marker = `marker ${Date.now()}`;

  // Clear anything an earlier interrupted run left behind for this fixture.
  await prisma.interviewAnswer.deleteMany({
    where: {
      transcript: { contains: "reconciled them against the source system" },
    },
  });
  await prisma.interviewQuestion.deleteMany({
    where: { question: { contains: "conflicting stakeholder data" } },
  });

  await page.goto("/app/interviews/practice");
  await expect(
    page.getByRole("heading", { name: /mock interview/i }).first(),
  ).toBeVisible();
  // No mode dropdown, no plan stat: pick a job (or a role) and a length.
  await expect(page.getByText(/Questions allowed/i)).toHaveCount(0);
  await page.getByLabel("Job").selectOption({ value: "" });
  await page.getByLabel("Target role").fill("Reporting Analyst");
  await page.getByLabel(/Quick/).check();

  // Manual Mode: the questions come back as a pasted JSON response.
  await page.getByRole("button", { name: /Use manual mode/ }).click();
  await expect(page.getByLabel("AI prompt to copy")).toHaveValue(
    /QUESTION PLAN/,
    { timeout: 45_000 },
  );
  await page.getByLabel("AI response to validate").fill(
    JSON.stringify({
      questions: [
        {
          question: `Tell me about a time you handled conflicting stakeholder data ${marker}.`,
          category: "BEHAVIORAL",
          slot: "BEHAVIOURAL",
          rationale: "Data ownership",
          expectedSignals: ["STAR"],
        },
      ],
    }),
  );
  await page.getByRole("button", { name: /Validate response/i }).click();

  // Quick plan: the opener comes first (standard wording), then our question.
  await expect(page.getByTestId("interview-question")).toContainText(
    /Tell me about yourself/,
    { timeout: 45_000 },
  );
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByTestId("interview-question")).toContainText(marker);

  const answerBox = page.getByLabel(/Your answer/i);
  await answerBox.fill(
    "Two teams sent different figures for the same month. I reconciled them " +
      "against the source system, agreed one definition with both leads, and " +
      "documented it so the next close was clean.",
  );
  await page.getByRole("button", { name: /Use manual mode/ }).click();
  await expect(page.getByLabel("AI prompt to copy")).toHaveValue(
    /CANDIDATE ANSWER/,
    { timeout: 45_000 },
  );
  await page.getByLabel("AI response to validate").fill(
    JSON.stringify({
      relevance: 4,
      specificity: 4,
      evidence: 3,
      structure: 4,
      clarity: 4,
      wasVague: false,
      unsupportedClaims: [],
      followUpQuestion: null,
      coachNote: "",
      strength: "You named the source system you checked against.",
      improvement: "Say how long the close took afterwards.",
      strongerAnswer:
        "Two teams sent different figures for the same month. I reconciled them against the source system.",
    }),
  );
  await page.getByRole("button", { name: /Validate response/i }).click();

  // Feedback: four scores, one improvement, a stronger answer.
  const feedback = page.getByTestId("interview-feedback");
  await expect(feedback).toBeVisible({ timeout: 60_000 });
  await expect(feedback).toContainText("Say how long the close took");
  await expect(feedback).toContainText("A stronger answer");

  // The question row is real, so the answer can be attached to it.
  expect(
    await prisma.interviewQuestion.count({
      where: { question: { contains: marker } },
    }),
  ).toBe(1);

  const answers = await prisma.interviewAnswer.findMany({
    where: {
      userId,
      transcript: { contains: "reconciled them against the source system" },
    },
    include: { question: { select: { question: true } } },
    orderBy: { createdAt: "desc" },
  });
  expect(answers.length).toBeGreaterThan(0);

  const latest = answers[0]!;
  expect(latest.userId).toBe(userId);
  expect(latest.question.question).toContain(marker);

  // Leave the demo account as we found it.
  await prisma.interviewAnswer.deleteMany({
    where: {
      transcript: { contains: "reconciled them against the source system" },
    },
  });
  await prisma.interviewQuestion.deleteMany({
    where: { question: { contains: "conflicting stakeholder data" } },
  });
});

test("a free user is offered the upgrade rather than a broken tool", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email").fill("free@acmejobs.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });

  await page.goto("/app/evidence/discover");
  await expect(
    page.getByText(/Complete Edition feature/i).first(),
  ).toBeVisible();
  // The Manual Mode prompt is not offered to someone who cannot use it.
  await expect(page.getByLabel("AI prompt to copy")).toHaveCount(0);

  // Interview prep points free users at the mock interview instead of an
  // "Upgrade to unlock" button.
  await page.goto("/app/interviews/prep");
  await expect(
    page.getByRole("link", { name: "Start a mock interview" }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Upgrade to unlock/i)).toHaveCount(0);
  await expect(page.getByLabel("AI prompt to copy")).toHaveCount(0);
});

async function paidUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "paid@acmejobs.local" },
    select: { id: true },
  });
  return user.id;
}

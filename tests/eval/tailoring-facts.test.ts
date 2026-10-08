import { describe, expect, it } from "vitest";
import { ResumeTailoringSchema } from "@/ai/schemas";
import { validateWorkflowOutput } from "@/ai/validate";
import {
  buildChanges,
  buildTailoringFacts,
  composeTailored,
  defaultDecisions,
  keywordCoverage,
  newFactsIn,
  type TailorDecision,
} from "@/domain/tailoring";
import { RESUME_CONTENT_SCHEMA } from "@/services/resume-service";
import type { EvidenceRecord } from "@/domain/evidence";

/**
 * Evaluation: resume tailoring can never add a fact.
 *
 * A careless (or adversarial) model output is pushed through the real guard.
 * Whatever the user then clicks — even "accept" on every change — the saved
 * resume may not contain an employer, title, date, number or skill the user
 * did not already have. The only way new words enter is the user typing them.
 */

function ev(
  id: string,
  statement: string,
  metricValue: number | null = null,
  metricUnit: string | null = null,
  tags: string[] = [],
): EvidenceRecord {
  return {
    id,
    statement,
    claimType: "ACHIEVEMENT",
    verificationStatus: "USER_CONFIRMED",
    confidenceCategory: "MEDIUM",
    metricValue,
    metricUnit,
    metricStatus: metricValue === null ? "NOT_APPLICABLE" : "VERIFIED",
    sourceType: "EMPLOYMENT",
    sourceDescription: "Fixture",
    tags,
  };
}

const ORIGINAL = RESUME_CONTENT_SCHEMA.parse({
  contact: { fullName: "Sam Rivera" },
  summary: "Support analyst who builds reporting for operations teams.",
  skills: ["Excel", "SQL", "Customer support"],
  experiences: [
    {
      company: "Acme Retail",
      title: "Support Analyst",
      location: "Cairo",
      startDate: "Jan 2021",
      endDate: "Present",
      bullets: [
        "Handled approximately 40 support tickets per day.",
        "Built the weekly Excel report for the operations team.",
      ],
    },
    {
      company: "Nile Books",
      title: "Sales Assistant",
      location: "Giza",
      startDate: "Jun 2019",
      endDate: "Dec 2020",
      bullets: ["Answered customer questions in store."],
    },
  ],
});

const EVIDENCE = [
  ev(
    "e1",
    "Rebuilt the month-end reporting pack in Power Query, cutting preparation from 5 days to 2.",
    2,
    "days",
    ["power query", "reporting"],
  ),
  ev("e2", "Wrote SQL queries to reconcile refunds."),
];

/** What a careless model returns for a "Data Analyst" job. */
const CARELESS = {
  summary:
    "Results-driven data analyst who increased revenue by 45% across 3 markets.",
  prioritizedSkills: ["SQL", "Power Query", "Excel", "Tableau", "Kubernetes"],
  experiences: [
    {
      index: 0,
      bullets: [
        {
          text: "Resolved 60 support tickets per day with SQL lookups.",
          original: "Handled approximately 40 support tickets per day.",
          evidenceIds: [],
          why: "Adds SQL.",
        },
        {
          text: "Built the weekly Excel report used by the operations team to track demand.",
          original: "Built the weekly Excel report for the operations team.",
          evidenceIds: [],
          why: "Job keywords.",
        },
        {
          text: "Led a team of analysts to automate reporting.",
          original: null,
          evidenceIds: [],
          why: "Leadership.",
        },
        {
          text: "Rebuilt the month-end reporting pack in Power Query, cutting preparation from 5 days to 2.",
          original: null,
          evidenceIds: [0],
          why: "Evidence e1.",
        },
      ],
    },
    // An index that does not exist must be ignored, not invent a role.
    {
      index: 7,
      bullets: [
        {
          text: "Senior Data Scientist at Google, 2015-2019.",
          original: null,
          evidenceIds: [1],
          why: "",
        },
      ],
    },
  ],
  changes: [{ section: "summary", what: "Rewrote", why: "Leads with SQL." }],
  jobKeywords: ["SQL", "Power Query", "Tableau", "reporting"],
  gaps: [],
  droppedPoints: [],
  needsInput: [],
};

function run(output: unknown) {
  const parsed = ResumeTailoringSchema.parse(output);
  const facts = buildTailoringFacts(ORIGINAL, EVIDENCE);
  return { facts, ...buildChanges(ORIGINAL, parsed, facts) };
}

describe("Resume tailoring evaluation: no new facts", () => {
  it("keeps more than 15 gaps and asks for evidence when a question is missing", () => {
    const gaps = Array.from({ length: 16 }, (_, i) => ({
      requirement: `Requirement ${i + 1}`,
      ...(i === 8 ? {} : { question: "Where have you demonstrated this?" }),
    }));
    const result = validateWorkflowOutput<
      ReturnType<typeof ResumeTailoringSchema.parse>
    >("RESUME_TAILORING", JSON.stringify({ ...CARELESS, gaps }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(" "));
    expect(result.data.gaps).toHaveLength(16);
    expect(result.data.gaps[8]!.question).toContain("Requirement 9");
    expect(result.data.gaps[0]!.question).toBe(gaps[0]!.question);
    const { changes } = run({ ...CARELESS, gaps });
    expect(changes.find((c) => c.after.includes("45%"))!.blocked).toMatch(
      /number/i,
    );
  });

  it("still rejects malformed gaps and unbounded gap lists", () => {
    for (const gaps of [
      [{ requirement: "", question: "What did you do?" }],
      [{ requirement: "SQL", question: 123 }],
      Array.from({ length: 61 }, () => ({ requirement: "SQL" })),
    ]) {
      expect(
        ResumeTailoringSchema.safeParse({ ...CARELESS, gaps }).success,
      ).toBe(false);
    }
  });

  it("validates the careless output against the v7 schema", () => {
    const result = validateWorkflowOutput(
      "RESUME_TAILORING",
      JSON.stringify(CARELESS),
    );
    expect(result.ok).toBe(true);
  });

  it("blocks invented numbers, inflation and uncited new bullets", () => {
    const { changes } = run(CARELESS);
    const byText = (t: string) => changes.find((c) => c.after.includes(t))!;

    expect(byText("45%").blocked).toMatch(/number/i);
    expect(byText("60 support tickets").blocked).toMatch(/60/);
    expect(byText("Led a team").blocked).not.toBeNull();
    // Grounded changes pass.
    expect(byText("used by the operations team").blocked).toBeNull();
    expect(byText("5 days to 2").blocked).toBeNull();
  });

  it("turns unknown skills into gap questions instead of adding them", () => {
    const { changes, gaps } = run(CARELESS);
    const skills = changes.find((c) => c.section === "skills")!;
    expect(skills.after).toContain("Power Query");
    expect(skills.after).not.toMatch(/Tableau|Kubernetes/);
    expect(gaps.map((g) => g.requirement)).toEqual(
      expect.arrayContaining(["Tableau", "Kubernetes"]),
    );
  });

  it("never touches employers, titles, locations or dates — even if every change is accepted", () => {
    const { changes, facts } = run(CARELESS);
    const acceptAll: Record<string, TailorDecision> = Object.fromEntries(
      changes.map((c) => [c.id, { accepted: true }]),
    );
    const tailored = composeTailored(ORIGINAL, changes, acceptAll);

    expect(newFactsIn(ORIGINAL, tailored, facts)).toEqual([]);
    expect(tailored.experiences.map((e) => e.company)).toEqual([
      "Acme Retail",
      "Nile Books",
    ]);
    expect(JSON.stringify(tailored)).not.toMatch(/Google|45%|\b60\b|Tableau/);
  });

  it("applies the safe changes by default and improves keyword coverage", () => {
    const { changes, facts } = run(CARELESS);
    const tailored = composeTailored(
      ORIGINAL,
      changes,
      defaultDecisions(changes),
    );
    expect(newFactsIn(ORIGINAL, tailored, facts)).toEqual([]);
    expect(tailored.experiences[0]!.bullets).toContain(
      "Rebuilt the month-end reporting pack in Power Query, cutting preparation from 5 days to 2.",
    );
    const keywords = CARELESS.jobKeywords;
    expect(keywordCoverage(tailored, keywords).score).toBeGreaterThan(
      keywordCoverage(ORIGINAL, keywords).score,
    );
  });

  it("lets the user's own edit replace a blocked suggestion", () => {
    const { changes } = run(CARELESS);
    const blocked = changes.find((c) => c.after.includes("60 support"))!;
    const tailored = composeTailored(ORIGINAL, changes, {
      [blocked.id]: {
        accepted: true,
        text: "Handled about 40 support tickets a day, using SQL to look up orders.",
      },
    });
    expect(tailored.experiences[0]!.bullets[0]).toMatch(/about 40/);
  });

  it("flags a resume whose identity fields were tampered with", () => {
    const facts = buildTailoringFacts(ORIGINAL, EVIDENCE);
    const tampered = structuredClone(ORIGINAL);
    tampered.experiences[0]!.title = "Head of Data";
    tampered.experiences[0]!.startDate = "Jan 2018";
    tampered.skills.push("Kubernetes");
    const problems = newFactsIn(ORIGINAL, tampered, facts);
    expect(problems.join(" ")).toMatch(/title/);
    expect(problems.join(" ")).toMatch(/startDate/);
    expect(problems.join(" ")).toMatch(/Kubernetes/);
  });
});

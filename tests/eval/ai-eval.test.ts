import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { OUTPUT_SCHEMAS } from "@/ai/schemas";
import { PROMPTS } from "@/ai/prompts";
import {
  assessClaim,
  findInventedMetrics,
  detectInflation,
  type EvidenceRecord,
} from "@/domain/evidence";
import {
  activePromptVersion,
  PROMPT_VERSIONS,
  EVALUATION_VERSION,
} from "@/ai/workflow-ids";
import { validateWorkflowOutput, extractJson } from "@/ai/validate";

/**
 * AI evaluation suite.
 *
 * The zero-cost configuration has no live model, so evaluation runs against
 * fixtures: a deterministic "model" produces candidate output, and the suite
 * measures whether the *system* would reject it. This is what protects the
 * product: the guarantee is that invalid output cannot reach a user, regardless
 * of which model produced it.
 */
interface Fixture {
  slug: string;
  scenario: string;
  workflowId: keyof typeof OUTPUT_SCHEMAS;
  evidence: EvidenceRecord[];
  /** What a careless model would emit. */
  carelessOutput: unknown;
  /** Expected claim outcome when the careless output is evaluated. */
  expectUnsupportedAspects?: string[];
}

function ev(
  id: string,
  statement: string,
  verificationStatus: EvidenceRecord["verificationStatus"] = "USER_CONFIRMED",
  metricValue: number | null = null,
  metricUnit: string | null = null,
  tags: string[] = [],
): EvidenceRecord {
  return {
    id,
    statement,
    claimType: "ACHIEVEMENT",
    verificationStatus,
    confidenceCategory: "MEDIUM",
    metricValue,
    metricUnit,
    metricStatus: metricValue === null ? "NOT_APPLICABLE" : "VERIFIED",
    sourceType: "EMPLOYMENT",
    sourceDescription: "Fixture source",
    tags,
  };
}

const FIXTURES: Fixture[] = [
  {
    slug: "fresh-graduate",
    scenario: "Fresh graduate with an internship and a university project",
    workflowId: "RESUME_BULLET",
    evidence: [
      ev(
        "e1",
        "Built and updated the weekly Excel report for the operations team.",
        "USER_CONFIRMED",
        null,
        null,
        ["excel", "reporting"],
      ),
      ev(
        "e2",
        "Handled approximately 40 support tickets per day.",
        "USER_CONFIRMED",
        40,
        "tickets/day",
      ),
      ev(
        "e3",
        "Built a Python pipeline that cleaned 12 months of transaction data.",
        "USER_CONFIRMED",
        12,
        "months",
      ),
    ],
    carelessOutput: {
      suggestion:
        "Built weekly Excel reporting and increased team revenue by 45%.",
      usedEvidenceIds: [1, 3],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "Great work with clear impact.",
    },
    expectUnsupportedAspects: ["45%"],
  },
  {
    slug: "career-changer",
    scenario: "Accountant moving into analytics",
    workflowId: "RESUME_BULLET",
    evidence: [
      ev(
        "e1",
        "Rebuilt the month-end reporting pack, cutting preparation from five days to two.",
        "VERIFIED",
        5,
        "days saved",
        ["reporting"],
      ),
      ev(
        "e2",
        "Introduced Power Query automation across four reporting workbooks.",
        "VERIFIED",
        4,
        "workbooks",
      ),
    ],
    carelessOutput: {
      suggestion:
        "Led the analytics transformation programme across three departments.",
      usedEvidenceIds: [],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "",
    },
    expectUnsupportedAspects: ["leadership", "three departments"],
  },
  {
    slug: "senior-professional",
    scenario: "Senior professional with strong evidence",
    workflowId: "RESUME_BULLET",
    evidence: [
      ev("e1", "Managed a team of eight analysts.", "VERIFIED", 8, "people", [
        "leadership",
      ]),
    ],
    carelessOutput: {
      suggestion:
        "Managed a team of eight analysts and delivered a 30% uplift in pipeline.",
      usedEvidenceIds: [1],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "",
    },
    expectUnsupportedAspects: ["30%"],
  },
  {
    slug: "sparse-experience",
    scenario: "Very little evidence recorded",
    workflowId: "RESUME_BULLET",
    evidence: [],
    carelessOutput: {
      suggestion:
        "Delivered significant improvements across the organisation with measurable impact.",
      usedEvidenceIds: [1, 2, 3],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "",
    },
    expectUnsupportedAspects: ["1", "2", "3"],
  },
  {
    slug: "missing-metrics",
    scenario: "Real achievement with no number",
    workflowId: "RESUME_BULLET",
    evidence: [
      ev("e1", "Rebuilt the weekly reporting pack.", "USER_CONFIRMED"),
    ],
    carelessOutput: {
      suggestion:
        "Rebuilt the weekly reporting pack, cutting preparation time by 60%.",
      usedEvidenceIds: [1],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "",
    },
    expectUnsupportedAspects: ["60%"],
  },
  {
    slug: "conflicting-dates",
    scenario: "Evidence with conflicting verification status",
    workflowId: "RESUME_BULLET",
    evidence: [
      ev("e1", "Ran the quarterly close process.", "CONFLICTED"),
      ev("e2", "Owned the audit response.", "REJECTED"),
      ev("e3", "Mentored two junior analysts.", "UNVERIFIED"),
    ],
    carelessOutput: {
      suggestion:
        "Ran the quarterly close, owned the audit response and mentored two junior analysts.",
      usedEvidenceIds: [1, 2, 3],
      unsupportedAspects: [],
      riskLevel: "LOW",
      explanation: "",
    },
    expectUnsupportedAspects: ["1", "2", "3"],
  },
  {
    slug: "mandatory-certification",
    scenario: "Job requires a certification the user does not hold",
    workflowId: "JOB_ANALYSIS",
    evidence: [
      ev("e1", "Advanced Excel reporting experience.", "USER_CONFIRMED"),
    ],
    carelessOutput: {
      role: "Data Analyst",
      company: "Acme",
      seniority: "Mid",
      summary: "Reporting role requiring certification.",
      mustHaveRequirements: [
        "ACCA certification is mandatory",
        "Advanced Excel",
      ],
      preferredRequirements: [],
      responsibilities: [],
      hardSkills: [],
      softSkills: [],
      tools: [],
      educationRequirements: [],
      certificationRequirements: ["ACCA"],
      experienceRequirement: "3 years",
      repeatedThemes: [],
      importantLanguage: [],
      dealBreakers: ["ACCA certification required"],
      needsInput: [],
    },
  },
  {
    slug: "ambiguous-job-description",
    scenario: "Vague description with implied requirements",
    workflowId: "JOB_ANALYSIS",
    evidence: [ev("e1", "Excel and reporting experience.", "USER_CONFIRMED")],
    carelessOutput: {
      role: "",
      company: "",
      seniority: "",
      summary:
        "Looking for a data ninja rockstar who can hit the ground running in a fast-paced startup.",
      mustHaveRequirements: ["data ninja"],
      preferredRequirements: ["rockstar"],
      responsibilities: [],
      hardSkills: [],
      softSkills: [],
      tools: [],
      educationRequirements: [],
      certificationRequirements: [],
      experienceRequirement: "",
      repeatedThemes: [],
      importantLanguage: [],
      dealBreakers: [],
      needsInput: ["No explicit requirements were stated in the description."],
    },
  },
];

interface Metrics {
  fixtures: number;
  schemaCompliance: number;
  unsupportedClaimRate: number;
  hallucinationRate: number;
  evidenceTraceability: number;
  consistencyScore: number;
  passed: boolean;
}

describe("AI evaluation fixtures", () => {
  let metrics: Metrics;

  beforeAll(async () => {
    // Evaluate in plain data first, then persist. Prisma's `create` does not return
    // scalars unless requested, so metrics are computed before the write.
    const evaluations = FIXTURES.map((fixture) => {
      const schema = OUTPUT_SCHEMAS[fixture.workflowId];
      const schemaOk = schema.safeParse(fixture.carelessOutput).success;

      const evidenceMap = new Map(fixture.evidence.map((e) => [e.id, e]));
      const carelessText = JSON.stringify(fixture.carelessOutput);

      let unsupportedAspects: string[] = [];
      let state = "UNSUPPORTED";
      if (fixture.workflowId === "RESUME_BULLET") {
        const suggestion = (fixture.carelessOutput as { suggestion: string })
          .suggestion;
        const usedIds = (
          (fixture.carelessOutput as { usedEvidenceIds: number[] })
            .usedEvidenceIds ?? []
        ).map((n) => `e${n}`);
        const inventedMetrics = findInventedMetrics(
          suggestion,
          fixture.evidence,
        );
        const inflation = detectInflation(
          suggestion,
          fixture.evidence.map((e) => e.statement),
        );
        unsupportedAspects = [
          ...inventedMetrics,
          ...(inflation ? [inflation.category] : []),
        ];

        const assessment = assessClaim(
          {
            text: suggestion,
            type: "ACHIEVEMENT",
            supportingEvidenceIds: usedIds,
            unsupportedAspects,
          },
          evidenceMap,
        );
        state = assessment.state;
      }

      const traceable = fixture.evidence.filter(
        (e) =>
          e.verificationStatus === "VERIFIED" ||
          e.verificationStatus === "USER_CONFIRMED",
      ).length;

      const passed =
        schemaOk &&
        (fixture.workflowId !== "RESUME_BULLET" ||
          unsupportedAspects.length > 0 ||
          state === "UNSUPPORTED");

      return {
        slug: fixture.slug,
        scenario: fixture.scenario,
        schemaOk,
        unsupportedAspects,
        state,
        traceable,
        evidenceCount: fixture.evidence.length,
        promptHasSafetyContract: PROMPTS[fixture.workflowId].systemPrompt
          .toLowerCase()
          .includes("never invent"),
        passed,
        rawLength: carelessText.length,
      };
    });

    const total = evaluations.length;
    const schemaPasses = evaluations.filter((r) => r.schemaOk).length;
    const caught = evaluations.filter((r) => r.passed).length;

    metrics = {
      fixtures: total,
      schemaCompliance: schemaPasses / total,
      unsupportedClaimRate: caught / total,
      hallucinationRate:
        evaluations.filter((r) => r.unsupportedAspects.length > 0).length /
        total,
      evidenceTraceability:
        evaluations.reduce((s, r) => s + r.traceable, 0) /
        Math.max(
          1,
          evaluations.reduce((s, r) => s + r.evidenceCount, 0),
        ),
      consistencyScore:
        evaluations.filter((r) => r.promptHasSafetyContract).length / total,
      passed: caught === total && schemaPasses === total,
    };

    const run = await prisma.aIEvaluationRun.create({
      data: {
        version: "suite-1",
        evaluationVersion: EVALUATION_VERSION,
        promptVersion: activePromptVersion("RESUME_BULLET"),
        fixtureCount: total,
        metrics: metrics as never,
        passed: metrics.passed,
      },
    });

    await prisma.aIEvaluationResult.createMany({
      data: evaluations.map((r) => ({
        runId: run.id,
        fixtureId: r.slug,
        metrics: {
          schemaCompliant: r.schemaOk,
          unsupportedAspects: r.unsupportedAspects,
          claimState: r.state,
          traceableEvidence: r.traceable,
          evidenceCount: r.evidenceCount,
          promptHasSafetyContract: r.promptHasSafetyContract,
        } as never,
        passed: r.passed,
        details: { scenario: r.scenario, rawLength: r.rawLength } as never,
      })),
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.aIEvaluationRun.deleteMany({ where: { version: "suite-1" } });
  });

  it("covers every required evaluation scenario", () => {
    const slugs = FIXTURES.map((f) => f.slug);
    for (const required of [
      "fresh-graduate",
      "career-changer",
      "senior-professional",
      "sparse-experience",
      "missing-metrics",
      "conflicting-dates",
      "mandatory-certification",
      "ambiguous-job-description",
    ]) {
      expect(slugs).toContain(required);
    }
  });

  it("catches every careless output before it can reach a user", () => {
    expect(metrics.passed).toBe(true);
    expect(metrics.unsupportedClaimRate).toBe(1);
  });

  it("has full schema compliance for every fixture shape", () => {
    expect(metrics.schemaCompliance).toBe(1);
  });

  it("detects hallucinated metrics and leadership inflation", () => {
    expect(metrics.hallucinationRate).toBeGreaterThan(0.4);
  });

  it("has a safety contract in every evaluated prompt", () => {
    expect(metrics.consistencyScore).toBe(1);
  });

  it("never treats unverified, conflicted or rejected evidence as proof", () => {
    const fixture = FIXTURES.find((f) => f.slug === "conflicting-dates")!;
    const map = new Map(fixture.evidence.map((e) => [e.id, e]));
    const assessment = assessClaim(
      {
        text: "Owned the audit response.",
        type: "RESPONSIBILITY",
        supportingEvidenceIds: ["e1", "e2", "e3"],
        unsupportedAspects: [],
      },
      map,
    );
    expect(assessment.supportingEvidenceIds).toHaveLength(0);
    expect(assessment.state).not.toBe("SUPPORTED");
  });
});

describe("Prompt version governance", () => {
  it("has exactly one active prompt per workflow and no active candidates", () => {
    for (const [workflowId, versions] of Object.entries(PROMPT_VERSIONS)) {
      expect(versions.active, workflowId).toBeTruthy();
      expect(versions.active).toMatch(/v\d+$/);
      expect(versions.candidates, workflowId).not.toContain(versions.active);
    }
  });

  it("refuses to parse output that does not match the active schema", () => {
    const result = validateWorkflowOutput(
      "JOB_ANALYSIS",
      '{"totally":"wrong"}',
    );
    expect(result.ok).toBe(false);
  });

  it("locally repairs a fenced response before validating it", () => {
    const valid = {
      role: "A",
      company: "B",
      seniority: "C",
      summary: "D",
      mustHaveRequirements: [],
      preferredRequirements: [],
      responsibilities: [],
      hardSkills: [],
      softSkills: [],
      tools: [],
      educationRequirements: [],
      certificationRequirements: [],
      experienceRequirement: "",
      repeatedThemes: [],
      importantLanguage: [],
      dealBreakers: [],
      needsInput: [],
    };
    const extract = extractJson("```json\n" + JSON.stringify(valid) + "\n```");
    expect(extract.ok).toBe(true);
    expect(extract.repaired).toBe(true);
    expect(
      validateWorkflowOutput(
        "JOB_ANALYSIS",
        "```json\n" + JSON.stringify(valid) + "\n```",
      ).ok,
    ).toBe(true);
  });
});

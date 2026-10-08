import { describe, it, expect } from "vitest";
import {
  evaluateReadiness,
  checkConsistency,
  READINESS_CATEGORY_LABELS,
} from "@/domain/readiness";
import {
  CAPABILITIES_BY_PLAN,
  planHasCapability,
  PLAN_LIMITS,
} from "@/domain/entitlements";
import { computeAnalytics, computeAttributePatterns } from "@/domain/analytics";
import { buildPriorities } from "@/domain/priorities";

describe("Readiness Gate", () => {
  const baseInput = {
    unsupportedClaims: [] as string[],
    conflictedClaims: [] as string[],
    dateConflicts: [] as string[],
    educationConflicts: [] as string[],
    titleConflicts: [] as string[],
    toolConflicts: [] as string[],
    responsibilityInflations: [] as string[],
    requirementsReviewed: true,
    requirementsTotal: 5,
    isResumeTailored: true,
    contactComplete: true,
    unverifiedMetrics: [] as string[],
    answerInconsistencies: [] as string[],
    defenseProblems: [] as Array<{ text: string; verdict: string }>,
  };

  it("returns READY when nothing blocks", () => {
    const result = evaluateReadiness(baseInput);
    expect(result.status).toBe("READY");
    expect(result.blockingCount).toBe(0);
    expect(result.checks).toHaveLength(8);
  });

  it("returns READY_WITH_WARNINGS for non-blocking warnings", () => {
    const result = evaluateReadiness({ ...baseInput, isResumeTailored: false });
    expect(result.status).toBe("READY_WITH_WARNINGS");
  });

  it("blocks on an unsupported claim", () => {
    const result = evaluateReadiness({
      ...baseInput,
      unsupportedClaims: ["Increased revenue by 30%."],
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.summary).toContain("Not ready");
  });

  it("blocks on leadership inflation", () => {
    const result = evaluateReadiness({
      ...baseInput,
      responsibilityInflations: [
        "This document claims team leadership, but no evidence records leadership responsibility.",
      ],
    });
    expect(result.status).toBe("NOT_READY");
    expect(
      result.checks.find((c) => c.category === "CROSS_DOCUMENT_CONSISTENCY")!
        .blocking,
    ).toBe(true);
  });

  it("blocks on a claim the user cannot defend", () => {
    const result = evaluateReadiness({
      ...baseInput,
      defenseProblems: [
        { text: "Led five-person team.", verdict: "OVERSTATED" },
      ],
    });
    expect(result.status).toBe("NOT_READY");
    const metricsCheck = result.checks.find(
      (c) => c.category === "METRICS_VERIFIED",
    )!;
    expect(metricsCheck.blocking).toBe(true);
    expect(metricsCheck.detail).toContain("cannot defend");
  });

  it("blocks when contact details are incomplete", () => {
    const result = evaluateReadiness({ ...baseInput, contactComplete: false });
    expect(result.status).toBe("NOT_READY");
  });

  it("never labels itself an ATS score", () => {
    const labels = Object.values(READINESS_CATEGORY_LABELS).join(" ");
    expect(labels.toLowerCase()).not.toContain("ats");
  });
});

describe("Cross-document consistency", () => {
  const baseInput = {
    profile: {
      jobTitles: ["Operations Intern"],
      employers: ["Northwind Services"],
      education: ["BSc Business Analytics"],
      tools: ["excel", "reporting"],
    },
    documents: [
      {
        id: "r1",
        type: "RESUME" as const,
        text: "Operations Intern at Northwind Services. Built weekly Excel reports.",
      },
    ],
    evidence: [
      {
        id: "e1",
        statement: "Built weekly Excel reports.",
        metricValue: null,
        employmentStart: null,
        employmentEnd: null,
        employer: null,
        jobTitle: null,
        tools: [] as string[],
      },
    ],
    employmentDates: [
      {
        employer: "Northwind Services",
        jobTitle: "Operations Intern",
        startDate: null,
        endDate: null,
      },
    ],
  };

  it("finds no issue for a consistent document", () => {
    expect(checkConsistency(baseInput)).toHaveLength(0);
  });

  it("flags a leadership claim with no leadership evidence", () => {
    const issues = checkConsistency({
      ...baseInput,
      documents: [
        {
          id: "r1",
          type: "RESUME",
          text: "Led a five-person team at Northwind Services.",
        },
      ],
    });
    const inflation = issues.find((i) => i.type === "LEADERSHIP_INFLATION");
    expect(inflation).toBeDefined();
    expect(inflation!.severity).toBe("BLOCKER");
    expect(inflation!.suggestion).toContain("supported a five-person team");
  });

  it("flags a metric that appears in no evidence record", () => {
    const issues = checkConsistency({
      ...baseInput,
      documents: [
        {
          id: "r1",
          type: "RESUME",
          text: "Increased revenue by 30% at Northwind Services.",
        },
      ],
    });
    expect(issues.some((i) => i.type === "METRIC_MISMATCH")).toBe(true);
  });

  it("flags a tool the profile does not record", () => {
    const issues = checkConsistency({
      ...baseInput,
      documents: [
        { id: "r1", type: "RESUME", text: "Built dashboards in Tableau." },
      ],
    });
    expect(issues.some((i) => i.type === "TOOL_CONFLICT")).toBe(true);
  });
});

describe("Entitlements", () => {
  it("gives free users the starter set only", () => {
    expect(planHasCapability("FREE", "CAREER_SNAPSHOT")).toBe(true);
    expect(planHasCapability("FREE", "CLAIM_INSPECTOR")).toBe(false);
    expect(planHasCapability("FREE", "READINESS_GATE")).toBe(false);
    expect(planHasCapability("FREE", "CAREER_LEARNING")).toBe(false);
    expect(planHasCapability("FREE", "SPRINT_14_DAY")).toBe(false);
  });

  it("gives complete users everything in the starter set", () => {
    for (const capability of CAPABILITIES_BY_PLAN.FREE) {
      expect(planHasCapability("COMPLETE", capability)).toBe(true);
    }
    expect(planHasCapability("COMPLETE", "CLAIM_INSPECTOR")).toBe(true);
    expect(planHasCapability("COMPLETE", "CAREER_LEARNING")).toBe(true);
    expect(planHasCapability("COMPLETE", "SPRINT_14_DAY")).toBe(true);
  });

  it("applies numeric limits on the free plan", () => {
    expect(PLAN_LIMITS.FREE.starStories).toBe(1);
    // Mock interviews are not limited by plan; a daily session cap applies.
    expect("mockInterviewQuestions" in PLAN_LIMITS.FREE).toBe(false);
    expect(PLAN_LIMITS.COMPLETE.starStories).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("Analytics honesty", () => {
  const now = new Date("2026-06-01");

  it('says "not enough data yet" with no submissions', () => {
    const result = computeAnalytics([], now);
    expect(result.applicationsSubmitted).toBe(0);
    expect(result.replyRate).toBeNull();
    expect(result.sufficiency.level).toBe("INSUFFICIENT");
    expect(result.sufficiency.message).toContain("Not enough data yet");
  });

  it("refuses to over-interpret a tiny sample", () => {
    const result = computeAnalytics(
      [
        {
          type: "SUBMITTED",
          occurredAt: new Date("2026-05-01"),
          applicationId: "a1",
        },
        {
          type: "REPLIED",
          occurredAt: new Date("2026-05-03"),
          applicationId: "a1",
        },
      ],
      now,
    );
    expect(result.sufficiency.level).toBe("DIRECTIONAL");
    expect(result.sufficiency.message).toContain("More data is needed");
    expect(result.sufficiency.message).not.toContain("excellent");
  });

  it("computes reply rate from real counts", () => {
    const result = computeAnalytics(
      [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: "SUBMITTED" as const,
          occurredAt: new Date("2026-05-01"),
          applicationId: `a${i}`,
        })),
        {
          type: "REPLIED",
          occurredAt: new Date("2026-05-04"),
          applicationId: "a0",
        },
        {
          type: "INTERVIEW",
          occurredAt: new Date("2026-05-05"),
          applicationId: "a1",
        },
      ],
      now,
    );
    expect(result.applicationsSubmitted).toBe(10);
    expect(result.replies).toBe(2);
    expect(result.replyRate).toBeCloseTo(0.2);
  });

  it("publishes a formula for every metric", () => {
    const result = computeAnalytics([], now);
    for (const f of result.formulas) {
      expect(f.formula.length).toBeGreaterThan(5);
    }
  });

  it("describes attribute patterns as association, never causation", () => {
    const patterns = computeAttributePatterns(
      [
        ...Array.from({ length: 11 }, (_, i) => ({
          type: "SUBMITTED" as const,
          occurredAt: new Date("2026-05-01"),
          applicationId: `a${i}`,
          company: "Acme",
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: "REPLIED" as const,
          occurredAt: new Date("2026-05-03"),
          applicationId: `a${i}`,
          company: "Acme",
        })),
      ],
      "company",
      () => ["your analytics project applications"],
    );
    const p = patterns[0]!;
    expect(p.statement).toBe(
      "Applications containing your analytics project applications received 4 replies from 11 submissions.",
    );
    expect(p.causal).toBe(false);
    expect(p.statement).not.toMatch(/increased|improved|caused|because/i);
  });
});

describe("Daily priority engine", () => {
  const now = new Date("2026-06-01T09:00:00Z");

  it("puts an imminent interview first", () => {
    const items = buildPriorities(
      {
        interviews: [
          {
            id: "i1",
            company: "Meta",
            role: "Analyst",
            scheduledAt: new Date("2026-06-02T09:00:00Z"),
            prepComplete: false,
          },
        ],
        followUps: [],
        unfinishedWork: [],
        deadApplications: [],
        userGoal: "FULL_SYSTEM",
      },
      now,
    );
    expect(items[0]!.title).toContain("Meta");
    expect(items[0]!.reason).toMatch(/within 24 hours|tomorrow/);
  });

  it("surfaces an overdue follow-up", () => {
    const items = buildPriorities(
      {
        interviews: [],
        followUps: [
          {
            id: "f1",
            applicationId: "a1",
            company: "Microsoft",
            role: "Analyst",
            scheduledFor: new Date("2026-05-28T09:00:00Z"),
            status: "DRAFT",
          },
        ],
        unfinishedWork: [],
        deadApplications: [],
        userGoal: "FULL_SYSTEM",
      },
      now,
    );
    expect(
      items.some((i) => i.title.includes("Follow up with Microsoft")),
    ).toBe(true);
    expect(items.find((i) => i.key === "followup:f1")!.reason).toContain("due");
  });

  it("marks long-undecided saved roles as optional", () => {
    const items = buildPriorities(
      {
        interviews: [],
        followUps: [],
        unfinishedWork: [],
        deadApplications: [
          {
            id: "d1",
            company: "Stale Co",
            role: "Role",
            deadline: null,
            savedAt: new Date("2026-05-01T09:00:00Z"),
          },
        ],
        userGoal: "FULL_SYSTEM",
      },
      now,
    );
    expect(items[0]!.action).toBe("OPTIONAL");
  });

  it("explains every priority", () => {
    const items = buildPriorities(
      {
        interviews: [],
        followUps: [],
        unfinishedWork: [
          {
            id: "w1",
            applicationId: "a1",
            company: "Amazon",
            role: "Analyst",
            kind: "RESUME_NOT_TAILORED",
            status: "SAVED",
            deadline: new Date("2026-06-03T09:00:00Z"),
          },
        ],
        deadApplications: [],
        userGoal: "FULL_SYSTEM",
      },
      now,
    );
    expect(items[0]!.reason).toContain("deadline");
    expect(items[0]!.minutes).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeEvidenceMatrix,
  scoreOpportunities,
  type RequirementInput,
} from "@/domain/matching";
import type { EvidenceRecord } from "@/domain/evidence";

function ev(
  id: string,
  statement: string,
  verificationStatus: EvidenceRecord["verificationStatus"] = "USER_CONFIRMED",
  metricValue: number | null = null,
  metricUnit: string | null = null,
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
    sourceDescription: "Test source",
    tags: [],
  };
}

function req(
  id: string,
  text: string,
  priority: RequirementInput["priority"],
  isMustHave = false,
): RequirementInput {
  return { id, text, priority, isMustHave };
}

describe("Evidence matrix and Apply/Skip", () => {
  it("classifies STRONG_FIT when must-haves are strongly evidenced", () => {
    const requirements = [
      req("r1", "Advanced Excel", "CRITICAL", true),
      req("r2", "Weekly stakeholder reporting", "HIGH", true),
    ];
    const result = computeEvidenceMatrix(requirements, [
      ev("e1", "Advanced Excel reporting for the operations team"),
      ev("e2", "Produced the weekly stakeholder report for management"),
    ]);

    expect(result.coverage.strong).toBe(2);
    expect(result.fitClassification).toBe("STRONG_FIT");
    expect(result.recommendation).toBe("APPLY");
    expect(result.explanation).toContain("Evidence coverage");
  });

  it("classifies LIKELY_SKIP when a mandatory certification is missing", () => {
    const requirements = [
      req("r1", "ACCA certification required", "CRITICAL", true),
      req("r2", "Advanced Excel", "HIGH", false),
    ];
    const result = computeEvidenceMatrix(requirements, [
      ev("e1", "Advanced Excel reporting"),
    ]);

    expect(result.fitClassification).toBe("LIKELY_SKIP");
    expect(result.recommendation).toBe("SKIP");
    expect(result.criticalGaps).toContain("ACCA certification required");
  });

  it("never invents evidence: a requirement with no match is MISSING", () => {
    const result = computeEvidenceMatrix(
      [req("r1", "SQL querying", "HIGH", true)],
      [ev("e1", "Advanced Excel reporting")],
    );
    const match = result.matches[0]!;
    expect(match.strength).toBe("MISSING");
    expect(match.supportingEvidenceIds).toHaveLength(0);
    expect(match.recommendedAction).toContain("no evidence");
  });

  it("returns UNKNOWN when there is no evidence at all", () => {
    const result = computeEvidenceMatrix(
      [req("r1", "SQL querying", "HIGH", true)],
      [],
    );
    expect(result.matches[0]!.strength).toBe("UNKNOWN");
  });

  it("always explains its classification", () => {
    const result = computeEvidenceMatrix(
      [req("r1", "Python", "MEDIUM", false)],
      [ev("e1", "Excel work")],
    );
    expect(result.explanation.length).toBeGreaterThan(20);
    expect(result.explanation).toContain("Classification");
  });

  it("excludes unverified evidence from being treated as proof", () => {
    const result = computeEvidenceMatrix(
      [req("r1", "Advanced Excel", "HIGH", true)],
      [ev("e1", "Advanced Excel", "UNVERIFIED")],
    );
    expect(result.matches[0]!.strength).not.toBe("STRONG");
  });
});

describe("Effort vs Opportunity ranking", () => {
  it("ranks a strong-fit low-effort role above a weak-fit high-effort role", () => {
    const scored = scoreOpportunities([
      {
        applicationId: "a1",
        company: "Good Co",
        role: "Data Analyst",
        fitClassification: "STRONG_FIT",
        coveragePercent: 0.9,
        criticalGapCount: 0,
        tailoringEffort: "LOW",
        deadline: null,
        userPriority: 1,
        recommendation: "APPLY",
      },
      {
        applicationId: "a2",
        company: "Stretch Co",
        role: "Research Scientist",
        fitClassification: "WEAK_FIT",
        coveragePercent: 0.2,
        criticalGapCount: 3,
        tailoringEffort: "VERY_HIGH",
        deadline: null,
        userPriority: 4,
        recommendation: "LOW_PRIORITY",
      },
    ]);

    expect(scored[0]!.applicationId).toBe("a1");
    expect(scored[0]!.netValue).toBeGreaterThan(scored[1]!.netValue);
  });

  it("boosts a role with an imminent deadline", () => {
    const base = {
      company: "Co",
      role: "Role",
      fitClassification: "REASONABLE_FIT" as const,
      coveragePercent: 0.6,
      criticalGapCount: 0,
      tailoringEffort: "MEDIUM" as const,
      userPriority: 3,
      recommendation: "APPLY" as const,
    };
    const now = new Date();
    const soon = scoreOpportunities([
      {
        ...base,
        applicationId: "soon",
        deadline: new Date(now.getTime() + 86_400_000),
      },
    ])[0]!;
    const later = scoreOpportunities([
      {
        ...base,
        applicationId: "later",
        deadline: new Date(now.getTime() + 90 * 86_400_000),
      },
    ])[0]!;

    expect(soon.opportunityScore).toBeGreaterThan(later.opportunityScore);
  });

  it("provides a readable rationale for every row", () => {
    const scored = scoreOpportunities([
      {
        applicationId: "a1",
        company: "Co",
        role: "Role",
        fitClassification: "STRETCH",
        coveragePercent: 0.4,
        criticalGapCount: 1,
        tailoringEffort: "HIGH",
        deadline: null,
        userPriority: 3,
        recommendation: "REVIEW",
      },
    ]);
    expect(scored[0]!.rationale).toContain("Co");
  });
});

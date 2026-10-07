import { describe, it, expect } from "vitest";
import {
  assessClaim,
  detectInflation,
  findInventedMetrics,
  isUsableAsFact,
  judgeDefense,
  scoreTermOverlap,
  evidenceStrengthForScore,
  type EvidenceRecord,
} from "@/domain/evidence";

function evidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "e1",
    statement: "Handled approximately 40 support tickets per day.",
    claimType: "RESPONSIBILITY",
    verificationStatus: "USER_CONFIRMED",
    confidenceCategory: "MEDIUM",
    metricValue: 40,
    metricUnit: "tickets/day",
    metricStatus: "USER_ESTIMATE",
    sourceType: "EMPLOYMENT",
    sourceDescription: "Support role",
    tags: [],
    ...overrides,
  };
}

describe("Evidence truth rules", () => {
  it("treats only VERIFIED and USER_CONFIRMED as usable fact", () => {
    expect(isUsableAsFact({ verificationStatus: "VERIFIED" })).toBe(true);
    expect(isUsableAsFact({ verificationStatus: "USER_CONFIRMED" })).toBe(true);
    expect(isUsableAsFact({ verificationStatus: "UNVERIFIED" })).toBe(false);
    expect(isUsableAsFact({ verificationStatus: "CONFLICTED" })).toBe(false);
    expect(isUsableAsFact({ verificationStatus: "REJECTED" })).toBe(false);
  });

  it("marks a claim with no supporting evidence as UNSUPPORTED", () => {
    const claim = {
      text: "Increased revenue by 30%.",
      type: "ACHIEVEMENT",
      supportingEvidenceIds: [],
      unsupportedAspects: ["30% revenue increase"],
    };
    const result = assessClaim(claim, new Map());
    expect(result.state).toBe("UNSUPPORTED");
    expect(result.explanation).toContain("No supporting evidence");
  });

  it("excludes UNVERIFIED and REJECTED evidence from support", () => {
    const map = new Map<string, EvidenceRecord>([
      ["e1", evidence({ verificationStatus: "UNVERIFIED" })],
      ["e2", evidence({ id: "e2", verificationStatus: "REJECTED" })],
    ]);
    const result = assessClaim(
      {
        text: "Handled approximately 40 support tickets per day.",
        type: "RESPONSIBILITY",
        supportingEvidenceIds: ["e1", "e2"],
        unsupportedAspects: [],
      },
      map,
    );
    expect(result.state).not.toBe("SUPPORTED");
    expect(result.supportingEvidenceIds).toHaveLength(0);
    expect(result.excludedEvidenceIds).toEqual(["e1", "e2"]);
  });

  it("marks a partially supported claim as NEEDS_CONFIRMATION and lists what is missing", () => {
    const map = new Map<string, EvidenceRecord>([["e1", evidence()]]);
    const result = assessClaim(
      {
        text: "Handled 40 support tickets per day and increased revenue by 30%.",
        type: "ACHIEVEMENT",
        supportingEvidenceIds: ["e1"],
        unsupportedAspects: ["revenue impact"],
      },
      map,
    );
    expect(result.state).toBe("NEEDS_CONFIRMATION");
    expect(result.unsupportedAspects).toEqual(["revenue impact"]);
  });

  it("marks a fully supported claim as SUPPORTED", () => {
    const map = new Map<string, EvidenceRecord>([["e1", evidence()]]);
    const result = assessClaim(
      {
        text: "Handled approximately 40 support tickets per day.",
        type: "RESPONSIBILITY",
        supportingEvidenceIds: ["e1"],
        unsupportedAspects: [],
      },
      map,
    );
    expect(result.state).toBe("SUPPORTED");
  });
});

describe("Leadership inflation detection", () => {
  it('flags "led a five-person team" when evidence only says "supported"', () => {
    const finding = detectInflation("Led a five-person team.", [
      "Supported a five-person project team by preparing the weekly status pack.",
    ]);
    expect(finding).not.toBeNull();
    expect(finding?.isInflated).toBe(true);
    expect(finding?.category).toBe("leadership");
  });

  it("does not flag leadership when evidence supports it", () => {
    const finding = detectInflation("Led a five-person team.", [
      "Led a five-person team for two quarters.",
    ]);
    expect(finding).toBeNull();
  });
});

describe("Defend this claim", () => {
  it("returns OVERSTATED for leadership inflation", () => {
    const result = judgeDefense(
      "Led five-person team.",
      "I prepared reports for the project manager.",
      ["Supported a five-person project team."],
    );
    expect(result.verdict).toBe("OVERSTATED");
  });

  it("returns DEFENSIBLE when the account matches the claim", () => {
    const result = judgeDefense(
      "Built the weekly Excel reporting pack.",
      "I built the weekly Excel reporting pack.",
    );
    expect(result.verdict).toBe("DEFENSIBLE");
  });

  it("returns PARTIALLY_SUPPORTED when the bullet states no ownership", () => {
    const result = judgeDefense(
      "Weekly reporting for the operations team.",
      "I worked on reporting.",
    );
    expect(result.verdict).toBe("PARTIALLY_SUPPORTED");
  });
});

describe("Invented metric detection", () => {
  it("accepts a number that exists in evidence", () => {
    const found = findInventedMetrics("Handled 40 tickets per day.", [
      evidence(),
    ]);
    expect(found).toHaveLength(0);
  });

  it("reports a number with no evidence behind it", () => {
    const found = findInventedMetrics(
      "Handled 40 tickets per day and lifted revenue 30%.",
      [evidence()],
    );
    expect(found.some((f) => f.includes("30"))).toBe(true);
  });
});

describe("Deterministic requirement matching", () => {
  it("scores a strong overlap highly", () => {
    const result = scoreTermOverlap(
      "Advanced Excel",
      "Advanced Excel reporting experience",
    );
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.matched).toContain("excel");
  });

  it("treats multi-word technology as a unit", () => {
    const result = scoreTermOverlap(
      "Power BI dashboards",
      "Built dashboards in Power BI for the team",
    );
    expect(result.matched).toContain("power bi");
  });

  it("maps scores to strength bands", () => {
    expect(evidenceStrengthForScore(0.8, true)).toBe("STRONG");
    expect(evidenceStrengthForScore(0.3, true)).toBe("PARTIAL");
    expect(evidenceStrengthForScore(0.05, true)).toBe("MISSING");
    expect(evidenceStrengthForScore(1, false)).toBe("UNKNOWN");
  });
});

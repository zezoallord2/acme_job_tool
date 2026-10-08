import type {
  EvidenceStrength,
  FitClassification,
  EffortLevel,
  OpportunityRecommendation,
  RequirementPriority,
} from "@prisma/client";
import {
  evidenceStrengthForScore,
  scoreTermOverlap,
  type EvidenceRecord,
} from "./evidence";

/**
 * Match Breakdown + Apply/Review/Skip. No hiring-probability estimate is ever
 * produced; the output is evidence coverage plus an explanation.
 */

export interface RequirementInput {
  id: string;
  text: string;
  priority: RequirementPriority;
  isMustHave: boolean;
}

export interface RequirementMatch {
  requirementId: string;
  requirementText: string;
  priority: RequirementPriority;
  strength: EvidenceStrength;
  matchBasis: string;
  supportingEvidenceIds: string[];
  supportingEvidenceLabels: string[];
  recommendedAction: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  isDealBreaker: boolean;
  explanation: string;
}

export interface MatrixResult {
  matches: RequirementMatch[];
  coverage: {
    strong: number;
    partial: number;
    missing: number;
    unknown: number;
  };
  coveragePercent: number;
  fitClassification: FitClassification;
  recommendation: OpportunityRecommendation;
  tailoringEffort: EffortLevel;
  criticalGaps: string[];
  strongSignals: string[];
  explanation: string;
}

const PRIORITY_WEIGHT: Record<RequirementPriority, number> = {
  CRITICAL: 1,
  HIGH: 0.75,
  MEDIUM: 0.4,
  LOW: 0.15,
};

const STRENGTH_VALUE: Record<EvidenceStrength, number> = {
  STRONG: 1,
  PARTIAL: 0.5,
  MISSING: 0,
  UNKNOWN: 0.25,
};

export function computeEvidenceMatrix(
  requirements: readonly RequirementInput[],
  allEvidence: readonly EvidenceRecord[],
  opts?: {
    hardRequirements?: readonly string[];
    softRequirements?: readonly string[];
  },
): MatrixResult {
  // Only verified or user-confirmed evidence may be presented as proof.
  // Unverified, conflicted and rejected records are shown to the user elsewhere,
  // but they must never upgrade a requirement to STRONG or PARTIAL here.
  const evidence = allEvidence.filter(
    (e) =>
      e.verificationStatus === "VERIFIED" ||
      e.verificationStatus === "USER_CONFIRMED",
  );
  const hasAnyUsableEvidence = evidence.length > 0;

  const matches: RequirementMatch[] = [];
  const hardSet = new Set((opts?.hardRequirements ?? []).map(normalize));

  for (const req of requirements) {
    const scored = evidence
      .map((e) => ({
        evidence: e,
        match: scoreTermOverlap(req.text, `${e.statement} ${e.tags.join(" ")}`),
      }))
      .sort((a, b) => b.match.score - a.match.score);

    const best = scored[0];
    const hasTermOverlap = scored.some((s) => s.match.score > 0);

    // MISSING means "we looked and nothing matches". UNKNOWN means "we have no
    // usable evidence at all to judge with" — a materially different statement.
    const strength = !hasAnyUsableEvidence
      ? "UNKNOWN"
      : hasTermOverlap
        ? evidenceStrengthForScore(best!.match.score, true)
        : "MISSING";

    const supporting = scored
      .filter((s) => s.match.score >= 0.25)
      .map((s) => s.evidence);

    const isHard = req.isMustHave || hardSet.has(normalize(req.text));
    const isDealBreaker =
      isHard &&
      strength !== "STRONG" &&
      /must|required|mandatory|essential|certified|certification|license/i.test(
        req.text,
      );

    matches.push({
      requirementId: req.id,
      requirementText: req.text,
      priority: req.priority,
      strength,
      matchBasis:
        best && best.match.score > 0
          ? `Matched terms: ${best.match.matched.join(", ")}`
          : "No matching evidence found",
      supportingEvidenceIds: supporting.map((e) => e.id),
      supportingEvidenceLabels: supporting.map((e) => e.statement),
      recommendedAction: recommendedActionFor(strength, req.priority, isHard),
      confidence:
        best && best.match.score >= 0.6
          ? "HIGH"
          : best && best.match.score >= 0.25
            ? "MEDIUM"
            : "LOW",
      isDealBreaker,
      explanation: explainMatch(
        req.text,
        strength,
        req.priority,
        isHard,
        best?.match.matched ?? [],
      ),
    });
  }

  const coverage = {
    strong: matches.filter((m) => m.strength === "STRONG").length,
    partial: matches.filter((m) => m.strength === "PARTIAL").length,
    missing: matches.filter((m) => m.strength === "MISSING").length,
    unknown: matches.filter((m) => m.strength === "UNKNOWN").length,
  };

  const total = matches.length;
  const weighted = total
    ? matches.reduce(
        (sum, m) =>
          sum + STRENGTH_VALUE[m.strength] * PRIORITY_WEIGHT[m.priority],
        0,
      ) / total
    : 0;
  const coveragePercent = total
    ? Math.round((weighted / total) * 100) / 100
    : 0;

  const criticalGaps = matches
    .filter(
      (m) =>
        m.priority === "CRITICAL" &&
        (m.strength === "MISSING" || m.strength === "UNKNOWN"),
    )
    .map((m) => m.requirementText);
  const strongSignals = matches
    .filter(
      (m) =>
        m.strength === "STRONG" &&
        (m.priority === "CRITICAL" || m.priority === "HIGH"),
    )
    .map((m) => m.requirementText);

  const fitClassification = classifyFit(coverage, weighted, matches);
  const recommendation = recommendationFor(fitClassification);
  const tailoringEffort = effortFor(matches);

  return {
    matches,
    coverage,
    coveragePercent,
    fitClassification,
    recommendation,
    tailoringEffort,
    criticalGaps,
    strongSignals,
    explanation: buildExplanation(
      fitClassification,
      recommendation,
      coverage,
      criticalGaps,
      strongSignals,
    ),
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classifyFit(
  coverage: MatrixResult["coverage"],
  weighted: number,
  matches: readonly RequirementMatch[],
): FitClassification {
  const total = matches.length || 1;
  const missingCritical = matches.filter(
    (m) =>
      m.priority === "CRITICAL" &&
      (m.strength === "MISSING" || m.strength === "UNKNOWN"),
  ).length;
  const dealBreakers = matches.filter((m) => m.isDealBreaker).length;

  // A hard blocker dominates: one deal-breaker gap outweighs everything else.
  if (dealBreakers > 0) return "LIKELY_SKIP";
  if (missingCritical >= 2) return "LIKELY_SKIP";
  if (missingCritical === 1) return "WEAK_FIT";
  if (weighted >= 0.75 && coverage.strong / total >= 0.5) return "STRONG_FIT";
  if (weighted >= 0.55) return "REASONABLE_FIT";
  if (weighted >= 0.35) return "STRETCH";
  return "WEAK_FIT";
}

function recommendationFor(fit: FitClassification): OpportunityRecommendation {
  switch (fit) {
    case "STRONG_FIT":
    case "REASONABLE_FIT":
      return "APPLY";
    case "STRETCH":
      return "REVIEW";
    case "WEAK_FIT":
      return "LOW_PRIORITY";
    case "LIKELY_SKIP":
      return "SKIP";
  }
}

function effortFor(matches: readonly RequirementMatch[]): EffortLevel {
  const gaps = matches.filter((m) => m.strength !== "STRONG").length;
  const criticalGaps = matches.filter(
    (m) =>
      m.strength !== "STRONG" &&
      (m.priority === "CRITICAL" || m.priority === "HIGH"),
  ).length;
  if (criticalGaps >= 4) return "VERY_HIGH";
  if (criticalGaps >= 2) return "HIGH";
  if (gaps >= 3) return "MEDIUM";
  return "LOW";
}

export function recommendedActionFor(
  strength: EvidenceStrength,
  priority: RequirementPriority,
  isMustHave: boolean,
): string {
  const prefix =
    priority === "CRITICAL"
      ? "Must address"
      : priority === "HIGH"
        ? "Should address"
        : "Optional";
  switch (strength) {
    case "STRONG":
      return `${prefix}: lead with this requirement and cite the evidence.`;
    case "PARTIAL":
      return `${prefix}: describe the closest real experience honestly; do not overstate.`;
    case "MISSING":
      return `${prefix}: no evidence found${isMustHave ? " for a must-have requirement" : ""}.`;
    case "UNKNOWN":
      return `${prefix}: ask the user to confirm or add evidence before applying.`;
  }
}

function explainMatch(
  requirement: string,
  strength: EvidenceStrength,
  priority: RequirementPriority,
  isMustHave: boolean,
  matchedTerms: readonly string[],
): string {
  const lead = isMustHave
    ? "Required."
    : priority === "CRITICAL"
      ? "Critical."
      : "";
  switch (strength) {
    case "STRONG":
      return `${lead} Strong evidence supports this (${matchedTerms.slice(0, 4).join(", ")}).`;
    case "PARTIAL":
      return `${lead} Related evidence exists (${matchedTerms.slice(0, 3).join(", ")}) but does not fully cover this requirement.`;
    case "MISSING":
      return `${lead} No evidence in your records matches this requirement.`;
    case "UNKNOWN":
      return `${lead} Not enough information to judge. Confirm whether you have relevant experience.`;
  }
}

function buildExplanation(
  fit: FitClassification,
  recommendation: OpportunityRecommendation,
  coverage: MatrixResult["coverage"],
  criticalGaps: readonly string[],
  strongSignals: readonly string[],
): string {
  const parts: string[] = [];
  parts.push(
    `Evidence coverage — strong ${coverage.strong}, partial ${coverage.partial}, missing ${coverage.missing}, unknown ${coverage.unknown}.`,
  );
  if (strongSignals.length) {
    parts.push(
      `You have direct evidence for: ${strongSignals.slice(0, 3).join("; ")}.`,
    );
  }
  if (criticalGaps.length) {
    parts.push(
      `Critical gaps: ${criticalGaps.slice(0, 3).join("; ")}${criticalGaps.length > 3 ? ` (+${criticalGaps.length - 3} more)` : ""}.`,
    );
  }
  parts.push(
    `Classification ${fit.replace(/_/g, " ").toLowerCase()}, recommendation ${recommendation}.`,
  );
  return parts.join(" ");
}

export const FIT_LABELS: Record<FitClassification, string> = {
  STRONG_FIT: "Strong fit",
  REASONABLE_FIT: "Reasonable fit",
  STRETCH: "Stretch",
  WEAK_FIT: "Weak fit",
  LIKELY_SKIP: "Likely skip",
};

export const STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  STRONG: "Strong",
  PARTIAL: "Partial",
  MISSING: "Missing",
  UNKNOWN: "Unknown",
};

export const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export interface OpportunityRow {
  applicationId: string;
  company: string;
  role: string;
  fitClassification: FitClassification;
  coveragePercent: number;
  criticalGapCount: number;
  tailoringEffort: EffortLevel;
  deadline: Date | null;
  userPriority: number;
  recommendation: OpportunityRecommendation;
}

/**
 * Best Jobs. Answers "where should I spend my next hour?" with a
 * transparent score — no black box, no outcome prediction.
 */
export interface OpportunityScored extends OpportunityRow {
  opportunityScore: number;
  effortScore: number;
  netValue: number;
  rationale: string;
}

const EFFORT_SCORE: Record<EffortLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const FIT_SCORE: Record<FitClassification, number> = {
  STRONG_FIT: 5,
  REASONABLE_FIT: 4,
  STRETCH: 3,
  WEAK_FIT: 2,
  LIKELY_SKIP: 1,
};

export function scoreOpportunities(
  rows: readonly OpportunityRow[],
  now = new Date(),
): OpportunityScored[] {
  return rows
    .map((r) => {
      const opportunityScore =
        FIT_SCORE[r.fitClassification] * 2 +
        r.coveragePercent * 3 -
        r.criticalGapCount * 1.5 +
        (6 - r.userPriority) * 0.25 +
        deadlineBoost(r.deadline, now);
      const effortScore = EFFORT_SCORE[r.tailoringEffort] * 2;
      const netValue = Math.round((opportunityScore - effortScore) * 10) / 10;
      return {
        ...r,
        opportunityScore: Math.round(opportunityScore * 10) / 10,
        effortScore,
        netValue,
        rationale: `${r.company} — ${FIT_LABELS[r.fitClassification].toLowerCase()}, coverage ${Math.round(
          r.coveragePercent * 100,
        )}%, ${r.criticalGapCount} critical gap${r.criticalGapCount === 1 ? "" : "s"}, ${r.tailoringEffort
          .toLowerCase()
          .replace(/_/g, " ")} tailoring effort.`,
      };
    })
    .sort((a, b) => b.netValue - a.netValue);
}

function deadlineBoost(deadline: Date | null, now: Date): number {
  if (!deadline) return 0;
  const days = (deadline.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return -1;
  if (days <= 2) return 1.5;
  if (days <= 7) return 0.75;
  return 0;
}

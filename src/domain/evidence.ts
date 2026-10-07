import type {
  ClaimVerificationState,
  ConfidenceCategory,
  EvidenceStrength,
  RiskLevel,
  VerificationStatus,
} from "@prisma/client";

/**
 * Truth rules. These are deterministic: AI output is untrusted input, and code
 * decides what is allowed to be presented as fact.
 */

export interface EvidenceRecord {
  id: string;
  statement: string;
  claimType: string;
  verificationStatus: VerificationStatus;
  confidenceCategory: ConfidenceCategory;
  metricValue: number | null;
  metricUnit: string | null;
  metricStatus: string;
  sourceType: string;
  sourceDescription: string;
  tags: string[];
  employmentId?: string | null;
  projectId?: string | null;
  educationId?: string | null;
  certificationId?: string | null;
  skillId?: string | null;
}

export interface ClaimCandidate {
  text: string;
  type: string;
  supportingEvidenceIds: string[];
  /** Elements the generator asserted that no evidence backs. */
  unsupportedAspects: string[];
  riskLevel?: RiskLevel;
}

/** Statuses that may be used as established fact in generated output. */
export const FACT_USABLE_STATUSES: readonly VerificationStatus[] = [
  "VERIFIED",
  "USER_CONFIRMED",
];

/**
 * Rejected and conflicted evidence must never support a generated claim.
 * UNVERIFIED may only be surfaced as "needs confirmation".
 */
export function isUsableAsFact(
  e: Pick<EvidenceRecord, "verificationStatus">,
): boolean {
  return FACT_USABLE_STATUSES.includes(e.verificationStatus);
}

export function usableEvidence(
  records: readonly EvidenceRecord[],
): EvidenceRecord[] {
  return records.filter(isUsableAsFact);
}

export interface ClaimAssessment {
  state: ClaimVerificationState;
  riskLevel: RiskLevel;
  explanation: string;
  supportingEvidenceIds: string[];
  excludedEvidenceIds: string[];
  unsupportedAspects: string[];
}

const RISK_BY_UNSUPPORTED_COUNT = (n: number): RiskLevel =>
  n === 0 ? "LOW" : n <= 2 ? "MEDIUM" : "HIGH";

export function assessClaim(
  claim: ClaimCandidate,
  evidenceById: ReadonlyMap<string, EvidenceRecord>,
): ClaimAssessment {
  const supporting: string[] = [];
  const excluded: string[] = [];

  for (const id of claim.supportingEvidenceIds) {
    // An id the caller referenced but that does not exist cannot support a claim,
    // and must not be persisted as a link.
    const evidence = evidenceById.get(id);
    if (!evidence || evidence.verificationStatus === "REJECTED") {
      excluded.push(id);
      continue;
    }
    if (isUsableAsFact(evidence)) supporting.push(id);
    else excluded.push(id);
  }

  const unsupported = [...claim.unsupportedAspects];
  const hasSupport = supporting.length > 0;

  if (!hasSupport && unsupported.length > 0) {
    return {
      state: "UNSUPPORTED",
      riskLevel:
        claim.riskLevel ?? RISK_BY_UNSUPPORTED_COUNT(unsupported.length),
      explanation:
        unsupported.length === 1
          ? `No supporting evidence exists for "${unsupported[0]}".`
          : `No supporting evidence exists for: ${unsupported.join(", ")}.`,
      supportingEvidenceIds: [],
      excludedEvidenceIds: excluded,
      unsupportedAspects: unsupported,
    };
  }

  if (!hasSupport) {
    return {
      state: "NEEDS_CONFIRMATION",
      riskLevel: claim.riskLevel ?? "MEDIUM",
      explanation:
        "No linked evidence. Confirm this claim before it is used as fact.",
      supportingEvidenceIds: [],
      excludedEvidenceIds: excluded,
      unsupportedAspects: unsupported,
    };
  }

  if (unsupported.length > 0) {
    return {
      state: "NEEDS_CONFIRMATION",
      riskLevel:
        claim.riskLevel ?? RISK_BY_UNSUPPORTED_COUNT(unsupported.length),
      explanation: `Partly supported. Unsupported: ${unsupported.join(", ")}.`,
      supportingEvidenceIds: supporting,
      excludedEvidenceIds: excluded,
      unsupportedAspects: unsupported,
    };
  }

  return {
    state: "SUPPORTED",
    riskLevel: "LOW",
    explanation: `Supported by ${supporting.length} verified or user-confirmed evidence record${
      supporting.length === 1 ? "" : "s"
    }.`,
    supportingEvidenceIds: supporting,
    excludedEvidenceIds: excluded,
    unsupportedAspects: [],
  };
}

export const CLAIM_STATE_COLORS: Record<
  ClaimVerificationState,
  "green" | "amber" | "red"
> = {
  SUPPORTED: "green",
  NEEDS_CONFIRMATION: "amber",
  UNSUPPORTED: "red",
  CONFLICTED: "red",
  REJECTED: "red",
};

export const CLAIM_STATE_LABELS: Record<ClaimVerificationState, string> = {
  SUPPORTED: "Supported",
  NEEDS_CONFIRMATION: "Needs confirmation",
  UNSUPPORTED: "Unsupported",
  CONFLICTED: "Conflicting",
  REJECTED: "Rejected",
};

/**
 * Deterministic term overlap between a requirement and an evidence statement.
 * No embeddings, no paid service: same behaviour for every user, auditable.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "for",
  "of",
  "in",
  "to",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "will",
  "would",
  "should",
  "can",
  "could",
  "may",
  "able",
  "you",
  "your",
  "we",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "or",
  "using",
  "use",
  "used",
  "work",
  "working",
  "years",
  "year",
  "experience",
  "strong",
  "good",
  "ability",
  "able",
  "knowledge",
  "understanding",
  "familiar",
  "excellent",
  "plus",
  "etc",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Multi-word technology names should match as a unit ("power bi"). */
const MULTIWORD_TECH = [
  "power bi",
  "power query",
  "tableau",
  "machine learning",
  "deep learning",
  "data analysis",
  "data modeling",
  "data warehouse",
  "business intelligence",
  "a/b testing",
  "unit testing",
  "project management",
  "salesforce",
  "excel",
  "sql",
  "nosql",
  "rest api",
  "rest apis",
  "node.js",
  "next.js",
  "react",
  "typescript",
  "javascript",
  "python",
  "java",
  "c++",
  "c#",
];

function expandTerms(tokens: string[]): string[] {
  const joined = ` ${tokens.join(" ")} `;
  const extra: string[] = [];
  for (const term of MULTIWORD_TECH) {
    if (joined.includes(` ${term} `)) extra.push(term);
  }
  return [...tokens, ...extra];
}

export interface TermMatch {
  score: number;
  matched: string[];
  missing: string[];
}

export function scoreTermOverlap(
  requirement: string,
  statement: string,
): TermMatch {
  const reqTokens = expandTerms(tokenize(requirement));
  const stmtTokens = new Set(expandTerms(tokenize(statement)));
  const stmtJoined = ` ${[...stmtTokens].join(" ")} `;

  const matched: string[] = [];
  const missing: string[] = [];
  for (const t of new Set(reqTokens)) {
    if (t.includes(" ") ? stmtJoined.includes(` ${t} `) : stmtTokens.has(t))
      matched.push(t);
    else missing.push(t);
  }
  const total = matched.length + missing.length;
  return {
    score: total === 0 ? 0 : matched.length / total,
    matched,
    missing,
  };
}

export function evidenceStrengthForScore(
  score: number,
  hasEvidence: boolean,
): EvidenceStrength {
  if (!hasEvidence) return "UNKNOWN";
  if (score >= 0.6) return "STRONG";
  if (score >= 0.25) return "PARTIAL";
  return "MISSING";
}

/**
 * Leadership / responsibility inflation detection.
 *
 * "Supported a five-person project team" does not license "Led a five-person
 * team". This is the canonical Part 1+2 critical-claim check.
 */
const INFLATION_RULES: Array<{
  pattern: RegExp;
  requiresEvidencePhrase: RegExp;
  label: string;
}> = [
  {
    // claimed leadership vs supporting/contributing evidence
    pattern:
      /\b(led|leading|managed|managing|directed|supervised|oversaw|owned|headed)\b/i,
    requiresEvidencePhrase:
      /\b(led|managed|owned|directed|supervised|responsible for|accountable)\b/i,
    label: "leadership",
  },
  {
    pattern:
      /\b(built|created|developed|designed|launched|implemented|delivered|owned)\b/i,
    requiresEvidencePhrase:
      /\b(built|created|developed|designed|launched|implemented|built)\b/i,
    label: "ownership",
  },
];

export interface InflationFinding {
  isInflated: boolean;
  category: string;
  claimed: string;
  requiredEvidence: string;
}

export function detectInflation(
  claimText: string,
  evidenceStatements: readonly string[],
): InflationFinding | null {
  for (const rule of INFLATION_RULES) {
    if (!rule.pattern.test(claimText)) continue;
    const anyEvidence = evidenceStatements.some((s) =>
      rule.requiresEvidencePhrase.test(s),
    );
    if (!anyEvidence) {
      const claimed = claimText.match(rule.pattern)?.[0] ?? rule.pattern.source;
      return {
        isInflated: true,
        category: rule.label,
        claimed,
        requiredEvidence: `evidence containing "${rule.requiresEvidencePhrase.source}"`,
      };
    }
  }
  return null;
}

const VERB_STRENGTH: Array<{ verb: RegExp; strength: number }> = [
  {
    verb: /\b(led|managed|owned|directed|established|founded)\b/i,
    strength: 5,
  },
  {
    verb: /\b(built|created|developed|launched|implemented|designed|introduced)\b/i,
    strength: 4,
  },
  {
    verb: /\b(ran|organized|coordinated|facilitated|executed|delivered)\b/i,
    strength: 3,
  },
  {
    verb: /\b(helped|assisted|supported|contributed|participated|worked on)\b/i,
    strength: 1,
  },
];

/**
 * "Defend this claim": compares claim language with what the user can actually
 * defend. Returns OVERSTATED when the claim is stronger than their account.
 */
export function judgeDefense(
  claimText: string,
  userAccount: string,
  evidenceStatements: readonly string[] = [],
): {
  verdict: "DEFENSIBLE" | "PARTIALLY_SUPPORTED" | "OVERSTATED";
  reason: string;
} {
  const claimStrength = Math.max(
    0,
    ...VERB_STRENGTH.filter((v) => v.verb.test(claimText)).map(
      (v) => v.strength,
    ),
  );
  const accountStrength = Math.max(
    0,
    ...VERB_STRENGTH.filter((v) => v.verb.test(userAccount)).map(
      (v) => v.strength,
    ),
  );
  const combined = [...evidenceStatements, userAccount];
  const inflation = detectInflation(claimText, combined);

  if (inflation?.isInflated && inflation.category === "leadership") {
    return {
      verdict: "OVERSTATED",
      reason: `The bullet claims leadership ("${inflation.claimed}") but your account and evidence only support supporting work.`,
    };
  }
  if (
    claimStrength >= 4 &&
    accountStrength > 0 &&
    claimStrength - accountStrength >= 2
  ) {
    return {
      verdict: "OVERSTATED",
      reason: "The bullet is stronger than what you described doing.",
    };
  }
  if (claimStrength === 0) {
    return {
      verdict: "PARTIALLY_SUPPORTED",
      reason:
        "The bullet does not say what you specifically did, so it is hard to defend.",
    };
  }
  if (claimStrength - accountStrength >= 2) {
    return {
      verdict: "PARTIALLY_SUPPORTED",
      reason: "You described a supporting role; the bullet reads as ownership.",
    };
  }
  return {
    verdict: "DEFENSIBLE",
    reason: "Your account supports the language used in the bullet.",
  };
}

const METRIC_RE =
  /(\d+(?:[.,]\d+)?)\s*(%|percent|k|m|bn|billion|million|thousand|x)?/gi;

export interface MetricMatch {
  value: number;
  unit: string | null;
  raw: string;
}

export function extractMetrics(text: string): MetricMatch[] {
  const out: MetricMatch[] = [];
  let m: RegExpExecArray | null;
  METRIC_RE.lastIndex = 0;
  while ((m = METRIC_RE.exec(text)) !== null) {
    const value = Number.parseFloat(m[1]!.replace(",", ""));
    if (Number.isFinite(value)) {
      out.push({ value, unit: m[2] ?? null, raw: m[0] });
    }
  }
  return out;
}

/**
 * A number that appears in generated text but in no evidence record is an
 * invented metric. This is the hard gate that keeps AI from fabricating results.
 */
export function findInventedMetrics(
  generatedText: string,
  evidence: readonly EvidenceRecord[],
): string[] {
  const allowed = new Set<string>();
  for (const e of evidence) {
    if (e.metricValue === null || e.metricValue === undefined) continue;
    allowed.add(String(e.metricValue));
    if (e.metricUnit) {
      const unit = e.metricUnit.toLowerCase();
      for (const m of extractMetrics(`${e.metricValue} ${e.metricUnit}`))
        allowed.add(String(m.value));
      if (unit.includes("percent") || unit === "%")
        allowed.add(`${e.metricValue}%`);
      if (unit.includes("day")) allowed.add(`${e.metricValue}/day`);
    }
  }
  const invented: string[] = [];
  for (const m of extractMetrics(generatedText)) {
    const normalized = String(m.value);
    if (!allowed.has(normalized)) invented.push(m.raw.trim());
  }
  return [...new Set(invented)];
}

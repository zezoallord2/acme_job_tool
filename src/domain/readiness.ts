import type {
  ReadinessCheckCategory,
  ReadinessStatus,
  CheckSeverity,
  ClaimVerificationState,
} from "@prisma/client";
import { extractMetrics, judgeDefense } from "./evidence";

/**
 * Ready to Apply?. This is explicitly NOT an "ATS score" — it is a
 * list of concrete blocking conditions plus a status.
 */

export interface ReadinessInput {
  unsupportedClaims: string[];
  conflictedClaims: string[];
  dateConflicts: string[];
  educationConflicts: string[];
  titleConflicts: string[];
  toolConflicts: string[];
  responsibilityInflations: string[];
  requirementsReviewed: boolean;
  requirementsTotal: number;
  isResumeTailored: boolean;
  contactComplete: boolean;
  unverifiedMetrics: string[];
  answerInconsistencies: string[];
  defenseProblems: Array<{ text: string; verdict: string }>;
}

export interface ReadinessCheckResult {
  category: ReadinessCheckCategory;
  label: string;
  status: CheckSeverity;
  blocking: boolean;
  detail: string;
  evidenceRefs: string[];
}

export interface ReadinessResult {
  status: ReadinessStatus;
  checks: ReadinessCheckResult[];
  blockingCount: number;
  warningCount: number;
  summary: string;
}

export const READINESS_CATEGORY_LABELS: Record<ReadinessCheckCategory, string> =
  {
    UNSUPPORTED_CLAIMS: "Unsupported claims",
    DATES_CONSISTENT: "Dates consistent",
    REQUIREMENTS_REVIEWED: "Requirements reviewed",
    RESUME_TAILORED: "Resume tailored",
    CONTACT_COMPLETE: "Contact information complete",
    METRICS_VERIFIED: "Metrics verified",
    ANSWERS_CONSISTENT: "Application answers consistent",
    CROSS_DOCUMENT_CONSISTENCY: "Cross-document consistency",
  };

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const checks: ReadinessCheckResult[] = [];

  const unsupportedTotal =
    input.unsupportedClaims.length + input.conflictedClaims.length;
  checks.push({
    category: "UNSUPPORTED_CLAIMS",
    label: READINESS_CATEGORY_LABELS.UNSUPPORTED_CLAIMS,
    status: input.conflictedClaims.length
      ? "BLOCKER"
      : unsupportedTotal
        ? "WARNING"
        : "INFO",
    blocking: unsupportedTotal > 0,
    detail:
      unsupportedTotal === 0
        ? "Every generated claim is backed by verified or user-confirmed evidence."
        : `${unsupportedTotal} claim${unsupportedTotal === 1 ? "" : "s"} need attention: ${[
            ...input.conflictedClaims,
            ...input.unsupportedClaims,
          ]
            .slice(0, 3)
            .join(
              "; ",
            )}${unsupportedTotal > 3 ? ` (+${unsupportedTotal - 3} more)` : ""}.`,
    evidenceRefs: [],
  });

  const crossDocIssues = [
    ...input.dateConflicts,
    ...input.educationConflicts,
    ...input.titleConflicts,
    ...input.toolConflicts,
    ...input.responsibilityInflations,
  ];
  checks.push({
    category: "CROSS_DOCUMENT_CONSISTENCY",
    label: READINESS_CATEGORY_LABELS.CROSS_DOCUMENT_CONSISTENCY,
    status: input.responsibilityInflations.length
      ? "BLOCKER"
      : crossDocIssues.length
        ? "WARNING"
        : "INFO",
    blocking: crossDocIssues.length > 0,
    detail:
      crossDocIssues.length === 0
        ? "No contradictions found between your profile, evidence, resume, letters and answers."
        : `${crossDocIssues.length} contradiction${crossDocIssues.length === 1 ? "" : "s"} found: ${crossDocIssues
            .slice(0, 3)
            .join(
              "; ",
            )}${crossDocIssues.length > 3 ? ` (+${crossDocIssues.length - 3} more)` : ""}.`,
    evidenceRefs: [],
  });

  const datesOk = input.dateConflicts.length === 0;
  checks.push({
    category: "DATES_CONSISTENT",
    label: READINESS_CATEGORY_LABELS.DATES_CONSISTENT,
    status: datesOk ? "INFO" : "BLOCKER",
    blocking: !datesOk,
    detail: datesOk
      ? "Employment and education dates are consistent."
      : `Date mismatches: ${input.dateConflicts.join("; ")}.`,
    evidenceRefs: [],
  });

  const requirementsOk =
    input.requirementsTotal === 0 || input.requirementsReviewed;
  checks.push({
    category: "REQUIREMENTS_REVIEWED",
    label: READINESS_CATEGORY_LABELS.REQUIREMENTS_REVIEWED,
    status: requirementsOk ? "INFO" : "WARNING",
    blocking: !requirementsOk,
    detail: requirementsOk
      ? `Reviewed all ${input.requirementsTotal} extracted requirement${input.requirementsTotal === 1 ? "" : "s"}.`
      : "You have not reviewed the extracted requirements for this job yet.",
    evidenceRefs: [],
  });

  checks.push({
    category: "RESUME_TAILORED",
    label: READINESS_CATEGORY_LABELS.RESUME_TAILORED,
    status: input.isResumeTailored ? "INFO" : "WARNING",
    blocking: false,
    detail: input.isResumeTailored
      ? "The resume attached to this application is a job-specific version."
      : "The attached resume is your master resume. A tailored version will read better.",
    evidenceRefs: [],
  });

  checks.push({
    category: "CONTACT_COMPLETE",
    label: READINESS_CATEGORY_LABELS.CONTACT_COMPLETE,
    status: input.contactComplete ? "INFO" : "BLOCKER",
    blocking: !input.contactComplete,
    detail: input.contactComplete
      ? "Contact details are complete."
      : "Name, email and phone are required before applying.",
    evidenceRefs: [],
  });

  const defenseBlockers = input.defenseProblems.filter(
    (d) => d.verdict === "OVERSTATED",
  );
  const metricIssues = [...input.unverifiedMetrics];
  const metricsOk = metricIssues.length === 0 && defenseBlockers.length === 0;
  checks.push({
    category: "METRICS_VERIFIED",
    label: READINESS_CATEGORY_LABELS.METRICS_VERIFIED,
    status: metricsOk ? "INFO" : "BLOCKER",
    blocking: !metricsOk,
    detail: metricsOk
      ? "All metrics in your documents trace back to evidence."
      : [
          metricIssues.length
            ? `${metricIssues.length} unverified metric(s): ${metricIssues.slice(0, 2).join(", ")}.`
            : "",
          defenseBlockers.length
            ? `${defenseBlockers.length} claim(s) you cannot defend: ${defenseBlockers
                .slice(0, 2)
                .map((d) => `"${d.text.slice(0, 48)}…"`)
                .join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
    evidenceRefs: [],
  });

  const answersOk = input.answerInconsistencies.length === 0;
  checks.push({
    category: "ANSWERS_CONSISTENT",
    label: READINESS_CATEGORY_LABELS.ANSWERS_CONSISTENT,
    status: answersOk ? "INFO" : "WARNING",
    blocking: false,
    detail: answersOk
      ? "Application answers match your resume and evidence."
      : `Inconsistencies: ${input.answerInconsistencies.slice(0, 3).join("; ")}.`,
    evidenceRefs: [],
  });

  const blockingCount = checks.filter((c) => c.blocking).length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;

  const status: ReadinessStatus =
    blockingCount > 0
      ? "NOT_READY"
      : warningCount > 0
        ? "READY_WITH_WARNINGS"
        : "READY";

  return {
    status,
    checks,
    blockingCount,
    warningCount,
    summary:
      status === "READY"
        ? "Ready to send."
        : status === "READY_WITH_WARNINGS"
          ? `Ready to send with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
          : `Not ready — ${blockingCount} blocking issue${blockingCount === 1 ? "" : "s"} to resolve.`,
  };
}

/**
 * Cross-document consistency. Deterministic comparisons between documents and
 * the user's authoritative records.
 */
export interface ConsistencyInput {
  profile: {
    jobTitles: string[];
    employers: string[];
    education: string[];
    tools: string[];
  };
  documents: Array<{
    id: string;
    type: "RESUME" | "COVER_LETTER" | "LINKEDIN" | "ANSWER" | "STAR";
    text: string;
  }>;
  evidence: Array<{
    id: string;
    statement: string;
    metricValue: number | null;
    employmentStart: Date | null;
    employmentEnd: Date | null;
    employer: string | null;
    jobTitle: string | null;
    tools: string[];
  }>;
  employmentDates: Array<{
    employer: string;
    jobTitle: string;
    startDate: Date | null;
    endDate: Date | null;
  }>;
}

export interface ConsistencyIssue {
  id: string;
  type:
    | "DATE_MISMATCH"
    | "TITLE_MISMATCH"
    | "EDUCATION_MISMATCH"
    | "METRIC_MISMATCH"
    | "TOOL_CONFLICT"
    | "LEADERSHIP_INFLATION"
    | "RESPONSIBILITY_INFLATION"
    | "CONTRADICTION";
  severity: "WARNING" | "BLOCKER";
  documentId: string | null;
  message: string;
  suggestion: string;
}

export function checkConsistency(input: ConsistencyInput): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const knownEmployers = input.profile.employers
    .map((e) => e.toLowerCase())
    .filter(Boolean);
  const knownTools = new Set(input.profile.tools.map((t) => t.toLowerCase()));
  const knownEducation = input.profile.education
    .map((e) => e.toLowerCase())
    .filter(Boolean);
  const knownMetrics = new Set(
    input.evidence
      .filter((e) => e.metricValue !== null)
      .map((e) => String(e.metricValue)),
  );

  const toolAliases: Record<string, string> = {
    "power bi": "power bi",
    powerbi: "power bi",
    "ms excel": "excel",
    excel: "excel",
    "microsoft excel": "excel",
    tableau: "tableau",
    "google analytics": "google analytics",
    sql: "sql",
    "sql server": "sql",
    postgresql: "sql",
    postgres: "sql",
    "postgre sql": "sql",
  };

  for (const doc of input.documents) {
    const text = doc.text;
    const lower = text.toLowerCase();

    // 1. Invented metrics.
    for (const m of extractMetrics(text)) {
      if (!knownMetrics.has(String(m.value))) {
        issues.push({
          id: `${doc.id}:metric:${m.raw}`,
          type: "METRIC_MISMATCH",
          severity: "BLOCKER",
          documentId: doc.id,
          message: `"${m.raw.trim()}" does not appear in any evidence record.`,
          suggestion: "Remove the number or add evidence that supports it.",
        });
      }
    }

    // 2. Unknown employers.
    for (const cand of candidateEmployers(text, input.employmentDates)) {
      if (
        !knownEmployers.some(
          (k) =>
            cand.toLowerCase().includes(k) || k.includes(cand.toLowerCase()),
        )
      ) {
        issues.push({
          id: `${doc.id}:employer:${cand}`,
          type: "CONTRADICTION",
          severity: "BLOCKER",
          documentId: doc.id,
          message: `"${cand}" is not in your employment history.`,
          suggestion:
            "Remove the employer or add the record to your career profile.",
        });
      }
    }

    // 3. Leadership inflation against evidence.
    if (/\b(led|managed|directed|supervised|owned)\b/i.test(text)) {
      const leadershipEvidence = input.evidence.filter((e) =>
        /\b(led|managed|owned|directed|supervised|responsible for|accountable)\b/i.test(
          `${e.statement} ${e.jobTitle ?? ""}`,
        ),
      );
      const hasLeadingContext =
        /\b(team|staff|group|employees|direct reports)\b/i.test(text);
      if (hasLeadingContext && leadershipEvidence.length === 0) {
        issues.push({
          id: `${doc.id}:leadership`,
          type: "LEADERSHIP_INFLATION",
          severity: "BLOCKER",
          documentId: doc.id,
          message:
            "This document claims team leadership, but no evidence records leadership responsibility.",
          suggestion:
            'Change the wording to the role you actually had (for example "supported a five-person team").',
        });
      }
    }

    // 4. Tool conflicts.
    for (const [alias, canonical] of Object.entries(toolAliases)) {
      if (lower.includes(alias) && !knownTools.has(canonical)) {
        issues.push({
          id: `${doc.id}:tool:${canonical}`,
          type: "TOOL_CONFLICT",
          severity: "WARNING",
          documentId: doc.id,
          message: `${canonical} is mentioned here but is not in your skills.`,
          suggestion: "Add it to your skills with evidence, or remove it.",
        });
      }
    }

    // 5. Education mismatch.
    if (/\b(university|college|bachelor|master|phd|degree)\b/i.test(text)) {
      const mentionsDegree = /\b(bachelor|master|phd|doctorate)\b/i.test(text);
      const profileHasDegree = knownEducation.some((e) =>
        /\b(bachelor|master|phd|doctorate|bsc|msc|ba|ma)\b/i.test(e),
      );
      if (mentionsDegree && knownEducation.length > 0 && !profileHasDegree) {
        issues.push({
          id: `${doc.id}:education`,
          type: "EDUCATION_MISMATCH",
          severity: "WARNING",
          documentId: doc.id,
          message:
            "This document mentions a degree that is not recorded in your education section.",
          suggestion: "Add the education record or remove the degree mention.",
        });
      }
    }
  }

  // 6. Title mismatch: a title stated in a document that contradicts the
  //    employment record for the same employer.
  for (const doc of input.documents) {
    const lower = doc.text.toLowerCase();
    for (const record of input.employmentDates) {
      const employerToken = record.employer.toLowerCase().split(/\s+/)[0];
      if (!employerToken || employerToken.length < 3) continue;
      if (!lower.includes(employerToken)) continue;
      const profileTitle = record.jobTitle.toLowerCase();
      if (!profileTitle) continue;
      const claimedTitle = findTitleNearEmployer(lower, employerToken);
      if (!claimedTitle) continue;
      if (
        claimedTitle !== profileTitle &&
        !titleMatches(claimedTitle, profileTitle)
      ) {
        issues.push({
          id: `${doc.id}:title:${employerToken}`,
          type: "TITLE_MISMATCH",
          severity: "WARNING",
          documentId: doc.id,
          message: `Title "${claimedTitle}" for ${record.employer} does not match your profile ("${record.jobTitle}").`,
          suggestion:
            "Use the title from your employment record so dates and history line up.",
        });
      }
    }
  }

  return dedupeIssues(issues);
}

/** Finds the capitalised phrase that follows "at <Employer>". */
function findTitleNearEmployer(
  lowerText: string,
  employerToken: string,
): string | null {
  const idx = lowerText.indexOf(employerToken);
  if (idx === -1) return null;
  const window = lowerText.slice(Math.max(0, idx - 90), idx);
  const m = window.match(/([a-z]+(?:\s+[a-z]+){0,2})\s+at\s+$/);
  return m ? m[1]!.trim() : null;
}

function titleMatches(a: string, b: string): boolean {
  const aWords = new Set(a.split(/\s+/).filter((w) => w.length > 3));
  const bWords = new Set(b.split(/\s+/).filter((w) => w.length > 3));
  if (aWords.size === 0 || bWords.size === 0) return a === b;
  for (const w of aWords) if (bWords.has(w)) return true;
  return false;
}

function candidateEmployers(
  text: string,
  records: ConsistencyInput["employmentDates"],
): string[] {
  const names = new Set<string>();
  const re = /\b(?:at|with|for)\s+([A-Z][A-Za-z0-9&.\- ]{2,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = m[1]!.trim();
    if (
      records.some((r) =>
        r.employer.toLowerCase().startsWith(value.toLowerCase()),
      )
    )
      continue;
    if (value.length < 3) continue;
    names.add(value);
  }
  return [...names].slice(0, 5);
}

function dedupeIssues(issues: readonly ConsistencyIssue[]): ConsistencyIssue[] {
  const seen = new Map<string, ConsistencyIssue>();
  for (const issue of issues) {
    const existing = seen.get(issue.id);
    if (
      !existing ||
      (existing.severity !== "BLOCKER" && issue.severity === "BLOCKER")
    ) {
      seen.set(issue.id, issue);
    }
  }
  return [...seen.values()];
}

export function collectReadinessInput(params: {
  claims: Array<{
    text: string;
    state: ClaimVerificationState;
    explanation?: string | null;
  }>;
  consistencyIssues: readonly ConsistencyIssue[];
  requirementsReviewed: boolean;
  requirementsTotal: number;
  isResumeTailored: boolean;
  contactComplete: boolean;
  unverifiedMetrics: readonly string[];
  defenseProblems: ReadonlyArray<{ text: string; verdict: string }>;
}): ReadinessInput {
  return {
    // REJECTED means the user removed the claim, so it must not block.
    unsupportedClaims: params.claims
      .filter((c) => c.state === "UNSUPPORTED" || c.state === "REJECTED")
      .map((c) => c.text),
    conflictedClaims: params.claims
      .filter((c) => c.state === "CONFLICTED")
      .map((c) => c.text),
    dateConflicts: params.consistencyIssues
      .filter((i) => i.type === "DATE_MISMATCH")
      .map((i) => i.message),
    educationConflicts: params.consistencyIssues
      .filter((i) => i.type === "EDUCATION_MISMATCH")
      .map((i) => i.message),
    titleConflicts: params.consistencyIssues
      .filter((i) => i.type === "TITLE_MISMATCH")
      .map((i) => i.message),
    toolConflicts: params.consistencyIssues
      .filter((i) => i.type === "TOOL_CONFLICT")
      .map((i) => i.message),
    responsibilityInflations: params.consistencyIssues
      .filter(
        (i) =>
          i.type === "LEADERSHIP_INFLATION" ||
          i.type === "RESPONSIBILITY_INFLATION",
      )
      .map((i) => i.message),
    requirementsReviewed: params.requirementsReviewed,
    requirementsTotal: params.requirementsTotal,
    isResumeTailored: params.isResumeTailored,
    contactComplete: params.contactComplete,
    unverifiedMetrics: [...params.unverifiedMetrics],
    answerInconsistencies: params.consistencyIssues
      .filter((i) => i.type === "CONTRADICTION" && i.documentId)
      .map((i) => i.message),
    defenseProblems: [...params.defenseProblems],
  };
}

export { judgeDefense };

import { z } from "zod";
import { OUTPUT_SCHEMAS } from "./schemas";
import type { WorkflowId } from "./workflow-ids";

/**
 * Deterministic JSON extraction + local repair.
 *
 * Pasted AI output arrives as markdown fences, prose preambles, trailing commas
 * and smart quotes. Repair is attempted locally and conservatively: if the text
 * cannot be recovered deterministically we say exactly what is wrong instead of
 * guessing.
 */

export interface ParseAttempt {
  ok: boolean;
  value?: unknown;
  method:
    | "direct"
    | "fenced"
    | "brace-scan"
    | "trailing-comma-fix"
    | "smart-quote-fix"
    | "failed";
  problems: string[];
  repaired: boolean;
}

export function extractJson(rawText: string): ParseAttempt {
  const problems: string[] = [];
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      ok: false,
      method: "failed",
      problems: ["The response was empty."],
      repaired: false,
    };
  }

  // 1. Direct parse.
  const direct = tryParse(trimmed);
  if (direct.ok)
    return {
      ok: true,
      value: direct.value,
      method: "direct",
      problems,
      repaired: false,
    };

  // 2. Fenced block.
  const fenced = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    const parsed = tryParse(inner);
    if (parsed.ok)
      return {
        ok: true,
        value: parsed.value,
        method: "fenced",
        problems,
        repaired: true,
      };
    problems.push("A fenced block was found but its JSON was invalid.");
  }

  // 3. Brace scan — first balanced JSON object in the text.
  const candidate = scanBalancedObject(trimmed);
  if (candidate) {
    const parsed = tryParse(candidate);
    if (parsed.ok) {
      return {
        ok: true,
        value: parsed.value,
        method: "brace-scan",
        problems,
        repaired: true,
      };
    }
    // 4. Repairs, in order: trailing commas, then smart quotes.
    const noTrailing = candidate.replace(/,\s*([}\]])/g, "$1");
    if (noTrailing !== candidate) {
      const parsed2 = tryParse(noTrailing);
      if (parsed2.ok) {
        return {
          ok: true,
          value: parsed2.value,
          method: "trailing-comma-fix",
          problems,
          repaired: true,
        };
      }
      problems.push(
        "Trailing commas were removed but the JSON is still invalid.",
      );
    }
    const deSmart = noTrailing.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    if (deSmart !== noTrailing) {
      const parsed3 = tryParse(deSmart);
      if (parsed3.ok) {
        return {
          ok: true,
          value: parsed3.value,
          method: "smart-quote-fix",
          problems,
          repaired: true,
        };
      }
      problems.push(
        "Smart quotes were normalised but the JSON is still invalid.",
      );
    }
  } else {
    problems.push("No JSON object could be located in the response.");
  }

  problems.push("Expected a single JSON object matching the requested schema.");
  return { ok: false, method: "failed", problems, repaired: false };
}

function tryParse(text: string): { ok: boolean; value?: unknown } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Scans for the first `{` and returns its balanced, string-aware object. */
function scanBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Keys that must literally be present in the pasted response.
 *
 * Schema defaults make every field optional, which would otherwise let a
 * completely wrong response (for example `{"totally":"wrong"}`) validate as an
 * empty analysis and leave the user with a blank job breakdown. Presence is
 * therefore checked separately from shape.
 */
const REQUIRED_KEYS: Partial<Record<WorkflowId, string[]>> = {
  JOB_ANALYSIS: ["role", "mustHaveRequirements", "responsibilities"],
  EVIDENCE_EXTRACTION: ["statements"],
  RESUME_BULLET: ["suggestion"],
  RESUME_TAILORING: ["summary", "bullets"],
  COVER_LETTER: ["body"],
  LINKEDIN_OPTIMIZER: ["headline", "about"],
  APPLICATION_ANSWER: ["answer"],
  STAR_STORY: ["situation", "task", "action", "result"],
  INTERVIEW_QUESTION: ["questions"],
  INTERVIEW_FEEDBACK: [
    "relevance",
    "specificity",
    "evidence",
    "structure",
    "clarity",
  ],
  POST_INTERVIEW_REVIEW: ["summary"],
  FOLLOW_UP: ["body"],
  CAREER_NARRATIVE: ["narrativeText"],
  VOICE_PROFILE: ["isDirect", "isConcise"],
  ACHIEVEMENT_INTERVIEW: ["nextQuestion"],
  ASK_ACME: ["answer"],
  DEFEND_CLAIM: ["verdict", "reason"],
};

export function missingRequiredKeys(
  workflowId: WorkflowId,
  value: unknown,
): string[] {
  const required = REQUIRED_KEYS[workflowId] ?? [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return required;
  }
  const record = value as Record<string, unknown>;
  return required.filter((key) => !(key in record));
}

export interface ValidationSuccess<T> {
  ok: true;
  data: T;
  warnings: string[];
  parse: ParseAttempt;
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
  parse: ParseAttempt;
}

export function validateWorkflowOutput<T>(
  workflowId: WorkflowId,
  rawText: string,
): ValidationSuccess<T> | ValidationFailure {
  const parse = extractJson(rawText);
  if (!parse.ok) {
    return { ok: false, errors: parse.problems, parse };
  }
  const missing = missingRequiredKeys(workflowId, parse.value);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        `The response is missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
        "Nothing was changed. Ask the assistant again with the same prompt and paste the complete JSON object.",
      ],
      parse,
    };
  }

  const schema = OUTPUT_SCHEMAS[workflowId] as unknown as z.ZodType<T>;
  const result = schema.safeParse(parse.value);
  if (!result.success) {
    const errors = result.error.issues.slice(0, 12).map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return { ok: false, errors, parse };
  }
  return {
    ok: true,
    data: result.data,
    warnings: parse.repaired
      ? ["Pasted response needed local repair before validation."]
      : [],
    parse,
  };
}

/**
 * Safety pass applied after schema validation: strips banned phrasing and
 * reports anything that must be surfaced to the user rather than hidden.
 */
const BANNED_PHRASES = [
  "results-driven",
  "dynamic professional",
  "passionate about",
  "synergy",
  "leveraged",
  "detail-oriented team player",
  "proven track record of success",
  "go-getter",
];

export interface SafetyReport {
  bannedPhrasesFound: string[];
  hedges: string[];
}

export function safetyScan(text: string): SafetyReport {
  const lower = text.toLowerCase();
  const bannedPhrasesFound = BANNED_PHRASES.filter((p) => lower.includes(p));
  const hedges = [
    {
      pattern: /\b(guarantee[ds]?|will definitely|100% sure|certain to)\b/i,
      label: "over-confident claim",
    },
    {
      pattern:
        /\b(best[- ]in[- ]class|world[- ]class|industry[- ]leading|revolutionary)\b/i,
      label: "unsubstantiated superlative",
    },
  ]
    .filter((h) => h.pattern.test(text))
    .map((h) => h.label);
  return { bannedPhrasesFound, hedges };
}

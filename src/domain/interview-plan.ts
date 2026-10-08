import { extractMetrics } from "@/domain/evidence";
import type { InterviewMode } from "@prisma/client";

/**
 * Mock interview rules. Pure and deterministic.
 *
 * Standard (8) = 1 opener, 3 behavioural (STAR), 2 role-specific/technical,
 * 1 gap/risk question aimed at a requirement with no evidence, 1 closer.
 * Quick (5) and Deep (12) scale the same mix.
 */

export type InterviewDepth = "QUICK" | "STANDARD" | "DEEP";
export type QuestionSlot = "OPENER" | "BEHAVIOURAL" | "ROLE" | "GAP" | "CLOSER";

export const DEPTHS: Record<
  InterviewDepth,
  { label: string; count: number; mix: Record<QuestionSlot, number> }
> = {
  QUICK: {
    label: "Quick",
    count: 5,
    mix: { OPENER: 1, BEHAVIOURAL: 1, ROLE: 1, GAP: 1, CLOSER: 1 },
  },
  STANDARD: {
    label: "Standard",
    count: 8,
    mix: { OPENER: 1, BEHAVIOURAL: 3, ROLE: 2, GAP: 1, CLOSER: 1 },
  },
  DEEP: {
    label: "Deep",
    count: 12,
    mix: { OPENER: 1, BEHAVIOURAL: 5, ROLE: 3, GAP: 2, CLOSER: 1 },
  },
};

export const SLOT_LABEL: Record<QuestionSlot, string> = {
  OPENER: "Opener",
  BEHAVIOURAL: "Behavioural (STAR)",
  ROLE: "Role-specific",
  GAP: "Gap / risk",
  CLOSER: "Closer",
};

/** Suggested speaking time, shown as a hint next to the timer. */
export const SLOT_SECONDS: Record<QuestionSlot, number> = {
  OPENER: 90,
  BEHAVIOURAL: 120,
  ROLE: 120,
  GAP: 90,
  CLOSER: 60,
};

export const SLOT_CATEGORY: Record<QuestionSlot, InterviewMode> = {
  OPENER: "GENERAL",
  BEHAVIOURAL: "BEHAVIORAL",
  ROLE: "ROLE_SPECIFIC",
  GAP: "RESUME_BASED",
  CLOSER: "GENERAL",
};

export interface PlanSlot {
  slot: QuestionSlot;
  /** For GAP slots: the requirement with no evidence. */
  requirement: string | null;
}

/** The ordered list of slots the AI must fill. */
export function buildQuestionPlan(
  depth: InterviewDepth,
  missingRequirements: readonly string[],
): PlanSlot[] {
  const { mix } = DEPTHS[depth];
  const plan: PlanSlot[] = [];
  const push = (slot: QuestionSlot, n: number) => {
    for (let i = 0; i < n; i += 1) plan.push({ slot, requirement: null });
  };
  push("OPENER", mix.OPENER);
  // Interleave behavioural and role questions the way real interviews flow.
  const behavioural = mix.BEHAVIOURAL;
  const role = mix.ROLE;
  for (let i = 0; i < Math.max(behavioural, role); i += 1) {
    if (i < behavioural) push("BEHAVIOURAL", 1);
    if (i < role) push("ROLE", 1);
  }
  for (let i = 0; i < mix.GAP; i += 1) {
    const requirement = missingRequirements[i] ?? null;
    // With no identified gap, probe the weakest area instead of skipping.
    plan.push({ slot: requirement ? "GAP" : "ROLE", requirement });
  }
  push("CLOSER", mix.CLOSER);
  return plan;
}

export function describePlan(plan: readonly PlanSlot[]): string[] {
  return plan.map(
    (p, i) =>
      `${i + 1}. ${p.slot}${p.requirement ? ` — requirement with no evidence: ${p.requirement}` : ""}`,
  );
}

const FALLBACK: Record<"OPENER" | "CLOSER", (role: string) => string> = {
  OPENER: (role) =>
    `Tell me about yourself and what draws you to this ${role} role.`,
  CLOSER: () => "Do you have any questions for us?",
};

/**
 * Lines the model's questions up against the plan. Missing opener/closer get
 * a standard wording; extra questions are dropped; order follows the plan.
 */
export function alignToPlan<
  Q extends { question: string; slot?: QuestionSlot | null },
>(
  plan: readonly PlanSlot[],
  questions: readonly Q[],
  role: string,
): Array<{
  slot: QuestionSlot;
  requirement: string | null;
  question: Q | null;
  text: string;
}> {
  const pool = [...questions];
  const take = (slot: QuestionSlot): Q | null => {
    let idx = pool.findIndex((q) => q.slot === slot);
    if (idx === -1) idx = pool.findIndex((q) => !q.slot);
    if (idx === -1 && slot !== "OPENER" && slot !== "CLOSER") idx = 0;
    if (idx === -1 || !pool[idx]) return null;
    return pool.splice(idx, 1)[0] ?? null;
  };
  return plan
    .map((p) => {
      const q = take(p.slot);
      if (q) return { ...p, question: q, text: q.question };
      if (p.slot === "OPENER" || p.slot === "CLOSER") {
        return { ...p, question: null, text: FALLBACK[p.slot](role) };
      }
      return { ...p, question: null, text: "" };
    })
    .filter((row) => row.text.trim().length > 0);
}

/**
 * The "stronger answer" may only use facts the user already gave. Sentences
 * containing a number that appears in neither the user's answer nor their
 * evidence are removed, and reported.
 */
export function guardStrongerAnswer(
  suggestion: string,
  allowedText: string,
): { text: string; removed: string[] } {
  const allowed = new Set(extractMetrics(allowedText).map((m) => m.value));
  const sentences = suggestion.match(/[^.!?]+[.!?]*/g) ?? [];
  const kept: string[] = [];
  const removed: string[] = [];
  for (const sentence of sentences) {
    const invented = extractMetrics(sentence).some(
      (m) => !allowed.has(m.value),
    );
    if (invented) removed.push(sentence.trim());
    else kept.push(sentence);
  }
  return { text: kept.join("").trim(), removed };
}

export interface AnswerScore {
  question: string;
  relevance: number | null;
  specificity: number | null;
  evidence: number | null;
  structure: number | null;
  strength: string | null;
  improvement: string | null;
}

/** Top strengths from the best answers, top fixes from the weakest. */
export function summarizeSession(answers: readonly AnswerScore[]): {
  average: number | null;
  strengths: string[];
  fixes: string[];
} {
  const scored = answers
    .map((a) => {
      const parts = [
        a.relevance,
        a.specificity,
        a.evidence,
        a.structure,
      ].filter((n): n is number => typeof n === "number");
      return {
        a,
        score: parts.length
          ? parts.reduce((x, y) => x + y, 0) / parts.length
          : null,
      };
    })
    .filter((row) => row.score !== null) as Array<{
    a: AnswerScore;
    score: number;
  }>;
  const unique = (items: Array<string | null>) => [
    ...new Set(items.filter((s): s is string => Boolean(s && s.trim()))),
  ];

  const best = [...scored].sort((x, y) => y.score - x.score);
  const worst = [...scored].sort((x, y) => x.score - y.score);
  return {
    average: scored.length
      ? Math.round(
          (scored.reduce((t, r) => t + r.score, 0) / scored.length) * 10,
        ) / 10
      : null,
    strengths: unique(best.map((r) => r.a.strength)).slice(0, 3),
    fixes: unique(worst.map((r) => r.a.improvement)).slice(0, 3),
  };
}

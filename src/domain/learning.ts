import type {
  LearningEventType,
  LearningSourceType,
  ConfidenceCategory,
} from "@prisma/client";
import { shortHash } from "@/lib/crypto";

/**
 * Learning events are raw observations. They never mutate career facts; the
 * only path from inference to fact is explicit user confirmation.
 *
 * Dedupe is deterministic: the same observation about the same subject collapses
 * into one row with a rising occurrence count.
 */
export const LEARNING_EVENT_TYPES: readonly LearningEventType[] = [
  "NEW_EVIDENCE_DISCOVERED",
  "INTERVIEW_GAP_DISCOVERED",
  "STRONG_STORY_IDENTIFIED",
  "REPEATED_REJECTION_PATTERN",
  "POSITIVE_RESPONSE_PATTERN",
  "MISSING_SKILL_PATTERN",
  "USER_FEEDBACK",
  "WORKFLOW_FAILURE",
  "OUTCOME_RECORDED",
  "USER_PREFERENCE_SIGNAL",
];

export interface LearningObservation {
  userId: string;
  eventType: LearningEventType;
  sourceType: LearningSourceType;
  sourceId?: string | null;
  observation: string;
  supportingData?: Record<string, unknown>;
  /** Stable identity of the *subject* of the observation. */
  subjectKey: string;
  confidenceCategory?: ConfidenceCategory;
}

export function dedupeKeyFor(o: LearningObservation): string {
  return `${o.eventType}:${shortHash(o.subjectKey, 24)}`;
}

export interface LearningRule {
  eventType: LearningEventType;
  /** Minimum repeated observations before a pattern claim is made. */
  minObservations: number;
  confidence: ConfidenceCategory;
}

/**
 * Minimum sample sizes prevent over-interpreting a single rejection or a single
 * reply. One data point is an anecdote, not a pattern.
 */
export const LEARNING_RULES: Record<LearningEventType, LearningRule> = {
  NEW_EVIDENCE_DISCOVERED: {
    eventType: "NEW_EVIDENCE_DISCOVERED",
    minObservations: 1,
    confidence: "LOW",
  },
  INTERVIEW_GAP_DISCOVERED: {
    eventType: "INTERVIEW_GAP_DISCOVERED",
    minObservations: 1,
    confidence: "LOW",
  },
  STRONG_STORY_IDENTIFIED: {
    eventType: "STRONG_STORY_IDENTIFIED",
    minObservations: 1,
    confidence: "MEDIUM",
  },
  REPEATED_REJECTION_PATTERN: {
    eventType: "REPEATED_REJECTION_PATTERN",
    minObservations: 3,
    confidence: "LOW",
  },
  POSITIVE_RESPONSE_PATTERN: {
    eventType: "POSITIVE_RESPONSE_PATTERN",
    minObservations: 3,
    confidence: "LOW",
  },
  MISSING_SKILL_PATTERN: {
    eventType: "MISSING_SKILL_PATTERN",
    minObservations: 3,
    confidence: "LOW",
  },
  USER_FEEDBACK: {
    eventType: "USER_FEEDBACK",
    minObservations: 1,
    confidence: "MEDIUM",
  },
  WORKFLOW_FAILURE: {
    eventType: "WORKFLOW_FAILURE",
    minObservations: 1,
    confidence: "HIGH",
  },
  OUTCOME_RECORDED: {
    eventType: "OUTCOME_RECORDED",
    minObservations: 1,
    confidence: "HIGH",
  },
  USER_PREFERENCE_SIGNAL: {
    eventType: "USER_PREFERENCE_SIGNAL",
    minObservations: 1,
    confidence: "MEDIUM",
  },
};

export function confidenceForOccurrences(
  eventType: LearningEventType,
  occurrences: number,
): ConfidenceCategory {
  if (eventType === "WORKFLOW_FAILURE" || eventType === "OUTCOME_RECORDED")
    return "HIGH";
  if (occurrences >= 5) return "MEDIUM";
  if (occurrences >= LEARNING_RULES[eventType].minObservations) return "LOW";
  return "UNKNOWN";
}

export function isPatternMature(
  eventType: LearningEventType,
  occurrences: number,
): boolean {
  return occurrences >= LEARNING_RULES[eventType].minObservations;
}

/**
 * Interview → career learning.
 *
 * "They asked about training new employees" + existing evidence "Helped onboard
 * two employees" produces a *proposal*, never an automatic evidence record.
 */
export interface EvidenceProposalSuggestion {
  proposedStatement: string;
  claimType:
    | "ACHIEVEMENT"
    | "RESPONSIBILITY"
    | "SKILL"
    | "METRIC"
    | "TOOL"
    | "LEADERSHIP";
  sourceType: "INTERVIEW_RECALL";
  sourceDescription: string;
  confidence: ConfidenceCategory;
  relatedEvidenceIds: string[];
  rationale: string;
  requiresConfirmation: true;
}

const ONBOARDING_PATTERNS = [
  /\btrain(?:ed|ing)?\b/i,
  /\bonboard(?:ed|ing)?\b/i,
  /\bmentor(?:ed|ing)?\b/i,
  /\bnew (?:employees|hires|joiners|staff|joiners)\b/i,
];

export function suggestEvidenceFromInterviewNote(
  note: string,
): EvidenceProposalSuggestion[] {
  const suggestions: EvidenceProposalSuggestion[] = [];
  if (ONBOARDING_PATTERNS.some((p) => p.test(note))) {
    suggestions.push({
      proposedStatement: "Trained or onboarded new team members.",
      claimType: "ACHIEVEMENT",
      sourceType: "INTERVIEW_RECALL",
      sourceDescription: `Recalled during interview review: "${note.slice(0, 180)}"`,
      confidence: "LOW",
      relatedEvidenceIds: [],
      rationale:
        "You described experience that may belong in your career evidence but is not yet recorded. Add the number of people and the timeframe you remember.",
      requiresConfirmation: true,
    });
  }
  if (
    /\b(metrics?|revenue|growth|reduced|saved|cost)\b/i.test(note) &&
    !/\d/.test(note)
  ) {
    suggestions.push({
      proposedStatement:
        "Describe the measurable outcome you mentioned in this interview.",
      claimType: "METRIC",
      sourceType: "INTERVIEW_RECALL",
      sourceDescription: `Recalled during interview review: "${note.slice(0, 180)}"`,
      confidence: "LOW",
      relatedEvidenceIds: [],
      rationale:
        "You described an outcome without a number. Acme Jobs will not invent one — tell us the figure you can defend.",
      requiresConfirmation: true,
    });
  }
  return suggestions;
}

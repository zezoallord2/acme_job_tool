import type { ApplicationStatus } from "@prisma/client";

/**
 * Application lifecycle. Transitions are validated before persistence, and an
 * invalid transition must fail atomically (no partial update, no history entry).
 */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "SAVED",
  "ANALYZING",
  "READY_TO_APPLY",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
] as const;

/** States from which no further movement is allowed. */
export const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
] as const;

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SAVED: ["ANALYZING", "READY_TO_APPLY", "ARCHIVED", "WITHDRAWN"],
  ANALYZING: ["READY_TO_APPLY", "SAVED", "ARCHIVED", "WITHDRAWN"],
  READY_TO_APPLY: ["APPLIED", "ANALYZING", "SAVED", "ARCHIVED", "WITHDRAWN"],
  APPLIED: [
    "SCREENING",
    "INTERVIEW",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    "OFFER",
  ],
  SCREENING: [
    "INTERVIEW",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    "FINAL_INTERVIEW",
  ],
  INTERVIEW: ["FINAL_INTERVIEW", "REJECTED", "WITHDRAWN", "ARCHIVED", "OFFER"],
  FINAL_INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  OFFER: ["ARCHIVED", "REJECTED", "WITHDRAWN"],
  REJECTED: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
  ARCHIVED: [],
};

export interface TransitionDecision {
  allowed: boolean;
  from: ApplicationStatus;
  to: ApplicationStatus;
  reason?: string;
  /** Whether the transition should freeze an immutable sent snapshot. */
  sealsSnapshot?: boolean;
}

export function allowedTransitions(
  from: ApplicationStatus,
): readonly ApplicationStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * `SAVED -> OFFER` is the canonical invalid transition: it skips analysis and
 * submission. The guard is explicit so the failure reason is useful, not vague.
 */
export function evaluateTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  opts?: { requiresSnapshot?: boolean; hasSnapshot?: boolean },
): TransitionDecision {
  if (from === to) {
    return {
      allowed: false,
      from,
      to,
      reason: "Application is already in that state.",
    };
  }
  if (
    TERMINAL_STATUSES.includes(from) &&
    !allowedTransitions(from).includes(to)
  ) {
    return {
      allowed: false,
      from,
      to,
      reason: `An application in ${from} cannot move to ${to}.`,
    };
  }
  if (!canTransition(from, to)) {
    return {
      allowed: false,
      from,
      to,
      reason: `An application cannot move directly from ${from} to ${to}.`,
    };
  }
  if (
    (to === "APPLIED" || to === "SCREENING" || to === "INTERVIEW") &&
    opts?.requiresSnapshot === true
  ) {
    if (!opts.hasSnapshot) {
      return {
        allowed: false,
        from,
        to,
        reason:
          "A sent snapshot must be stored before this application can move forward.",
      };
    }
  }
  return {
    allowed: true,
    from,
    to,
    sealsSnapshot: to === "APPLIED",
  };
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  ANALYZING: "Analyzing",
  READY_TO_APPLY: "Ready to apply",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

export const STATUS_GROUPS = {
  active: [
    "SAVED",
    "ANALYZING",
    "READY_TO_APPLY",
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "FINAL_INTERVIEW",
  ],
  needsAction: ["SAVED", "READY_TO_APPLY", "APPLIED", "SCREENING"],
  interviews: ["INTERVIEW", "FINAL_INTERVIEW"],
  offers: ["OFFER"],
  closed: ["REJECTED", "WITHDRAWN", "ARCHIVED"],
} as const satisfies Record<string, readonly ApplicationStatus[]>;

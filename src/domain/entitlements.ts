import type { EntitlementPlan } from "@prisma/client";

/**
 * Single source of truth for product tiers. UI never calls `isPaid` directly —
 * it asks the EntitlementService, so the boundary lives in one place.
 */

export type Capability =
  | "CAREER_SNAPSHOT"
  | "CAREER_MASTER_PROFILE"
  | "EVIDENCE_LEDGER_BASIC"
  | "EVIDENCE_LEDGER_FULL"
  | "ACHIEVEMENT_MINING"
  | "TARGET_ROLE_BLUEPRINT"
  | "JOB_ANALYZER_BASIC"
  | "JOB_ANALYZER_DEEP"
  | "EVIDENCE_MATRIX_BASIC"
  | "EVIDENCE_MATRIX_FULL"
  | "FIT_RECOMMENDATION"
  | "EFFORT_VS_OPPORTUNITY"
  | "RESUME_QUICK_CHECK"
  | "MASTER_RESUME"
  | "RESUME_VERSIONS"
  | "RESUME_TAILORING_BASIC"
  | "RESUME_TAILORING_ADVANCED"
  | "RESUME_BULLET_BUILDER"
  | "CLAIM_INSPECTOR"
  | "CONSISTENCY_ENGINE"
  | "READINESS_GATE"
  | "COVER_LETTER_BUILDER"
  | "LINKEDIN_OPTIMIZER"
  | "APPLICATION_QUESTION_BUILDER"
  | "VOICE_PROFILE"
  | "CAREER_NARRATIVE"
  | "STAR_BANK_BASIC"
  | "STAR_BANK_FULL"
  | "MOCK_INTERVIEW_BASIC"
  | "MOCK_INTERVIEW_ADVANCED"
  | "DEFEND_THIS_CLAIM"
  | "INTERVIEW_COMMAND_CENTER"
  | "POST_INTERVIEW_REVIEW"
  | "FOLLOW_UP_BUILDER"
  | "APPLICATION_CAPSULE"
  | "IMMUTABLE_SENT_VERSIONS"
  | "APPLICATION_TRACKER"
  | "ANALYTICS"
  | "CAREER_LEARNING"
  | "DAILY_PRIORITY_ENGINE"
  | "ASK_ACME"
  | "SPRINT_14_DAY"
  | "COMPLETE_BOOK"
  | "FREE_GUIDE";

export const FREE_CAPABILITIES: readonly Capability[] = [
  "CAREER_SNAPSHOT",
  "EVIDENCE_LEDGER_BASIC",
  "RESUME_QUICK_CHECK",
  "JOB_ANALYZER_BASIC",
  "EVIDENCE_MATRIX_BASIC",
  "RESUME_TAILORING_BASIC",
  "STAR_BANK_BASIC",
  "MOCK_INTERVIEW_BASIC",
  "FREE_GUIDE",
  "ASK_ACME",
];

export const COMPLETE_CAPABILITIES: readonly Capability[] = [
  ...FREE_CAPABILITIES,
  "CAREER_MASTER_PROFILE",
  "EVIDENCE_LEDGER_FULL",
  "ACHIEVEMENT_MINING",
  "TARGET_ROLE_BLUEPRINT",
  "JOB_ANALYZER_DEEP",
  "EVIDENCE_MATRIX_FULL",
  "FIT_RECOMMENDATION",
  "EFFORT_VS_OPPORTUNITY",
  "MASTER_RESUME",
  "RESUME_VERSIONS",
  "RESUME_TAILORING_ADVANCED",
  "RESUME_BULLET_BUILDER",
  "CLAIM_INSPECTOR",
  "CONSISTENCY_ENGINE",
  "READINESS_GATE",
  "COVER_LETTER_BUILDER",
  "LINKEDIN_OPTIMIZER",
  "APPLICATION_QUESTION_BUILDER",
  "VOICE_PROFILE",
  "CAREER_NARRATIVE",
  "STAR_BANK_FULL",
  "MOCK_INTERVIEW_ADVANCED",
  "DEFEND_THIS_CLAIM",
  "INTERVIEW_COMMAND_CENTER",
  "POST_INTERVIEW_REVIEW",
  "FOLLOW_UP_BUILDER",
  "APPLICATION_CAPSULE",
  "IMMUTABLE_SENT_VERSIONS",
  "APPLICATION_TRACKER",
  "ANALYTICS",
  "CAREER_LEARNING",
  "DAILY_PRIORITY_ENGINE",
  "SPRINT_14_DAY",
  "COMPLETE_BOOK",
];

export const CAPABILITIES_BY_PLAN: Record<
  EntitlementPlan,
  readonly Capability[]
> = {
  FREE: FREE_CAPABILITIES,
  COMPLETE: COMPLETE_CAPABILITIES,
};

export function planHasCapability(
  plan: EntitlementPlan,
  capability: Capability,
): boolean {
  return CAPABILITIES_BY_PLAN[plan].includes(capability);
}

/** Hard numeric limits enforced server-side, not just hidden in the UI. */
export interface PlanLimits {
  starStories: number;
  mockInterviewQuestions: number;
  aiAssistCallsPerDay: number;
  savedApplications: number;
  resumeVersions: number;
  // Job search results are no longer limited by plan: every match is shown.
  // Cost is controlled by the daily fresh-search cap (src/lib/usage-caps.ts).
}

export const PLAN_LIMITS: Record<EntitlementPlan, PlanLimits> = {
  FREE: {
    starStories: 1,
    mockInterviewQuestions: 5,
    aiAssistCallsPerDay: 20,
    savedApplications: 3,
    resumeVersions: 1,
  },
  COMPLETE: {
    starStories: Number.POSITIVE_INFINITY,
    mockInterviewQuestions: Number.POSITIVE_INFINITY,
    aiAssistCallsPerDay: Number.POSITIVE_INFINITY,
    savedApplications: Number.POSITIVE_INFINITY,
    resumeVersions: Number.POSITIVE_INFINITY,
  },
};

export interface PricingTier {
  id: EntitlementPlan;
  name: string;
  positioning: string;
  launchPriceUsd: number;
  regularPriceUsd: number;
  features: string[];
}

export const PRICING: PricingTier[] = [
  {
    id: "FREE",
    name: "Starter",
    positioning: "Understand + Try",
    launchPriceUsd: 0,
    regularPriceUsd: 0,
    features: [
      "Quick Profile",
      "Basic experience history",
      "Resume Quick Check",
      "Basic Job Check",
      "Basic Match Breakdown",
      "Basic resume tailoring",
      "One STAR story",
      "Five-question Practice Interview",
      "30-minute guided workflow",
      "Free Starter Guide",
      "Limited Acme Assistant",
    ],
  },
  {
    id: "COMPLETE",
    name: "AI Job Hunter — Complete Edition",
    positioning: "Build + Execute + Repeat",
    launchPriceUsd: 9.99,
    regularPriceUsd: 14.99,
    features: [
      "Full My Profile",
      "Full My Experience + Find My Wins",
      "Job Goals",
      "Deep Job Analyzer + full Match Breakdown",
      "Should I Apply? recommendation",
      "Best Jobs comparison",
      "My Resume + multiple versions",
      "Advanced tailoring + Improve Bullet",
      "Truth Check",
      "Consistency Check",
      "Ready to Apply?",
      "Cover Letter + LinkedIn",
      "Application Answers",
      "Writing Style + Career Story",
      "Full Interview Stories",
      "Advanced Mock Interviews + Can I Defend This?",
      "Interview Prep + Interview Review",
      "Follow-Up Message",
      "Application Details + Immutable Sent Versions",
      "My Applications + Analytics",
      "Career Learning Review",
      "Today's Tasks",
      "Acme Assistant",
      "14-Day Plan",
      "Complete Edition PDF access",
    ],
  },
];

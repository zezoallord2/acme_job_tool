/** Canonical workflow + prompt identity. Version bumps are deliberate releases. */
export const WORKFLOW_IDS = [
  "JOB_ANALYSIS",
  "EVIDENCE_EXTRACTION",
  "RESUME_TAILORING",
  "RESUME_BULLET",
  "COVER_LETTER",
  "LINKEDIN_OPTIMIZER",
  "APPLICATION_ANSWER",
  "STAR_STORY",
  "INTERVIEW_QUESTION",
  "INTERVIEW_FEEDBACK",
  "POST_INTERVIEW_REVIEW",
  "FOLLOW_UP",
  "CAREER_NARRATIVE",
  "VOICE_PROFILE",
  "ACHIEVEMENT_INTERVIEW",
  "ASK_ACME",
  "DEFEND_CLAIM",
  // Reads a user-supplied CV and returns a structured profile. Extraction only:
  // the model may report what the document says and nothing more.
  "PROFILE_IMPORT",
  // Job search agent: plan diverse queries from the profile, then re-rank the
  // merged results against it. Neither writes anything about the user.
  "JOB_SEARCH_PLAN",
  "JOB_RERANK",
] as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[number];

/**
 * Prompt versions. A version is only ever promoted through the release process;
 * a candidate that measures worse cannot become active by accident.
 */
export const PROMPT_VERSIONS: Record<
  WorkflowId,
  { active: string; candidates: string[]; retired: string[] }
> = {
  JOB_ANALYSIS: {
    active: "JOB_ANALYSIS_PROMPT_v4",
    candidates: ["JOB_ANALYSIS_PROMPT_v5"],
    retired: ["v1", "v2", "v3"],
  },
  EVIDENCE_EXTRACTION: {
    active: "EVIDENCE_EXTRACTION_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  RESUME_TAILORING: {
    active: "RESUME_TAILORING_PROMPT_v7",
    candidates: [],
    retired: ["v1", "v2", "v3", "v4", "v5", "v6"],
  },
  RESUME_BULLET: {
    active: "RESUME_BULLET_PROMPT_v7",
    candidates: ["RESUME_BULLET_PROMPT_v8"],
    retired: ["v1", "v2", "v3", "v4", "v5", "v6"],
  },
  COVER_LETTER: {
    active: "COVER_LETTER_PROMPT_v5",
    candidates: [],
    retired: ["v1", "v2", "v3", "v4"],
  },
  LINKEDIN_OPTIMIZER: {
    active: "LINKEDIN_OPTIMIZER_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  APPLICATION_ANSWER: {
    active: "APPLICATION_ANSWER_PROMPT_v4",
    candidates: [],
    retired: ["v1", "v2", "v3"],
  },
  STAR_STORY: {
    active: "STAR_STORY_PROMPT_v4",
    candidates: [],
    retired: ["v1", "v2", "v3"],
  },
  INTERVIEW_QUESTION: {
    active: "INTERVIEW_QUESTION_PROMPT_v6",
    candidates: [],
    retired: ["v1", "v2", "v3", "v4", "v5"],
  },
  INTERVIEW_FEEDBACK: {
    active: "INTERVIEW_FEEDBACK_PROMPT_v5",
    candidates: [],
    retired: ["v1", "v2", "v3", "v4"],
  },
  POST_INTERVIEW_REVIEW: {
    active: "POST_INTERVIEW_REVIEW_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  FOLLOW_UP: {
    active: "FOLLOW_UP_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  CAREER_NARRATIVE: {
    active: "CAREER_NARRATIVE_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  VOICE_PROFILE: {
    active: "VOICE_PROFILE_PROMPT_v2",
    candidates: [],
    retired: ["v1"],
  },
  ACHIEVEMENT_INTERVIEW: {
    active: "ACHIEVEMENT_INTERVIEW_PROMPT_v3",
    candidates: [],
    retired: ["v1", "v2"],
  },
  ASK_ACME: { active: "ASK_ACME_PROMPT_v2", candidates: [], retired: ["v1"] },
  DEFEND_CLAIM: {
    active: "DEFEND_CLAIM_PROMPT_v2",
    candidates: [],
    retired: ["v1"],
  },
  PROFILE_IMPORT: {
    active: "PROFILE_IMPORT_v1",
    candidates: [],
    retired: [],
  },
  JOB_SEARCH_PLAN: {
    active: "JOB_SEARCH_PLAN_v1",
    candidates: [],
    retired: [],
  },
  JOB_RERANK: {
    active: "JOB_RERANK_v1",
    candidates: [],
    retired: [],
  },
};

export const VALIDATOR_VERSION = "VALIDATOR_v3";
export const EVALUATION_VERSION = "AI_EVAL_v2";
export const RANKER_VERSION = "OPPORTUNITY_RANKER_v2";

export function activePromptVersion(workflowId: WorkflowId): string {
  return PROMPT_VERSIONS[workflowId].active;
}

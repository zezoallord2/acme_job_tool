import { z } from "zod";

/**
 * Output schemas. AI text is never trusted: it is parsed into one of these,
 * then domain-validated against the user's evidence, then consistency-checked,
 * then safety-checked. Only then can it reach the user.
 */

const strArray = (max = 50) =>
  z.array(z.string().trim().min(1)).max(max).default([]);

export const JobAnalysisSchema = z.object({
  role: z.string().trim().max(200).default(""),
  company: z.string().trim().max(200).default(""),
  seniority: z.string().trim().max(80).default(""),
  summary: z.string().trim().max(2000).default(""),
  mustHaveRequirements: strArray(40),
  preferredRequirements: strArray(40),
  responsibilities: strArray(40),
  hardSkills: strArray(40),
  softSkills: strArray(30),
  tools: strArray(30),
  educationRequirements: strArray(10),
  certificationRequirements: strArray(20),
  experienceRequirement: z.string().trim().max(300).default(""),
  repeatedThemes: strArray(20),
  importantLanguage: strArray(30),
  dealBreakers: strArray(20),
  needsInput: strArray(20),
});

export const EvidenceExtractionSchema = z.object({
  statements: z
    .array(
      z.object({
        statement: z.string().trim().min(3).max(600),
        claimType: z.enum([
          "SKILL",
          "TOOL",
          "ACHIEVEMENT",
          "RESPONSIBILITY",
          "LEADERSHIP",
          "METRIC",
          "SOFT_SKILL",
        ]),
        metricValue: z.number().finite().nullable().default(null),
        metricUnit: z.string().trim().max(40).nullable().default(null),
        tags: strArray(15),
      }),
    )
    .max(40),
  needsInput: strArray(20),
});

export const ResumeBulletSchema = z.object({
  suggestion: z.string().trim().min(5).max(800),
  usedEvidenceIds: z.array(z.number().int().nonnegative()).max(40).default([]),
  unsupportedAspects: strArray(20),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  explanation: z.string().trim().max(600).default(""),
});

export const ResumeTailoringSchema = z.object({
  summary: z.string().trim().max(2000).default(""),
  prioritizedSkills: strArray(40),
  experienceOrder: z.array(z.number().int()).max(40).default([]),
  bullets: z
    .array(
      z.object({
        section: z.enum(["SUMMARY", "EXPERIENCE", "PROJECT", "SKILLS"]),
        text: z.string().trim().min(5).max(1000),
        evidenceIds: z
          .array(z.number().int().nonnegative())
          .max(40)
          .default([]),
        unsupportedAspects: strArray(20),
      }),
    )
    .max(60),
  droppedPoints: z
    .array(z.object({ text: z.string().max(400), reason: z.string().max(300) }))
    .max(30)
    .default([]),
  needsInput: strArray(20),
});

export const CoverLetterSchema = z.object({
  subject: z.string().trim().max(200).default(""),
  body: z.string().trim().min(20).max(6000),
  usedEvidenceIds: z.array(z.number().int().nonnegative()).max(40).default([]),
  unsupportedCompanyClaims: strArray(20),
  needsInput: strArray(20),
});

export const LinkedInSchema = z.object({
  headline: z.object({
    current: z.string().max(300).default(""),
    suggested: z.string().max(300).default(""),
    why: z.string().max(400).default(""),
  }),
  about: z.object({
    current: z.string().max(4000).default(""),
    suggested: z.string().max(4000).default(""),
    why: z.string().max(400).default(""),
  }),
  experience: z
    .array(
      z.object({
        id: z.string().max(80),
        suggested: z.string().max(2000),
        why: z.string().max(400),
      }),
    )
    .max(20)
    .default([]),
  skillsToFeature: z
    .array(
      z.object({
        skill: z.string().max(120),
        why: z.string().max(400),
        evidenceIds: z
          .array(z.number().int().nonnegative())
          .max(20)
          .default([]),
      }),
    )
    .max(30)
    .default([]),
  unsupportedAspects: strArray(20),
});

export const ApplicationAnswerSchema = z.object({
  answer: z.string().trim().min(10).max(4000),
  usedEvidenceIds: z.array(z.number().int().nonnegative()).max(40).default([]),
  unsupportedAspects: strArray(20),
  needsInput: strArray(20),
});

export const StarStorySchema = z.object({
  title: z.string().trim().min(3).max(200),
  situation: z.string().trim().min(3).max(2000),
  task: z.string().trim().min(3).max(2000),
  action: z.string().trim().min(3).max(2000),
  result: z.string().trim().min(3).max(2000),
  learning: z.string().max(1000).default(""),
  usedEvidenceIds: z.array(z.number().int().nonnegative()).max(40).default([]),
  unsupportedAspects: strArray(20),
  needsInput: strArray(20),
});

export const InterviewQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(8).max(600),
        category: z.enum([
          "GENERAL",
          "BEHAVIORAL",
          "ROLE_SPECIFIC",
          "TECHNICAL",
          "RESUME_BASED",
          "GRADUATE",
          "CAREER_CHANGE",
          "MANAGERIAL",
        ]),
        rationale: z.string().max(600).default(""),
        expectedSignals: strArray(10),
      }),
    )
    .min(1)
    .max(30),
});

export const InterviewFeedbackSchema = z.object({
  relevance: z.number().min(0).max(5),
  specificity: z.number().min(0).max(5),
  evidence: z.number().min(0).max(5),
  structure: z.number().min(0).max(5),
  clarity: z.number().min(0).max(5),
  wasVague: z.boolean().default(false),
  unsupportedClaims: strArray(20),
  followUpQuestion: z.string().max(600).nullable().default(null),
  coachNote: z.string().max(1200).default(""),
});

export const PostInterviewReviewSchema = z.object({
  summary: z.string().max(3000).default(""),
  strengths: strArray(15),
  weaknesses: strArray(15),
  questionsAsked: strArray(30),
  surprises: strArray(15),
  recalledEvidence: strArray(15),
  evidenceSuggestions: z
    .array(
      z.object({
        statement: z.string().max(400),
        why: z.string().max(400),
        askFor: strArray(6),
      }),
    )
    .max(15)
    .default([]),
  followUpRecommended: z.boolean().default(false),
});

export const FollowUpSchema = z.object({
  subject: z.string().max(300).default(""),
  body: z.string().trim().min(10).max(4000),
  mentionsEvidenceIds: z
    .array(z.number().int().nonnegative())
    .max(20)
    .default([]),
});

export const CareerNarrativeSchema = z.object({
  title: z.string().max(200).default(""),
  originPoint: z.string().max(600).default(""),
  bridgeSteps: strArray(12),
  destinationRole: z.string().max(200).default(""),
  targetIndustry: z.string().max(200).default(""),
  coreTheme: z.string().max(400).default(""),
  narrativeText: z.string().max(4000).default(""),
  usedEvidenceIds: z.array(z.number().int().nonnegative()).max(40).default([]),
  unsupportedAspects: strArray(20),
});

export const VoiceProfileSchema = z.object({
  isDirect: z.boolean().default(false),
  isConcise: z.boolean().default(false),
  isFormal: z.boolean().default(false),
  isConversational: z.boolean().default(false),
  isTechnical: z.boolean().default(false),
  isSimple: z.boolean().default(false),
  avgSentenceLength: z.number().min(0).max(200).default(0),
  bannedPhrases: strArray(40),
  preferredPhrases: strArray(40),
  notes: z.string().max(1000).default(""),
});

export const AchievementInterviewSchema = z.object({
  nextQuestion: z.string().trim().min(3).max(600),
  questionType: z.enum([
    "WHAT_DID_YOU_DO",
    "PROBLEM",
    "TOOLS",
    "PEOPLE",
    "RESULT",
    "QUANTIFY",
    "FREQUENCY",
    "SCALE",
    "DONE",
  ]),
  missingFields: strArray(12),
  factsLearned: z
    .array(
      z.object({
        statement: z.string().min(3).max(600),
        claimType: z.string().max(40),
        metricValue: z.number().finite().nullable().default(null),
        metricUnit: z.string().max(40).nullable().default(null),
      }),
    )
    .max(15)
    .default([]),
});

export const AskAcmeSchema = z.object({
  answer: z.string().min(1).max(4000),
  citations: z
    .array(
      z.object({
        kind: z.string().max(60),
        id: z.string().max(80),
        label: z.string().max(300),
      }),
    )
    .max(20)
    .default([]),
  dataGaps: strArray(15),
  suggestedActions: z
    .array(z.object({ label: z.string().max(120), href: z.string().max(300) }))
    .max(8)
    .default([]),
});

export const DefendClaimSchema = z.object({
  verdict: z.enum(["DEFENSIBLE", "PARTIALLY_SUPPORTED", "OVERSTATED"]),
  reason: z.string().min(3).max(1200),
  whatHappened: z.string().max(1200).default(""),
  whatYouDid: z.string().max(1200).default(""),
  whatWasTheResult: z.string().max(1200).default(""),
  suggestedHonestWording: z.string().max(600).default(""),
});

export type JobAnalysisOutput = z.infer<typeof JobAnalysisSchema>;
export type EvidenceExtractionOutput = z.infer<typeof EvidenceExtractionSchema>;
export type ResumeBulletOutput = z.infer<typeof ResumeBulletSchema>;
export type ResumeTailoringOutput = z.infer<typeof ResumeTailoringSchema>;
export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>;
export type LinkedInOutput = z.infer<typeof LinkedInSchema>;
export type ApplicationAnswerOutput = z.infer<typeof ApplicationAnswerSchema>;
export type StarStoryOutput = z.infer<typeof StarStorySchema>;
export type InterviewQuestionsOutput = z.infer<typeof InterviewQuestionsSchema>;
export type InterviewFeedbackOutput = z.infer<typeof InterviewFeedbackSchema>;
export type PostInterviewReviewOutput = z.infer<
  typeof PostInterviewReviewSchema
>;
export type FollowUpOutput = z.infer<typeof FollowUpSchema>;
export type CareerNarrativeOutput = z.infer<typeof CareerNarrativeSchema>;
export type VoiceProfileOutput = z.infer<typeof VoiceProfileSchema>;
export type AchievementInterviewOutput = z.infer<
  typeof AchievementInterviewSchema
>;
export type AskAcmeOutput = z.infer<typeof AskAcmeSchema>;
export type DefendClaimOutput = z.infer<typeof DefendClaimSchema>;

export const OUTPUT_SCHEMAS = {
  JOB_ANALYSIS: JobAnalysisSchema,
  EVIDENCE_EXTRACTION: EvidenceExtractionSchema,
  RESUME_BULLET: ResumeBulletSchema,
  RESUME_TAILORING: ResumeTailoringSchema,
  COVER_LETTER: CoverLetterSchema,
  LINKEDIN_OPTIMIZER: LinkedInSchema,
  APPLICATION_ANSWER: ApplicationAnswerSchema,
  STAR_STORY: StarStorySchema,
  INTERVIEW_QUESTION: InterviewQuestionsSchema,
  INTERVIEW_FEEDBACK: InterviewFeedbackSchema,
  POST_INTERVIEW_REVIEW: PostInterviewReviewSchema,
  FOLLOW_UP: FollowUpSchema,
  CAREER_NARRATIVE: CareerNarrativeSchema,
  VOICE_PROFILE: VoiceProfileSchema,
  ACHIEVEMENT_INTERVIEW: AchievementInterviewSchema,
  ASK_ACME: AskAcmeSchema,
  DEFEND_CLAIM: DefendClaimSchema,
} as const;

import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { evidenceRecords } from "@/services/evidence-service";
import { recordLearningEvent } from "@/services/learning-service";
import { startMockSession, addQuestion } from "@/services/interview-service";
import type {
  AchievementInterviewOutput,
  DefendClaimOutput,
  EvidenceExtractionOutput,
  InterviewFeedbackOutput,
  InterviewQuestionsOutput,
} from "@/ai/schemas";
import type {
  ClaimType,
  EvidenceSourceType,
  LearningSourceType,
} from "@prisma/client";

/**
 * Coaching workflows.
 *
 * Every function here runs a workflow that already has a prompt, a schema, a
 * validator and a version. This module is the part that was missing: it gives
 * each one a real entry point and a persistence rule.
 *
 * The persistence rule is the same everywhere: AI output becomes a PROPOSAL,
 * never a fact. Nothing reaches the Evidence Ledger until the user accepts it on
 * the Learning page.
 *
 * Manual Mode is the only path these run through. `raw` is the pasted response,
 * which is validated by exactly the same pipeline a provider response would be.
 */

export const CLAIM_TYPES = new Set<string>([
  "SKILL",
  "TOOL",
  "ACHIEVEMENT",
  "RESPONSIBILITY",
  "LEADERSHIP",
  "METRIC",
  "SOFT_SKILL",
  "EDUCATION",
  "CERTIFICATION",
  "EMPLOYMENT",
  "DATE",
]);

/** Maps the AI's free-text claim type onto the ledger's closed enum. */
export function toClaimType(value: string): ClaimType {
  const upper = String(value ?? "")
    .trim()
    .toUpperCase();
  return (CLAIM_TYPES.has(upper) ? upper : "RESPONSIBILITY") as ClaimType;
}

async function aiKey(userId: string) {
  return getUserApiKeyForWorkflow(userId);
}

/**
 * Learning events and ledger evidence use different source vocabularies. Map
 * deliberately rather than casting, so a proposal always records where it came
 * from in the ledger's own terms.
 */
function toEvidenceSourceType(source: LearningSourceType): EvidenceSourceType {
  switch (source) {
    case "INTERVIEW_REVIEW":
      return "INTERVIEW_RECALL";
    case "USER_FEEDBACK":
      return "USER_STATEMENT";
    case "APPLICATION_OUTCOME":
      return "OTHER";
    default:
      return "OTHER";
  }
}

/**
 * Turns extracted statements into pending proposals.
 *
 * Each proposal carries a learning event so the origin stays auditable, and each
 * is deduplicated against statements already in the ledger or already proposed.
 */
async function proposeStatements(
  userId: string,
  statements: Array<{
    statement: string;
    claimType: string;
    metricValue: number | null;
    metricUnit: string | null;
  }>,
  opts: {
    eventType: "NEW_EVIDENCE_DISCOVERED" | "INTERVIEW_GAP_DISCOVERED";
    sourceType: LearningSourceType;
    sourceDescription: string;
  },
): Promise<string[]> {
  const created: string[] = [];

  for (const s of statements) {
    const statement = String(s.statement ?? "").trim();
    if (statement.length < 5) continue;

    // Never propose something the ledger already holds.
    const existingEvidence = await prisma.evidence.findFirst({
      where: {
        userId,
        statement: { equals: statement, mode: "insensitive" },
        verificationStatus: { notIn: ["REJECTED"] },
      },
      select: { id: true },
    });
    if (existingEvidence) continue;

    const event = await recordLearningEvent({
      userId,
      eventType: opts.eventType,
      sourceType: opts.sourceType,
      sourceId: null,
      observation: statement,
      subjectKey: statement.toLowerCase().slice(0, 200),
      supportingData: {
        metricValue: s.metricValue ?? null,
        metricUnit: s.metricUnit ?? null,
      },
      confidenceCategory: "LOW",
    });

    const alreadyProposed = await prisma.evidenceProposal.findFirst({
      where: {
        userId,
        learningEventId: event.id,
        proposedStatement: statement,
      },
      select: { id: true },
    });
    if (alreadyProposed) continue;

    const proposal = await prisma.evidenceProposal.create({
      data: {
        userId,
        learningEventId: event.id,
        proposedStatement: statement,
        claimType: toClaimType(s.claimType),
        sourceType: toEvidenceSourceType(opts.sourceType),
        sourceDescription: opts.sourceDescription,
        metricValue: s.metricValue ?? null,
        metricUnit: s.metricUnit ?? null,
        // Inferred content always starts low-confidence until a human confirms it.
        confidence: "LOW",
      },
    });
    created.push(proposal.id);
  }

  return created;
}

// ---------------------------------------------------------------------------
// EVIDENCE_EXTRACTION
// ---------------------------------------------------------------------------

/** The prompt context is built in one place so the prompt and the submit match. */
export async function buildExtractionContext(
  userId: string,
  narrative: string,
): Promise<Record<string, unknown>> {
  const text = narrative.trim();
  if (text.length < 40) {
    throw Errors.validation(
      "Describe the work in a bit more detail so there is something to extract.",
    );
  }
  return { narrative: text };
}

export interface ExtractedEvidence {
  statements: EvidenceExtractionOutput["statements"];
  needsInput: string[];
  proposalIds: string[];
}

export async function extractEvidenceFromNarrative(
  userId: string,
  narrative: string,
  raw: string,
): Promise<ExtractedEvidence> {
  const context = await buildExtractionContext(userId, narrative);

  const outcome = await runWorkflow<EvidenceExtractionOutput>({
    userId,
    workflowId: "EVIDENCE_EXTRACTION",
    context,
    evidence: await evidenceRecords(userId),
    userApiKey: await aiKey(userId),
    preferManual: true,
    manualInput: raw,
  });

  if (!outcome.ok) throw new CoachingFailure(outcome);

  const proposalIds = await proposeStatements(userId, outcome.data.statements, {
    eventType: "NEW_EVIDENCE_DISCOVERED",
    sourceType: "USER_FEEDBACK",
    sourceDescription: "Extracted from a description the user wrote",
  });

  return {
    statements: outcome.data.statements,
    needsInput: outcome.data.needsInput,
    proposalIds,
  };
}

// ---------------------------------------------------------------------------
// ACHIEVEMENT_INTERVIEW
// ---------------------------------------------------------------------------

export interface AchievementTurn {
  nextQuestion: string;
  questionType: AchievementInterviewOutput["questionType"];
  missingFields: string[];
  factsLearned: AchievementInterviewOutput["factsLearned"];
}

export function buildAchievementContext(input: {
  known: Record<string, unknown>;
  questionCount: number;
}): Record<string, unknown> {
  return { known: input.known, questionCount: input.questionCount };
}

/** Asks ONE question at a time. Never writes the bullet for the user. */
export async function nextAchievementQuestion(
  userId: string,
  input: { known: Record<string, unknown>; questionCount: number },
  raw: string,
): Promise<AchievementTurn> {
  const outcome = await runWorkflow<AchievementInterviewOutput>({
    userId,
    workflowId: "ACHIEVEMENT_INTERVIEW",
    context: buildAchievementContext(input),
    evidence: await evidenceRecords(userId),
    userApiKey: await aiKey(userId),
    preferManual: true,
    manualInput: raw,
  });

  if (!outcome.ok) throw new CoachingFailure(outcome);

  return {
    nextQuestion: outcome.data.nextQuestion,
    questionType: outcome.data.questionType,
    missingFields: outcome.data.missingFields,
    factsLearned: outcome.data.factsLearned,
  };
}

/** Files what the interview uncovered as proposals. Never as facts. */
export async function finishAchievementMining(
  userId: string,
  facts: Array<{
    statement: string;
    claimType: string;
    metricValue?: number | null;
    metricUnit?: string | null;
  }>,
): Promise<{ proposalIds: string[]; skipped: number }> {
  const usable = facts.filter(
    (f) => String(f.statement ?? "").trim().length >= 5,
  );
  const proposalIds = await proposeStatements(
    userId,
    usable.map((f) => ({
      statement: f.statement,
      claimType: f.claimType,
      metricValue: f.metricValue ?? null,
      metricUnit: f.metricUnit ?? null,
    })),
    {
      eventType: "NEW_EVIDENCE_DISCOVERED",
      sourceType: "INTERVIEW_REVIEW",
      sourceDescription: "Recalled during an achievement interview",
    },
  );
  return { proposalIds, skipped: facts.length - usable.length };
}

// ---------------------------------------------------------------------------
// DEFEND_CLAIM
// ---------------------------------------------------------------------------

export interface ClaimDefense extends DefendClaimOutput {
  /** Warnings raised by the invented-metric check, if any. */
  warnings: string[];
}

/**
 * The prompt builder renders `evidence` through `evidenceBlock`, which requires
 * a real array of records. Passing a placeholder string here crashed every
 * Claim Defense run, so the ledger is loaded properly instead.
 */
export async function buildDefenseContext(
  userId: string,
  input: {
    claim: string;
    userAccount?: string | null;
  },
): Promise<Record<string, unknown>> {
  const claim = input.claim.trim();
  if (claim.length < 10) {
    throw Errors.validation("Paste the exact claim you want to defend.");
  }
  return {
    claim,
    userAccount: input.userAccount ?? "not provided",
    evidence: await evidenceRecords(userId),
  };
}

/**
 * Honest classification. The suggested wording is offered for the user to accept
 * or discard; nothing is rewritten into their ledger automatically.
 */
export async function defendClaim(
  userId: string,
  input: { claim: string; userAccount?: string | null },
  raw: string,
): Promise<ClaimDefense> {
  const context = await buildDefenseContext(userId, input);

  const outcome = await runWorkflow<DefendClaimOutput>({
    userId,
    workflowId: "DEFEND_CLAIM",
    context,
    evidence: await evidenceRecords(userId),
    userApiKey: await aiKey(userId),
    preferManual: true,
    manualInput: raw,
  });

  if (!outcome.ok) throw new CoachingFailure(outcome);

  return { ...outcome.data, warnings: outcome.warnings };
}

// ---------------------------------------------------------------------------
// INTERVIEW_QUESTION
// ---------------------------------------------------------------------------

export type QuestionCategory =
  InterviewQuestionsOutput["questions"][number]["category"];

export interface PreparedQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  rationale: string;
  expectedSignals: string[];
}

export interface QuestionSet {
  sessionId: string;
  questions: PreparedQuestion[];
}

export interface QuestionPrepInput {
  mode: QuestionCategory;
  role: string;
  applicationId?: string | null;
  difficulty?: string;
  count: number;
}

/** Loads what an interviewer would actually see, from the user's own records. */
export async function buildQuestionContext(
  userId: string,
  input: QuestionPrepInput,
): Promise<Record<string, unknown>> {
  const application = input.applicationId
    ? await prisma.application.findFirst({
        where: { id: input.applicationId, userId },
        include: {
          job: { include: { analysis: { include: { requirements: true } } } },
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    : null;

  if (input.applicationId && !application) {
    throw Errors.notFound("Application");
  }

  const job = application?.job ?? null;

  const requirements =
    job?.analysis?.requirements.map((r) => ({
      text: r.text,
      isMustHave: r.isMustHave,
    })) ?? [];

  const sentResume = application?.snapshots[0]?.resumeContent ?? null;
  const role = input.role.trim() || job?.title || "not specified";

  const evidence = await evidenceRecords(userId);
  const strongestEvidence = evidence
    .filter((e) => e.verificationStatus === "VERIFIED")
    .slice(0, 12);

  return {
    mode: input.mode,
    role,
    jobRequirements: requirements,
    sentResume,
    strongestEvidence,
    difficulty: input.difficulty ?? "medium",
    count: input.count,
    previousQuestions: [],
  };
}

export async function generateInterviewQuestions(
  userId: string,
  input: QuestionPrepInput,
  raw: string,
): Promise<QuestionSet> {
  const context = await buildQuestionContext(userId, input);
  const role = String(context.role ?? "not specified");

  const outcome = await runWorkflow<InterviewQuestionsOutput>({
    userId,
    workflowId: "INTERVIEW_QUESTION",
    context,
    evidence: await evidenceRecords(userId),
    userApiKey: await aiKey(userId),
    preferManual: true,
    manualInput: raw,
  });

  if (!outcome.ok) throw new CoachingFailure(outcome);

  const questions = outcome.data.questions.slice(0, input.count);

  // Persisted onto a session so practised answers are recorded against it.
  const session = await startMockSession(userId, {
    mode: "GENERAL",
    targetRole: role,
    questionLimit: questions.length,
  });

  const saved: PreparedQuestion[] = [];
  for (const q of questions) {
    const row = await addQuestion({
      sessionId: session.id,
      question: q.question,
      category: q.category,
      rationale: q.rationale,
      expectedSignals: q.expectedSignals,
    });
    saved.push({
      id: row.id,
      question: q.question,
      category: q.category,
      rationale: q.rationale,
      expectedSignals: q.expectedSignals,
    });
  }

  return { sessionId: session.id, questions: saved };
}

// ---------------------------------------------------------------------------
// INTERVIEW_FEEDBACK
// ---------------------------------------------------------------------------

export interface AnswerCoach extends InterviewFeedbackOutput {
  warnings: string[];
}

export function buildCoachContext(input: {
  question: string;
  answer: string;
  jobRequirements?: string[];
  sentResume?: string | null;
  evidence: unknown[];
}): Record<string, unknown> {
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (question.length < 8) {
    throw Errors.validation("Add the question you were asked.");
  }
  if (answer.length < 20) {
    throw Errors.validation(
      "Paste the answer you gave, or write what you would say.",
    );
  }
  return {
    question,
    answer,
    jobRequirements: input.jobRequirements ?? [],
    sentResume: input.sentResume ?? "(none)",
    evidence: input.evidence,
  };
}

/** Five criteria plus at most one useful follow-up question. */
export async function coachInterviewAnswer(
  userId: string,
  input: {
    question: string;
    answer: string;
    jobRequirements?: string[];
    sentResume?: string | null;
  },
  raw: string,
): Promise<AnswerCoach> {
  const context = buildCoachContext({
    ...input,
    evidence: await evidenceRecords(userId),
  });

  const outcome = await runWorkflow<InterviewFeedbackOutput>({
    userId,
    workflowId: "INTERVIEW_FEEDBACK",
    context,
    evidence: await evidenceRecords(userId),
    userApiKey: await aiKey(userId),
    preferManual: true,
    manualInput: raw,
  });

  if (!outcome.ok) throw new CoachingFailure(outcome);

  return { ...outcome.data, warnings: outcome.warnings };
}

// ---------------------------------------------------------------------------
// Shared failure carrier
// ---------------------------------------------------------------------------

/**
 * Carries a workflow failure out of the service so the action layer can render
 * the Manual Mode prompt that arrived with it instead of discarding it.
 */
export class CoachingFailure extends Error {
  readonly userMessage: string;
  readonly errors: string[];
  readonly prompt: unknown;
  readonly code: string;

  constructor(outcome: {
    userMessage: string;
    errors: string[];
    manualFallback: unknown;
    code: string;
  }) {
    super(outcome.userMessage);
    this.name = "CoachingFailure";
    this.userMessage = outcome.userMessage;
    this.errors = outcome.errors;
    this.prompt = outcome.manualFallback;
    this.code = outcome.code;
  }
}

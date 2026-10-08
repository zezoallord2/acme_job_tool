import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { providerLabel } from "@/ai/router";
import { evidenceRecords } from "@/services/evidence-service";
import {
  ensureMasterResume,
  RESUME_CONTENT_SCHEMA,
} from "@/services/resume-service";
import {
  addQuestion,
  recordAnswer,
  startMockSession,
} from "@/services/interview-service";
import {
  alignToPlan,
  buildQuestionPlan,
  DEPTHS,
  describePlan,
  guardStrongerAnswer,
  SLOT_CATEGORY,
  SLOT_LABEL,
  SLOT_SECONDS,
  summarizeSession,
  type InterviewDepth,
  type QuestionSlot,
} from "@/domain/interview-plan";
import type {
  InterviewFeedbackOutput,
  InterviewQuestionsOutput,
} from "@/ai/schemas";
import type { ManualPromptPackage } from "@/ai/providers/manual";

/**
 * AI mock interview.
 *
 *   pick a job (or a target role) + Quick / Standard / Deep
 *   -> INTERVIEW_QUESTION builds the question set from the job description,
 *      the resume and the requirements the evidence does not cover yet
 *   -> one question at a time; INTERVIEW_FEEDBACK scores each answer and writes
 *      one improvement and a stronger answer from the user's own evidence
 *   -> summary: top 3 strengths, top 3 fixes.
 */

export interface MockQuestionView {
  id: string;
  question: string;
  slot: QuestionSlot;
  slotLabel: string;
  seconds: number;
  rationale: string;
}

export interface MockFeedbackView {
  relevance: number;
  specificity: number;
  evidence: number;
  structure: number;
  strength: string;
  improvement: string;
  strongerAnswer: string;
  followUpQuestion: string | null;
  unsupportedClaims: string[];
  warnings: string[];
  generatedBy: string;
}

export class InterviewFailure extends Error {
  readonly code: string;
  readonly prompt: ManualPromptPackage | null;
  readonly errors: string[];
  constructor(outcome: {
    userMessage: string;
    code: string;
    manualFallback: ManualPromptPackage | null;
    errors: string[];
  }) {
    super(outcome.userMessage);
    this.name = "InterviewFailure";
    this.code = outcome.code;
    this.prompt = outcome.manualFallback;
    this.errors = outcome.errors;
  }
}

interface InterviewContext {
  role: string;
  jobDescription: string;
  requirements: string[];
  missing: string[];
  resume: unknown;
  evidence: Awaited<ReturnType<typeof evidenceRecords>>;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 3);
}

async function loadContext(
  userId: string,
  input: { applicationId?: string | null; targetRole?: string | null },
): Promise<InterviewContext> {
  const evidence = await evidenceRecords(userId);
  const master = await ensureMasterResume(userId);
  const masterVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId: master.id },
    orderBy: { version: "desc" },
    select: { content: true },
  });
  let resume: unknown = RESUME_CONTENT_SCHEMA.parse(
    masterVersion?.content ?? {},
  );

  if (!input.applicationId) {
    const role = input.targetRole?.trim();
    if (!role) {
      throw Errors.validation(
        "Pick a saved job or type the role you are interviewing for.",
      );
    }
    return {
      role,
      jobDescription: "",
      requirements: [],
      missing: [],
      resume,
      evidence,
    };
  }

  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, userId },
    include: {
      job: { include: { analysis: { include: { requirements: true } } } },
      matrix: { include: { matches: { include: { requirement: true } } } },
      snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!application?.job) throw Errors.notFound("Application");
  // Interviewers see what was sent, when something was sent.
  if (application.snapshots[0]?.resumeContent) {
    resume = application.snapshots[0].resumeContent;
  }

  let requirements = (application.job.analysis?.requirements ?? []).map(
    (r) => r.text,
  );
  if (requirements.length === 0) {
    // Job not analysed yet: take the requirement-like sentences from the
    // posting itself so GAP questions still target something real.
    requirements = application.job.rawDescription
      .split(/(?<=[.!?])\s+|\n+/)
      .map((line) => line.replace(/^[-•*\s]+/, "").trim())
      .filter(
        (line) =>
          line.length > 12 &&
          line.length < 300 &&
          /require|must|experience (in|with)|\d\+?\s*years|certif|proficien|knowledge of|familiar/i.test(
            line,
          ),
      )
      .slice(0, 12);
  }
  let missing = (application.matrix?.matches ?? [])
    .filter((m) => m.strength === "MISSING")
    .map((m) => m.requirement.text);
  if (missing.length === 0 && requirements.length) {
    // No match breakdown yet: a requirement whose key words appear nowhere in
    // the resume or evidence is treated as a gap worth probing.
    const corpus = new Set(
      words(
        `${JSON.stringify(resume)} ${evidence.map((e) => e.statement).join(" ")}`,
      ),
    );
    missing = requirements.filter((r) => {
      const w = words(r);
      return (
        w.length > 0 && w.filter((x) => corpus.has(x)).length / w.length < 0.34
      );
    });
  }

  return {
    role: input.targetRole?.trim() || application.job.title || "this role",
    jobDescription: application.job.rawDescription,
    requirements,
    missing: missing.slice(0, 6),
    resume,
    evidence,
  };
}

function promptEvidence(evidence: InterviewContext["evidence"]) {
  return evidence.map((e) => ({
    statement: e.statement,
    source: e.sourceDescription || e.sourceType,
    status: e.verificationStatus,
    metric:
      e.metricValue !== null
        ? `${e.metricValue}${e.metricUnit ? ` ${e.metricUnit}` : ""}`
        : undefined,
  }));
}

export async function startAiInterview(
  userId: string,
  input: {
    applicationId?: string | null;
    targetRole?: string | null;
    depth: InterviewDepth;
    manualInput?: string | null;
    manualPrompt?: boolean;
  },
): Promise<{
  sessionId: string;
  questions: MockQuestionView[];
  generatedBy: string;
}> {
  const depth = DEPTHS[input.depth] ? input.depth : "STANDARD";
  const ctx = await loadContext(userId, input);
  const plan = buildQuestionPlan(depth, ctx.missing);
  const pasted = input.manualInput?.trim() || undefined;

  const outcome = await runWorkflow<InterviewQuestionsOutput>({
    userId,
    workflowId: "INTERVIEW_QUESTION",
    context: {
      mode: "MOCK_INTERVIEW",
      role: ctx.role,
      jobDescription: ctx.jobDescription,
      jobRequirements: ctx.requirements,
      missingRequirements: ctx.missing,
      sentResume: ctx.resume,
      strongestEvidence: promptEvidence(
        ctx.evidence
          .filter((e) => e.verificationStatus !== "CONFLICTED")
          .slice(0, 15),
      ),
      difficulty: depth === "DEEP" ? "hard" : "medium",
      count: plan.length,
      plan: describePlan(plan),
      previousQuestions: [],
    },
    evidence: ctx.evidence,
    userApiKey: await getUserApiKeyForWorkflow(userId),
    preferManual: Boolean(pasted) || input.manualPrompt === true,
    manualInput: pasted,
  });
  if (!outcome.ok) throw new InterviewFailure(outcome);

  const aligned = alignToPlan(plan, outcome.data.questions, ctx.role);
  const session = await startMockSession(userId, {
    mode: "GENERAL",
    targetRole: ctx.role,
    questionLimit: aligned.length,
  });
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      interactionId: outcome.interactionId,
      promptVersion: outcome.promptVersion,
      workflowId: "INTERVIEW_QUESTION",
    },
  });

  const questions: MockQuestionView[] = [];
  for (const row of aligned) {
    const rationale =
      row.question?.rationale ||
      (row.requirement ? `Probes: ${row.requirement}` : SLOT_LABEL[row.slot]);
    const saved = await addQuestion({
      sessionId: session.id,
      question: row.text,
      category: SLOT_CATEGORY[row.slot],
      // The slot is stored at the front of the rationale so the session can be
      // resumed and summarised without a schema change.
      rationale: `[${row.slot}] ${rationale}`.slice(0, 600),
      expectedSignals: row.question?.expectedSignals ?? [],
    });
    questions.push({
      id: saved.id,
      question: row.text,
      slot: row.slot,
      slotLabel: SLOT_LABEL[row.slot],
      seconds: SLOT_SECONDS[row.slot],
      rationale,
    });
  }

  return {
    sessionId: session.id,
    questions,
    generatedBy: outcome.manual ? "Manual" : providerLabel(outcome.provider),
  };
}

function slotOf(rationale: string | null): QuestionSlot {
  const m = rationale?.match(/^\[(OPENER|BEHAVIOURAL|ROLE|GAP|CLOSER)\]/);
  return (m?.[1] as QuestionSlot | undefined) ?? "ROLE";
}

export async function answerAiQuestion(
  userId: string,
  input: {
    sessionId: string;
    questionId: string;
    transcript: string;
    manualInput?: string | null;
    manualPrompt?: boolean;
  },
): Promise<MockFeedbackView> {
  const transcript = input.transcript.trim();
  if (transcript.length < 20) {
    throw Errors.validation(
      "Write (or dictate) a little more of your answer first.",
    );
  }
  const question = await prisma.interviewQuestion.findFirst({
    where: {
      id: input.questionId,
      sessionId: input.sessionId,
      session: { userId },
    },
    include: { session: { select: { targetRole: true } } },
  });
  if (!question) throw Errors.notFound("Interview question");

  const evidence = await evidenceRecords(userId);
  const master = await ensureMasterResume(userId);
  const masterVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId: master.id },
    orderBy: { version: "desc" },
    select: { content: true },
  });
  const pasted = input.manualInput?.trim() || undefined;

  const outcome = await runWorkflow<InterviewFeedbackOutput>({
    userId,
    workflowId: "INTERVIEW_FEEDBACK",
    context: {
      question: question.question,
      answer: transcript,
      jobRequirements: [],
      sentResume: RESUME_CONTENT_SCHEMA.parse(masterVersion?.content ?? {}),
      evidence: promptEvidence(evidence),
    },
    evidence,
    userApiKey: await getUserApiKeyForWorkflow(userId),
    preferManual: Boolean(pasted) || input.manualPrompt === true,
    manualInput: pasted,
  });
  if (!outcome.ok) throw new InterviewFailure(outcome);
  const f = outcome.data;

  // The stronger answer may only reuse facts from the answer and the evidence.
  const allowed = [
    transcript,
    ...evidence.map(
      (e) => `${e.statement} ${e.metricValue ?? ""} ${e.metricUnit ?? ""}`,
    ),
  ].join("\n");
  const guarded = guardStrongerAnswer(f.strongerAnswer, allowed);
  const warnings = [...outcome.warnings];
  if (guarded.removed.length) {
    warnings.push(
      `Removed ${guarded.removed.length} sentence(s) from the suggested answer that used numbers you have not stated.`,
    );
  }

  const answer = await recordAnswer({
    userId,
    sessionId: input.sessionId,
    questionId: question.id,
    transcript,
    scores: {
      relevance: f.relevance,
      specificity: f.specificity,
      evidence: f.evidence,
      structure: f.structure,
      clarity: f.clarity,
    },
    unsupportedClaims: f.unsupportedClaims,
    followUpQuestion: f.followUpQuestion,
    coachNote: f.coachNote,
    wasVague: f.wasVague,
  });
  await prisma.interviewAnswer.update({
    where: { id: answer.id },
    data: {
      strength: f.strength || null,
      improvement: f.improvement || f.coachNote || null,
      suggestedAnswer: guarded.text || null,
    },
  });

  return {
    relevance: f.relevance,
    specificity: f.specificity,
    evidence: f.evidence,
    structure: f.structure,
    strength: f.strength,
    improvement: f.improvement || f.coachNote,
    strongerAnswer: guarded.text,
    followUpQuestion: f.followUpQuestion,
    unsupportedClaims: f.unsupportedClaims,
    warnings,
    generatedBy: outcome.manual ? "Manual" : providerLabel(outcome.provider),
  };
}

export async function interviewSummary(userId: string, sessionId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      answers: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) throw Errors.notFound("Interview session");
  const latest = new Map(session.answers.map((a) => [a.questionId, a]));
  const rows = session.questions
    .map((q) => ({ q, a: latest.get(q.id) }))
    .filter((r) => r.a);
  const summary = summarizeSession(
    rows.map(({ q, a }) => ({
      question: q.question,
      relevance: a!.relevanceScore,
      specificity: a!.specificityScore,
      evidence: a!.evidenceScore,
      structure: a!.structureScore,
      strength: a!.strength,
      improvement: a!.improvement,
    })),
  );
  if (summary.average !== null) {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        overallScore: summary.average,
        status: "COMPLETED",
        completedAt: session.completedAt ?? new Date(),
        summary: JSON.stringify({
          strengths: summary.strengths,
          fixes: summary.fixes,
        }).slice(0, 4000),
      },
    });
  }
  return {
    role: session.targetRole ?? "",
    answered: rows.length,
    total: session.questions.length,
    ...summary,
    slots: session.questions.map((q) => slotOf(q.rationale)),
  };
}

/** Options for the start screen. */
export async function interviewOptions(userId: string) {
  const [applications, career, recent] = await Promise.all([
    prisma.application.findMany({
      where: { userId, jobId: { not: null } },
      select: { id: true, job: { select: { title: true, company: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.careerMasterProfile.findUnique({
      where: { userId },
      select: { targetRolePrimary: true },
    }),
    prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        targetRole: true,
        status: true,
        overallScore: true,
        createdAt: true,
        _count: { select: { questions: true, answers: true } },
      },
    }),
  ]);
  return {
    applications: applications.map((a) => ({
      id: a.id,
      label: `${a.job?.title ?? "Role"}${a.job?.company ? ` — ${a.job.company}` : ""}`,
    })),
    targetRole: career?.targetRolePrimary ?? "",
    recent,
  };
}

import { z } from "zod";
import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { recordOutcome } from "./application-service";
import { recordLearningEvent } from "./learning-service";
import type {
  InterviewMode,
  InterviewStage,
  InterviewFormat,
  StarCategory,
} from "@prisma/client";

/**
 * Interviews: Interview Prep, mock sessions, post-interview review and follow-ups.
 */

export const InterviewInputSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  scheduledAt: z.coerce.date().nullable().optional(),
  stage: z
    .enum(["SCREENING", "FIRST", "SECOND", "FINAL", "PANEL", "UNKNOWN"])
    .default("UNKNOWN"),
  format: z.enum(["PHONE", "VIDEO", "ONSITE", "UNKNOWN"]).default("UNKNOWN"),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(600)
    .nullable()
    .optional(),
  interviewerName: z.string().trim().max(200).nullable().optional(),
  interviewerRole: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  applicationId: z.string().max(80).nullable().optional(),
  notes: z.string().max(20_000).nullable().optional(),
});

export async function createInterview(userId: string, input: unknown) {
  const parsed = InterviewInputSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("Interview details could not be saved.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6),
    });
  }
  const d = parsed.data;

  if (d.applicationId) {
    const app = await prisma.application.findFirst({
      where: { id: d.applicationId, userId },
      select: { id: true, jobId: true },
    });
    if (!app) throw Errors.notFound("Application");
    const interview = await prisma.interview.create({
      data: {
        userId,
        company: d.company,
        role: d.role,
        scheduledAt: d.scheduledAt ?? null,
        stage: d.stage as InterviewStage,
        format: d.format as InterviewFormat,
        durationMinutes: d.durationMinutes ?? null,
        interviewerName: d.interviewerName ?? null,
        interviewerRole: d.interviewerRole ?? null,
        location: d.location ?? null,
        applicationId: d.applicationId,
        jobId: app.jobId,
        notes: d.notes ?? null,
        questionsToAsk: DEFAULT_QUESTIONS_TO_ASK,
        risks: [],
        gaps: [],
      },
    });
    await prisma.notification
      .create({
        data: {
          userId,
          type: "INTERVIEW_TOMORROW",
          title: `Interview: ${d.company}`,
          body: `${d.role}${d.scheduledAt ? ` on ${d.scheduledAt.toLocaleString()}` : ""}`,
          href: `/app/interviews/${interview.id}`,
          dueAt: d.scheduledAt,
          dedupeKey: `interview:${interview.id}`,
        },
      })
      .catch(() => undefined);
    return interview;
  }

  return prisma.interview.create({
    data: {
      userId,
      company: d.company,
      role: d.role,
      scheduledAt: d.scheduledAt ?? null,
      stage: d.stage as InterviewStage,
      format: d.format as InterviewFormat,
      durationMinutes: d.durationMinutes ?? null,
      interviewerName: d.interviewerName ?? null,
      interviewerRole: d.interviewerRole ?? null,
      location: d.location ?? null,
      notes: d.notes ?? null,
      questionsToAsk: DEFAULT_QUESTIONS_TO_ASK,
      risks: [],
      gaps: [],
    },
  });
}

export const DEFAULT_QUESTIONS_TO_ASK = [
  "What does success look like in this role after 90 days?",
  "Which part of the job description is hardest to fill, and why?",
  "How do you measure whether someone is doing this well?",
  "What is the team working on that I would own first?",
  "What is the biggest risk you see in onboarding for this hire?",
];

export async function listInterviews(userId: string) {
  return prisma.interview.findMany({
    where: { userId },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    include: { application: { select: { id: true, status: true } } },
  });
}

/**
 * Interview Prep. Uses the SENT snapshot when one exists so the user
 * prepares against exactly what the employer received.
 */
export async function interviewCommandCenter(
  userId: string,
  interviewId: string,
) {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, userId },
    include: {
      application: {
        include: {
          job: { include: { analysis: { include: { requirements: true } } } },
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
          matrix: {
            include: {
              matches: { include: { requirement: true, evidence: true } },
            },
          },
          resumes: {
            include: {
              sections: true,
              versions: { orderBy: { version: "desc" }, take: 1 },
            },
          },
          answers: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!interview) throw Errors.notFound("Interview");

  const snapshot = interview.application?.snapshots[0] ?? null;
  const requirements =
    interview.application?.job?.analysis?.requirements.map((r) => ({
      text: r.text,
      priority: r.priority,
      isMustHave: r.isMustHave,
      strength:
        interview.application?.matrix?.matches.find(
          (m) => m.requirementId === r.id,
        )?.strength ?? "UNKNOWN",
    })) ?? [];

  const strongMatches = (interview.application?.matrix?.matches ?? []).filter(
    (m) => m.strength === "STRONG",
  );

  const evidence = await prisma.evidence.findMany({
    where: {
      userId,
      verificationStatus: { in: ["VERIFIED", "USER_CONFIRMED"] },
    },
    orderBy: { lastConfirmedAt: "desc" },
    take: 20,
  });

  const stories = await prisma.starStory.findMany({
    where: { userId },
    orderBy: [{ strength: "desc" }, { usageCount: "desc" }],
    take: 8,
  });

  const gaps =
    strongMatches.length === 0 && requirements.length > 0
      ? [
          "No strong evidence matches the top requirements yet. Prepare examples that come close, and be honest about the difference.",
        ]
      : requirements
          .filter((r) => r.strength !== "STRONG")
          .slice(0, 5)
          .map((r) => `No strong evidence yet for: ${r.text}`);

  return {
    interview,
    jobRequirements: requirements,
    submittedResume: snapshot
      ? snapshot.resumeContent
      : (interview.application?.resumes?.[0]?.sections ?? null),
    strongestEvidence: evidence.slice(0, 8),
    topStories: stories,
    questionsToAsk: interview.questionsToAsk.length
      ? interview.questionsToAsk
      : DEFAULT_QUESTIONS_TO_ASK,
    risks: [
      ...(requirements.filter((r) => r.isMustHave && r.strength !== "STRONG")
        .length
        ? [
            `${requirements.filter((r) => r.isMustHave && r.strength !== "STRONG").length} must-have requirement(s) are not strongly evidenced.`,
          ]
        : []),
      ...(interview.application?.job?.analysis?.dealBreakers.length
        ? [
            `Deal breakers in the posting: ${interview.application.job.analysis.dealBreakers.slice(0, 2).join("; ")}`,
          ]
        : []),
    ],
    gaps,
    notes: interview.notes ?? "",
    checklist: buildChecklist(interview.status),
    usedSentSnapshot: Boolean(snapshot),
  };
}

function buildChecklist(
  status: string,
): Array<{ label: string; done: boolean }> {
  return [
    { label: "Re-read the job requirements", done: status === "COMPLETED" },
    { label: "Review the strongest evidence", done: false },
    { label: "Rehearse two STAR answers out loud", done: false },
    { label: "Prepare questions to ask", done: false },
    { label: "Know what to send as a follow-up", done: false },
  ];
}

// ---------------------------------------------------------------------------
// Mock interviews
// ---------------------------------------------------------------------------

export async function startMockSession(
  userId: string,
  input: {
    mode: InterviewMode;
    targetRole?: string | null;
    questionLimit: number;
    interviewId?: string | null;
  },
) {
  const session = await prisma.interviewSession.create({
    data: {
      userId,
      interviewId: input.interviewId ?? null,
      mode: input.mode,
      targetRole: input.targetRole ?? null,
      questionLimit: input.questionLimit,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });
  return session;
}

export async function addQuestion(input: {
  sessionId: string;
  question: string;
  category: InterviewMode;
  rationale?: string;
  expectedSignals?: string[];
}) {
  const last = await prisma.interviewQuestion.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return prisma.interviewQuestion.create({
    data: {
      sessionId: input.sessionId,
      orderIndex: (last?.orderIndex ?? -1) + 1,
      question: input.question,
      category: input.category,
      rationale: input.rationale ?? null,
      expectedSignals: input.expectedSignals ?? [],
    },
  });
}

export async function recordAnswer(input: {
  userId: string;
  sessionId: string;
  questionId: string;
  transcript: string;
  scores?: {
    relevance?: number;
    specificity?: number;
    evidence?: number;
    structure?: number;
    clarity?: number;
  };
  unsupportedClaims?: string[];
  followUpQuestion?: string | null;
  coachNote?: string;
  wasVague?: boolean;
}) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true, questionLimit: true },
  });
  if (!session) throw Errors.notFound("Interview session");

  const s = input.scores ?? {};
  const total =
    s.relevance !== undefined &&
    s.specificity !== undefined &&
    s.evidence !== undefined &&
    s.structure !== undefined &&
    s.clarity !== undefined
      ? (s.relevance + s.specificity + s.evidence + s.structure + s.clarity) / 5
      : null;

  const answer = await prisma.interviewAnswer.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      questionId: input.questionId,
      transcript: input.transcript,
      relevanceScore: s.relevance ?? null,
      specificityScore: s.specificity ?? null,
      evidenceScore: s.evidence ?? null,
      structureScore: s.structure ?? null,
      clarityScore: s.clarity ?? null,
      totalScore: total,
      unsupportedClaims: input.unsupportedClaims ?? [],
      followUpQuestion: input.followUpQuestion ?? null,
      coachNote: input.coachNote ?? null,
      wasVague: input.wasVague ?? false,
    },
  });

  const asked = await prisma.interviewQuestion.count({
    where: { sessionId: input.sessionId },
  });
  await prisma.interviewSession.update({
    where: { id: input.sessionId },
    data: {
      questionsAsked: asked,
      status: asked >= session.questionLimit ? "COMPLETED" : "IN_PROGRESS",
      completedAt: asked >= session.questionLimit ? new Date() : null,
    },
  });

  if ((input.unsupportedClaims?.length ?? 0) > 0) {
    await recordLearningEvent({
      userId: input.userId,
      eventType: "INTERVIEW_GAP_DISCOVERED",
      sourceType: "INTERVIEW_REVIEW",
      sourceId: input.sessionId,
      observation: `Unsupported claims in interview answer: ${input.unsupportedClaims!.slice(0, 2).join("; ")}`,
      subjectKey: input.unsupportedClaims![0] ?? "answer",
      supportingData: { questionId: input.questionId },
      confidenceCategory: "MEDIUM",
    });
  }
  if (input.wasVague) {
    await recordLearningEvent({
      userId: input.userId,
      eventType: "INTERVIEW_GAP_DISCOVERED",
      sourceType: "INTERVIEW_REVIEW",
      sourceId: input.sessionId,
      observation: "Answer was too vague and needed a follow-up question.",
      subjectKey: `vague:${input.questionId}`,
      confidenceCategory: "LOW",
    });
  }

  return answer;
}

// ---------------------------------------------------------------------------
// STAR stories
// ---------------------------------------------------------------------------

export const StarStoryInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum([
    "ACHIEVEMENT",
    "LEADERSHIP",
    "FAILURE",
    "CONFLICT",
    "TEAMWORK",
    "PROBLEM_SOLVING",
    "DEADLINE",
    "CUSTOMER",
    "LEARNING",
    "INITIATIVE",
  ]),
  situation: z.string().trim().min(3).max(4000),
  task: z.string().trim().min(3).max(4000),
  action: z.string().trim().min(3).max(4000),
  result: z.string().trim().min(3).max(4000),
  learning: z.string().max(2000).optional(),
  evidenceIds: z.array(z.string().max(80)).max(20).default([]),
  skills: z.array(z.string().max(80)).max(20).default([]),
});

export async function createStarStory(userId: string, input: unknown) {
  const parsed = StarStoryInputSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("STAR story could not be saved.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6),
    });
  }
  const d = parsed.data;
  const owned = await countOwnedEvidence(userId, d.evidenceIds);

  return prisma.starStory.create({
    data: {
      userId,
      title: d.title,
      category: d.category as StarCategory,
      situation: d.situation,
      task: d.task,
      action: d.action,
      result: d.result,
      learning: d.learning ?? null,
      evidenceIds: owned,
      skills: d.skills,
      strength: owned.length > 0 ? "STRONG" : "PARTIAL",
    },
  });
}

async function countOwnedEvidence(
  userId: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.evidence.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function listStarStories(userId: string) {
  return prisma.starStory.findMany({
    where: { userId },
    orderBy: [{ strength: "desc" }, { updatedAt: "desc" }],
  });
}

export async function incrementStoryUsage(userId: string, storyId: string) {
  const story = await prisma.starStory.findFirst({
    where: { id: storyId, userId },
  });
  if (!story) throw Errors.notFound("STAR story");
  return prisma.starStory.update({
    where: { id: storyId },
    data: { usageCount: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Post-interview review + follow-ups
// ---------------------------------------------------------------------------

export const PostReviewSchema = z.object({
  questionsAsked: z.string().max(8000).default(""),
  wentWell: z.string().max(8000).default(""),
  feltWeak: z.string().max(8000).default(""),
  surprises: z.string().max(8000).default(""),
  rememberedExperience: z.string().max(8000).default(""),
  interviewerFocus: z.string().max(8000).default(""),
  followUpNeeded: z.boolean().default(false),
});

export async function savePostInterviewReview(
  userId: string,
  interviewId: string,
  input: unknown,
) {
  const parsed = PostReviewSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("Interview review could not be saved.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6),
    });
  }
  const d = parsed.data;
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, userId },
  });
  if (!interview) throw Errors.notFound("Interview");

  const review = {
    questionsAsked: d.questionsAsked,
    wentWell: d.wentWell,
    feltWeak: d.feltWeak,
    surprises: d.surprises,
    rememberedExperience: d.rememberedExperience,
    interviewerFocus: d.interviewerFocus,
    followUpNeeded: d.followUpNeeded,
    savedAt: new Date().toISOString(),
  };

  return inTransaction(async (tx) => {
    const updated = await tx.interview.update({
      where: { id: interviewId },
      data: {
        postReview: review as never,
        reviewedAt: new Date(),
        status: "COMPLETED",
      },
    });
    if (interview.applicationId && d.followUpNeeded) {
      const followUpCount = await tx.followUp.count({
        where: {
          userId,
          applicationId: interview.applicationId,
          type: "THANK_YOU",
          status: "DRAFT",
        },
      });
      if (followUpCount === 0) {
        await tx.followUp.create({
          data: {
            userId,
            applicationId: interview.applicationId,
            interviewId,
            type: "THANK_YOU",
            status: "DRAFT",
            subject: `Thank you — ${interview.company} ${interview.role}`,
            body: "",
            scheduledFor: new Date(Date.now() + 24 * 3_600_000),
          },
        });
      }
    }
    return updated;
  });
}

export async function recordInterviewOutcome(
  userId: string,
  applicationId: string,
  outcome: "INTERVIEW" | "OFFER" | "REJECTED",
  detail?: string,
) {
  return recordOutcome(userId, applicationId, outcome, detail);
}

export async function createFollowUp(
  userId: string,
  input: {
    applicationId?: string | null;
    interviewId?: string | null;
    type: "THANK_YOU" | "FOLLOW_UP" | "SECOND_FOLLOW_UP" | "WITHDRAWAL";
    subject?: string | null;
    body: string;
    scheduledFor?: Date | null;
  },
) {
  if (input.body.trim().length < 10)
    throw Errors.validation("The follow-up message is too short.");
  return prisma.followUp.create({
    data: {
      userId,
      applicationId: input.applicationId ?? null,
      interviewId: input.interviewId ?? null,
      type: input.type,
      subject: input.subject ?? null,
      body: input.body,
      scheduledFor: input.scheduledFor ?? null,
    },
  });
}

export async function listFollowUps(userId: string) {
  return prisma.followUp.findMany({
    where: { userId },
    orderBy: [{ scheduledFor: "asc" }],
    include: {
      application: {
        select: { id: true, job: { select: { company: true, title: true } } },
      },
    },
  });
}

export async function markFollowUpSent(userId: string, followUpId: string) {
  const followUp = await prisma.followUp.findFirst({
    where: { id: followUpId, userId },
  });
  if (!followUp) throw Errors.notFound("Follow-up");
  return prisma.followUp.update({
    where: { id: followUpId },
    data: { status: "SENT", sentAt: new Date() },
  });
}

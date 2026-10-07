"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage, Errors } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createStarStory,
  createFollowUp,
  markFollowUpSent,
} from "@/services/interview-service";
import {
  getEntitlementState,
  requireCapability,
} from "@/services/entitlement-service";
import type { ActionState } from "@/app/actions/state";
import { generateEvidenceProposalsFromInterview } from "@/services/learning-service";

function fail(e: unknown) {
  return { ok: false, message: userFacingMessage(asAppError(e)) };
}

export async function createInterviewAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "INTERVIEW_COMMAND_CENTER");
    const { createInterview } = await import("@/services/interview-service");
    await createInterview(user.id, {
      company: formData.get("company"),
      role: formData.get("role"),
      scheduledAt: formData.get("scheduledAt") || null,
      stage: formData.get("stage"),
      format: formData.get("format"),
      interviewerName: formData.get("interviewerName") || null,
      applicationId: formData.get("applicationId") || null,
    });
    revalidatePath("/app/interviews");
    return { ok: true, message: "Interview added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createStarStoryAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });

    const state = await getEntitlementState(user.id);
    const existing = await prisma.starStory.count({
      where: { userId: user.id },
    });
    if (existing >= state.limits.starStories) {
      throw Errors.validation(
        `The Starter plan includes ${state.limits.starStories} STAR story. Upgrade to Complete Edition for the full bank.`,
      );
    }

    await createStarStory(user.id, {
      title: formData.get("title"),
      category: formData.get("category"),
      situation: formData.get("situation"),
      task: formData.get("task"),
      action: formData.get("action"),
      result: formData.get("result"),
      learning: String(formData.get("learning") ?? "") || undefined,
      evidenceIds: String(formData.get("evidenceIds") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      skills: String(formData.get("skills") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    revalidatePath("/app/stories");
    return { ok: true, message: "STAR story saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function savePostReviewAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "POST_INTERVIEW_REVIEW");
    const interviewId = String(formData.get("interviewId"));

    const { savePostInterviewReview } =
      await import("@/services/interview-service");
    await savePostInterviewReview(user.id, interviewId, {
      questionsAsked: formData.get("questionsAsked"),
      wentWell: formData.get("wentWell"),
      feltWeak: formData.get("feltWeak"),
      surprises: formData.get("surprises"),
      rememberedExperience: formData.get("rememberedExperience"),
      interviewerFocus: formData.get("interviewerFocus"),
      followUpNeeded: formData.get("followUpNeeded") === "true",
    });

    // Interview -> career learning. Proposals only; never automatic facts.
    const proposals = await generateEvidenceProposalsFromInterview({
      userId: user.id,
      interviewId,
      reflection: [
        String(formData.get("rememberedExperience") ?? ""),
        String(formData.get("questionsAsked") ?? ""),
        String(formData.get("wentWell") ?? ""),
      ].join("\n"),
    });

    revalidatePath(`/app/interviews/${interviewId}`);
    revalidatePath("/app/learning");
    revalidatePath("/app/interviews");

    return {
      ok: true,
      message:
        proposals.proposals.length > 0
          ? `Review saved. ${proposals.proposals.length} evidence proposal(s) created — review them before anything is added to your ledger.`
          : "Review saved. No new evidence proposals were needed.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function createFollowUpAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "FOLLOW_UP_BUILDER");
    await createFollowUp(user.id, {
      applicationId: String(formData.get("applicationId") ?? "") || null,
      interviewId: String(formData.get("interviewId") ?? "") || null,
      type: String(formData.get("type") ?? "FOLLOW_UP") as never,
      subject: String(formData.get("subject") ?? "") || null,
      body: String(formData.get("body") ?? ""),
      scheduledFor: formData.get("scheduledFor")
        ? new Date(String(formData.get("scheduledFor")))
        : null,
    });
    revalidatePath("/app/follow-ups");
    return { ok: true, message: "Follow-up saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function markFollowUpSentAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "FOLLOW_UP_BUILDER");
    await markFollowUpSent(user.id, String(formData.get("followUpId")));
    revalidatePath("/app/follow-ups");
    revalidatePath("/app");
    return { ok: true, message: "Marked as sent." };
  } catch (e) {
    return fail(e);
  }
}

export async function addMockQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { questionId?: string }> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });

    const sessionId = String(formData.get("sessionId") ?? "");
    const question = String(formData.get("question") ?? "").trim();
    if (question.length < 8) {
      throw Errors.validation("That question is too short to record.");
    }

    // Ownership is enforced by looking the session up against the user first.
    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true, questionLimit: true },
    });
    if (!session) throw Errors.notFound("Interview session");

    const existing = await prisma.interviewQuestion.count({
      where: { sessionId: session.id },
    });
    if (existing >= session.questionLimit) {
      throw Errors.validation(
        `This session is limited to ${session.questionLimit} question(s).`,
      );
    }

    const { addQuestion } = await import("@/services/interview-service");
    const row = await addQuestion({
      sessionId: session.id,
      question,
      category: String(formData.get("category") || "GENERAL") as never,
      rationale: String(formData.get("rationale") ?? "") || undefined,
      expectedSignals: String(formData.get("expectedSignals") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    revalidatePath("/app/interviews/practice");
    return { ok: true, message: "Question added.", questionId: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function recordAnswerAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { recordAnswer } = await import("@/services/interview-service");
    await recordAnswer({
      userId: user.id,
      sessionId: String(formData.get("sessionId")),
      questionId: String(formData.get("questionId")),
      transcript: String(formData.get("transcript") ?? ""),
      scores: {
        relevance: Number(formData.get("relevance") ?? 0),
        specificity: Number(formData.get("specificity") ?? 0),
        evidence: Number(formData.get("evidence") ?? 0),
        structure: Number(formData.get("structure") ?? 0),
        clarity: Number(formData.get("clarity") ?? 0),
      },
      unsupportedClaims: String(formData.get("unsupportedClaims") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      followUpQuestion: String(formData.get("followUpQuestion") ?? "") || null,
      coachNote: String(formData.get("coachNote") ?? ""),
      wasVague: formData.get("wasVague") === "true",
    });
    revalidatePath("/app/interviews/practice");
    return { ok: true, message: "Answer recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function startMockSessionAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const state = await getEntitlementState(user.id);
    const requested = Number(formData.get("questionLimit") ?? 5);
    const limit = Math.min(
      requested,
      state.isComplete ? 30 : state.limits.mockInterviewQuestions,
    );

    const { startMockSession } = await import("@/services/interview-service");
    const session = await startMockSession(user.id, {
      mode: (formData.get("mode") ?? "GENERAL") as never,
      targetRole: String(formData.get("targetRole") ?? "") || null,
      questionLimit: limit,
    });

    revalidatePath("/app/interviews/practice");
    return {
      ok: true,
      message: `Session started with a limit of ${limit} questions.`,
      sessionId: session.id,
    };
  } catch (e) {
    return fail(e);
  }
}

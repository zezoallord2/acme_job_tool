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

// ---------------------------------------------------------------------------
// AI mock interview (one question per screen, coached answers)
// ---------------------------------------------------------------------------

type ManualPrompt = import("@/ai/providers/manual").ManualPromptPackage;

export type AiInterviewFailure = {
  ok: false;
  message: string;
  code?: string;
  prompt?: ManualPrompt;
  errors?: string[];
};

function interviewFail(e: unknown): AiInterviewFailure {
  if (e instanceof Error && e.name === "InterviewFailure") {
    const f = e as import("@/services/mock-interview-service").InterviewFailure;
    return {
      ok: false,
      message: f.message,
      code: f.code,
      prompt: f.prompt ?? undefined,
      errors: f.errors,
    };
  }
  return fail(e) as AiInterviewFailure;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

export async function startAiInterviewAction(raw: Record<string, unknown>) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const manualInput = text(raw.manualInput, 100_000);
    const manualPrompt = raw.mode === "manual-prompt";
    // The daily session cap protects hosted AI quota. It is the only limit:
    // starting a session is never behind a paywall.
    if (!manualInput && !manualPrompt) {
      const state = await getEntitlementState(user.id);
      const { enforceDailyCap } = await import("@/lib/usage-caps");
      await enforceDailyCap(user.id, "interview", state.isComplete);
    }
    const depthRaw = String(raw.depth ?? "STANDARD").toUpperCase();
    const depth = (["QUICK", "STANDARD", "DEEP"] as const).includes(
      depthRaw as never,
    )
      ? (depthRaw as "QUICK" | "STANDARD" | "DEEP")
      : "STANDARD";
    const { startAiInterview } =
      await import("@/services/mock-interview-service");
    const result = await startAiInterview(user.id, {
      applicationId: text(raw.applicationId, 60),
      targetRole: text(raw.targetRole, 200),
      depth,
      manualInput,
      manualPrompt,
    });
    revalidatePath("/app/interviews/practice");
    return { ok: true as const, ...result };
  } catch (e) {
    return interviewFail(e);
  }
}

export async function answerAiQuestionAction(raw: Record<string, unknown>) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("interviewAnswer", { userId: user.id });
    const { answerAiQuestion } =
      await import("@/services/mock-interview-service");
    const feedback = await answerAiQuestion(user.id, {
      sessionId: String(raw.sessionId ?? ""),
      questionId: String(raw.questionId ?? ""),
      transcript: String(raw.transcript ?? "").slice(0, 8000),
      manualInput: text(raw.manualInput, 100_000),
      manualPrompt: raw.mode === "manual-prompt",
    });
    return { ok: true as const, feedback };
  } catch (e) {
    return interviewFail(e);
  }
}

export async function interviewSummaryAction(sessionId: string) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    const { interviewSummary } =
      await import("@/services/mock-interview-service");
    const summary = await interviewSummary(user.id, sessionId);
    revalidatePath("/app/interviews/practice");
    return { ok: true as const, summary };
  } catch (e) {
    return interviewFail(e);
  }
}

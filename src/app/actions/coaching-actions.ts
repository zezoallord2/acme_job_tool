"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage, Errors } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildManualPrompt } from "@/ai/providers/manual";
import { activePromptVersion, type WorkflowId } from "@/ai/workflow-ids";
import { hasCapability } from "@/services/entitlement-service";
import { evidenceRecords } from "@/services/evidence-service";
import {
  CoachingFailure,
  buildAchievementContext,
  buildCoachContext,
  buildDefenseContext,
  buildExtractionContext,
  buildQuestionContext,
  coachInterviewAnswer,
  defendClaim,
  extractEvidenceFromNarrative,
  finishAchievementMining,
  generateInterviewQuestions,
  nextAchievementQuestion,
  type QuestionCategory,
} from "@/services/coaching-service";
import type {
  AchievementInterviewOutput,
  DefendClaimOutput,
  EvidenceExtractionOutput,
  InterviewFeedbackOutput,
  InterviewQuestionsOutput,
} from "@/ai/schemas";
import type { CoachingSubmitResult } from "@/app/actions/state";

/**
 * Coaching workflow actions.
 *
 * Each workflow follows the same two-phase Manual Mode shape as job analysis:
 * build a self-contained prompt, then validate whatever is pasted back. There is
 * no provider call in the default configuration, so this is the real path rather
 * than a fallback.
 */

type ManualPayload = ReturnType<typeof buildManualPrompt>;

function fail(e: unknown): CoachingSubmitResult<never> {
  if (e instanceof CoachingFailure) {
    return {
      ok: false,
      message: e.userMessage,
      errors: e.errors,
      prompt: e.prompt as ManualPayload | undefined,
    };
  }
  return { ok: false, message: userFacingMessage(asAppError(e)), errors: [] };
}

function promptFor(
  workflowId: WorkflowId,
  context: Record<string, unknown>,
): CoachingSubmitResult<never> & { prompt: ManualPayload } {
  return {
    ok: true as const,
    prompt: buildManualPrompt(
      workflowId,
      context,
      activePromptVersion(workflowId),
    ),
  };
}

/** Throws when a Complete Edition capability is missing. */
async function requireCapability(
  userId: string,
  capability: Parameters<typeof hasCapability>[1],
  label: string,
): Promise<void> {
  if (!(await hasCapability(userId, capability))) {
    throw Errors.conflict(
      `${label} is a Complete Edition feature. Your Starter plan does not include it.`,
    );
  }
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ---------------------------------------------------------------------------
// EVIDENCE_EXTRACTION
// ---------------------------------------------------------------------------

export async function buildExtractionPrompt(formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "ACHIEVEMENT_MINING",
      "Evidence Extraction",
    );
    const context = await buildExtractionContext(
      user.id,
      str(formData, "narrative"),
    );
    return promptFor("EVIDENCE_EXTRACTION", context);
  } catch (e) {
    return fail(e);
  }
}

export async function submitExtractionAction(
  _prev: CoachingSubmitResult<EvidenceExtractionOutput>,
  formData: FormData,
): Promise<CoachingSubmitResult<EvidenceExtractionOutput>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "ACHIEVEMENT_MINING",
      "Evidence Extraction",
    );

    const result = await extractEvidenceFromNarrative(
      user.id,
      str(formData, "narrative"),
      String(formData.get("raw") ?? ""),
    );

    revalidatePath("/app/evidence");
    revalidatePath("/app/evidence/discover");
    revalidatePath("/app/learning");

    return {
      ok: true,
      data: {
        statements: result.statements,
        needsInput: result.needsInput,
      },
      message:
        result.proposalIds.length > 0
          ? `${result.proposalIds.length} statement(s) added as proposals. Review them on the Learning page before anything enters your ledger.`
          : "No new statements. Everything extracted is already in your ledger.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// ACHIEVEMENT_INTERVIEW
// ---------------------------------------------------------------------------

export async function buildAchievementPrompt(formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "ACHIEVEMENT_MINING",
      "Achievement Mining",
    );

    let known: Record<string, unknown> = {};
    let questionCount = 0;
    try {
      known = JSON.parse(str(formData, "known") || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      throw Errors.validation("The interview context could not be read.");
    }
    questionCount = Number(formData.get("questionCount") ?? 0) || 0;

    return promptFor(
      "ACHIEVEMENT_INTERVIEW",
      buildAchievementContext({ known, questionCount }),
    );
  } catch (e) {
    return fail(e);
  }
}

export async function submitAchievementTurnAction(
  _prev: CoachingSubmitResult<AchievementInterviewOutput>,
  formData: FormData,
): Promise<CoachingSubmitResult<AchievementInterviewOutput>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "ACHIEVEMENT_MINING",
      "Achievement Mining",
    );

    let known: Record<string, unknown> = {};
    try {
      known = JSON.parse(str(formData, "known") || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      throw Errors.validation("The interview context could not be read.");
    }

    const turn = await nextAchievementQuestion(
      user.id,
      { known, questionCount: Number(formData.get("questionCount") ?? 0) || 0 },
      String(formData.get("raw") ?? ""),
    );

    return { ok: true, data: turn };
  } catch (e) {
    return fail(e);
  }
}

/** Ends the interview and files what was learned as proposals, never as facts. */
export async function finishMiningAction(
  _prev: CoachingSubmitResult<{ proposalIds: string[] }>,
  formData: FormData,
): Promise<CoachingSubmitResult<{ proposalIds: string[] }>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(
      user.id,
      "ACHIEVEMENT_MINING",
      "Achievement Mining",
    );

    let facts: Array<{
      statement: string;
      claimType: string;
      metricValue?: number | null;
      metricUnit?: string | null;
    }> = [];
    try {
      facts = JSON.parse(str(formData, "facts") || "[]") as typeof facts;
    } catch {
      throw Errors.validation("The mined facts could not be read.");
    }
    if (facts.length === 0) {
      throw Errors.validation(
        "There is nothing to file yet. Answer at least one question first.",
      );
    }

    const result = await finishAchievementMining(user.id, facts);

    revalidatePath("/app/evidence/discover");
    revalidatePath("/app/learning");

    return {
      ok: true,
      data: result,
      message:
        result.proposalIds.length > 0
          ? `${result.proposalIds.length} fact(s) filed as proposals. Nothing entered your ledger without your approval.`
          : "Nothing new to file — your ledger already covers this.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// DEFEND_CLAIM
// ---------------------------------------------------------------------------

export async function buildDefensePrompt(formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(user.id, "CLAIM_INSPECTOR", "Claim Defense");

    const context = await buildDefenseContext(user.id, {
      claim: str(formData, "claim"),
      userAccount: str(formData, "userAccount") || null,
    });
    return promptFor("DEFEND_CLAIM", context);
  } catch (e) {
    return fail(e);
  }
}

export async function submitDefenseAction(
  _prev: CoachingSubmitResult<DefendClaimOutput>,
  formData: FormData,
): Promise<CoachingSubmitResult<DefendClaimOutput>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(user.id, "CLAIM_INSPECTOR", "Claim Defense");

    const career = await prisma.careerMasterProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        professionalSummary: true,
        targetRolePrimary: true,
      },
    });

    const result = await defendClaim(
      user.id,
      {
        claim: str(formData, "claim"),
        userAccount:
          str(formData, "userAccount") ||
          [
            career?.headline,
            career?.targetRolePrimary,
            career?.professionalSummary,
          ]
            .filter(Boolean)
            .join(" · ") ||
          null,
      },
      String(formData.get("raw") ?? ""),
    );

    revalidatePath("/app/claims/defend");

    return {
      ok: true,
      data: result,
      warnings: result.warnings,
      message: `Verdict: ${result.verdict.replace(/_/g, " ").toLowerCase()}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// INTERVIEW_QUESTION
// ---------------------------------------------------------------------------

export async function buildQuestionsPrompt(formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "MOCK_INTERVIEW_ADVANCED",
      "Interview Question Builder",
    );

    const context = await buildQuestionContext(user.id, {
      mode: (str(formData, "mode") || "GENERAL") as QuestionCategory,
      role: str(formData, "role"),
      applicationId: str(formData, "applicationId") || null,
      difficulty: str(formData, "difficulty") || "medium",
      count: Math.min(Math.max(Number(formData.get("count") ?? 5) || 5, 1), 15),
    });
    return promptFor("INTERVIEW_QUESTION", context);
  } catch (e) {
    return fail(e);
  }
}

export async function submitQuestionsAction(
  _prev: CoachingSubmitResult<InterviewQuestionsOutput>,
  formData: FormData,
): Promise<CoachingSubmitResult<InterviewQuestionsOutput>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "MOCK_INTERVIEW_ADVANCED",
      "Interview Question Builder",
    );

    const count = Math.min(
      Math.max(Number(formData.get("count") ?? 5) || 5, 1),
      15,
    );

    const result = await generateInterviewQuestions(
      user.id,
      {
        mode: (str(formData, "mode") || "GENERAL") as QuestionCategory,
        role: str(formData, "role"),
        applicationId: str(formData, "applicationId") || null,
        difficulty: str(formData, "difficulty") || "medium",
        count,
      },
      String(formData.get("raw") ?? ""),
    );

    revalidatePath("/app/interviews/prep");
    revalidatePath("/app/interviews");

    return {
      ok: true,
      data: {
        questions: result.questions.map((q) => ({
          question: q.question,
          category: q.category,
          rationale: q.rationale,
          expectedSignals: q.expectedSignals,
        })),
      },
      message: `${result.questions.length} question(s) ready to practise.`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// INTERVIEW_FEEDBACK
// ---------------------------------------------------------------------------

export async function buildCoachPrompt(formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "MOCK_INTERVIEW_ADVANCED",
      "The Answer Coach",
    );

    const context = buildCoachContext({
      question: str(formData, "question"),
      answer: str(formData, "answer"),
      jobRequirements: str(formData, "jobRequirements")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      evidence: await evidenceRecords(user.id),
    });
    return promptFor("INTERVIEW_FEEDBACK", context);
  } catch (e) {
    return fail(e);
  }
}

export async function submitCoachAction(
  _prev: CoachingSubmitResult<InterviewFeedbackOutput>,
  formData: FormData,
): Promise<CoachingSubmitResult<InterviewFeedbackOutput>> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    await requireCapability(
      user.id,
      "MOCK_INTERVIEW_ADVANCED",
      "The Answer Coach",
    );

    const result = await coachInterviewAnswer(
      user.id,
      {
        question: str(formData, "question"),
        answer: str(formData, "answer"),
        jobRequirements: str(formData, "jobRequirements")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      String(formData.get("raw") ?? ""),
    );

    return {
      ok: true,
      data: result,
      warnings: result.warnings,
      message: result.followUpQuestion
        ? "Scored. One follow-up question is worth practising."
        : "Scored against relevance, specificity, evidence, structure and clarity.",
    };
  } catch (e) {
    return fail(e);
  }
}

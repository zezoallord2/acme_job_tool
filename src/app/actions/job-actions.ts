"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { buildManualPrompt } from "@/ai/providers/manual";
import { activePromptVersion } from "@/ai/workflow-ids";
import {
  buildEvidenceMatrix,
  getJob,
  saveJobAnalysis,
} from "@/services/job-service";
import { evidenceRecords } from "@/services/evidence-service";
import { hasCapability } from "@/services/entitlement-service";
import { createJob } from "@/services/job-service";
import { redirect } from "next/navigation";

import {
  type ActionState,
  type AnalysisSubmitResult,
} from "@/app/actions/state";
import type { JobAnalysisOutput } from "@/ai/schemas";

/** One-click default. Manual paste remains available only after this path fails. */
export async function analyzeJobAction(
  _prev: AnalysisSubmitResult,
  formData: FormData,
): Promise<AnalysisSubmitResult> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const jobId = String(formData.get("jobId"));
    const job = await getJob(user.id, jobId);
    const career = await prisma.careerMasterProfile.findUnique({
      where: { userId: user.id },
      select: { targetRolePrimary: true },
    });
    const outcome = await runWorkflow<JobAnalysisOutput>({
      userId: user.id,
      workflowId: "JOB_ANALYSIS",
      context: {
        description: job.rawDescription,
        targetRole: career?.targetRolePrimary ?? "not specified",
      },
      evidence: await evidenceRecords(user.id),
      userApiKey: await getUserApiKeyForWorkflow(user.id),
      preferManual: false,
    });
    if (!outcome.ok)
      return {
        ok: false,
        message: outcome.userMessage,
        errors: outcome.errors,
        prompt: outcome.manualFallback ?? undefined,
      };
    await saveJobAnalysis({
      userId: user.id,
      jobId,
      output: outcome.data,
      interactionId: outcome.interactionId,
      workflowId: "JOB_ANALYSIS",
      promptVersion: outcome.promptVersion,
      provider: outcome.provider,
      model: outcome.model,
      manual: false,
    });
    const matrix = await buildEvidenceMatrix(user.id, jobId);
    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app/jobs");
    revalidatePath("/app");
    return {
      ok: true,
      message: `Job checked. ${matrix.result.coverage.strong} strong matches, ${matrix.result.coverage.partial} possible matches and ${matrix.result.coverage.missing} gaps.`,
      errors: [],
    };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)), errors: [] };
  }
}

/** Saves a real public listing into the user's private workspace. */
export async function saveDiscoveredJobAction(formData: FormData) {
  let destination = "/app/jobs";
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const title = String(formData.get("title") ?? "");
    const company = String(formData.get("company") ?? "");
    const location = String(formData.get("location") ?? "");
    const sourceUrl = String(formData.get("sourceUrl") ?? "");
    let description = String(formData.get("description") ?? "").trim();
    // Some sources (Adzuna, Jooble) return a snippet only. Save what is known
    // and point to the full posting rather than refusing to save the job.
    if (description.length < 80) {
      description = `${title} at ${company}${location ? ` (${location})` : ""}. ${description} The full job description is on the original posting: ${sourceUrl}`;
    }
    const job = await createJob(user.id, {
      title,
      company,
      location,
      description,
      sourceName: String(formData.get("sourceName") ?? "Public job board"),
      sourceUrl,
      inputSource: "MANUAL",
    });
    destination = `/app/jobs/${job.id}`;
    revalidatePath("/app/jobs");
    revalidatePath("/app");
  } catch (e) {
    const err = asAppError(e);
    const duplicateId = (err.details as { jobId?: string } | undefined)?.jobId;
    if (duplicateId) destination = `/app/jobs/${duplicateId}`;
    else
      destination = `/app/jobs?saveError=${encodeURIComponent(userFacingMessage(err))}`;
  }
  redirect(destination);
}

/** Returns the Manual Mode prompt package for a saved job. */
export async function getAnalysisPromptAction(
  _prev: ActionState,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const job = await getJob(user.id, String(formData.get("jobId")));

    const career = await prisma.careerMasterProfile.findUnique({
      where: { userId: user.id },
      select: { targetRolePrimary: true },
    });

    return {
      ok: true as const,
      prompt: buildManualPrompt(
        "JOB_ANALYSIS",
        {
          description: job.rawDescription,
          targetRole: career?.targetRolePrimary ?? "not specified",
        },
        activePromptVersion("JOB_ANALYSIS"),
      ),
    };
  } catch (e) {
    return { ok: false as const, message: userFacingMessage(asAppError(e)) };
  }
}

/** Validates a pasted AI response and persists the analysis + match breakdown. */
export async function submitAnalysisAction(
  _prev: AnalysisSubmitResult,
  formData: FormData,
): Promise<AnalysisSubmitResult> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const jobId = String(formData.get("jobId"));
    const raw = String(formData.get("raw") ?? "");

    const job = await getJob(user.id, jobId);
    const career = await prisma.careerMasterProfile.findUnique({
      where: { userId: user.id },
      select: { targetRolePrimary: true },
    });

    const outcome = await runWorkflow<JobAnalysisOutput>({
      userId: user.id,
      workflowId: "JOB_ANALYSIS",
      context: {
        description: job.rawDescription,
        targetRole: career?.targetRolePrimary ?? "not specified",
      },
      evidence: await evidenceRecords(user.id),
      userApiKey: await getUserApiKeyForWorkflow(user.id),
      preferManual: true,
      manualInput: raw,
    });

    if (!outcome.ok) {
      return {
        ok: false,
        message: outcome.userMessage,
        errors: outcome.errors,
        prompt: outcome.manualFallback ?? undefined,
      };
    }

    await saveJobAnalysis({
      userId: user.id,
      jobId,
      output: outcome.data,
      interactionId: outcome.interactionId,
      workflowId: "JOB_ANALYSIS",
      promptVersion: outcome.promptVersion,
      provider: outcome.provider,
      model: outcome.model,
      manual: outcome.manual,
    });

    const deep = await hasCapability(user.id, "JOB_ANALYZER_DEEP");
    const matrix = await buildEvidenceMatrix(user.id, jobId);

    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app/jobs");
    revalidatePath("/app");

    return {
      ok: true,
      repaired: outcome.warnings.some((w) => w.includes("repair")),
      message: deep
        ? `Analysis saved. Evidence coverage: ${matrix.result.coverage.strong} strong, ${matrix.result.coverage.partial} partial, ${matrix.result.coverage.missing} missing.`
        : `Analysis saved. Evidence coverage: ${matrix.result.coverage.strong} strong, ${matrix.result.coverage.partial} partial, ${matrix.result.coverage.missing} missing. Upgrade for the full matrix with Apply/Review/Skip reasoning.`,
    };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)), errors: [] };
  }
}

export async function rebuildMatrixAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const jobId = String(formData.get("jobId"));
    await buildEvidenceMatrix(user.id, jobId);
    revalidatePath(`/app/jobs/${jobId}`);
    return {
      ok: true,
      message: "Match breakdown updated from your confirmed experience.",
    };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

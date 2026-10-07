"use server";

import { revalidatePath } from "next/cache";
import { asAppError, userFacingMessage, Errors } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  buildManualPrompt,
  type ManualPromptPackage,
} from "@/ai/providers/manual";
import { activePromptVersion, type WorkflowId } from "@/ai/workflow-ids";
import { hasCapability } from "@/services/entitlement-service";
import {
  STUDIO_IDS,
  StudioFailure,
  studioDescriptor,
  studioWorkflow,
  type StudioResult,
  type StudioValues,
} from "@/services/studio-service";

/**
 * Studio actions.
 *
 * Two phases, like every other Manual Mode workflow: build a self-contained
 * prompt, then validate whatever is pasted back. The workflow is chosen by id and
 * resolved through the registry, so this module contains no per-workflow logic.
 */

export interface StudioFieldView {
  name: string;
  label: string;
  kind: "text" | "textarea" | "select" | "number";
  hint?: string;
  placeholder?: string;
  required: boolean;
  minLength?: number;
  rows?: number;
  options: Array<{ value: string; label: string }>;
}

export interface StudioDescriptorView {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  fields: StudioFieldView[];
}

export interface StudioSubmitResult {
  ok: boolean;
  message?: string;
  errors?: string[];
  prompt?: unknown;
  result?: StudioResult;
}

/** Discriminated so the client can narrow on `ok` without a cast. */
export type PromptResult =
  | { ok: true; prompt: ManualPromptPackage }
  | {
      ok: false;
      message: string;
      errors?: string[];
      prompt?: ManualPromptPackage;
    };

function promptFail(e: unknown): PromptResult {
  if (e instanceof StudioFailure) {
    return {
      ok: false,
      message: e.userMessage,
      errors: e.errors,
      prompt: e.prompt as ManualPromptPackage | undefined,
    };
  }
  return { ok: false, message: userFacingMessage(asAppError(e)), errors: [] };
}

function fail(e: unknown): StudioSubmitResult {
  if (e instanceof StudioFailure) {
    return {
      ok: false,
      message: e.userMessage,
      errors: e.errors,
      prompt: e.prompt as ManualPromptPackage | undefined,
    };
  }
  return { ok: false, message: userFacingMessage(asAppError(e)), errors: [] };
}

function values(formData: FormData): StudioValues {
  const out: StudioValues = {};
  for (const [key, value] of formData.entries()) {
    if (key === "raw" || key === "workflow") continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

async function resolve(userId: string, formData: FormData) {
  const id = String(formData.get("workflow") ?? "");
  if (!STUDIO_IDS.includes(id as WorkflowId)) {
    throw Errors.notFound("Workflow");
  }
  const workflow = studioWorkflow(id);
  if (!(await hasCapability(userId, workflow.capability))) {
    throw Errors.conflict(
      `${workflow.title} is a Complete Edition feature. Your Starter plan does not include it.`,
    );
  }
  return workflow;
}

export async function studioDescriptorAction(
  workflowId: string,
): Promise<StudioDescriptorView | { ok: false; message: string }> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    const workflow = studioWorkflow(workflowId);
    return await studioDescriptor(user.id, workflow);
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

export async function buildStudioPromptAction(
  formData: FormData,
): Promise<PromptResult> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const workflow = await resolve(user.id, formData);
    const context = await workflow.buildContext(user.id, values(formData));
    return {
      ok: true,
      prompt: buildManualPrompt(
        workflow.id,
        context,
        activePromptVersion(workflow.id),
      ),
    };
  } catch (e) {
    return promptFail(e);
  }
}

export async function submitStudioAction(
  _prev: StudioSubmitResult,
  formData: FormData,
): Promise<StudioSubmitResult> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });
    const workflow = await resolve(user.id, formData);
    const raw = String(formData.get("raw") ?? "");
    if (!raw.trim()) {
      throw Errors.validation("Paste the assistant's response first.");
    }

    const result = await workflow.run(user.id, values(formData), raw);

    // Everything a studio workflow can touch, revalidated together.
    for (const path of [
      "/app",
      "/app/applications",
      "/app/resumes",
      "/app/interviews",
      "/app/stories",
      "/app/follow-ups",
      "/app/career",
      "/app/evidence",
      "/app/settings",
    ]) {
      revalidatePath(path);
    }

    return { ok: true, message: result.summary, result };
  } catch (e) {
    return fail(e);
  }
}

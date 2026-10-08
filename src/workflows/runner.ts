import type { AIProviderName } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { newTraceId } from "@/lib/crypto";
import { asAppError, Errors } from "@/lib/errors";
import { logInfo, logWarn } from "@/lib/logger";
import { executeWithFallback, resolveProvider } from "@/ai/router";
import { AIProviderError, LOCAL_EXECUTION_REQUEST } from "@/ai/provider";
import { isCallPermitted, recordFailure, recordSuccess } from "@/queue/circuit";
import { validateWorkflowOutput } from "@/ai/validate";
import { findInventedMetrics, type EvidenceRecord } from "@/domain/evidence";
import {
  activePromptVersion,
  VALIDATOR_VERSION,
  type WorkflowId,
} from "@/ai/workflow-ids";
import {
  buildManualPrompt,
  type ManualPromptPackage,
} from "@/ai/providers/manual";
import { ManualAIProvider } from "@/ai/providers/manual";
import { recordProductMetric } from "@/lib/observability";
import type { UserApiKey } from "@prisma/client";

/**
 * The single entry point for every AI-assisted workflow.
 *
 * Order of operations (AI extracts, code decides):
 *   provider -> circuit breaker -> raw text -> schema validation ->
 *   evidence validation -> safety validation -> persistence
 *
 * Nothing reaches the user without passing every gate, and Manual Mode is always
 * available so a zero-cost install can complete the workflow.
 */

export interface WorkflowContext {
  userId: string;
  workflowId: WorkflowId;
  context: Record<string, unknown>;
  /** Evidence used to fact-check the AI output. */
  evidence?: EvidenceRecord[];
  traceId?: string;
  userApiKey?: { provider: AIProviderName; key: string } | null;
  preferManual?: boolean;
  /** Optional: pre-supplied raw AI text (Manual Mode paste-back). */
  manualInput?: string;
}

export interface WorkflowResult<T> {
  ok: true;
  data: T;
  interactionId: string;
  provider: AIProviderName;
  model: string;
  promptVersion: string;
  validatorVersion: string;
  manual: boolean;
  warnings: string[];
  needsInput: string[];
  usedFallback: boolean;
  traceId: string;
}

export interface WorkflowFailure {
  ok: false;
  code: string;
  message: string;
  userMessage: string;
  interactionId: string | null;
  traceId: string;
  /** Present when the workflow can still be completed by hand. */
  manualFallback: ManualPromptPackage | null;
  errors: string[];
  retryable: boolean;
}

export type WorkflowOutcome<T> = WorkflowResult<T> | WorkflowFailure;

export async function runWorkflow<T>(
  ctx: WorkflowContext,
): Promise<WorkflowOutcome<T>> {
  const forceLocal = ctx.manualInput === LOCAL_EXECUTION_REQUEST;
  const manualInput = forceLocal ? undefined : ctx.manualInput;
  const traceId = ctx.traceId ?? newTraceId();
  const promptVersion = activePromptVersion(ctx.workflowId);
  const circuitName = `ai:${ctx.workflowId}`;

  const manualPackage = buildManualPrompt(
    ctx.workflowId,
    ctx.context,
    promptVersion,
  );
  const interaction = await prisma.aIInteraction.create({
    data: {
      userId: ctx.userId,
      workflowId: ctx.workflowId,
      promptVersion,
      validatorVersion: VALIDATOR_VERSION,
      provider: "MANUAL",
      status: manualInput ? "PENDING" : "PENDING",
      inputSummary: summarizeInput(ctx.context) as never,
      traceId,
    },
    select: { id: true },
  });

  const finish = async (
    patch: Record<string, unknown>,
    outcome: WorkflowResult<T> | WorkflowFailure,
  ): Promise<WorkflowOutcome<T>> => {
    await prisma.aIInteraction
      .update({ where: { id: interaction.id }, data: patch })
      .catch(() => undefined);
    await recordProductMetric(
      outcome.ok ? "workflow_completed" : "workflow_failed",
      1,
      {
        workflow: ctx.workflowId,
        provider: String(outcome.ok ? outcome.provider : "MANUAL"),
      },
    );
    return outcome;
  };

  // When does a workflow run in Manual Mode instead of calling a model?
  //
  // Only on an explicit gesture: the caller passes `preferManual: true` (the
  // "Use manual mode" button) or supplies a pasted response. A saved account
  // preference used to force Manual Mode for every workflow, which is how the
  // product came to look inert; AI is now the default for every account.
  const preferManual = forceLocal
    ? false
    : manualInput
      ? true
      : ctx.preferManual === true;

  // --- Manual Mode: return the prompt package so the UI can offer it ---------
  // A pasted response always continues through validation, even in Manual Mode;
  // otherwise the paste-back flow could never complete.
  if (preferManual && !manualInput) {
    return finish(
      {
        status: "MANUAL_AWAITING_INPUT",
        provider: "MANUAL",
        model: "user-provided-assistant",
      },
      {
        ok: false,
        code: "MANUAL_REQUIRED",
        message: "Manual Mode: paste an AI response to continue.",
        userMessage:
          "Manual Mode: copy the prompt into your assistant, then paste the response back.",
        interactionId: interaction.id,
        traceId,
        manualFallback: manualPackage,
        errors: ["Awaiting pasted AI response."],
        retryable: false,
      },
    );
  }

  let rawText = manualInput ?? "";
  let providerName: AIProviderName = "MANUAL";
  let model = "user-provided-assistant";
  let durationMs = 0;
  let usedFallback = false;
  const attempts: string[] = [];

  // --- Direct AI Mode --------------------------------------------------------
  if (!rawText) {
    if (!(await isCallPermitted(circuitName))) {
      logWarn(
        { operation: `workflow.${ctx.workflowId}`, traceId },
        "Circuit open; using Manual Mode",
      );
      return finish(
        { status: "MANUAL_AWAITING_INPUT" },
        {
          ok: false,
          code: "CIRCUIT_OPEN",
          message: "The AI provider is temporarily unavailable.",
          userMessage:
            "AI is temporarily unavailable (too many recent failures). Nothing was generated. Try again in a few minutes, or use manual mode.",
          interactionId: interaction.id,
          traceId,
          manualFallback: manualPackage,
          errors: ["Provider circuit is open."],
          retryable: true,
        },
      );
    }

    try {
      const execution = await executeWithFallback(
        {
          workflowId: ctx.workflowId,
          promptVersion,
          systemPrompt: manualPackage.systemPrompt,
          userPrompt: manualPackage.userPrompt,
          expectJson: manualPackage.expectedShape === "JSON",
          jsonHint: manualPackage.outputContract,
          traceId,
        },
        { userApiKey: ctx.userApiKey ?? null },
      );

      usedFallback = execution.usedFallback;
      attempts.push(
        ...execution.attempts.map((a) => `${a.provider}:${a.kind}`),
      );

      if (execution.provider instanceof ManualAIProvider) {
        await recordFailure(circuitName, "all providers unavailable").catch(
          () => undefined,
        );
        return finish(
          { status: "MANUAL_AWAITING_INPUT", provider: "MANUAL" },
          {
            ok: false,
            code: "PROVIDER_UNAVAILABLE",
            message: "No AI provider is available.",
            userMessage: attempts.length
              ? `AI is unavailable right now — every provider failed (${attempts.join(", ")}). Nothing was generated. Retry, or use manual mode.`
              : "AI is not configured on this server (no provider key). Nothing was generated. Use manual mode, or add your own key in Settings.",
            interactionId: interaction.id,
            traceId,
            manualFallback: manualPackage,
            errors: attempts.length ? attempts : ["No provider configured."],
            retryable: true,
          },
        );
      }

      rawText = execution.response.rawText;
      providerName = execution.response.provider;
      model = execution.response.model;
      durationMs = execution.response.durationMs;
      await recordSuccess(circuitName).catch(() => undefined);
      await prisma.systemError
        .updateMany({ where: { traceId, resolutionStatus: "OPEN" }, data: {} })
        .catch(() => undefined);
    } catch (e) {
      const err =
        e instanceof AIProviderError
          ? e
          : new AIProviderError(
              "MANUAL",
              "UNKNOWN",
              e instanceof Error ? e.message : "unknown",
            );
      await recordFailure(circuitName, err.kind).catch(() => undefined);
      const appErr = asAppError(e);
      return finish(
        {
          status: "FAILED",
          errorCategory: "AI_PROVIDER",
          errorCode: err.kind,
          retryCount: 1,
          durationMs,
          provider: providerName,
        },
        {
          ok: false,
          code: err.kind,
          message: err.message,
          userMessage: `AI failed: ${appErr.message} Nothing was generated. Retry, or use manual mode.`,
          interactionId: interaction.id,
          traceId,
          manualFallback: manualPackage,
          errors: [err.message],
          retryable: err.retryable,
        },
      );
    }
  }

  // --- Validation pipeline ---------------------------------------------------
  const validation = validateWorkflowOutput<T>(ctx.workflowId, rawText);

  if (!validation.ok) {
    // One safe correction retry is permitted when a provider was used.
    if (!manualInput && providerName !== "MANUAL") {
      const repaired = await attemptCorrectionRetry(
        ctx,
        rawText,
        validation.errors,
        traceId,
      );
      if (repaired) {
        const second = validateWorkflowOutput<T>(ctx.workflowId, repaired);
        if (second.ok) {
          return complete(
            second.data,
            validation.parse.repaired
              ? ["Pasted response needed local repair."]
              : [],
            second.warnings,
          );
        }
      }
    }
    return finish(
      {
        status: "VALIDATION_FAILED",
        provider: providerName,
        model,
        durationMs,
        outputSummary: summarizeErrors(validation.errors),
      },
      {
        ok: false,
        code: "AI_OUTPUT_INVALID",
        message: "The AI response did not match the expected schema.",
        userMessage: `The AI response could not be validated. Nothing was changed. ${validation.errors.slice(0, 2).join(" ")}`,
        interactionId: interaction.id,
        traceId,
        manualFallback: manualPackage,
        errors: validation.errors,
        retryable: false,
      },
    );
  }

  return complete(validation.data, validation.warnings, []);

  async function complete(
    data: T,
    schemaWarnings: string[],
    extraWarnings: string[],
  ): Promise<WorkflowOutcome<T>> {
    const warnings = [...schemaWarnings, ...extraWarnings];
    const invented = checkForInventedMetrics(
      ctx.workflowId,
      data,
      ctx.evidence ?? [],
    );
    if (invented.length)
      warnings.push(
        `Numbers in the output that no evidence supports: ${invented.join(", ")}.`,
      );

    return finish(
      {
        status: "SUCCEEDED",
        provider: providerName,
        model,
        durationMs,
        outputSummary: summarizeOutput(ctx.workflowId, data),
        fallbackUsed: usedFallback,
      },
      {
        ok: true,
        data,
        interactionId: interaction.id,
        provider: providerName,
        model,
        promptVersion,
        validatorVersion: VALIDATOR_VERSION,
        manual: Boolean(manualInput),
        warnings,
        needsInput: extractNeedsInput(data),
        usedFallback,
        traceId,
      },
    );
  }
}

/**
 * A single corrective retry that asks explicitly for JSON only. Never retries a
 * refusal or a business-rule rejection.
 */
async function attemptCorrectionRetry(
  ctx: WorkflowContext,
  rawText: string,
  errors: string[],
  traceId: string,
): Promise<string | null> {
  try {
    const resolution = await resolveProvider({
      userApiKey: ctx.userApiKey ?? null,
    });
    if (resolution.provider instanceof ManualAIProvider) return null;
    const response = await resolution.provider.generate({
      workflowId: ctx.workflowId,
      promptVersion: activePromptVersion(ctx.workflowId),
      systemPrompt:
        "You must return a single valid JSON object and nothing else. No prose, no markdown fences, no comments.",
      userPrompt: [
        "Your previous response was rejected by a schema validator.",
        `Errors: ${errors.slice(0, 6).join(" | ")}`,
        "",
        "Return the corrected JSON object now. Output JSON only.",
        "",
        "Previous response (for reference):",
        rawText.slice(0, 2000),
      ].join("\n"),
      expectJson: true,
      traceId,
    });
    if (env().NODE_ENV !== "production") {
      logInfo({ operation: "workflow.correction" }, "Correction retry issued", {
        traceId,
      });
    }
    return response.rawText;
  } catch {
    return null;
  }
}

/** Workflows whose output contains prose get the invented-metric check. */
// RESUME_TAILORING is checked by its own, stricter guard (src/domain/tailoring.ts),
// which also allows numbers already present in the user's resume.
const PROSE_WORKFLOWS = new Set<WorkflowId>([
  "RESUME_BULLET",
  "COVER_LETTER",
  "APPLICATION_ANSWER",
  "STAR_STORY",
  "FOLLOW_UP",
  "LINKEDIN_OPTIMIZER",
]);

function checkForInventedMetrics(
  workflowId: WorkflowId,
  data: unknown,
  evidence: EvidenceRecord[],
): string[] {
  if (!PROSE_WORKFLOWS.has(workflowId)) return [];
  const text = collectStrings(data).join(" ");
  return findInventedMetrics(text, evidence);
}

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, acc);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "unsupportedAspects" || k === "needsInput") continue;
      collectStrings(v, acc);
    }
  }
  return acc;
}

function extractNeedsInput(data: unknown): string[] {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      if (Array.isArray(v.needsInput)) out.push(...v.needsInput.map(String));
      else for (const x of Object.values(v)) visit(x);
    }
  };
  visit(data);
  return [...new Set(out)];
}

function summarizeInput(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (typeof v === "string") out[k] = { chars: v.length };
    else if (Array.isArray(v)) out[k] = { items: v.length };
    else out[k] = typeof v;
  }
  return out;
}

function summarizeOutput(
  workflowId: WorkflowId,
  data: unknown,
): Record<string, unknown> {
  return {
    workflowId,
    keys:
      data && typeof data === "object" ? Object.keys(data).slice(0, 12) : [],
  };
}

function summarizeErrors(errors: string[]): Record<string, unknown> {
  return { count: errors.length, first: errors.slice(0, 3) };
}

export async function getUserApiKeyForWorkflow(
  userId: string,
): Promise<{ provider: AIProviderName; key: string } | null> {
  const row = await prisma.userApiKey.findFirst({
    where: { userId, keyStatus: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  try {
    const { decryptSecret } = await import("@/lib/crypto");
    return {
      provider: row.provider,
      key: decryptSecret(Buffer.from(row.encryptedKey)),
    };
  } catch {
    throw Errors.configuration("Stored API key could not be decrypted.");
  }
}

export type { UserApiKey };

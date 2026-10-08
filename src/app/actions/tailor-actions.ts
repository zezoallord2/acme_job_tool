"use server";

import { revalidatePath } from "next/cache";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { requireSameOrigin, requireUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceDailyCap } from "@/lib/usage-caps";
import { getEntitlementState } from "@/services/entitlement-service";
import {
  saveTailoredResume,
  tailorResume,
  TailorFailure,
  type TailorInput,
  type TailorProposal,
} from "@/services/tailor-service";
import type { ManualPromptPackage } from "@/ai/providers/manual";

/**
 * Resume tailoring actions. One primary action (AI), the same action in Manual
 * Mode (prompt out, paste in), and save. Open to every plan; a daily cap and the
 * aiAssist rate limit stop abuse.
 */

export type TailorActionResult =
  | { ok: true; proposal: TailorProposal }
  | {
      ok: false;
      message: string;
      code?: string;
      prompt?: ManualPromptPackage;
      applicationId?: string | null;
      errors?: string[];
    };

function str(value: unknown, max = 30_000): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

export async function tailorAction(
  raw: Record<string, unknown>,
): Promise<TailorActionResult> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("aiAssist", { userId: user.id });

    const manualInput = str(raw.manualInput, 100_000);
    const manualPrompt = raw.mode === "manual-prompt";
    // The daily cap protects hosted AI quota; a Manual Mode round trip costs
    // nothing, so it is not counted.
    if (!manualInput && !manualPrompt) {
      const state = await getEntitlementState(user.id);
      await enforceDailyCap(user.id, "tailor", state.isComplete);
    }

    const input: TailorInput = {
      applicationId: str(raw.applicationId, 60),
      jobText: str(raw.jobText),
      jobUrl: str(raw.jobUrl, 2000),
      jobTitle: str(raw.jobTitle, 200),
      company: str(raw.company, 200),
      resumeId: str(raw.resumeId, 60),
      manualInput,
      manualPrompt,
    };
    const proposal = await tailorResume(user.id, input);
    return { ok: true, proposal };
  } catch (e) {
    if (e instanceof TailorFailure) {
      return {
        ok: false,
        message: e.message,
        code: e.code,
        prompt: e.prompt ?? undefined,
        applicationId: e.applicationId,
        errors: e.errors,
      };
    }
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

export async function saveTailoredAction(
  payload: unknown,
): Promise<
  { ok: true; resumeId: string; label: string } | { ok: false; message: string }
> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const saved = await saveTailoredResume(user.id, payload);
    revalidatePath("/app/resumes");
    revalidatePath("/app/applications");
    return { ok: true, ...saved };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

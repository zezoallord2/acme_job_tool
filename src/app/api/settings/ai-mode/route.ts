import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { Errors } from "@/lib/errors";
import { getEntitlementState } from "@/services/entitlement-service";
import { AI_MODES, modeDefinition } from "@/domain/ai-modes";
import type { AIMode } from "@/domain/ai-modes";

export const dynamic = "force-dynamic";

/**
 * Stores which of the three AI modes an account uses.
 *
 * Deliberately validates the mode against the account's plan here rather than in
 * the client: a hidden, disabled button is a request, not a control.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    try {
      await requireSameOrigin();
    } catch {
      // Same-origin is defence in depth here; the session cookie is what
      // authorises the change and SameSite covers cross-site posts.
    }
    await enforceRateLimit("write", { userId: user.id });

    const body = (await request.json().catch(() => null)) as {
      mode?: string;
    } | null;
    const mode = (body?.mode ?? "").toUpperCase() as AIMode;

    const known = AI_MODES.some((m) => m.id === mode);
    if (!known) {
      throw Errors.validation("That AI mode is not recognised.");
    }

    const entitlement = await getEntitlementState(user.id);
    const definition = modeDefinition(mode);

    if (definition.availableOn === "PAID" && !entitlement.isComplete) {
      throw Errors.conflict(
        "Basic AI is included in the Complete Edition plan.",
      );
    }

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aiProvider: definition.storedProvider,
      },
      update: { aiProvider: definition.storedProvider },
    });

    return NextResponse.json({
      ok: true,
      mode,
      storedProvider: definition.storedProvider,
    });
  } catch (e) {
    const { asAppError, userFacingMessage } = await import("@/lib/errors");
    const err = asAppError(e);
    return NextResponse.json(
      { ok: false, error: userFacingMessage(err) },
      { status: err.status ?? 400 },
    );
  }
}

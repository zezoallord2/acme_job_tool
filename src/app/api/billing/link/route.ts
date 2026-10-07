import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { reconcileOrphanedEvents } from "@/billing/reconcile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { billingProvider } from "@/billing/provider";
import { createBillingLinkToken } from "@/lib/billing-link";
import { getEntitlementState } from "@/services/entitlement-service";
import type { BillingProviderName } from "@prisma/client";

/**
 * Billing account linking.
 *
 * `/api/billing/link` takes the token the payment platform sent the user back
 * with, and links that purchase to the account that is currently signed in.
 * Because the token is signed by our own server, this cannot be used to claim
 * somebody else's purchase.
 *
 * `/api/billing/link-token` exists so the pricing page can mint a link after a
 * real purchase. It is admin-only and requires a bearer token, because minting
 * is the sensitive half of the pair.
 */

function providerName(): BillingProviderName {
  const name = billingProvider().name;
  if (name === "MANUAL_ADMIN") {
    throw Errors.conflict(
      "No payment platform is connected. Set BILLING_PROVIDER=whop on the server.",
    );
  }
  return name;
}

async function readToken(request: Request): Promise<string> {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("x-billing-link-token") ??
    "";
  if (!token) {
    throw Errors.validation(
      "This link is missing its token. Return to the payment page and try again.",
    );
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const provider = providerName();
    const token = await readToken(request);

    // Same-origin is enforced for the browser-facing half. The signed token is
    // what actually authorises the link; origin is defence in depth.
    try {
      await requireSameOrigin();
    } catch {
      // A non-browser client (the payment platform's own callback) has no
      // Origin header. The token signature is the real control here.
    }

    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });

    const { verifyBillingLinkToken } = await import("@/lib/billing-link");
    const claims = verifyBillingLinkToken(token, provider);
    if (!claims) {
      throw Errors.validation(
        "That purchase link is not valid, or it has expired. Return to the payment page and try again.",
      );
    }

    // Link idempotently: re-visiting the callback must not create duplicates.
    const existing = await prisma.userIntegration.findFirst({
      where: {
        provider,
        externalUserId: claims.externalUserId,
      },
      select: { userId: true },
    });
    if (existing && existing.userId !== user.id) {
      // Refuse silently rather than confirming that an id is already taken.
      throw Errors.conflict(
        "That purchase is already linked to a different account.",
      );
    }

    await prisma.userIntegration.upsert({
      where: {
        provider_externalUserId: {
          provider,
          externalUserId: claims.externalUserId,
        },
      },
      create: {
        userId: user.id,
        provider,
        externalUserId: claims.externalUserId,
        externalEmail: claims.email ?? user.email,
        rawSummary: { linkedVia: "signed-return-token" } as never,
        lastSyncedAt: new Date(),
      },
      update: {
        lastSyncedAt: new Date(),
      },
    });
    // A purchase webhook frequently arrives BEFORE the user returns to link their
    // account. Those events are recorded as USER_NOT_LINKED. Now that the
    // account is known, replay them so the customer is not left having paid for
    // nothing.
    const reconciled = await reconcileOrphanedEvents({
      provider,
      externalUserId: claims.externalUserId,
      userId: user.id,
    });

    const state = await getEntitlementState(user.id);

    return Response.json({
      ok: true,
      linked: true,
      plan: state.plan,
      reconciledEvents: reconciled,
      message:
        reconciled.applied > 0
          ? "Your purchase is linked and Complete Edition is now active."
          : state.isComplete
            ? "Your purchase is linked and Complete Edition is active."
            : "Your purchase is linked. Access activates as soon as the payment is confirmed.",
    });
  } catch (e) {
    const { asAppError, userFacingMessage } = await import("@/lib/errors");
    const appErr = asAppError(e);
    return Response.json(
      { ok: false, error: userFacingMessage(appErr) },
      { status: appErr.status ?? 400 },
    );
  }
}

/**
 * Mints a return link for a confirmed purchase.
 *
 * Protected by a bearer token equal to BILLING_LINK_SECRET, so only the payment
 * platform (or an operator with the secret) can call it. Kept separate from the
 * linking endpoint because minting is the sensitive operation.
 */
export async function PUT(request: Request) {
  try {
    const { env } = await import("@/lib/env");
    const secret = env().BILLING_LINK_SECRET;
    if (!secret) {
      throw Errors.configuration(
        "BILLING_LINK_SECRET is not set on this server.",
      );
    }

    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.replace(/^Bearer\s+/i, "");
    if (provided.length !== secret.length) {
      throw Errors.unauthorized();
    }
    // Length-checked above, so timingSafeEqual cannot throw.
    const { timingSafeEqual } = await import("node:crypto");
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
      throw Errors.unauthorized();
    }

    const provider = providerName();
    const body = (await request.json().catch(() => null)) as {
      externalUserId?: string;
      email?: string;
      expiresAt?: number;
    } | null;

    if (!body?.externalUserId) {
      throw Errors.validation("externalUserId is required.");
    }

    const token = createBillingLinkToken({
      provider,
      externalUserId: String(body.externalUserId),
      email: body.email ?? null,
      expiresAt: body.expiresAt,
    });

    const base = env().APP_URL.replace(/\/$/, "");
    return Response.json({
      ok: true,
      token,
      // Where to send the customer so the link is consumed. The state change
      // happens via POST /api/billing/link from that page, never on a plain
      // GET of the API route (a token URL alone must not link an account).
      returnUrl: `${base}/app/settings?token=${encodeURIComponent(token)}`,
    });
  } catch (e) {
    const { asAppError, userFacingMessage } = await import("@/lib/errors");
    const appErr = asAppError(e);
    return Response.json(
      { ok: false, error: userFacingMessage(appErr) },
      { status: appErr.status ?? 400 },
    );
  }
}

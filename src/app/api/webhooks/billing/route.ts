import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { billingProvider } from "@/billing/provider";
import { hashContent } from "@/lib/crypto";
import {
  grantCompleteEntitlement,
  revokeCompleteEntitlement,
} from "@/services/entitlement-service";
import { jobQueue } from "@/queue/queue";
import { orphanSummary } from "@/billing/reconcile";
import { logInfo, logWarn } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Billing webhook endpoint.
 *
 * Hardening: signature verification, replay protection, idempotency, bounded
 * retries and status recording. A duplicate delivery can never grant access
 * twice, because the entitlement table has a unique (source, externalEventId).
 */
export async function POST(request: Request) {
  const provider = billingProvider();
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-whop-signature") ??
    request.headers.get("x-signature");

  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: "Billing provider is not configured on this deployment." },
      { status: 503 },
    );
  }

  if (!provider.verifySignature(rawBody, signature)) {
    logWarn(
      { operation: "webhook.invalid-signature" },
      "Rejected webhook with invalid signature",
    );
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const event = provider.toEntitlementEvent(payload);
  if (!event || !event.externalEventId) {
    return NextResponse.json(
      { error: "Unrecognised event shape." },
      { status: 422 },
    );
  }

  // Replay protection: a processed event id is acknowledged but not re-applied.
  if (await provider.isReplay(event.externalEventId)) {
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: provider.name,
          externalEventId: event.externalEventId,
        },
      },
      select: { id: true },
    });
    logInfo({ operation: "webhook.replay" }, "Duplicate webhook ignored", {
      eventId: event.externalEventId,
    });
    return NextResponse.json(
      { ok: true, duplicate: true, eventId: existing?.id },
      { status: 200 },
    );
  }

  const payloadHash = hashContent(rawBody);
  const record = await prisma.webhookEvent.create({
    data: {
      provider: provider.name,
      externalEventId: event.externalEventId,
      eventType: String((payload as { type?: string }).type ?? "unknown"),
      signatureValid: true,
      replayDetected: false,
      payloadHash,
      sanitizedPayload: event.rawSummary as never,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  // Map the external user to a local account.
  const integration = await prisma.userIntegration.findFirst({
    where: { provider: provider.name, externalUserId: event.externalUserId },
    select: { userId: true },
  });

  if (!integration) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        errorCode: "USER_NOT_LINKED",
        errorMessage: "No local account is linked to this external user.",
        // Retain just enough to replay this once the account is linked, so a
        // customer who paid before linking still gets access.
        sanitizedPayload: orphanSummary({
          externalUserId: event.externalUserId,
          externalCustomerId: event.externalCustomerId,
          externalSubscriptionId: event.externalSubscriptionId,
          plan: event.plan,
          type: String((payload as { type?: string }).type ?? "unknown"),
        }) as never,
      },
    });
    return NextResponse.json(
      { error: "No linked account for this external user." },
      { status: 202 },
    );
  }

  try {
    if (event.plan === "COMPLETE") {
      const result = await grantCompleteEntitlement({
        userId: integration.userId,
        source: provider.name,
        externalEventId: event.externalEventId,
        externalCustomerId: event.externalCustomerId,
        externalSubscriptionId: event.externalSubscriptionId,
      });
      await prisma.webhookEvent.update({
        where: { id: record.id },
        data: {
          status: "SUCCEEDED",
          processedAt: new Date(),
          entitlementId: result.id,
        },
      });
      logInfo({ operation: "webhook.granted" }, "Entitlement granted", {
        eventId: event.externalEventId,
        deduplicated: result.deduplicated,
      });
    } else {
      await revokeCompleteEntitlement(integration.userId);
      await prisma.webhookEvent.update({
        where: { id: record.id },
        data: { status: "SUCCEEDED", processedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    // Persist for a controlled retry rather than losing the event.
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: "QUEUED",
        errorCode: "PROCESSING_FAILED",
        errorMessage: e instanceof Error ? e.message.slice(0, 300) : "unknown",
        attempts: { increment: 1 },
      },
    });
    await jobQueue().enqueue({
      type: "WEBHOOK_PROCESS",
      userId: integration.userId,
      payload: { webhookEventId: record.id },
      idempotencyKey: `webhook-retry:${record.id}`,
    });
    return NextResponse.json({ ok: false, queued: true }, { status: 202 });
  }
}

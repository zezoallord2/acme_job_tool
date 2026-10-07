import { prisma } from "@/lib/db";
import { hashContent } from "@/lib/crypto";
import {
  grantCompleteEntitlement,
  revokeCompleteEntitlement,
} from "@/services/entitlement-service";
import { logInfo, logWarn } from "@/lib/logger";
import type { BillingProviderName, QueueJobState } from "@prisma/client";

/**
 * Replays webhook events that arrived before the account was linked.
 *
 * Race, and it is a common one: the platform confirms the purchase by webhook
 * the moment payment clears, but the customer does not return to Acme Jobs until
 * later. The first webhook has no way to identify the local account, so it is
 * recorded as `USER_NOT_LINKED` and set aside. Without a replay step that
 * customer pays and never gets access.
 *
 * The webhook table keeps a sanitized copy of each event, which is what makes
 * this possible after the fact. Only the fields needed to grant or revoke are
 * retained; nothing sensitive is stored.
 */

export interface ReconcileResult {
  examined: number;
  applied: number;
  failed: number;
}

/** Recorded by the webhook route when it could not identify the account. */
const ORPHAN_ERROR_CODE = "USER_NOT_LINKED";

export async function reconcileOrphanedEvents(input: {
  provider: BillingProviderName;
  externalUserId: string;
  userId: string;
}): Promise<ReconcileResult> {
  const orphaned = await prisma.webhookEvent.findMany({
    where: {
      provider: input.provider,
      errorCode: ORPHAN_ERROR_CODE,
      status: { in: ["FAILED", "QUEUED"] as QueueJobState[] },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const result: ReconcileResult = {
    examined: orphaned.length,
    applied: 0,
    failed: 0,
  };
  if (orphaned.length === 0) return result;

  for (const event of orphaned) {
    const summary = (event.sanitizedPayload ?? {}) as {
      externalUserId?: string;
      externalCustomerId?: string | null;
      externalSubscriptionId?: string | null;
      plan?: string;
      type?: string;
    };

    // Guard against a row belonging to a different customer, which would be a
    // cross-account grant if applied blindly.
    if (
      summary.externalUserId &&
      summary.externalUserId !== input.externalUserId
    ) {
      continue;
    }

    // Mark it claimed first so two concurrent link attempts cannot both apply it.
    const claimed = await prisma.webhookEvent.updateMany({
      where: { id: event.id, status: event.status },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) continue;

    try {
      if (summary.plan === "FREE") {
        await revokeCompleteEntitlement(input.userId);
      } else {
        const granted = await grantCompleteEntitlement({
          userId: input.userId,
          source: input.provider,
          externalEventId: event.externalEventId,
          externalCustomerId: summary.externalCustomerId ?? null,
          externalSubscriptionId: summary.externalSubscriptionId ?? null,
        });
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "SUCCEEDED",
            processedAt: new Date(),
            errorCode: null,
            errorMessage: null,
            entitlementId: granted.id,
          },
        });
      }
      result.applied += 1;
      logInfo(
        { operation: "billing.reconcile", traceId: event.id },
        "Replayed orphaned billing event after account link",
        { externalEventId: event.externalEventId, userId: input.userId },
      );
    } catch (e) {
      result.failed += 1;
      await prisma.webhookEvent
        .update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            errorCode: "RECONCILE_FAILED",
            errorMessage:
              e instanceof Error ? e.message.slice(0, 500) : "unknown",
          },
        })
        .catch(() => undefined);
      logWarn(
        { operation: "billing.reconcile", traceId: event.id },
        "Could not replay an orphaned billing event",
      );
    }
  }

  return result;
}

/**
 * Stores the identifying fields on the event so a later replay is possible.
 * Deliberately excludes anything sensitive: no full payloads, no payment data.
 */
export function orphanSummary(event: {
  externalUserId: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  plan: string;
  type: string;
}) {
  return {
    externalUserId: event.externalUserId,
    externalCustomerId: event.externalCustomerId ?? null,
    externalSubscriptionId: event.externalSubscriptionId ?? null,
    plan: event.plan,
    type: event.type,
    hash: hashContent(event.externalUserId),
  };
}

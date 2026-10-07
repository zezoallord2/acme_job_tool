import { prisma } from "@/lib/db";
import { logInfo } from "@/lib/logger";

/**
 * Whop billing diagnostics.
 *
 * The billing path fails in ways a generic error message cannot explain: a
 * webhook arrives with no way to identify the account, a link is never followed,
 * a replay is ignored. Each of those is invisible without a way to look up "what
 * happened to event X", so this module provides one.
 *
 * Two rules:
 *
 *  1. Nothing here ever returns payment data. Whop's payload is reduced to the
 *     fields needed to grant or revoke an entitlement, and only that reduced
 *     form was stored in the first place.
 *  2. Every lookup is read-only. Inspecting billing state must never change it.
 */

/**
 * Lifecycle of a webhook event.
 *
 * Stored as a string on the existing row rather than a database enum, so this
 * milestone needs no migration. `RECEIVED` and `VERIFIED` are derived from
 * `signatureValid`; the rest map onto the stored status and error code.
 */
export type WhopEventState =
  | "RECEIVED"
  | "VERIFIED"
  | "USER_NOT_LINKED"
  | "HELD"
  | "RECONCILED"
  | "APPLIED"
  | "DUPLICATE"
  | "FAILED";

export interface WhopEventView {
  id: string;
  /** Whop's own event identifier. */
  externalEventId: string;
  eventType: string;
  state: WhopEventState;
  /** Derived, not stored: false means the signature did not verify. */
  signatureValid: boolean;
  /** The reduced payload. Contains no payment instrument or card data. */
  summary: Record<string, unknown> | null;
  /** Our own event row, for an admin jumping from here to the raw record. */
  webhookEventId: string;
  entitlementId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  receivedAt: Date;
  processedAt: Date | null;
}

export function deriveState(row: {
  status: string;
  signatureValid: boolean;
  errorCode: string | null;
  entitlementId: string | null;
  replayDetected: boolean;
}): WhopEventState {
  if (!row.signatureValid) return "RECEIVED";
  if (row.replayDetected) return "DUPLICATE";
  if (row.errorCode === "USER_NOT_LINKED") return "HELD";
  if (row.status === "FAILED") return "FAILED";
  if (row.status === "SUCCEEDED") {
    return row.entitlementId ? "APPLIED" : "RECONCILED";
  }
  return "VERIFIED";
}

function toView(row: {
  id: string;
  externalEventId: string;
  eventType: string;
  status: string;
  signatureValid: boolean;
  replayDetected: boolean;
  sanitizedPayload: unknown;
  entitlementId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  receivedAt: Date;
  processedAt: Date | null;
}): WhopEventView {
  return {
    id: row.id,
    externalEventId: row.externalEventId,
    eventType: row.eventType,
    state: deriveState(row),
    signatureValid: row.signatureValid,
    summary: (row.sanitizedPayload ?? null) as Record<string, unknown> | null,
    webhookEventId: row.id,
    entitlementId: row.entitlementId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    attempts: row.attempts,
    receivedAt: row.receivedAt,
    processedAt: row.processedAt,
  };
}

const ORDER_BY_RECENT = { receivedAt: "desc" } as const;

/** Finds an event by Whop's event id. The id an operator pastes from a log. */
export async function findByExternalEventId(
  externalEventId: string,
): Promise<WhopEventView | null> {
  const row = await prisma.webhookEvent.findFirst({
    where: { provider: "WHOP", externalEventId },
    orderBy: ORDER_BY_RECENT,
  });
  return row ? toView(row) : null;
}

/**
 * Finds every event belonging to one Whop customer.
 *
 * The external user id is stored inside the reduced payload rather than in a
 * dedicated column, so this reads the JSON. That is acceptable at diagnostic
 * volumes and avoids a migration during closeout.
 */
export async function findByExternalUserId(
  externalUserId: string,
): Promise<WhopEventView[]> {
  const rows = await prisma.webhookEvent.findMany({
    where: {
      provider: "WHOP",
      sanitizedPayload: { path: ["externalUserId"], equals: externalUserId },
    },
    orderBy: ORDER_BY_RECENT,
    take: 50,
  });
  return rows.map(toView);
}

/**
 * Everything billing-related for one local account: the linked purchase identity,
 * its events, and its entitlements. Requires admin access at the call site.
 */
export async function findByLocalUserId(localUserId: string): Promise<{
  user: { id: string; email: string } | null;
  integrations: Array<{
    provider: string;
    externalUserId: string;
    externalEmail: string | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
  }>;
  events: WhopEventView[];
  entitlements: Array<{
    id: string;
    plan: string;
    status: string;
    source: string;
    createdAt: Date;
    expiresAt: Date | null;
  }>;
}> {
  const [user, integrations, entitlements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: localUserId },
      select: { id: true, email: true },
    }),
    prisma.userIntegration.findMany({
      where: { userId: localUserId },
      select: {
        provider: true,
        externalUserId: true,
        externalEmail: true,
        lastSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.entitlement.findMany({
      where: { userId: localUserId },
      select: {
        id: true,
        plan: true,
        status: true,
        source: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Match on the purchase identities linked to this account. Filtering in the
  // database rather than in JS matters: a page of other users' events would
  // otherwise be truncated before this user's rows were ever seen.
  const linkedIds = integrations
    .filter((i) => i.provider === "WHOP")
    .map((i) => i.externalUserId);

  const events =
    linkedIds.length === 0
      ? []
      : await prisma.webhookEvent.findMany({
          where: {
            provider: "WHOP",
            OR: linkedIds.map((externalUserId) => ({
              sanitizedPayload: {
                path: ["externalUserId"],
                equals: externalUserId,
              },
            })),
          },
          orderBy: ORDER_BY_RECENT,
          take: 50,
        });

  return {
    user,
    integrations,
    events: events.map(toView),
    entitlements,
  };
}

/**
 * Translates a lifecycle state into a `where` clause.
 *
 * Derived from the same precedence as `deriveState`, and written out in full for
 * every state on purpose: a state with no clause would silently fall through to
 * an unfiltered query and hand the operator every event, which is worse than an
 * empty list during an incident.
 */
export function stateFilter(state: WhopEventState): Record<string, unknown> {
  const provider = "WHOP";
  // `deriveState` returns early on these two, so they take precedence over
  // status, error code and replay.
  if (state === "RECEIVED") return { provider, signatureValid: false };
  if (state === "DUPLICATE")
    return { provider, replayDetected: true, signatureValid: true };

  // Everything below is a well-formed, signature-valid, non-replayed event.
  // `errorCode: { not: "USER_NOT_LINKED" }` alone is wrong: SQL renders that as
  // `errorCode <> 'USER_NOT_LINKED'`, which is unknown -- therefore excluded --
  // for the overwhelmingly common NULL case. The normal path is stated outright.
  const sound = {
    provider,
    signatureValid: true,
    replayDetected: false,
    OR: [{ errorCode: null }, { errorCode: { not: "USER_NOT_LINKED" } }],
  } as const;

  if (state === "HELD" || state === "USER_NOT_LINKED") {
    return {
      provider,
      signatureValid: true,
      replayDetected: false,
      errorCode: "USER_NOT_LINKED",
    };
  }
  if (state === "FAILED") return { ...sound, status: "FAILED" };
  if (state === "APPLIED") {
    return { ...sound, status: "SUCCEEDED", entitlementId: { not: null } };
  }
  if (state === "RECONCILED") {
    // A succeeded event that granted no entitlement: processed, nothing owed.
    return { ...sound, status: "SUCCEEDED", entitlementId: null };
  }
  // VERIFIED
  return { ...sound, status: { in: ["QUEUED", "PROCESSING"] } };
}

/** Filters the event log by lifecycle state, for "show me what failed". */
export async function findByState(
  state: WhopEventState,
  take = 50,
): Promise<WhopEventView[]> {
  const rows = await prisma.webhookEvent.findMany({
    where: stateFilter(state) as never,
    orderBy: ORDER_BY_RECENT,
    take,
  });
  return rows.map(toView);
}

/** Counts per state, so an operator sees the shape of a problem at a glance. */
export async function stateCounts(): Promise<Record<WhopEventState, number>> {
  const rows = await prisma.webhookEvent.findMany({
    where: { provider: "WHOP" },
    select: {
      status: true,
      signatureValid: true,
      replayDetected: true,
      errorCode: true,
      entitlementId: true,
    },
    take: 5000,
  });
  const counts: Record<WhopEventState, number> = {
    RECEIVED: 0,
    VERIFIED: 0,
    USER_NOT_LINKED: 0,
    HELD: 0,
    RECONCILED: 0,
    APPLIED: 0,
    DUPLICATE: 0,
    FAILED: 0,
  };
  for (const row of rows) {
    counts[deriveState(row)] += 1;
  }
  return counts;
}

/**
 * Replays a held event after the account has been linked.
 *
 * Explicit and idempotent. It is the manual counterpart to the automatic
 * reconciliation that runs when someone follows their link, for the case where
 * the link was followed before the webhook arrived.
 */
export async function replayHeldEvent(
  webhookEventId: string,
): Promise<{ applied: number; failed: number; message: string }> {
  const row = await prisma.webhookEvent.findFirst({
    where: { id: webhookEventId, provider: "WHOP" },
  });
  if (!row) {
    return { applied: 0, failed: 0, message: "No such webhook event." };
  }
  if (row.errorCode !== "USER_NOT_LINKED") {
    return {
      applied: 0,
      failed: 0,
      message: `That event is not held (state: ${deriveState(row)}). Only USER_NOT_LINKED events can be replayed.`,
    };
  }

  const summary = (row.sanitizedPayload ?? {}) as {
    externalUserId?: string;
    plan?: string;
  };
  if (!summary.externalUserId) {
    return {
      applied: 0,
      failed: 0,
      message:
        "That event has no external user id recorded, so it cannot be matched.",
    };
  }

  const integration = await prisma.userIntegration.findFirst({
    where: { provider: "WHOP", externalUserId: summary.externalUserId },
    select: { userId: true },
  });
  if (!integration) {
    return {
      applied: 0,
      failed: 0,
      message:
        "No local account is linked to this Whop user yet. Have the customer open their return link first.",
    };
  }

  const { reconcileOrphanedEvents } = await import("@/billing/reconcile");
  const result = await reconcileOrphanedEvents({
    provider: "WHOP",
    externalUserId: summary.externalUserId,
    userId: integration.userId,
  });

  logInfo(
    { operation: "whop.replay" },
    "Manually replayed a held webhook event",
    { webhookEventId, applied: result.applied },
  );
  return {
    applied: result.applied,
    failed: result.failed,
    message:
      result.applied > 0
        ? `Replayed ${result.applied} event(s); entitlement granted.`
        : "Nothing was applied. The event may already have been processed.",
  };
}

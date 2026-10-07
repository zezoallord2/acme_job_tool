import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import {
  CAPABILITIES_BY_PLAN,
  PLAN_LIMITS,
  planHasCapability,
  type Capability,
  type PlanLimits,
} from "@/domain/entitlements";
import type { EntitlementPlan } from "@prisma/client";

/**
 * Centralized entitlements. UI never branches on `isPaid` directly — it asks this
 * service, so the Free/Complete boundary is defined in exactly one place and is
 * enforced server-side on every guarded action.
 */

export interface EntitlementState {
  plan: EntitlementPlan;
  capabilities: readonly Capability[];
  limits: PlanLimits;
  isComplete: boolean;
  source: string;
  expiresAt: Date | null;
}

export async function getEntitlementState(
  userId: string,
): Promise<EntitlementState> {
  const active = await prisma.entitlement.findFirst({
    where: {
      userId,
      plan: "COMPLETE",
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: { plan: true, source: true, expiresAt: true },
  });
  const plan: EntitlementPlan = active ? "COMPLETE" : "FREE";
  return {
    plan,
    capabilities: CAPABILITIES_BY_PLAN[plan],
    limits: PLAN_LIMITS[plan],
    isComplete: plan === "COMPLETE",
    source: active?.source ?? "none",
    expiresAt: active?.expiresAt ?? null,
  };
}

export class EntitlementError extends Error {
  readonly capability: Capability;
  readonly requiredPlan: EntitlementPlan;
  constructor(capability: Capability, requiredPlan: EntitlementPlan) {
    super(
      `This feature requires the ${requiredPlan === "COMPLETE" ? "AI Job Hunter — Complete Edition" : "paid"} plan.`,
    );
    this.name = "EntitlementError";
    this.capability = capability;
    this.requiredPlan = requiredPlan;
  }
}

/**
 * Server-side gate. Throws a typed error the UI can turn into a clean upgrade
 * prompt. This is the only supported way to gate a paid capability.
 */
export async function requireCapability(
  userId: string,
  capability: Capability,
): Promise<EntitlementState> {
  const state = await getEntitlementState(userId);
  if (!planHasCapability(state.plan, capability)) {
    throw new EntitlementError(capability, "COMPLETE");
  }
  return state;
}

export async function hasCapability(
  userId: string,
  capability: Capability,
): Promise<boolean> {
  const state = await getEntitlementState(userId);
  return planHasCapability(state.plan, capability);
}

/** Numeric limit check, enforced server-side rather than hidden in the UI. */
export async function assertWithinLimit(
  userId: string,
  kind: "starStories" | "savedApplications" | "resumeVersions",
  currentCount: number,
): Promise<void> {
  const state = await getEntitlementState(userId);
  const limit = state.limits[kind];
  if (currentCount >= limit) {
    throw Errors.validation(
      kind === "starStories"
        ? `The Starter plan includes ${limit} STAR story. Upgrade to Complete Edition for the full bank.`
        : kind === "savedApplications"
          ? `The Starter plan holds ${limit} saved applications. Upgrade to Complete Edition to track more.`
          : `The Starter plan holds ${limit} resume version. Upgrade to Complete Edition for job-specific versions.`,
      { limit, currentCount, kind },
    );
  }
}

/** Grants or revokes an entitlement. Idempotent per external event id. */
export async function grantCompleteEntitlement(input: {
  userId: string;
  source: "WHOP" | "STRIPE" | "MANUAL_ADMIN";
  externalEventId?: string | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  expiresAt?: Date | null;
  adminUserId?: string | null;
}): Promise<{ id: string; deduplicated: boolean }> {
  return inTransaction(async (tx) => {
    if (input.externalEventId) {
      const existing = await tx.entitlement.findUnique({
        where: {
          source_externalEventId: {
            source: input.source,
            externalEventId: input.externalEventId,
          },
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id, deduplicated: true };
    }
    const created = await tx.entitlement.create({
      data: {
        userId: input.userId,
        plan: "COMPLETE",
        status: "ACTIVE",
        source: input.source,
        externalEventId: input.externalEventId ?? null,
        externalCustomerId: input.externalCustomerId ?? null,
        externalSubscriptionId: input.externalSubscriptionId ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: "entitlement.granted",
        entity: "Entitlement",
        entityId: created.id,
        outcome: "success",
        metadata: {
          source: input.source,
          adminUserId: input.adminUserId ?? null,
        },
      },
    });
    return { id: created.id, deduplicated: false };
  });
}

export async function revokeCompleteEntitlement(
  userId: string,
  adminUserId?: string | null,
): Promise<number> {
  return inTransaction(async (tx) => {
    const result = await tx.entitlement.updateMany({
      where: { userId, plan: "COMPLETE", status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "entitlement.revoked",
        entity: "Entitlement",
        outcome: "success",
        metadata: { count: result.count, adminUserId: adminUserId ?? null },
      },
    });
    return result.count;
  });
}

export async function entitlementSnapshot(userId: string) {
  return prisma.entitlement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

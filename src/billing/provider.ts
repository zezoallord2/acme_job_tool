import type { EntitlementPlan } from "@prisma/client";

/**
 * Billing/EntitlementProvider abstraction.
 *
 * `ManualAdminEntitlementProvider` is always available and needs no credentials,
 * which is what makes a $0 local setup fully testable including paid features.
 * `WhopEntitlementProvider` is a real adapter with signature verification,
 * replay protection and idempotent grants — it simply reports itself as
 * unconfigured until credentials exist.
 */
export interface EntitlementEvent {
  externalEventId: string;
  externalUserId: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  plan: EntitlementPlan;
  occurredAt: Date;
  rawSummary: Record<string, unknown>;
}

export interface BillingProvider {
  readonly name: "WHOP" | "STRIPE" | "MANUAL_ADMIN";
  isConfigured(): boolean;
  /** Cost responsibility, for honest display. */
  readonly costModel: "FREE" | "PAID_PLATFORM";
  readonly costLabel: string;
  verifySignature(rawBody: string, signature: string | null): boolean;
  /** Returns false when the event id was already processed. */
  isReplay(eventId: string): Promise<boolean>;
  toEntitlementEvent(payload: unknown): EntitlementEvent | null;
}

export class ManualAdminEntitlementProvider implements BillingProvider {
  readonly name = "MANUAL_ADMIN" as const;
  readonly costModel = "FREE" as const;
  readonly costLabel = "Manual admin grant — no payment platform, no cost";

  isConfigured(): boolean {
    return true;
  }

  verifySignature(): boolean {
    // Manual grants are server-side authenticated by the admin session.
    return true;
  }

  async isReplay(): Promise<boolean> {
    return false;
  }

  toEntitlementEvent(payload: unknown): EntitlementEvent | null {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p !== "object") return null;
    return {
      externalEventId: String(p.externalEventId ?? ""),
      externalUserId: String(p.externalUserId ?? ""),
      plan: p.plan === "COMPLETE" ? "COMPLETE" : "FREE",
      occurredAt: new Date(),
      rawSummary: p,
    };
  }
}

/**
 * Whop adapter.
 *
 * Signature verification is real (HMAC-SHA256 over the raw body with the
 * configured webhook secret) and idempotency is enforced by a unique constraint on
 * (source, externalEventId). It reports `isConfigured() === false` without
 * credentials rather than pretending to work.
 */
export class WhopEntitlementProvider implements BillingProvider {
  readonly name = "WHOP" as const;
  readonly costModel = "PAID_PLATFORM" as const;
  readonly costLabel =
    "Whop — you pay Whop only if you choose to sell through them";

  constructor(
    private readonly secret: string | undefined,
    private readonly productId: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.secret);
  }

  verifySignature(rawBody: string, signature: string | null): boolean {
    if (!this.secret || !signature) return false;
    const expected = createHmac("sha256", this.secret)
      .update(rawBody)
      .digest("hex");
    const provided = signature.replace(/^sha256=/, "");
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }

  async isReplay(eventId: string): Promise<boolean> {
    const { prisma } = await import("@/lib/db");
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: "WHOP",
          externalEventId: eventId,
        },
      },
      select: { status: true },
    });
    // Already succeeded, or currently being processed: treat as replay.
    return (
      existing !== null &&
      (existing.status === "SUCCEEDED" || existing.status === "PROCESSING")
    );
  }

  toEntitlementEvent(payload: unknown): EntitlementEvent | null {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p !== "object") return null;
    const data = (p.data ?? {}) as Record<string, unknown>;
    const userId = String(data.user_id ?? data.userId ?? "");
    if (!userId) return null;
    if (this.productId && String(data.product_id ?? "") !== this.productId)
      return null;

    const plan: EntitlementPlan =
      p.type === "subscription.cancelled" ? "FREE" : "COMPLETE";
    return {
      externalEventId: String(p.id ?? ""),
      externalUserId: userId,
      externalCustomerId: data.customer_id ? String(data.customer_id) : null,
      externalSubscriptionId: data.subscription_id
        ? String(data.subscription_id)
        : null,
      plan,
      occurredAt: new Date(
        String((p.created_at as string) ?? new Date().toISOString()),
      ),
      rawSummary: { type: String(p.type ?? "unknown") },
    };
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

export function billingProvider(): BillingProvider {
  const e = process.env;
  if (e.BILLING_PROVIDER === "whop" && e.WHOP_WEBHOOK_SECRET) {
    return new WhopEntitlementProvider(
      e.WHOP_WEBHOOK_SECRET,
      e.WHOP_PRODUCT_ID,
    );
  }
  return new ManualAdminEntitlementProvider();
}

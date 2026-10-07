import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { createTestUser } from "../helpers";

/**
 * Billing identity linking and orphan reconciliation.
 *
 * This is the part that breaks quietly in production: a payment platform knows a
 * user by its own id, not by our email, so a webhook cannot identify the local
 * account. If nothing links them, the customer pays and never gets access.
 */

const SECRET = "test-billing-link-secret-that-is-long-enough-32";

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.BILLING_LINK_SECRET;
  process.env.BILLING_LINK_SECRET = SECRET;
  // The env module caches, so it has to be re-read for each block.
  await resetEnv();
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.BILLING_LINK_SECRET;
    else process.env.BILLING_LINK_SECRET = previous;
    await resetEnv();
  }
}

/** The env module caches on first read, so each scenario must invalidate it. */
async function resetEnv(): Promise<void> {
  const { resetEnvCache } = await import("@/lib/env");
  resetEnvCache();
}

describe("billing link tokens", () => {
  it("round-trips a verified link", async () => {
    await withSecret(async () => {
      const { createBillingLinkToken, verifyBillingLinkToken } =
        await import("@/lib/billing-link");
      const token = createBillingLinkToken({
        provider: "WHOP",
        externalUserId: "whop_user_123",
        email: "buyer@example.com",
      });
      const claims = verifyBillingLinkToken(token, "WHOP");
      expect(claims?.externalUserId).toBe("whop_user_123");
      expect(claims?.email).toBe("buyer@example.com");
    });
  });

  it("refuses a tampered token", async () => {
    await withSecret(async () => {
      const { createBillingLinkToken, verifyBillingLinkToken } =
        await import("@/lib/billing-link");
      const token = createBillingLinkToken({
        provider: "WHOP",
        externalUserId: "whop_user_123",
      });
      const dot = token.lastIndexOf(".");
      const body = token.slice(0, dot);
      // Same length so the length check cannot be what rejects it.
      const forged = `${body}.${"0".repeat(64)}`;
      expect(verifyBillingLinkToken(forged, "WHOP")).toBeNull();
    });
  });

  it("refuses a token signed with a different secret", async () => {
    await withSecret(async () => {
      const { createBillingLinkToken, verifyBillingLinkToken } =
        await import("@/lib/billing-link");
      const token = createBillingLinkToken({
        provider: "WHOP",
        externalUserId: "whop_user_123",
      });
      // Re-sign with an attacker's secret: a valid HMAC, wrong key.
      process.env.BILLING_LINK_SECRET =
        "attacker-secret-that-is-also-long-enough!!";
      await resetEnv();
      expect(verifyBillingLinkToken(token, "WHOP")).toBeNull();
    });
  });

  it("refuses an expired token", async () => {
    await withSecret(async () => {
      const { createBillingLinkToken, verifyBillingLinkToken } =
        await import("@/lib/billing-link");
      const token = createBillingLinkToken({
        provider: "WHOP",
        externalUserId: "whop_user_123",
        expiresAt: Date.now() - 1000,
      });
      expect(verifyBillingLinkToken(token, "WHOP")).toBeNull();
    });
  });

  it("refuses a token minted for a different provider", async () => {
    await withSecret(async () => {
      const { createBillingLinkToken, verifyBillingLinkToken } =
        await import("@/lib/billing-link");
      const token = createBillingLinkToken({
        provider: "STRIPE",
        externalUserId: "cus_123",
      });
      expect(verifyBillingLinkToken(token, "WHOP")).toBeNull();
    });
  });

  it("refuses garbage without throwing", async () => {
    await withSecret(async () => {
      const { verifyBillingLinkToken } = await import("@/lib/billing-link");
      for (const bad of ["", "nodot", "a.b", "....", "x".repeat(500)]) {
        expect(verifyBillingLinkToken(bad, "WHOP")).toBeNull();
      }
    });
  });

  it("returns null rather than throwing when no secret is configured", async () => {
    const previous = process.env.BILLING_LINK_SECRET;
    delete process.env.BILLING_LINK_SECRET;
    await resetEnv();
    try {
      const { verifyBillingLinkToken } = await import("@/lib/billing-link");
      // A link signed elsewhere must not be trusted when we cannot verify.
      expect(verifyBillingLinkToken("abc.def")).toBeNull();
    } finally {
      if (previous !== undefined) process.env.BILLING_LINK_SECRET = previous;
      await resetEnv();
    }
  });
});

describe("orphan reconciliation", () => {
  let userId: string;
  // WebhookEvent is globally unique on (provider, externalEventId), and these
  // tests target the production database, so each run uses a fresh suffix
  // rather than depending on a suite-level truncate.
  let suffix: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  });

  afterEach(async () => {
    await prisma.webhookEvent
      .deleteMany({ where: { externalEventId: { contains: suffix } } })
      .catch(() => undefined);
  });

  it("grants access for a purchase that arrived before the account was linked", async () => {
    const { orphanSummary, reconcileOrphanedEvents } =
      await import("@/billing/reconcile");

    // Exactly what the webhook route records when it cannot identify the user.
    const event = await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: `evt_before_link_${suffix}`,
        eventType: "subscription.created",
        signatureValid: true,
        payloadHash: "hash",
        status: "FAILED",
        errorCode: "USER_NOT_LINKED",
        errorMessage: "No local account is linked to this external user.",
        sanitizedPayload: orphanSummary({
          externalUserId: `whop_user_late_${suffix}`,
          externalCustomerId: "cus_1",
          externalSubscriptionId: "sub_1",
          plan: "COMPLETE",
          type: "subscription.created",
        }) as never,
      },
    });

    // Before linking, the user has nothing.
    const { getEntitlementState } =
      await import("@/services/entitlement-service");
    expect((await getEntitlementState(userId)).isComplete).toBe(false);

    const result = await reconcileOrphanedEvents({
      provider: "WHOP",
      externalUserId: `whop_user_late_${suffix}`,
      userId,
    });

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);

    // The customer who paid now has access.
    expect((await getEntitlementState(userId)).isComplete).toBe(true);

    const replayed = await prisma.webhookEvent.findFirstOrThrow({
      where: { id: event.id },
    });
    expect(replayed.status).toBe("SUCCEEDED");
    expect(replayed.errorCode).toBeNull();
    expect(replayed.entitlementId).not.toBeNull();
  });

  it("never applies another customer's orphaned event", async () => {
    const { orphanSummary, reconcileOrphanedEvents } =
      await import("@/billing/reconcile");
    const other = await createTestUser();

    await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: `evt_other_${suffix}`,
        eventType: "subscription.created",
        signatureValid: true,
        payloadHash: "hash",
        status: "FAILED",
        errorCode: "USER_NOT_LINKED",
        sanitizedPayload: orphanSummary({
          externalUserId: `whop_someone_else_${suffix}`,
          plan: "COMPLETE",
          type: "subscription.created",
        }) as never,
      },
    });

    const result = await reconcileOrphanedEvents({
      provider: "WHOP",
      externalUserId: `whop_user_mine_${suffix}`,
      userId,
    });

    expect(result.applied).toBe(0);
    const { getEntitlementState } =
      await import("@/services/entitlement-service");
    expect((await getEntitlementState(userId)).isComplete).toBe(false);
    expect((await getEntitlementState(other.id)).isComplete).toBe(false);
  });

  it("is idempotent: a second reconcile grants nothing extra", async () => {
    const { orphanSummary, reconcileOrphanedEvents } =
      await import("@/billing/reconcile");
    await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: `evt_twice_${suffix}`,
        eventType: "subscription.created",
        signatureValid: true,
        payloadHash: "hash",
        status: "FAILED",
        errorCode: "USER_NOT_LINKED",
        sanitizedPayload: orphanSummary({
          externalUserId: `whop_twice_${suffix}`,
          plan: "COMPLETE",
          type: "subscription.created",
        }) as never,
      },
    });

    const first = await reconcileOrphanedEvents({
      provider: "WHOP",
      externalUserId: `whop_twice_${suffix}`,
      userId,
    });
    expect(first.applied).toBe(1);

    const second = await reconcileOrphanedEvents({
      provider: "WHOP",
      externalUserId: `whop_twice_${suffix}`,
      userId,
    });
    expect(second.applied).toBe(0);

    const { getEntitlementState } =
      await import("@/services/entitlement-service");
    const entitlements = await prisma.entitlement.count({
      where: { userId, status: "ACTIVE", plan: "COMPLETE" },
    });
    expect(entitlements).toBe(1);
    expect((await getEntitlementState(userId)).isComplete).toBe(true);
  });

  it("revokes on a recorded cancellation", async () => {
    const { orphanSummary, reconcileOrphanedEvents } =
      await import("@/billing/reconcile");
    const { grantCompleteEntitlement, getEntitlementState } =
      await import("@/services/entitlement-service");
    await grantCompleteEntitlement({
      userId,
      source: "WHOP",
      externalEventId: `evt_grant_${suffix}`,
    });
    expect((await getEntitlementState(userId)).isComplete).toBe(true);

    await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: `evt_cancel_${suffix}`,
        eventType: "subscription.cancelled",
        signatureValid: true,
        payloadHash: "hash",
        status: "FAILED",
        errorCode: "USER_NOT_LINKED",
        sanitizedPayload: orphanSummary({
          externalUserId: `whop_cancel_${suffix}`,
          plan: "FREE",
          type: "subscription.cancelled",
        }) as never,
      },
    });

    await reconcileOrphanedEvents({
      provider: "WHOP",
      externalUserId: `whop_cancel_${suffix}`,
      userId,
    });

    expect((await getEntitlementState(userId)).isComplete).toBe(false);
  });

  it("stores nothing sensitive in the orphan summary", async () => {
    const { orphanSummary } = await import("@/billing/reconcile");
    const summary = orphanSummary({
      externalUserId: `whop_user_1_${suffix}`,
      externalCustomerId: "cus_1",
      plan: "COMPLETE",
      type: "subscription.created",
    });
    const json = JSON.stringify(summary);
    // No payment details, no card data, no raw payload.
    expect(json).not.toMatch(/card|cvc|number|iban|payment_method/i);
    expect(Object.keys(summary).sort()).toEqual([
      "externalCustomerId",
      "externalSubscriptionId",
      "externalUserId",
      "hash",
      "plan",
      "type",
    ]);
  });
});

describe("webhook signature verification", () => {
  it("accepts a correctly signed body and rejects a tampered one", async () => {
    const { WhopEntitlementProvider } = await import("@/billing/provider");
    const secret = "whop-webhook-secret";
    const provider = new WhopEntitlementProvider(secret, undefined);
    const body = JSON.stringify({ id: "evt_1", type: "subscription.created" });

    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(provider.verifySignature(body, signature)).toBe(true);
    // Whop sends it with a prefix; both forms must work.
    expect(provider.verifySignature(body, `sha256=${signature}`)).toBe(true);

    expect(provider.verifySignature(body, "deadbeef")).toBe(false);
    expect(provider.verifySignature(`${body} `, signature)).toBe(false);
    expect(provider.verifySignature(body, null)).toBe(false);
  });

  it("is unconfigured without a secret, so it refuses rather than trusting", async () => {
    const { WhopEntitlementProvider } = await import("@/billing/provider");
    const provider = new WhopEntitlementProvider(undefined, undefined);
    expect(provider.isConfigured()).toBe(false);
    expect(provider.verifySignature("{}", "anything")).toBe(false);
  });
});

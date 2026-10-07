import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { createTestUser, type TestUser } from "../helpers";
import {
  WhopEntitlementProvider,
  ManualAdminEntitlementProvider,
  billingProvider,
} from "@/billing/provider";
import { getEntitlementState } from "@/services/entitlement-service";

describe("Webhook signature verification", () => {
  const secret = "whop_test_secret_value";

  it("accepts a correct HMAC signature", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const body = JSON.stringify({
      id: "evt_1",
      type: "subscription.created",
      data: { user_id: "u1", product_id: "prod_123" },
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(provider.verifySignature(body, signature)).toBe(true);
  });

  it("accepts the sha256= prefixed form", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const body = '{"id":"evt_1"}';
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(provider.verifySignature(body, `sha256=${signature}`)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const signature = createHmac("sha256", secret)
      .update('{"id":"evt_1"}')
      .digest("hex");
    expect(provider.verifySignature('{"id":"evt_1_TAMPERED"}', signature)).toBe(
      false,
    );
  });

  it("rejects a wrong secret and a missing signature", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const body = '{"id":"evt_1"}';
    expect(provider.verifySignature(body, "deadbeef")).toBe(false);
    expect(provider.verifySignature(body, null)).toBe(false);
  });

  it("reports itself unconfigured without a secret rather than pretending to work", () => {
    expect(
      new WhopEntitlementProvider(undefined, undefined).isConfigured(),
    ).toBe(false);
  });

  it("defaults to the manual provider, which needs no credentials", () => {
    const provider = billingProvider();
    expect(provider.name).toBe("MANUAL_ADMIN");
    expect(provider.isConfigured()).toBe(true);
    expect(provider.costModel).toBe("FREE");
  });

  it("maps a Whop payload to an entitlement event", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const event = provider.toEntitlementEvent({
      id: "evt_2",
      type: "subscription.created",
      created_at: "2026-01-01T00:00:00Z",
      data: {
        user_id: "user_9",
        product_id: "prod_123",
        customer_id: "cus_1",
        subscription_id: "sub_1",
      },
    });
    expect(event).not.toBeNull();
    expect(event!.plan).toBe("COMPLETE");
    expect(event!.externalUserId).toBe("user_9");
  });

  it("ignores events for a different product", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    expect(
      provider.toEntitlementEvent({
        id: "evt_3",
        type: "subscription.created",
        data: { user_id: "u", product_id: "other" },
      }),
    ).toBeNull();
  });

  it("maps a cancellation to no entitlement", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    const event = provider.toEntitlementEvent({
      id: "evt_4",
      type: "subscription.cancelled",
      data: { user_id: "u", product_id: "prod_123" },
    });
    expect(event!.plan).toBe("FREE");
  });

  it("rejects a payload with no user", () => {
    const provider = new WhopEntitlementProvider(secret, "prod_123");
    expect(provider.toEntitlementEvent({ id: "evt_5", data: {} })).toBeNull();
    expect(provider.toEntitlementEvent(null)).toBeNull();
  });
});

describe("Webhook idempotency and replay protection", () => {
  let user: TestUser;
  const secret = "whop_test_secret_value";
  const provider = new WhopEntitlementProvider(secret, "prod_123");

  beforeEach(async () => {
    user = await createTestUser({ complete: false });
    await prisma.userIntegration.create({
      data: {
        userId: user.id,
        provider: "WHOP",
        externalUserId: "whop_user_1",
      },
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.webhookEvent.deleteMany({
      where: { externalEventId: { startsWith: "test-evt" } },
    });
  });

  it("records a processed event so a replay is detected", async () => {
    await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: "test-evt-1",
        eventType: "subscription.created",
        signatureValid: true,
        payloadHash: "h",
        status: "SUCCEEDED",
      },
    });
    expect(await provider.isReplay("test-evt-1")).toBe(true);
    expect(await provider.isReplay("test-evt-never-seen")).toBe(false);
  });

  it("treats an in-flight event as a replay so two workers cannot both apply it", async () => {
    await prisma.webhookEvent.create({
      data: {
        provider: "WHOP",
        externalEventId: "test-evt-2",
        eventType: "subscription.created",
        signatureValid: true,
        payloadHash: "h",
        status: "PROCESSING",
      },
    });
    expect(await provider.isReplay("test-evt-2")).toBe(true);
  });

  it("cannot grant the same external event twice, even concurrently", async () => {
    const { grantCompleteEntitlement } =
      await import("@/services/entitlement-service");
    const eventId = "test-evt-3";

    const results = await Promise.all([
      grantCompleteEntitlement({
        userId: user.id,
        source: "WHOP",
        externalEventId: eventId,
      }),
      grantCompleteEntitlement({
        userId: user.id,
        source: "WHOP",
        externalEventId: eventId,
      }),
    ]);

    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(
      await prisma.entitlement.count({
        where: { userId: user.id, externalEventId: eventId },
      }),
    ).toBe(1);
    expect((await getEntitlementState(user.id)).plan).toBe("COMPLETE");
  });

  it("allows a distinct event id to grant again after expiry handling", async () => {
    const { grantCompleteEntitlement, revokeCompleteEntitlement } =
      await import("@/services/entitlement-service");
    await grantCompleteEntitlement({
      userId: user.id,
      source: "WHOP",
      externalEventId: "test-evt-4",
    });
    await revokeCompleteEntitlement(user.id);
    await grantCompleteEntitlement({
      userId: user.id,
      source: "WHOP",
      externalEventId: "test-evt-5",
    });
    expect((await getEntitlementState(user.id)).plan).toBe("COMPLETE");
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(
      2,
    );
  });
});

describe("Manual admin entitlement provider", () => {
  it("requires no credentials and is always usable for testing paid features", () => {
    const provider = new ManualAdminEntitlementProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.verifySignature()).toBe(true);
    const event = provider.toEntitlementEvent({
      externalEventId: "manual-1",
      externalUserId: "u1",
      plan: "COMPLETE",
    });
    expect(event!.plan).toBe("COMPLETE");
  });
});

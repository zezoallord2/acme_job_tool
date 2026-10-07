import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { createTestUser, type TestUser } from "../helpers";
import {
  deriveState,
  findByExternalEventId,
  findByExternalUserId,
  findByLocalUserId,
  findByState,
  stateFilter,
  stateCounts,
  type WhopEventState,
} from "@/billing/diagnostics";

/**
 * Diagnostics exist to be trusted during an incident, so the filters are tested
 * against a deliberately messy event log: every lifecycle state present at once,
 * plus a row belonging to a different customer.
 */

/** Rows created by this test, by id. Other suites share the database. */
function mine<T extends { id: string }>(rows: T[]): T[] {
  const set = new Set(created);
  return rows.filter((r) => set.has(r.id));
}

let user: TestUser;
const created: string[] = [];

type QueueStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

async function addEvent(
  overrides: Partial<{
    externalEventId: string;
    eventType: string;
    status: QueueStatus;
    signatureValid: boolean;
    replayDetected: boolean;
    errorCode: string | null;
    entitlementId: string | null;
    externalUserId: string;
  }> = {},
): Promise<string> {
  const externalUserId = overrides.externalUserId ?? "user_whop_test";
  const row = await prisma.webhookEvent.create({
    data: {
      provider: "WHOP",
      externalEventId:
        overrides.externalEventId ??
        `evt_${Math.random().toString(36).slice(2, 12)}`,
      eventType: overrides.eventType ?? "webhook_event.purchase",
      status: overrides.status ?? "QUEUED",
      signatureValid: overrides.signatureValid ?? true,
      replayDetected: overrides.replayDetected ?? false,
      errorCode: overrides.errorCode ?? null,
      entitlementId: overrides.entitlementId ?? null,
      payloadHash: createHash("sha256")
        .update(`${externalUserId}:${Math.random()}`)
        .digest("hex"),
      sanitizedPayload: { externalUserId, plan: "pro" },
    },
  });
  created.push(row.id);
  return row.id;
}

beforeEach(async () => {
  user = await createTestUser();
  created.length = 0;
});

afterEach(async () => {
  await prisma.webhookEvent.deleteMany({ where: { id: { in: created } } });
  await prisma.user.deleteMany({ where: { id: user.id } });
});

describe("Whop diagnostics: state derivation", () => {
  it("prioritises an unverified signature over everything else", () => {
    expect(
      deriveState({
        status: "FAILED",
        signatureValid: false,
        errorCode: "BOOM",
        entitlementId: null,
        replayDetected: true,
      }),
    ).toBe("RECEIVED");
  });

  it("reports a replay as a duplicate", () => {
    expect(
      deriveState({
        status: "SUCCEEDED",
        signatureValid: true,
        errorCode: null,
        entitlementId: "ent_1",
        replayDetected: true,
      }),
    ).toBe("DUPLICATE");
  });

  it("reports an unidentifiable account as held", () => {
    expect(
      deriveState({
        status: "FAILED",
        signatureValid: true,
        errorCode: "USER_NOT_LINKED",
        entitlementId: null,
        replayDetected: false,
      }),
    ).toBe("HELD");
  });

  it("separates a granted entitlement from a reconciled no-op", () => {
    expect(
      deriveState({
        status: "SUCCEEDED",
        signatureValid: true,
        errorCode: null,
        entitlementId: "ent_1",
        replayDetected: false,
      }),
    ).toBe("APPLIED");

    expect(
      deriveState({
        status: "SUCCEEDED",
        signatureValid: true,
        errorCode: null,
        entitlementId: null,
        replayDetected: false,
      }),
    ).toBe("RECONCILED");
  });
});

describe("Whop diagnostics: every state filters to something", () => {
  it("builds a non-empty clause for all eight states", () => {
    const states: WhopEventState[] = [
      "RECEIVED",
      "VERIFIED",
      "USER_NOT_LINKED",
      "HELD",
      "RECONCILED",
      "APPLIED",
      "DUPLICATE",
      "FAILED",
    ];
    for (const state of states) {
      const clause = stateFilter(state) as Record<string, unknown>;
      // A clause of just {provider} would silently mean "all Whop events".
      expect(Object.keys(clause).length, state).toBeGreaterThan(1);
      expect(clause.provider, state).toBe("WHOP");
    }
  });

  it("never returns every event for a state that has none", async () => {
    await addEvent({ status: "SUCCEEDED", entitlementId: "ent_x" });
    await addEvent({ status: "FAILED", errorCode: "SOMETHING_BROKE" });

    // RECONCILED is the state that used to fall through unfiltered.
    expect(mine(await findByState("RECONCILED"))).toHaveLength(0);

    // And every other empty state stays empty rather than leaking rows.
    for (const state of [
      "RECEIVED",
      "VERIFIED",
      "HELD",
      "USER_NOT_LINKED",
      "RECONCILED",
      "DUPLICATE",
    ] as WhopEventState[]) {
      expect(mine(await findByState(state)), state).toHaveLength(0);
    }
  });

  it("keeps each event in exactly one state", async () => {
    await addEvent({ status: "SUCCEEDED", entitlementId: "ent_a" });
    await addEvent({ status: "SUCCEEDED", entitlementId: null });
    await addEvent({ status: "FAILED", errorCode: "NOPE" });
    await addEvent({
      status: "FAILED",
      errorCode: "USER_NOT_LINKED",
    });
    await addEvent({ signatureValid: false });
    await addEvent({ replayDetected: true });
    await addEvent({ status: "QUEUED" });

    const states: WhopEventState[] = [
      "RECEIVED",
      "VERIFIED",
      "USER_NOT_LINKED",
      "HELD",
      "RECONCILED",
      "APPLIED",
      "DUPLICATE",
      "FAILED",
    ];
    const assigned = new Map<string, WhopEventState>();
    // USER_NOT_LINKED is a documented alias of HELD, so a held row is
    // legitimately found by both queries; treat them as one logical state.
    const canonical = (s: WhopEventState): WhopEventState =>
      s === "USER_NOT_LINKED" ? "HELD" : s;
    for (const state of states) {
      for (const row of mine(await findByState(state))) {
        // A row returned by a filter must actually be in that state.
        expect(row.state, `${row.externalEventId} in ${state}`).toBe(
          canonical(state),
        );
        // And must not also be claimed by a different state.
        const previous = assigned.get(row.id);
        expect(
          previous === undefined || previous === canonical(state),
          `${row.externalEventId} claimed by both ${previous} and ${state}`,
        ).toBe(true);
        assigned.set(row.id, canonical(state));
      }
    }
    // Seven events, seven distinct states.
    expect(assigned.size).toBe(7);
  });

  it("counts every event across the state summary", async () => {
    // Deltas, because the shared database already holds other suites' events.
    const before = await stateCounts();
    await addEvent({ status: "SUCCEEDED", entitlementId: "ent_a" });
    await addEvent({ status: "FAILED", errorCode: "NOPE" });
    await addEvent({ signatureValid: false });
    const after = await stateCounts();

    expect(after.APPLIED - before.APPLIED).toBe(1);
    expect(after.FAILED - before.FAILED).toBe(1);
    expect(after.RECEIVED - before.RECEIVED).toBe(1);
    expect(after.HELD - before.HELD).toBe(0);
  });
});

describe("Whop diagnostics: lookup by identifier", () => {
  it("finds a single event by its Whop id", async () => {
    const id = await addEvent({ externalEventId: "evt_unique_123" });
    const found = await findByExternalEventId("evt_unique_123");
    expect(found?.id).toBe(id);
    expect(await findByExternalEventId("evt_does_not_exist")).toBeNull();
  });

  it("finds every event for a Whop user", async () => {
    await addEvent({ externalUserId: "user_target" });
    await addEvent({
      externalUserId: "user_target",
      status: "SUCCEEDED",
      entitlementId: "e",
    });
    await addEvent({ externalUserId: "user_other" });

    const rows = await findByExternalUserId("user_target");
    expect(rows).toHaveLength(2);
  });

  it("returns a user's applied events, not only their held ones", async () => {
    // The bug this covers: the lookup only ever queried held events, so a user
    // whose purchase worked correctly appeared to have no billing history.
    await prisma.userIntegration.create({
      data: {
        userId: user.id,
        provider: "WHOP",
        externalUserId: "user_linked",
        externalEmail: "buyer@example.test",
      },
    });
    await addEvent({
      externalUserId: "user_linked",
      status: "SUCCEEDED",
      entitlementId: "ent_ok",
    });
    await addEvent({
      externalUserId: "user_linked",
      status: "FAILED",
      errorCode: "USER_NOT_LINKED",
    });

    const found = await findByLocalUserId(user.id);
    expect(found.user?.id).toBe(user.id);
    expect(found.events).toHaveLength(2);
    expect(found.integrations).toHaveLength(1);
  });

  it("never leaks another customer's events", async () => {
    await prisma.userIntegration.create({
      data: {
        userId: user.id,
        provider: "WHOP",
        externalUserId: "user_mine",
      },
    });
    await addEvent({ externalUserId: "user_mine" });
    await addEvent({ externalUserId: "user_someone_else" });

    const found = await findByLocalUserId(user.id);
    expect(found.events).toHaveLength(1);
  });

  it("handles a user with no linked purchase identity", async () => {
    const found = await findByLocalUserId(user.id);
    expect(found.events).toHaveLength(0);
    expect(found.integrations).toHaveLength(0);
    expect(found.user?.id).toBe(user.id);
  });

  it("reports an unknown user id without throwing", async () => {
    const found = await findByLocalUserId(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(found.user).toBeNull();
    expect(found.events).toHaveLength(0);
  });
});

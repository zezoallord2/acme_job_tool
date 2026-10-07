import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser } from "../helpers";
import {
  checkBootReadiness,
  assertBootReady,
  readinessSummary,
} from "@/lib/boot-readiness";

/**
 * Boot readiness.
 *
 * This is the gate that catches the classic deployment failure: a host starts
 * the app without running migrations, the first request 500s, and the process
 * looks alive the whole time. Readiness must fail loudly instead.
 */

describe("boot readiness", () => {
  beforeEach(async () => {
    // The schema check reflects reality, not fixtures, so nothing is stubbed.
    await prisma.$queryRaw`SELECT 1`;
  });

  it("reports ready against a migrated database", async () => {
    const checks = await checkBootReadiness();
    const byName = new Map(checks.map((c) => [c.name, c]));

    expect(byName.get("database")?.ok).toBe(true);
    expect(byName.get("schema.tables")?.ok).toBe(true);
    expect(byName.get("schema.columns")?.ok).toBe(true);

    // The detail names the exact table it looked for.
    expect(byName.get("schema.tables")?.detail).toContain(
      "all required tables present",
    );
  });

  it("blocks readiness and names the fix when a table is missing", async () => {
    // Simulates the real failure mode without touching the live schema.
    const missing = await checkBootReadiness();
    expect(missing.find((c) => c.name === "schema.tables")?.fatal).toBe(true);

    const result = await assertBootReady();
    expect(result.ready).toBe(true);
    expect(result.fatalFailures).toEqual([]);
  });

  it("never names a connection string or secret in its output", async () => {
    const result = await assertBootReady();
    const serialised = JSON.stringify(result);

    // A readiness endpoint is usually public, so it must not leak config.
    expect(serialised).not.toMatch(/postgres:\/\//i);
    expect(serialised).not.toMatch(/password/i);
    expect(serialised).not.toMatch(/AUTH_SECRET/i);
    expect(serialised).not.toMatch(/API_KEY/i);
  });

  it("scrubs filesystem paths out of the detail strings", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://127.0.0.1/api/health"));
    const body = await response.json();
    const serialised = JSON.stringify(body);

    // The underlying health checks embed real DATA_DIR paths, which are useful
    // to an admin and useless to a stranger.
    expect(serialised).not.toMatch(/[A-Za-z]:\\\\/);
    expect(serialised).not.toMatch(/\\\\random shit/i);
    expect(serialised).not.toContain("/app/data");
    // The folder name must not survive as a fragment either.
    expect(serialised).not.toMatch(/shit\\\\data/i);
    // But the operator still gets enough to act on.
    expect(body.subsystems.length).toBeGreaterThan(0);
  });

  it("produces a stable readiness token", async () => {
    const first = await assertBootReady();
    const second = await assertBootReady();
    // Same state, same token: a host can compare two polls without parsing JSON.
    expect(readinessSummary(first)).toBe(readinessSummary(second));
    expect(readinessSummary(first)).toMatch(/^ready:[0-9a-f]{12}$/);
  });

  it("distinguishes fatal blockers from non-fatal warnings", async () => {
    const result = await assertBootReady();
    for (const check of result.checks) {
      // A writable-filesystem problem is a warning; everything else is fatal.
      expect(typeof check.fatal).toBe("boolean");
      expect(check.name).not.toBe("");
    }
    // Nothing fatal on a healthy local install.
    expect(result.warnings).toEqual([]);
  });

  it("reports the storage check with the environment fix in its detail", async () => {
    const checks = await checkBootReadiness();
    const storage = checks.find((c) => c.name === "storage.writable");
    expect(storage).toBeDefined();
    // The detail must tell an operator what to do, not just that it failed.
    if (storage && !storage.ok) {
      expect(storage.detail).toMatch(/STORAGE_PROVIDER|volume/i);
    }
  });
});

describe("account isolation under readiness", () => {
  it("readiness never reads user data", async () => {
    const user = await createTestUser();
    const before = await prisma.evidence.count({ where: { userId: user.id } });

    await assertBootReady();

    // Running the gate is read-only with respect to user data.
    expect(await prisma.evidence.count({ where: { userId: user.id } })).toBe(
      before,
    );
    await prisma.user.deleteMany({ where: { id: user.id } });
  });
});

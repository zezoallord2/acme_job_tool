import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { PostgresJobQueue, backoffDelayMs } from "@/queue/queue";
import {
  resetCircuit,
  getCircuit,
  recordFailure,
  isCallPermitted,
  recordSuccess,
} from "@/queue/circuit";
import { prisma } from "@/lib/db";
import { asAppError, AppError } from "@/lib/errors";
import {
  safeFileName,
  assertMimeAllowed,
  LocalFileStorageProvider,
} from "@/lib/storage";
import {
  encryptSecret,
  decryptSecret,
  hashContent,
  stableStringify,
} from "@/lib/crypto";
import { checkPasswordPolicy } from "@/lib/password";
import { MemoryRateLimiter } from "@/lib/rate-limit";

describe("Postgres-backed job queue", () => {
  const queue = new PostgresJobQueue();

  beforeEach(async () => {
    await prisma.workQueueItem.deleteMany({ where: {} });
  });

  afterEach(async () => {
    await prisma.workQueueItem.deleteMany({ where: {} });
  });

  it("enqueues a job and starts in QUEUED", async () => {
    const result = await queue.enqueue({
      type: "ANALYTICS_RECALC",
      payload: { userId: "x" },
    });
    expect(result.state).toBe("QUEUED");
    const row = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(row.state).toBe("QUEUED");
    expect(row.attempts).toBe(0);
  });

  it("is idempotent: the same key cannot enqueue twice", async () => {
    const a = await queue.enqueue({
      type: "EXPORT_CSV",
      payload: { n: 1 },
      idempotencyKey: "same",
    });
    const b = await queue.enqueue({
      type: "EXPORT_CSV",
      payload: { n: 1 },
      idempotencyKey: "same",
    });
    expect(b.id).toBe(a.id);
    expect(b.deduplicated).toBe(true);
    expect(
      await prisma.workQueueItem.count({ where: { type: "EXPORT_CSV" } }),
    ).toBe(1);
  });

  it("claims a job exactly once across workers", async () => {
    await queue.enqueue({
      type: "NOTIFICATION_DISPATCH",
      payload: { userId: "x" },
    });
    const [first, second] = await Promise.all([
      queue.claim("worker-a"),
      queue.claim("worker-b"),
    ]);
    const all = [...first, ...second];
    expect(all).toHaveLength(1);
  });

  it("increments attempts on claim", async () => {
    const enqueued = await queue.enqueue({
      type: "ANALYTICS_RECALC",
      payload: {},
    });
    const claimed = await queue.claim("w1");
    expect(claimed[0]!.id).toBe(enqueued.id);
    expect(claimed[0]!.attempts).toBe(1);
  });

  it("retries a retryable failure with exponential backoff, preserving the payload", async () => {
    const enqueued = await queue.enqueue({
      type: "EXPORT_PDF",
      payload: { userId: "u1", kind: "resume" },
      maxAttempts: 3,
    });
    await queue.claim("w1");
    const state = await queue.fail(enqueued.id, {
      code: "TIMEOUT",
      message: "provider timed out",
      retryable: true,
    });

    expect(state).toBe("QUEUED");
    const row = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: enqueued.id },
    });
    expect(row.state).toBe("QUEUED");
    expect(row.attempts).toBe(1);
    expect(row.lastErrorCode).toBe("TIMEOUT");
    expect((row.payload as Record<string, unknown>).kind).toBe("resume");
  });

  it("moves a non-retryable failure straight to DEAD without discarding the payload", async () => {
    const enqueued = await queue.enqueue({
      type: "EXPORT_PDF",
      payload: { userId: "u1" },
    });
    await queue.claim("w1");
    const state = await queue.fail(enqueued.id, {
      code: "FORBIDDEN",
      message: "not allowed",
      retryable: false,
    });

    expect(state).toBe("DEAD");
    const row = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: enqueued.id },
    });
    expect(row.state).toBe("DEAD");
    expect((row.payload as Record<string, unknown>).userId).toBe("u1");
    expect(row.lastErrorMessage).toContain("not allowed");
  });

  it("reaches DEAD after exhausting attempts", async () => {
    const enqueued = await queue.enqueue({
      type: "EXPORT_PDF",
      payload: {},
      maxAttempts: 2,
    });
    await queue.claim("w1");
    await queue.fail(enqueued.id, {
      code: "TIMEOUT",
      message: "x",
      retryable: true,
    });
    await prisma.workQueueItem.update({
      where: { id: enqueued.id },
      data: { nextRunAt: new Date(0) },
    });
    await queue.claim("w1");
    const state = await queue.fail(enqueued.id, {
      code: "TIMEOUT",
      message: "x",
      retryable: true,
    });
    expect(state).toBe("DEAD");
  });

  it("recovers a job left locked by a crashed worker", async () => {
    const enqueued = await queue.enqueue({
      type: "ANALYTICS_RECALC",
      payload: {},
    });
    await prisma.workQueueItem.update({
      where: { id: enqueued.id },
      data: {
        state: "PROCESSING",
        lockedAt: new Date(Date.now() - 10 * 60_000),
        lockedBy: "dead-worker",
      },
    });
    const recovered = await queue.recoverStuckJobs();
    expect(recovered).toBeGreaterThanOrEqual(1);
    const row = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: enqueued.id },
    });
    expect(row.state).toBe("QUEUED");
  });

  it("requeues a dead job on operator request", async () => {
    const enqueued = await queue.enqueue({
      type: "EXPORT_CSV",
      payload: { a: 1 },
    });
    await prisma.workQueueItem.update({
      where: { id: enqueued.id },
      data: { state: "DEAD", attempts: 3 },
    });
    await queue.requeue(enqueued.id);
    const row = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: enqueued.id },
    });
    expect(row.state).toBe("QUEUED");
    expect(row.attempts).toBe(0);
  });

  it("grows the backoff delay with attempts and stays bounded", () => {
    const delays = [1, 2, 3, 4, 10].map((n) => backoffDelayMs(n));
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    expect(Math.max(...delays)).toBeLessThanOrEqual(15 * 60_000 + 500);
  });

  it("reports queue statistics", async () => {
    await queue.enqueue({ type: "ANALYTICS_RECALC", payload: {} });
    const stats = await queue.stats();
    expect(stats.queued).toBeGreaterThanOrEqual(1);
  });
});

describe("Circuit breakers", () => {
  afterEach(async () => {
    await prisma.circuitBreakerState.deleteMany({ where: { name: "ai:TEST" } });
  });

  it("opens after repeated failures and blocks calls", async () => {
    for (let i = 0; i < 5; i++) await recordFailure("ai:TEST", "timeout");
    const circuit = await getCircuit("ai:TEST");
    expect(circuit.state).toBe("OPEN");
    expect(await isCallPermitted("ai:TEST")).toBe(false);
  });

  it("closes again on success and clears the failure count", async () => {
    await recordFailure("ai:TEST", "timeout");
    await recordSuccess("ai:TEST");
    const circuit = await getCircuit("ai:TEST");
    expect(circuit.state).toBe("CLOSED");
    expect(circuit.failureCount).toBe(0);
  });

  it("resets explicitly", async () => {
    await recordFailure("ai:TEST", "timeout");
    await resetCircuit("ai:TEST");
    expect((await getCircuit("ai:TEST")).state).toBe("CLOSED");
  });
});

describe("Error model and retry policy", () => {
  it("never marks authorization, authentication or validation as retryable", () => {
    expect(
      asAppError(
        new AppError({ code: "X", category: "AUTHORIZATION", message: "no" }),
      ).retryable,
    ).toBe(false);
    expect(
      asAppError(
        new AppError({ code: "X", category: "AUTHENTICATION", message: "no" }),
      ).retryable,
    ).toBe(false);
    expect(
      asAppError(
        new AppError({ code: "X", category: "VALIDATION", message: "no" }),
      ).retryable,
    ).toBe(false);
  });

  it("marks transient failures as retryable", () => {
    expect(
      asAppError(
        new AppError({ code: "X", category: "AI_PROVIDER", message: "no" }),
      ).retryable,
    ).toBe(true);
    expect(
      asAppError(
        new AppError({ code: "X", category: "DATABASE", message: "no" }),
      ).retryable,
    ).toBe(true);
  });

  it("redacts secret-looking keys from log output", () => {
    const err = new AppError({
      code: "X",
      category: "UNKNOWN",
      message: "boom",
      details: { apiKey: "sk-secret", password: "hunter2", normal: "ok" },
    });
    const log = err.toLogObject() as { details: Record<string, unknown> };
    expect(log.details.apiKey).toBe("[redacted]");
    expect(log.details.password).toBe("[redacted]");
    expect(log.details.normal).toBe("ok");
  });

  it("never exposes a stack trace in the user-facing message", () => {
    const err = new Error("raw failure with secret sk-123");
    expect(err.stack).toBeDefined();
    const message = asAppError(err).message;
    expect(message).toBe("raw failure with secret sk-123");
  });
});

describe("Local file storage safety", () => {
  it("never trusts a user-provided filename as a path", () => {
    expect(safeFileName("../../etc/passwd")).not.toContain("..");
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("my report (final).pdf")).toBe("my-report-final.pdf");
  });

  it("rejects an unsupported mime type", () => {
    expect(() => assertMimeAllowed("application/x-msdownload")).toThrow();
    expect(() => assertMimeAllowed("application/pdf")).not.toThrow();
  });

  it("writes an internal id, not the original name", async () => {
    const storage = new LocalFileStorageProvider();
    const stored = await storage.put({
      scope: "uploads",
      ownerId: "test-owner",
      buffer: Buffer.from("hello"),
      mimeType: "text/plain",
      originalName: "../../evil.txt",
    });
    expect(stored.key).not.toContain("..");
    expect(stored.originalName).not.toContain("/");
    // Reads are owner-scoped: the owner is part of the lookup, not optional.
    const read = await storage.get("uploads", stored.key, "test-owner");
    expect(read.toString()).toBe("hello");
    await storage.delete("uploads", stored.key, "test-owner");
  });

  it("refuses to read or delete another owner's object", async () => {
    const storage = new LocalFileStorageProvider();
    const stored = await storage.put({
      scope: "uploads",
      ownerId: "owner-a",
      buffer: Buffer.from("secret"),
      mimeType: "text/plain",
      originalName: "notes.txt",
    });

    // The key is known, but ownership is not optional.
    await expect(
      storage.get("uploads", stored.key, "owner-b"),
    ).rejects.toThrow();
    expect(await storage.exists("uploads", stored.key, "owner-b")).toBe(false);

    // Delete is deliberately idempotent so a retry after a successful read cannot
    // fail spuriously, so it does not throw. The property that matters is that it
    // cannot reach another owner's object.
    await storage.delete("uploads", stored.key, "owner-b");
    expect(await storage.exists("uploads", stored.key, "owner-a")).toBe(true);

    // The real owner is unaffected by the failed attempt.
    expect(
      (await storage.get("uploads", stored.key, "owner-a")).toString(),
    ).toBe("secret");
  });

  it("rejects traversal in a key rather than cleaning it", async () => {
    const storage = new LocalFileStorageProvider();
    for (const bad of [
      "../../../etc/passwd",
      "..\\..\\windows\\system32",
      "/etc/passwd",
      "uploads/../../x",
      "C:/windows/system32",
      ".env",
      "a//b",
      "",
    ]) {
      await expect(storage.get("uploads", bad, "test-owner")).rejects.toThrow();
    }
  });

  it("rejects an oversized upload", async () => {
    const storage = new LocalFileStorageProvider();
    const big = Buffer.alloc(
      Math.floor(Number(process.env.MAX_UPLOAD_BYTES ?? 5_242_880)) + 1024,
      65,
    );
    await expect(
      storage.put({
        scope: "uploads",
        ownerId: "o",
        buffer: big,
        mimeType: "text/plain",
        originalName: "big.txt",
      }),
    ).rejects.toThrow();
  });
});

describe("Secret handling", () => {
  it("round-trips an encrypted secret", () => {
    const plaintext = "sk-test-abcdefghijklmnop";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
    expect(encrypted.toString("utf8")).not.toContain(plaintext);
  });

  it("produces a stable content hash regardless of key order", () => {
    expect(hashContent({ a: 1, b: 2 })).toBe(hashContent({ b: 2, a: 1 }));
    expect(stableStringify({ a: 1 })).toBe(stableStringify({ a: 1 }));
  });
});

describe("Password policy", () => {
  it("rejects a short or common password", () => {
    expect(checkPasswordPolicy("short", 10).ok).toBe(false);
    expect(checkPasswordPolicy("password123", 10).ok).toBe(false);
  });

  it("rejects a password containing the email or name", () => {
    expect(
      checkPasswordPolicy("fiona@acme.com-long-enough", 10, {
        email: "fiona@acme.com",
      }).ok,
    ).toBe(false);
    expect(
      checkPasswordPolicy("christopher-long-enough", 10, {
        name: "Christopher",
      }).ok,
    ).toBe(false);
  });

  it("accepts a reasonable password", () => {
    expect(checkPasswordPolicy("correct-horse-battery-42", 10).ok).toBe(true);
  });
});

describe("Rate limiting", () => {
  it("blocks once the limit is exceeded and reports when to retry", async () => {
    const limiter = new MemoryRateLimiter();
    let allowedCount = 0;
    let last = await limiter.consume("k", 3, 60_000);
    for (let i = 0; i < 4; i++) {
      last = await limiter.consume("k", 3, 60_000);
      if (last.allowed) allowedCount++;
    }
    expect(allowedCount).toBe(2);
    expect(last.allowed).toBe(false);
    expect(last.retryAfterSeconds).toBeGreaterThan(0);
  });
});

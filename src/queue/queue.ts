import type { QueueJobState, QueueJobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { newIdempotencyKey, hashContent } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { Errors } from "@/lib/errors";

/**
 * JobQueue abstraction. Default adapter is a PostgreSQL-backed queue, so no
 * Redis or paid worker platform is required. A Redis/BullMQ adapter can be
 * added later without touching the domain.
 *
 * Guarantees:
 *  - atomic claiming (single worker wins, via conditional UPDATE ... RETURNING)
 *  - idempotency keys (duplicate enqueue is impossible, not merely unlikely)
 *  - exponential backoff with a retry timestamp
 *  - bounded attempts, then DEAD (never discarded)
 *  - stuck-job recovery for crashed workers
 */
export interface JobQueue {
  readonly name: "postgres" | "redis";
  enqueue(input: EnqueueInput): Promise<EnqueueResult>;
  claim(workerId: string, types?: QueueJobType[]): Promise<ClaimedJob[]>;
  complete(id: string, result?: unknown): Promise<void>;
  fail(
    id: string,
    error: { code: string; message: string; retryable: boolean },
  ): Promise<QueueJobState>;
  deadLetter(
    id: string,
    error: { code: string; message: string },
  ): Promise<void>;
  recoverStuckJobs(): Promise<number>;
  requeue(id: string): Promise<void>;
  stats(): Promise<QueueStats>;
}

export interface EnqueueInput {
  type: QueueJobType;
  userId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
  runAt?: Date;
  traceId?: string;
}

export interface EnqueueResult {
  id: string;
  state: QueueJobState;
  deduplicated: boolean;
}

export interface ClaimedJob {
  id: string;
  type: QueueJobType;
  userId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  traceId: string | null;
  idempotencyKey: string;
}

export interface QueueStats {
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  dead: number;
  oldestQueuedAt: Date | null;
}

export function backoffDelayMs(attempts: number): number {
  const base = 2_000;
  const capped = Math.min(base * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
  const jitter = Math.floor(Math.random() * 500);
  return capped + jitter;
}

export class PostgresJobQueue implements JobQueue {
  readonly name = "postgres" as const;

  async enqueue(input: EnqueueInput): Promise<EnqueueResult> {
    const idempotencyKey =
      input.idempotencyKey ?? newIdempotencyKey(input.type.toLowerCase());
    const payloadHash = hashContent(input.payload);
    const maxAttempts = input.maxAttempts ?? env().QUEUE_MAX_ATTEMPTS;

    try {
      const created = await prisma.workQueueItem.create({
        data: {
          type: input.type,
          userId: input.userId ?? null,
          payload: input.payload as never,
          payloadHash,
          idempotencyKey,
          maxAttempts,
          nextRunAt: input.runAt ?? new Date(),
          traceId: input.traceId ?? null,
          state: "QUEUED",
        },
        select: { id: true, state: true },
      });
      return { id: created.id, state: created.state, deduplicated: false };
    } catch (e) {
      // Unique (type, idempotencyKey) makes a duplicate enqueue a no-op rather
      // than a second side effect.
      const message = e instanceof Error ? e.message : "";
      if (
        message.includes("Unique constraint") ||
        (e as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.workQueueItem.findUnique({
          where: { type_idempotencyKey: { type: input.type, idempotencyKey } },
          select: { id: true, state: true },
        });
        if (existing)
          return { id: existing.id, state: existing.state, deduplicated: true };
      }
      throw Errors.database("Failed to enqueue background job.", e);
    }
  }

  async claim(workerId: string, types?: QueueJobType[]): Promise<ClaimedJob[]> {
    const batchSize = env().QUEUE_BATCH_SIZE;
    const lockTimeout = new Date(Date.now() - env().QUEUE_LOCK_TIMEOUT_MS);

    // Candidate scan first, then a conditional claim per row. The conditional
    // UPDATE is what makes claiming atomic across processes.
    const candidates = await prisma.workQueueItem.findMany({
      where: {
        state: "QUEUED",
        nextRunAt: { lte: new Date() },
        ...(types && types.length ? { type: { in: types } } : {}),
      },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
      take: batchSize * 3,
      select: { id: true },
    });

    const claimed: ClaimedJob[] = [];
    for (const candidate of candidates) {
      if (claimed.length >= batchSize) break;
      const result = await prisma.workQueueItem.updateMany({
        where: { id: candidate.id, state: "QUEUED" },
        data: {
          state: "PROCESSING",
          lockedAt: new Date(),
          lockedBy: workerId,
          attempts: { increment: 1 },
        },
      });
      if (result.count === 0) continue;
      const row = await prisma.workQueueItem.findUnique({
        where: { id: candidate.id },
      });
      if (!row) continue;
      claimed.push({
        id: row.id,
        type: row.type,
        userId: row.userId,
        payload: (row.payload ?? {}) as Record<string, unknown>,
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        traceId: row.traceId,
        idempotencyKey: row.idempotencyKey,
      });
    }

    // Opportunistically release jobs whose worker died.
    await prisma.workQueueItem.updateMany({
      where: { state: "PROCESSING", lockedAt: { lt: lockTimeout } },
      data: {
        state: "QUEUED",
        lockedAt: null,
        lockedBy: null,
        nextRunAt: new Date(),
      },
    });

    return claimed;
  }

  async complete(id: string, result?: unknown): Promise<void> {
    await prisma.workQueueItem.update({
      where: { id },
      data: {
        state: "SUCCEEDED",
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        resultSummary: summarize(result) as never,
      },
    });
  }

  async fail(
    id: string,
    error: { code: string; message: string; retryable: boolean },
  ): Promise<QueueJobState> {
    const job = await prisma.workQueueItem.findUnique({ where: { id } });
    if (!job) throw Errors.notFound("Queue job");

    if (!error.retryable || job.attempts >= job.maxAttempts) {
      await this.deadLetter(id, { code: error.code, message: error.message });
      return "DEAD";
    }

    const nextRunAt = new Date(Date.now() + backoffDelayMs(job.attempts));
    await prisma.workQueueItem.update({
      where: { id },
      data: {
        state: "QUEUED",
        nextRunAt,
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: error.code,
        lastErrorMessage: error.message.slice(0, 500),
      },
    });
    logWarn(
      { operation: "queue.retry", traceId: job.traceId ?? undefined },
      "Job scheduled for retry",
      {
        id,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        nextRunAt: nextRunAt.toISOString(),
        code: error.code,
      },
    );
    return "QUEUED";
  }

  async deadLetter(
    id: string,
    error: { code: string; message: string },
  ): Promise<void> {
    // The payload is preserved, never deleted: an admin must be able to inspect
    // and replay it.
    await prisma.workQueueItem.update({
      where: { id },
      data: {
        state: "DEAD",
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: error.code,
        lastErrorMessage: error.message.slice(0, 500),
      },
    });
    logError({ operation: "queue.dead" }, "Job moved to dead-letter state", {
      id,
      code: error.code,
    });
  }

  async recoverStuckJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - env().QUEUE_LOCK_TIMEOUT_MS);
    const result = await prisma.workQueueItem.updateMany({
      where: { state: "PROCESSING", lockedAt: { lt: cutoff } },
      data: {
        state: "QUEUED",
        lockedAt: null,
        lockedBy: null,
        nextRunAt: new Date(),
      },
    });
    if (result.count > 0) {
      logWarn(
        { operation: "queue.recover" },
        "Recovered stuck jobs from a crashed worker",
        {
          count: result.count,
        },
      );
    }
    return result.count;
  }

  async requeue(id: string): Promise<void> {
    await prisma.workQueueItem.update({
      where: { id },
      data: {
        state: "QUEUED",
        attempts: 0,
        nextRunAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    logInfo(
      { operation: "queue.requeue" },
      "Dead-letter job requeued by operator",
      { id },
    );
  }

  async stats(): Promise<QueueStats> {
    const grouped = await prisma.workQueueItem.groupBy({
      by: ["state"],
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.state] = g._count._all;
    const oldest = await prisma.workQueueItem.findFirst({
      where: { state: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return {
      queued: counts.QUEUED ?? 0,
      processing: counts.PROCESSING ?? 0,
      succeeded: counts.SUCCEEDED ?? 0,
      failed: counts.FAILED ?? 0,
      dead: counts.DEAD ?? 0,
      oldestQueuedAt: oldest?.createdAt ?? null,
    };
  }
}

/** Bounded summary stored on the job row — never the full payload. */
function summarize(result: unknown): Record<string, unknown> | undefined {
  if (result === undefined || result === null) return undefined;
  const text = JSON.stringify(result);
  if (text.length > 500) return { truncated: true, sizeChars: text.length };
  if (typeof result === "object") return result as Record<string, unknown>;
  return { value: String(result).slice(0, 200) };
}

let queue: JobQueue | null = null;

export function jobQueue(): JobQueue {
  if (queue) return queue;
  // Redis is documented as a future scale option but never required.
  queue = new PostgresJobQueue();
  return queue;
}

export function __resetQueueForTests(): void {
  queue = null;
}

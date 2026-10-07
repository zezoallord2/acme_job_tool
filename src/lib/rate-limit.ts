import { prisma } from "./db";
import { Errors } from "./errors";
import { env } from "./env";

/**
 * Rate limiting. Database-backed by default so a single-process self-hosted
 * install needs no Redis. An in-memory adapter exists for tests and for the case
 * where the database itself is the thing being protected.
 */
export interface RateLimitProvider {
  readonly name: "database" | "memory" | "redis";
  consume(
    key: string,
    limit: number,
    windowMs: number,
    userId?: string | null,
  ): Promise<RateLimitResult>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  /**
   * Separate bucket from the request path. Guessing tokens must not be able to
   * burn the quota a legitimate user needs to submit the link they were emailed.
   */
  passwordResetConfirm: { limit: 10, windowMs: 60 * 60_000 },
  aiAssist: { limit: 30, windowMs: 60 * 60_000 },
  upload: { limit: 20, windowMs: 60 * 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
  bugReport: { limit: 10, windowMs: 60 * 60_000 },
  export: { limit: 10, windowMs: 60 * 60_000 },
  write: { limit: 600, windowMs: 60_000 },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

export async function enforceRateLimit(
  kind: RateLimitKind,
  identity: { userId?: string | null; ip?: string | null },
): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[kind];
  const subject = identity.userId
    ? `u:${identity.userId}`
    : `ip:${identity.ip ?? "unknown"}`;
  const key = `${kind}:${subject}`;
  const result = await rateLimitProvider().consume(
    key,
    limit,
    windowMs,
    identity.userId ?? null,
  );
  if (!result.allowed) {
    throw Errors.rateLimited(
      "Too many requests. Please wait a moment and try again.",
      result.retryAfterSeconds,
    );
  }

  if (kind === "aiAssist" && identity.userId) {
    const { getEntitlementState } =
      await import("@/services/entitlement-service");
    const state = await getEntitlementState(identity.userId);
    if (Number.isFinite(state.limits.aiAssistCallsPerDay)) {
      const daily = await rateLimitProvider().consume(
        `plan-ai:u:${identity.userId}`,
        state.limits.aiAssistCallsPerDay,
        24 * 60 * 60_000,
        identity.userId,
      );
      if (!daily.allowed) {
        throw Errors.rateLimited(
          `The Starter plan includes ${state.limits.aiAssistCallsPerDay} AI-assisted actions per day. Upgrade to Complete Edition for unlimited daily use.`,
          daily.retryAfterSeconds,
        );
      }
    }
  }
}

export async function aiAssistUsageToday(userId: string): Promise<number> {
  if (rateLimitProvider().name !== "database") return 0;
  const windowMs = 24 * 60 * 60_000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await prisma.rateLimitBucket.findUnique({
    where: {
      key_windowStart: { key: `plan-ai:u:${userId}`, windowStart },
    },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export class DatabaseRateLimiter implements RateLimitProvider {
  readonly name = "database" as const;

  async consume(
    key: string,
    limit: number,
    windowMs: number,
    userId: string | null,
  ): Promise<RateLimitResult> {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const resetAt = new Date(windowStart.getTime() + windowMs);

    // Atomic upsert + increment keeps concurrent requests from losing counts.
    const row = await prisma.rateLimitBucket.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1, limitValue: limit, userId },
      update: { count: { increment: 1 } },
    });

    const allowed = row.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - row.count),
      limit,
      resetAt,
      retryAfterSeconds: allowed
        ? 0
        : Math.ceil((resetAt.getTime() - Date.now()) / 1000),
    };
  }
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimitProvider {
  readonly name = "memory" as const;
  private readonly buckets = new Map<string, MemoryEntry>();

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, entry);
      return {
        allowed: true,
        remaining: limit - 1,
        limit,
        resetAt: new Date(entry.resetAt),
        retryAfterSeconds: 0,
      };
    }
    existing.count++;
    const allowed = existing.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - existing.count),
      limit,
      resetAt: new Date(existing.resetAt),
      retryAfterSeconds: allowed
        ? 0
        : Math.ceil((existing.resetAt - now) / 1000),
    };
  }
}

let provider: RateLimitProvider | null = null;

export function rateLimitProvider(): RateLimitProvider {
  if (provider) return provider;
  provider =
    env().RATE_LIMIT_PROVIDER === "memory"
      ? new MemoryRateLimiter()
      : new DatabaseRateLimiter();
  return provider;
}

export function __resetRateLimiterForTests(): void {
  provider = null;
}

/** Housekeeping so the table does not grow without bound. */
export async function purgeExpiredBuckets(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}

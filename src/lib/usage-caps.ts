import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { rateLimitProvider } from "@/lib/rate-limit";

/**
 * Usage caps for the AI-first features.
 *
 * The features are open to every plan. What protects the free provider quotas
 * is a per-user daily cap (and the hourly aiAssist rate limit), not a paywall.
 * Caps reuse the rate-limit buckets, so they need no extra table and reset on
 * UTC day boundaries.
 */

export type CappedFeature = "tailor" | "interview" | "jobRefresh";

const DAY_MS = 24 * 60 * 60_000;
export const MONTH_MS = 30 * DAY_MS;

const LABELS: Record<CappedFeature, string> = {
  tailor: "resume tailoring runs",
  interview: "mock interview sessions",
  jobRefresh: "fresh job searches",
};

export function dailyCapFor(
  feature: CappedFeature,
  isComplete: boolean,
): number {
  const e = env();
  switch (feature) {
    case "tailor":
      return isComplete ? e.TAILOR_DAILY_CAP_PAID : e.TAILOR_DAILY_CAP_FREE;
    case "interview":
      return isComplete
        ? e.INTERVIEW_DAILY_CAP_PAID
        : e.INTERVIEW_DAILY_CAP_FREE;
    case "jobRefresh":
      return isComplete
        ? e.JOB_REFRESH_DAILY_CAP_PAID
        : e.JOB_REFRESH_DAILY_CAP_FREE;
  }
}

/** Throws RATE_LIMITED once the user has used today's allowance. */
export async function enforceDailyCap(
  userId: string,
  feature: CappedFeature,
  isComplete: boolean,
): Promise<void> {
  const cap = dailyCapFor(feature, isComplete);
  const result = await rateLimitProvider().consume(
    `daily:${feature}:u:${userId}`,
    cap,
    DAY_MS,
    userId,
  );
  if (!result.allowed) {
    throw Errors.rateLimited(
      `You have used today's ${cap} ${LABELS[feature]}. The limit resets at midnight UTC.`,
      result.retryAfterSeconds,
    );
  }
}

/**
 * Consumes one unit of a provider quota (e.g. SerpAPI's monthly free credits).
 * Returns false instead of throwing so a provider can report "quota reached"
 * in its health status and the search continues with the other sources.
 */
export async function consumeQuota(
  key: string,
  limit: number,
  windowMs: number,
  userId: string | null = null,
): Promise<boolean> {
  if (limit <= 0) return false;
  const result = await rateLimitProvider().consume(
    `quota:${key}`,
    limit,
    windowMs,
    userId,
  );
  return result.allowed;
}

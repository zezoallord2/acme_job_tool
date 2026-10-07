import { prisma } from "@/lib/db";
import { newRequestId, newTraceId } from "@/lib/crypto";
import { asAppError, redactDetails } from "@/lib/errors";
import { logError, logInfo } from "@/lib/logger";
import type {
  AppError,
  ErrorCategory,
  SystemErrorSeverity,
} from "@/lib/errors";

/**
 * Internal observability. Everything is stored in PostgreSQL, so debugging works
 * with no external service. Logs are structured; secrets are never written.
 */

export interface RequestContext {
  traceId: string;
  requestId: string;
  operation: string;
  service: string;
  method?: string;
  route?: string;
  userId?: string | null;
  startedAt: number;
}

export function newRequestContext(
  operation: string,
  opts?: {
    route?: string;
    method?: string;
    userId?: string | null;
    traceId?: string;
  },
): RequestContext {
  return {
    traceId: opts?.traceId ?? newTraceId(),
    requestId: newRequestId(),
    operation,
    service: "acme-jobs",
    method: opts?.method,
    route: opts?.route,
    userId: opts?.userId ?? null,
    startedAt: Date.now(),
  };
}

/**
 * Times an operation, records a trace row, and returns the result. Failures are
 * recorded as errors and re-thrown — never swallowed.
 */
export async function traced<T>(
  ctx: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    await recordTrace(ctx, "success");
    return result;
  } catch (e) {
    const err = asAppError(e);
    await recordTrace(ctx, "failure", err.category);
    await recordSystemError(ctx, err);
    throw e;
  }
}

export async function recordTrace(
  ctx: RequestContext,
  result: "success" | "failure" | "degraded",
  errorCategory?: ErrorCategory,
): Promise<void> {
  const durationMs = Date.now() - ctx.startedAt;
  try {
    await prisma.traceRecord.create({
      data: {
        traceId: ctx.traceId,
        requestId: ctx.requestId,
        service: ctx.service,
        operation: ctx.operation,
        method: ctx.method,
        route: ctx.route,
        userId: ctx.userId ?? undefined,
        durationMs,
        result,
        errorCategory: errorCategory as never,
      },
    });
  } catch {
    // Observability must never take down the request it is observing.
  }
  recordPerformance("http_request_duration_ms", durationMs, {
    operation: ctx.operation,
    result,
  });
}

export async function recordSystemError(
  ctx: RequestContext,
  err: AppError,
): Promise<string | null> {
  const severity = severityFor(err.severity);
  logError(
    {
      traceId: ctx.traceId,
      operation: ctx.operation,
      userId: ctx.userId ?? undefined,
      result: "failure",
    },
    err.message,
    err.toLogObject(),
  );
  try {
    const row = await prisma.systemError.create({
      data: {
        traceId: ctx.traceId,
        severity: severity as never,
        category: err.category as never,
        code: err.code,
        message: err.message.slice(0, 1000),
        affectedWorkflow: ctx.operation,
        service: ctx.service,
        sanitizedContext: redactDetails({
          ...err.details,
          requestId: ctx.requestId,
          route: ctx.route,
        }) as never,
        retryCount:
          typeof err.details.attempts === "number"
            ? (err.details.attempts as number)
            : 0,
        userId: ctx.userId ?? undefined,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

function severityFor(s: SystemErrorSeverity): SystemErrorSeverity {
  return s;
}

// ---------------------------------------------------------------------------
// Percentile performance metrics (p50/p95/p99), computed locally
// ---------------------------------------------------------------------------

export interface MetricWindow {
  name: string;
  kind: string;
  p50: number;
  p95: number;
  p99: number;
  count: number;
  windowStart: Date;
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

const METRIC_BUFFER = new Map<string, number[]>();
const METRIC_MAX_SAMPLES = 500;

export function recordPerformance(
  name: string,
  valueMs: number,
  metadata?: Record<string, unknown>,
): void {
  const key = `${name}:${JSON.stringify(metadata ?? {})}`;
  const buf = METRIC_BUFFER.get(key) ?? [];
  buf.push(Math.max(0, Math.round(valueMs)));
  if (buf.length > METRIC_MAX_SAMPLES) buf.shift();
  METRIC_BUFFER.set(key, buf);
}

export async function flushPerformance(windowMinutes = 5): Promise<number> {
  const entries = [...METRIC_BUFFER.entries()];
  if (entries.length === 0) return 0;
  METRIC_BUFFER.clear();
  const windowStart = new Date(
    Math.floor(Date.now() / (windowMinutes * 60_000)) * windowMinutes * 60_000,
  );
  let written = 0;
  for (const [key, values] of entries) {
    const name = key.split(":")[0] ?? key;
    const kind = key.slice(name.length + 1);
    const sorted = [...values].sort((a, b) => a - b);
    try {
      await prisma.performanceMetric.create({
        data: {
          name,
          kind,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
          count: values.length,
          windowStart,
          metadata: safeParseJson(kind) as never,
        },
      });
      written++;
    } catch {
      /* metrics are best-effort */
    }
  }
  return written;
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function recentPerformance(limit = 50): Promise<MetricWindow[]> {
  return prisma.performanceMetric.findMany({
    orderBy: [{ windowStart: "desc" }, { name: "asc" }],
    take: limit,
  });
}

/** Aggregated, anonymised product metrics. Never stores user content. */
export async function recordProductMetric(
  name: string,
  delta = 1,
  dimensions?: Record<string, string>,
): Promise<void> {
  const bucket = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  try {
    await prisma.productMetric.upsert({
      where: { name_bucket: { name, bucket } },
      create: {
        name,
        bucket,
        value: delta,
        count: 1,
        dimensions: dimensions as never,
      },
      update: { value: { increment: delta }, count: { increment: 1 } },
    });
  } catch {
    /* analytics must never break a user action */
  }
}

export async function productMetrics(): Promise<
  Array<{ name: string; value: number; count: number; bucket: Date }>
> {
  return prisma.productMetric.findMany({
    orderBy: { bucket: "desc" },
    take: 200,
  });
}

export async function traceFor(traceId: string) {
  const [errors, traces] = await Promise.all([
    prisma.systemError.findMany({
      where: { traceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.traceRecord.findMany({
      where: { traceId },
      orderBy: { startedAt: "asc" },
    }),
  ]);
  return { errors, traces };
}

export function logStartup(summary: Record<string, unknown>): void {
  logInfo({ operation: "app.startup" }, "Acme Jobs starting", summary);
}

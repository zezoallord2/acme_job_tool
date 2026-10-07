import type { ClaimedJob, JobQueue } from "@/queue/queue";
import type { AppError, ErrorCategory } from "@/lib/errors";
import { asAppError } from "@/lib/errors";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { flushPerformance } from "@/lib/observability";
import { purgeExpiredBuckets } from "@/lib/rate-limit";
import { purgeOldArtefacts, ensureDataDirs } from "@/lib/storage";

export type JobHandler = (job: ClaimedJob) => Promise<unknown>;

/**
 * Worker registry. Handlers own their own retry decision: a handler returns
 * normally on success, throws an AppError with `retryable` set appropriately
 * otherwise. Authorization, authentication and validation failures are never
 * retried, because retrying cannot change the outcome.
 */
export const HANDLERS: Record<string, JobHandler> = {
  DOCUMENT_PARSE: async (job) => {
    const { parseDocumentText } =
      await import("@/worker/handlers/document-parse");
    return parseDocumentText(job);
  },
  EXPORT_PDF: async (job) => {
    const { handleExportPdf } = await import("@/worker/handlers/export-pdf");
    return handleExportPdf(job);
  },
  EXPORT_CSV: async (job) => {
    const { handleExportCsv } = await import("@/worker/handlers/export-pdf");
    return handleExportCsv(job);
  },
  ANALYTICS_RECALC: async (job) => {
    const { handleAnalyticsRecalc } =
      await import("@/worker/handlers/analytics-recalc");
    return handleAnalyticsRecalc(job);
  },
  AI_WORKFLOW: async (job) => {
    const { handleAiWorkflow } = await import("@/worker/handlers/ai-workflow");
    return handleAiWorkflow(job);
  },
  WEBHOOK_PROCESS: async (job) => {
    const { handleWebhookProcess } =
      await import("@/worker/handlers/webhook-process");
    return handleWebhookProcess(job);
  },
  NOTIFICATION_DISPATCH: async (job) => {
    const { handleNotificationDispatch } =
      await import("@/worker/handlers/analytics-recalc");
    return handleNotificationDispatch(job);
  },
  INTEGRITY_CHECK: async (job) => {
    const { handleIntegrityCheck } =
      await import("@/worker/handlers/integrity-check");
    return handleIntegrityCheck(job);
  },
  DEAD_LETTER_REPLAY: async (job) => {
    const { handleDeadLetterReplay } =
      await import("@/worker/handlers/webhook-process");
    return handleDeadLetterReplay(job);
  },
};

export interface WorkerOptions {
  queue: JobQueue;
  workerId: string;
  pollIntervalMs: number;
  runOnce?: boolean;
  onIdle?: () => Promise<void>;
}

export async function runWorker(options: WorkerOptions): Promise<void> {
  const { queue, workerId } = options;
  let consecutiveIdle = 0;

  await ensureDataDirs().catch(() => undefined);
  await queue.recoverStuckJobs().catch(() => undefined);

  logInfo({ operation: "worker.start" }, "Worker started", { workerId });

  for (;;) {
    let processed = 0;
    try {
      const jobs = await queue.claim(workerId);
      for (const job of jobs) {
        processed++;
        await processOne(queue, job);
      }
    } catch (e) {
      // A worker crash must not silently discard work: the job stays PROCESSING
      // and is recovered by the lock-timeout sweep.
      logError({ operation: "worker.tick" }, "Worker tick failed");
      void e;
    }

    if (processed === 0) {
      consecutiveIdle++;
      if (options.runOnce) return;
      if (consecutiveIdle % 60 === 0) {
        await runMaintenance().catch(() => undefined);
      }
      await sleep(options.pollIntervalMs);
    } else {
      consecutiveIdle = 0;
      if (options.runOnce) return;
    }
  }
}

export async function processOne(
  queue: JobQueue,
  job: ClaimedJob,
): Promise<void> {
  const handler = HANDLERS[job.type];
  if (!handler) {
    await queue.deadLetter(job.id, {
      code: "NO_HANDLER",
      message: `No handler registered for ${job.type}.`,
    });
    return;
  }

  const started = Date.now();
  try {
    const result = await handler(job);
    await queue.complete(job.id, result);
    await recordSystemErrorForJob(job, null, Date.now() - started);
  } catch (e) {
    const err: AppError = asAppError(e);
    const state = await queue.fail(job.id, {
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    });
    await recordSystemErrorForJob(job, err, Date.now() - started);
    logWarn(
      { operation: "worker.job.failed", traceId: job.traceId ?? undefined },
      "Job failed",
      {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
        code: err.code,
        retryable: err.retryable,
        nextState: state,
      },
    );
  }
}

async function recordSystemErrorForJob(
  job: ClaimedJob,
  err: AppError | null,
  durationMs: number,
): Promise<void> {
  try {
    await prisma.systemError.create({
      data: {
        traceId: job.traceId ?? null,
        severity: err ? severityFor(err.category) : "INFO",
        category: err ? (err.category as never) : "UNKNOWN",
        code: err ? err.code : "JOB_SUCCEEDED",
        message: err ? err.message.slice(0, 1000) : `${job.type} completed`,
        affectedWorkflow: `queue:${job.type}`,
        service: "worker",
        sanitizedContext: {
          jobId: job.id,
          attempt: job.attempts,
          durationMs,
          userId: job.userId,
        } as never,
        retryCount: Math.max(0, job.attempts - 1),
        userId: job.userId ?? undefined,
      },
    });
  } catch {
    /* observability must not break the worker */
  }
}

function severityFor(
  category: ErrorCategory,
): "INFO" | "WARNING" | "ERROR" | "CRITICAL" {
  switch (category) {
    case "AUTHENTICATION":
    case "AUTHORIZATION":
    case "VALIDATION":
      return "WARNING";
    case "CONFIGURATION":
      return "CRITICAL";
    default:
      return "ERROR";
  }
}

export async function runMaintenance(): Promise<void> {
  const [perf, buckets, artefacts] = await Promise.allSettled([
    flushPerformance(),
    purgeExpiredBuckets(),
    purgeOldArtefacts(),
  ]);
  const summary = {
    performanceWindows: perf.status === "fulfilled" ? perf.value : 0,
    rateLimitBuckets: buckets.status === "fulfilled" ? buckets.value : 0,
    artefactsPurged: artefacts.status === "fulfilled" ? artefacts.value : 0,
  };
  if (Object.values(summary).some((v) => v > 0)) {
    logInfo(
      { operation: "worker.maintenance" },
      "Maintenance completed",
      summary,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

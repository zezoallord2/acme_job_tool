import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { envSummary } from "@/lib/errors";
import { healthCheckDb } from "@/lib/db";
import { jobQueue } from "@/queue/queue";
import { circuitStates } from "@/queue/circuit";
import { Errors } from "@/lib/errors";
import { ensureDataDirs, storageProvider, dataRoot } from "@/lib/storage";
import type { HealthState } from "@prisma/client";

/**
 * Internal Debug Center + bug reporting. Everything is local: PostgreSQL records
 * and filesystem data. No Sentry, Datadog or other paid observability service.
 */

/** ACME-7F92A1 — short, searchable, and reveals nothing about the user. */
export function generateDiagnosticId(): string {
  // Three bytes gives the six hex characters of the ACME-7F92A1 format.
  return `ACME-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export interface BugReportInput {
  userId?: string | null;
  whatAttempted: string;
  whatHappened: string;
  steps?: string;
  includeDiagnostics?: boolean;
  route?: string;
}

export async function createBugReport(input: BugReportInput): Promise<string> {
  if (!input.whatAttempted?.trim())
    throw Errors.validation("Tell us what you were trying to do.");
  if (!input.whatHappened?.trim())
    throw Errors.validation("Tell us what happened.");

  let diagnosticId = generateDiagnosticId();
  // Retry on the astronomically unlikely collision rather than failing the report.
  for (let i = 0; i < 3; i++) {
    const clash = await prisma.bugReport.findUnique({
      where: { diagnosticId },
      select: { id: true },
    });
    if (!clash) break;
    diagnosticId = generateDiagnosticId();
  }

  const diagnostics = input.includeDiagnostics
    ? await sanitizedDiagnostics(input.route)
    : null;

  await prisma.bugReport.create({
    data: {
      diagnosticId,
      userId: input.userId ?? null,
      whatAttempted: input.whatAttempted.slice(0, 2000),
      whatHappened: input.whatHappened.slice(0, 4000),
      steps: input.steps?.slice(0, 4000) ?? null,
      includeDiagnostics: Boolean(input.includeDiagnostics),
      diagnostics: diagnostics as never,
      status: "OPEN",
      severity: "WARNING",
    },
  });

  return diagnosticId;
}

/**
 * Reproduction package. Contains shapes, versions and identifiers only.
 * It never contains resume text, passwords, API keys or raw prompts.
 */
export async function sanitizedDiagnostics(
  route?: string,
): Promise<Record<string, unknown>> {
  const [schemaVersion, promptVersions, flags] = await Promise.all([
    prisma.systemError.findFirst({
      orderBy: { createdAt: "desc" },
      select: { traceId: true },
    }),
    prisma.versionedArtifact.findMany({
      select: { identifier: true, version: true, status: true },
      take: 40,
    }),
    prisma.featureFlag.findMany({
      select: { key: true, state: true, rolloutPercent: true },
      take: 40,
    }),
  ]);

  // The user agent is request-scoped. Diagnostics must still work from the
  // worker, scripts and tests, so an unavailable request scope is not an error.
  const userAgent = await readUserAgent();

  return {
    appVersion: env().APP_VERSION,
    schemaVersion: env().SCHEMA_VERSION,
    route: route ?? null,
    requestPath: "/report-problem",
    browser: extractBrowser(userAgent),
    os: extractOs(userAgent),
    userAgentFamily: extractBrowser(userAgent),
    featureFlags: flags,
    promptVersions: promptVersions.map(
      (p) => `${p.identifier}@${p.version}:${p.status}`,
    ),
    providerModels: "derived from AIInteraction.provider/model at call time",
    lastTraceId: schemaVersion?.traceId ?? null,
    nodeVersion: process.version,
    environment: env().NODE_ENV,
    config: envSummary(),
    capturedAt: new Date().toISOString(),
    sanitizedInputShape: {
      fields: ["whatAttempted", "whatHappened", "steps", "route"],
    },
    sanitizedResponseShape: { fields: ["diagnosticId"] },
  };
}

async function readUserAgent(): Promise<string> {
  try {
    const headersModule = await import("next/headers");
    return (await headersModule.headers()).get("user-agent") ?? "";
  } catch {
    return "";
  }
}

function extractBrowser(ua: string): string {
  if (!ua) return "unknown";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/")) return "Opera";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "other";
}

function extractOs(ua: string): string {
  if (!ua) return "unknown";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "other";
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

export interface SubsystemHealth {
  subsystem: string;
  state: HealthState;
  detail: string;
  durationMs?: number;
}

export async function runHealthChecks(): Promise<SubsystemHealth[]> {
  const out: SubsystemHealth[] = [];

  const db = await healthCheckDb();
  out.push({
    subsystem: "database",
    state: db.ok ? "HEALTHY" : "UNAVAILABLE",
    detail: db.ok ? "PostgreSQL reachable" : `unreachable (${db.detail})`,
    durationMs: db.durationMs,
  });

  try {
    const stats = await jobQueue().stats();
    const backlog = stats.queued;
    out.push({
      subsystem: "queue",
      state: stats.dead > 20 ? "DEGRADED" : "HEALTHY",
      detail: `queued ${stats.queued}, processing ${stats.processing}, dead ${stats.dead}`,
    });
    void backlog;
  } catch (e) {
    out.push({
      subsystem: "queue",
      state: "UNAVAILABLE",
      detail: e instanceof Error ? e.message : "error",
    });
  }

  const e = env();
  if (e.GEMINI_API_KEY || e.OPENAI_API_KEY) {
    out.push({
      subsystem: "ai-provider",
      state: "HEALTHY",
      detail: e.GEMINI_API_KEY
        ? "Gemini and manual mode are both available."
        : "Groq/OpenAI-compatible endpoint and manual mode are both available.",
    });
  }

  out.push({
    subsystem: "ai-manual",
    state: "HEALTHY",
    detail: "Manual Mode always available (zero-cost guarantee).",
  });

  try {
    await ensureDataDirs();
    out.push({
      subsystem: "storage",
      state: "HEALTHY",
      detail: `${storageProvider().name} at ${dataRoot()}`,
    });
  } catch (err) {
    out.push({
      subsystem: "storage",
      state: "UNAVAILABLE",
      detail: err instanceof Error ? err.message : "error",
    });
  }

  const exportDir = `${dataRoot()}/exports`;
  out.push({
    subsystem: "export",
    state: "HEALTHY",
    detail: `PDF/DOCX/CSV generated locally (${exportDir}). No external document service.`,
  });

  out.push({
    subsystem: "billing-webhook",
    state: "HEALTHY",
    detail: `Provider: ${e.BILLING_PROVIDER}. Manual admin grants always work.`,
  });

  return out;
}

// ---------------------------------------------------------------------------
// Debug Center data
// ---------------------------------------------------------------------------

export async function debugCenterData() {
  const [
    errors,
    deadJobs,
    failedJobs,
    queueStats,
    circuits,
    flags,
    promptVersions,
    releases,
    bugReports,
    slowOps,
    evals,
  ] = await Promise.all([
    prisma.systemError.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        code: true,
        message: true,
        severity: true,
        category: true,
        affectedWorkflow: true,
        traceId: true,
        retryCount: true,
        resolutionStatus: true,
        createdAt: true,
      },
    }),
    prisma.workQueueItem.findMany({
      where: { state: "DEAD" },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        attempts: true,
        maxAttempts: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        payloadHash: true,
        traceId: true,
        updatedAt: true,
      },
    }),
    prisma.workQueueItem.findMany({
      where: { state: "QUEUED", attempts: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        attempts: true,
        nextRunAt: true,
        lastErrorCode: true,
      },
    }),
    jobQueue().stats(),
    circuitStates(),
    prisma.featureFlag.findMany({ orderBy: { key: "asc" } }),
    prisma.promptCandidate.findMany({
      orderBy: [{ identifier: "asc" }, { version: "desc" }],
      take: 80,
    }),
    prisma.releaseRecord.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.bugReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        diagnosticId: true,
        status: true,
        severity: true,
        whatAttempted: true,
        whatHappened: true,
        reproductionStatus: true,
        rootCause: true,
        createdAt: true,
      },
    }),
    prisma.performanceMetric.findMany({
      orderBy: { windowStart: "desc" },
      take: 30,
    }),
    prisma.aIEvaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    errors,
    deadJobs,
    failedJobs,
    queueStats,
    circuits,
    flags,
    promptVersions,
    releases,
    bugReports,
    slowOps: slowOps.filter((m) => m.p95 > 500),
    evaluations: evals,
  };
}

export async function aiProviderFailures() {
  return prisma.aIInteraction.findMany({
    where: { status: { in: ["FAILED", "VALIDATION_FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      workflowId: true,
      provider: true,
      model: true,
      errorCode: true,
      errorCategory: true,
      retryCount: true,
      durationMs: true,
      createdAt: true,
      traceId: true,
    },
  });
}

export async function webhookDeliveries() {
  return prisma.webhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 40,
  });
}

export async function databaseErrors() {
  return prisma.systemError.findMany({
    where: { category: "DATABASE" },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

export async function searchByDiagnosticId(id: string) {
  const normalized = id.trim().toUpperCase();
  return prisma.bugReport.findUnique({
    where: { diagnosticId: normalized },
    include: { systemError: true },
  });
}

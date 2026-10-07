import { pino, type Logger } from "pino";
import { env } from "./env";
import { newTraceId } from "./crypto";

/**
 * Structured logging (Pino, MIT, local). No external service required.
 *
 * Redaction is enforced here rather than trusted to call sites: any key that
 * looks like a credential is replaced before serialisation.
 */
const REDACTED_PATHS = [
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "apiKey",
  "encryptedKey",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "sessionToken",
  "secret",
  "clientSecret",
  "webhookSecret",
  "*.password",
  "*.apiKey",
  "*.token",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

let base: Logger | null = null;

function getBase(): Logger {
  if (base) return base;
  const e = env();
  base = pino({
    level: e.NODE_ENV === "test" ? "silent" : e.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
    base: {
      service: "acme-jobs",
      appVersion: e.APP_VERSION,
      env: e.NODE_ENV,
      zeroCostMode: e.ZERO_COST_MODE,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
  return base;
}

export interface LogContext {
  traceId?: string;
  requestId?: string;
  operation?: string;
  userId?: string;
  durationMs?: number;
  result?: "success" | "failure" | "degraded";
  [key: string]: unknown;
}

export function logger(): Logger {
  return getBase();
}

export function withTrace(ctx: LogContext = {}): Logger {
  return getBase().child({
    traceId: ctx.traceId ?? newTraceId(),
    ...(ctx.operation ? { operation: ctx.operation } : {}),
    ...(ctx.userId ? { userId: ctx.userId } : {}),
  });
}

export function logInfo(
  ctx: LogContext,
  message: string,
  extra?: Record<string, unknown>,
): void {
  getBase().info({ ...ctx, ...extra }, message);
}

export function logWarn(
  ctx: LogContext,
  message: string,
  extra?: Record<string, unknown>,
): void {
  getBase().warn({ ...ctx, ...extra }, message);
}

export function logError(
  ctx: LogContext,
  message: string,
  extra?: Record<string, unknown>,
): void {
  getBase().error({ ...ctx, ...extra }, message);
}

export function logDebug(
  ctx: LogContext,
  message: string,
  extra?: Record<string, unknown>,
): void {
  getBase().debug({ ...ctx, ...extra }, message);
}

/** Test helper so each run gets a clean destination. */
export function __resetLoggerForTests(): void {
  base = null;
}

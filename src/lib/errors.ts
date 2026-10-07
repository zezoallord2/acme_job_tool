import { Prisma } from "@prisma/client";
import { env } from "./env";

/**
 * Structured error model. Every failure carries a stable code, a category the
 * queue/observability layers understand, and an explicit retry decision.
 *
 * Never surface `cause`, stack traces, or SQL to end users.
 */
export type ErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_PROVIDER"
  | "AI_VALIDATION"
  | "EXTERNAL_SERVICE"
  | "DATABASE"
  | "FILE_IO"
  | "QUEUE"
  | "WEBHOOK"
  | "EXPORT"
  | "INTEGRITY"
  | "RATE_LIMIT"
  | "CONFIGURATION"
  | "UNKNOWN";

export type SystemErrorSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface AppErrorOptions {
  code: string;
  category: ErrorCategory;
  message: string;
  status?: number;
  retryable?: boolean;
  severity?: SystemErrorSeverity;
  details?: Record<string, unknown>;
  cause?: unknown;
  traceId?: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly status: number;
  readonly retryable: boolean;
  readonly severity: SystemErrorSeverity;
  readonly details: Record<string, unknown>;
  readonly traceId?: string;

  constructor(opts: AppErrorOptions) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.category = opts.category;
    this.status = opts.status ?? defaultStatusFor(opts.category);
    this.retryable = opts.retryable ?? defaultRetryableFor(opts.category);
    this.severity = opts.severity ?? defaultSeverityFor(opts.category);
    this.details = opts.details ?? {};
    this.traceId = opts.traceId;
    if (opts.cause !== undefined)
      (this as { cause?: unknown }).cause = opts.cause;
  }

  /** Safe for logs: no secrets, no raw SQL, bounded size. */
  toLogObject(): Record<string, unknown> {
    return {
      code: this.code,
      category: this.category,
      status: this.status,
      retryable: this.retryable,
      severity: this.severity,
      message: this.message,
      details: redactDetails(this.details),
      traceId: this.traceId,
    };
  }
}

function defaultStatusFor(category: ErrorCategory): number {
  switch (category) {
    case "VALIDATION":
      return 400;
    case "AUTHENTICATION":
      return 401;
    case "AUTHORIZATION":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMIT":
      return 429;
    case "CONFIGURATION":
      return 503;
    default:
      return 500;
  }
}

/**
 * Retry policy is explicit. Authorization, authentication and validation
 * failures are never retried: retrying cannot change the outcome and only
 * duplicates load.
 */
function defaultRetryableFor(category: ErrorCategory): boolean {
  switch (category) {
    case "AUTHENTICATION":
    case "AUTHORIZATION":
    case "VALIDATION":
    case "NOT_FOUND":
    case "CONFLICT":
      return false;
    case "AI_PROVIDER":
    case "EXTERNAL_SERVICE":
    case "DATABASE":
    case "QUEUE":
    case "FILE_IO":
      return true;
    default:
      return false;
  }
}

function defaultSeverityFor(category: ErrorCategory): SystemErrorSeverity {
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

const SECRET_KEY_PATTERN =
  /(key|secret|password|token|authorization|cookie|apikey)/i;

export function redactDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string") {
      out[k] = v.length > 500 ? `${v.slice(0, 500)}…[truncated]` : v;
    } else if (v && typeof v === "object") {
      out[k] = redactDetails(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const Errors = {
  validation(
    message: string,
    details?: Record<string, unknown>,
    traceId?: string,
  ) {
    return new AppError({
      code: "VALIDATION_FAILED",
      category: "VALIDATION",
      message,
      details,
      traceId,
    });
  },
  unauthorized(
    message = "You are not allowed to perform this action.",
    details?: Record<string, unknown>,
  ) {
    return new AppError({
      code: "FORBIDDEN",
      category: "AUTHORIZATION",
      message,
      details,
    });
  },
  unauthenticated(message = "You must be signed in.") {
    return new AppError({
      code: "UNAUTHENTICATED",
      category: "AUTHENTICATION",
      message,
    });
  },
  notFound(resource: string) {
    return new AppError({
      code: "NOT_FOUND",
      category: "NOT_FOUND",
      message: `${resource} was not found.`,
      details: { resource },
    });
  },
  conflict(message: string, details?: Record<string, unknown>) {
    return new AppError({
      code: "CONFLICT",
      category: "CONFLICT",
      message,
      details,
    });
  },
  rateLimited(
    message = "Too many requests. Please slow down.",
    retryAfterSeconds?: number,
  ) {
    return new AppError({
      code: "RATE_LIMITED",
      category: "RATE_LIMIT",
      message,
      details: retryAfterSeconds ? { retryAfterSeconds } : undefined,
    });
  },
  aiProvider(
    message: string,
    details?: Record<string, unknown>,
    traceId?: string,
  ) {
    return new AppError({
      code: "AI_PROVIDER_FAILURE",
      category: "AI_PROVIDER",
      message,
      details,
      traceId,
      retryable: true,
    });
  },
  aiValidation(
    message: string,
    details?: Record<string, unknown>,
    traceId?: string,
  ) {
    return new AppError({
      code: "AI_OUTPUT_INVALID",
      category: "AI_VALIDATION",
      message,
      details,
      traceId,
      severity: "WARNING",
    });
  },
  configuration(message: string, details?: Record<string, unknown>) {
    return new AppError({
      code: "CONFIGURATION_ERROR",
      category: "CONFIGURATION",
      message,
      details,
    });
  },
  integrity(message: string, details?: Record<string, unknown>) {
    return new AppError({
      code: "INTEGRITY_VIOLATION",
      category: "INTEGRITY",
      message,
      details,
    });
  },
  database(message: string, cause?: unknown) {
    return new AppError({
      code: "DATABASE_ERROR",
      category: "DATABASE",
      message,
      cause,
      retryable: true,
    });
  },
  external(message: string, details?: Record<string, unknown>) {
    return new AppError({
      code: "EXTERNAL_SERVICE_ERROR",
      category: "EXTERNAL_SERVICE",
      message,
      details,
      retryable: true,
    });
  },
};

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function isPrismaNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2025" &&
    e instanceof Prisma.PrismaClientKnownRequestError
  );
}

export function asAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return Errors.notFound("Record");
    if (e.code === "P2002") {
      return new AppError({
        code: "UNIQUE_CONSTRAINT",
        category: "CONFLICT",
        message: "That record already exists.",
        details: { prismaCode: e.code },
      });
    }
    if (e.code === "P2034") {
      return new AppError({
        code: "TRANSACTION_CONFLICT",
        category: "CONFLICT",
        message: "The record was modified by someone else. Please retry.",
        details: { prismaCode: e.code },
        retryable: true,
      });
    }
    return Errors.database("A database operation failed.", e);
  }
  if (e instanceof Error) {
    if (e.name === "EntitlementError") {
      return Errors.unauthorized(e.message);
    }
    if (e.name === "AbortError" || e.message.includes("timeout")) {
      return new AppError({
        code: "TIMEOUT",
        category: "EXTERNAL_SERVICE",
        message: "The operation timed out.",
        cause: e,
        retryable: true,
      });
    }
    return new AppError({
      code: "UNEXPECTED",
      category: "UNKNOWN",
      message: e.message,
      cause: e,
    });
  }
  return new AppError({
    code: "UNEXPECTED",
    category: "UNKNOWN",
    message: "An unexpected error occurred.",
    cause: e,
  });
}

/** Message safe to render to a normal user. Never includes internals. */
export function userFacingMessage(e: unknown): string {
  const err = asAppError(e);
  switch (err.category) {
    case "AUTHENTICATION":
    case "AUTHORIZATION":
    case "VALIDATION":
    case "CONFLICT":
    case "RATE_LIMIT":
      return err.message;
    case "AI_PROVIDER":
      return "The AI provider could not complete that request. Your work is saved — try again, or switch to Manual Mode.";
    case "AI_VALIDATION":
      return "The AI response could not be validated. Nothing was changed. Review the response and try again.";
    case "NOT_FOUND":
      return err.message;
    default:
      return "We could not complete that action. Your work has been saved.";
  }
}

export function assertNever(value: never, context = "value"): never {
  throw new AppError({
    code: "UNREACHABLE",
    category: "UNKNOWN",
    message: `Unhandled ${context}: ${String(value)}`,
  });
}

export function envSummary(): Record<string, unknown> {
  const e = env();
  return {
    nodeEnv: e.NODE_ENV,
    appVersion: e.APP_VERSION,
    zeroCostMode: e.ZERO_COST_MODE,
    storageProvider: e.STORAGE_PROVIDER,
    queueProvider: e.QUEUE_PROVIDER,
    observabilityProvider: e.OBSERVABILITY_PROVIDER,
    analyticsProvider: e.ANALYTICS_PROVIDER,
    entitlementProvider: e.ENTITLEMENT_PROVIDER,
    defaultAiProvider: e.DEFAULT_AI_PROVIDER,
    acmeAiEnabled: e.ACME_AI_ENABLED,
  };
}

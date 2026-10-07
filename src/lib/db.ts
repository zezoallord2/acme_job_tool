import { PrismaClient, Prisma } from "@prisma/client";
import { env } from "./env";
import { logError, logInfo } from "./logger";

declare global {
  var __acmePrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__acmePrisma ??
  new PrismaClient({
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env().NODE_ENV !== "production") {
  globalThis.__acmePrisma = prisma;
}

/**
 * Runs a callback inside a transaction. Used wherever a multi-step write must
 * be all-or-nothing (status change + history event, entitlement grant + event,
 * snapshot + state transition).
 */
export async function inTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 15000,
    isolationLevel: options?.isolationLevel,
  });
}

export async function connectDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  logInfo({ operation: "db.connect" }, "Database connection established");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

export function isUniqueViolation(e: unknown, target?: string): boolean {
  if (
    !(e instanceof Prisma.PrismaClientKnownRequestError) ||
    e.code !== "P2002"
  )
    return false;
  if (!target) return true;
  const meta = e.meta as { target?: string[] | string } | undefined;
  const fields = Array.isArray(meta?.target)
    ? meta?.target
    : meta?.target
      ? [meta?.target]
      : [];
  return fields.some((f) => f.includes(target));
}

/**
 * Postgres advisory lock keyed on a string. Gives us a per-user critical section
 * without relying on row locks alone (read-modify-write sequences).
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const hash = [...key].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 2147483647,
    7,
  );
  const [result] = await prisma.$queryRaw<Array<{ result: unknown }>>`
    SELECT pg_advisory_xact_lock(${hash}) AS result
  `;
  void result;
  return fn();
}

export async function healthCheckDb(): Promise<{
  ok: boolean;
  detail: string;
  durationMs: number;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, detail: "reachable", durationMs: Date.now() - start };
  } catch (e) {
    logError({ operation: "db.health" }, "Database health check failed");
    return {
      ok: false,
      detail: e instanceof Error ? e.name : "unknown",
      durationMs: Date.now() - start,
    };
  }
}

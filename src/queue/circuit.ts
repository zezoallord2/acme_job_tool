import type { AIProviderName } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logWarn } from "@/lib/logger";

/**
 * Circuit breakers for external integrations.
 *
 * When a provider fails repeatedly we stop calling it, mark it DEGRADED, and let
 * the router fall back to Manual Mode rather than burning requests and money.
 */
const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 5 * 60_000;
const HALF_OPEN_SUCCESSES_TO_CLOSE = 2;

export type CircuitStateName = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitSnapshot {
  name: string;
  state: CircuitStateName;
  failureCount: number;
  successCount: number;
  nextProbeAt: Date | null;
  lastError: string | null;
}

export async function getCircuit(name: string): Promise<CircuitSnapshot> {
  const row = await prisma.circuitBreakerState.findUnique({ where: { name } });
  if (!row) {
    return {
      name,
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      nextProbeAt: null,
      lastError: null,
    };
  }
  return {
    name: row.name,
    state: row.state as CircuitStateName,
    failureCount: row.failureCount,
    successCount: row.successCount,
    nextProbeAt: row.nextProbeAt,
    lastError: row.lastError,
  };
}

export async function isCallPermitted(name: string): Promise<boolean> {
  const c = await getCircuit(name);
  if (c.state === "CLOSED") return true;
  if (c.state === "HALF_OPEN") return true;
  return c.nextProbeAt !== null && c.nextProbeAt.getTime() <= Date.now();
}

export async function recordSuccess(name: string): Promise<void> {
  const row = await prisma.circuitBreakerState.findUnique({ where: { name } });
  const successCount = (row?.successCount ?? 0) + 1;
  const shouldClose =
    (row?.state === "HALF_OPEN" &&
      successCount >= HALF_OPEN_SUCCESSES_TO_CLOSE) ||
    row?.state === "OPEN";
  await prisma.circuitBreakerState.upsert({
    where: { name },
    create: {
      name,
      state: shouldClose ? "CLOSED" : "CLOSED",
      failureCount: 0,
      successCount: shouldClose ? 0 : successCount,
      lastError: null,
      nextProbeAt: null,
    },
    update: shouldClose
      ? {
          state: "CLOSED",
          failureCount: 0,
          successCount: 0,
          nextProbeAt: null,
          lastError: null,
        }
      : { failureCount: 0, successCount },
  });
  await prisma.providerHealth.upsert({
    where: { provider: toProviderName(name) },
    create: {
      provider: toProviderName(name),
      state: "HEALTHY",
      totalSuccess: 1,
      lastSuccessAt: new Date(),
    },
    update: {
      state: "HEALTHY",
      totalSuccess: { increment: 1 },
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
    },
  });
}

export async function recordFailure(
  name: string,
  error: string,
): Promise<CircuitSnapshot> {
  const row = await prisma.circuitBreakerState.findUnique({ where: { name } });
  const failureCount = (row?.failureCount ?? 0) + 1;
  const shouldOpen =
    failureCount >= FAILURE_THRESHOLD || row?.state === "HALF_OPEN";

  const state: CircuitStateName = shouldOpen ? "OPEN" : "CLOSED";
  const nextProbeAt = shouldOpen
    ? new Date(Date.now() + OPEN_DURATION_MS)
    : null;

  const updated = await prisma.circuitBreakerState.upsert({
    where: { name },
    create: {
      name,
      state,
      failureCount,
      successCount: 0,
      nextProbeAt,
      lastError: error.slice(0, 300),
    },
    update: {
      state,
      failureCount,
      successCount: 0,
      nextProbeAt,
      lastError: error.slice(0, 300),
    },
  });

  await prisma.providerHealth.upsert({
    where: { provider: toProviderName(name) },
    create: {
      provider: toProviderName(name),
      state: shouldOpen ? "DEGRADED" : "HEALTHY",
      totalFailure: 1,
      consecutiveFailures: failureCount,
      lastFailureAt: new Date(),
      lastError: error.slice(0, 300),
    },
    update: {
      state: shouldOpen ? "DEGRADED" : "HEALTHY",
      totalFailure: { increment: 1 },
      consecutiveFailures: failureCount,
      lastFailureAt: new Date(),
      lastError: error.slice(0, 300),
    },
  });

  if (shouldOpen) {
    logWarn({ operation: "circuit.open" }, "Circuit opened; falling back", {
      circuit: name,
      failureCount,
      retryAt: nextProbeAt?.toISOString(),
    });
  }

  return {
    name,
    state: updated.state as CircuitStateName,
    failureCount: updated.failureCount,
    successCount: updated.successCount,
    nextProbeAt: updated.nextProbeAt,
    lastError: updated.lastError,
  };
}

export async function resetCircuit(name: string): Promise<void> {
  await prisma.circuitBreakerState.upsert({
    where: { name },
    create: { name, state: "CLOSED", failureCount: 0, successCount: 0 },
    update: {
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      nextProbeAt: null,
      lastError: null,
    },
  });
}

export async function circuitStates(): Promise<CircuitSnapshot[]> {
  const rows = await prisma.circuitBreakerState.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    name: r.name,
    state: r.state as CircuitStateName,
    failureCount: r.failureCount,
    successCount: r.successCount,
    nextProbeAt: r.nextProbeAt,
    lastError: r.lastError,
  }));
}

function toProviderName(name: string): AIProviderName {
  const valid: AIProviderName[] = [
    "OPENAI",
    "ANTHROPIC",
    "GEMINI",
    "OPENROUTER",
    "LOCAL",
    "MANUAL",
  ];
  const upper = name.toUpperCase() as AIProviderName;
  if (valid.includes(upper)) return upper;
  return "OPENAI";
}

/** Zero-cost configuration never blocks boot; health is informational. */
export function zeroCostNotice(): string | null {
  return env().ZERO_COST_MODE
    ? "Manual Mode is the guaranteed fallback for every AI workflow."
    : null;
}

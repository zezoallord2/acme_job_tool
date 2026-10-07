import type { AIProviderName } from "@prisma/client";

/**
 * Circuit breaker for AI providers.
 *
 * Purpose: when a provider is hard-down or quota-exhausted, stop paying its
 * latency on every single request. Without this, a user whose key has hit a rate
 * limit waits through the full timeout of a doomed provider before every answer,
 * which reads as "the app is broken" rather than "try again shortly".
 *
 * Scope, and why it matters:
 *   - State is per provider, NOT per key. Rate limits on Google AI Studio are
 *     per project, so two keys on one project share a fate; failing over between
 *     them just doubles the wait before the same error.
 *   - Only hard failures trip the breaker. A rate limit trips it too, but with a
 *     short cooldown, because it usually clears on its own.
 *   - Successes reset the state, so a provider that recovers is used again
 *     immediately rather than waiting out a stale cooldown.
 */

export type FailureKind =
  "RATE_LIMIT" | "AUTH" | "CONFIG" | "NETWORK" | "OTHER";

interface BreakerState {
  failures: number;
  /** Epoch ms until which the breaker is open and the provider is skipped. */
  openUntil: number;
  lastFailureAt: number;
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 10 * 60_000;

export interface CircuitBreakerOptions {
  threshold?: number;
  baseCooldownMs?: number;
  now?: () => number;
}

export class CircuitBreaker {
  private readonly state = new Map<AIProviderName, BreakerState>();
  private readonly threshold: number;
  private readonly baseCooldownMs: number;
  private readonly now: () => number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.threshold = opts.threshold ?? DEFAULT_THRESHOLD;
    this.baseCooldownMs = opts.baseCooldownMs ?? DEFAULT_BASE_COOLDOWN_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  /** True when the provider should be skipped without being attempted. */
  isOpen(provider: AIProviderName): boolean {
    const s = this.state.get(provider);
    if (!s) return false;
    if (s.openUntil <= this.now()) {
      // Cooldown elapsed: let it back in, but keep the failure count so a
      // flapping provider trips again immediately rather than after N requests.
      s.openUntil = 0;
      return false;
    }
    return true;
  }

  /** Milliseconds until the provider may be tried again, or 0 if it may. */
  cooldownRemaining(provider: AIProviderName): number {
    const s = this.state.get(provider);
    if (!s || s.openUntil <= this.now()) return 0;
    return s.openUntil - this.now();
  }

  recordSuccess(provider: AIProviderName): void {
    this.state.delete(provider);
  }

  /**
   * Records a failure and opens the breaker once the threshold is reached.
   *
   * The cooldown grows with the failure count and is capped, so a provider that
   * has been down for an hour is retried every ten minutes rather than never.
   */
  recordFailure(
    provider: AIProviderName,
    kind: FailureKind = "OTHER",
  ): { open: boolean; cooldownMs: number } {
    const current = this.state.get(provider);
    const failures = (current?.failures ?? 0) + 1;
    const lastFailureAt = this.now();

    const open = failures >= this.threshold;
    let cooldownMs = 0;

    if (open) {
      // Rate limits clear quickly; an auth or config problem will not, so it is
      // given the full base cooldown before anyone retries it.
      const multiplier = kind === "RATE_LIMIT" ? 1 : 2;
      cooldownMs = Math.min(
        MAX_COOLDOWN_MS,
        this.baseCooldownMs * multiplier * 2 ** (failures - this.threshold),
      );
    }

    this.state.set(provider, {
      failures,
      openUntil: open ? lastFailureAt + cooldownMs : 0,
      lastFailureAt,
    });

    return { open, cooldownMs };
  }

  /** Test and operator affordance. */
  reset(provider?: AIProviderName): void {
    if (provider) this.state.delete(provider);
    else this.state.clear();
  }

  snapshot(): Array<{
    provider: AIProviderName;
    failures: number;
    open: boolean;
    cooldownRemainingMs: number;
  }> {
    return [...this.state.entries()].map(([provider, s]) => ({
      provider,
      failures: s.failures,
      open: this.isOpen(provider),
      cooldownRemainingMs: this.cooldownRemaining(provider),
    }));
  }
}

/** Maps a provider error kind onto the breaker's vocabulary. */
export function toFailureKind(kind: string): FailureKind {
  switch (kind) {
    case "RATE_LIMIT":
      return "RATE_LIMIT";
    case "AUTH":
    case "NOT_CONFIGURED":
      return "AUTH";
    case "TIMEOUT":
    case "CIRCUIT_OPEN":
    case "OUTAGE":
      return "NETWORK";
    default:
      return "OTHER";
  }
}

/** Process-wide breaker shared by every request in this process. */
export const globalBreaker = new CircuitBreaker();

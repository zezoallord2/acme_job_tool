import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker, toFailureKind } from "@/ai/circuit-breaker";

/**
 * The breaker exists so a dead provider stops costing a full timeout on every
 * request. These tests pin the timing behaviour, because an off-by-one in a
 * cooldown is the kind of bug that only shows up in production.
 */
describe("CircuitBreaker", () => {
  let clock: number;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    clock = 1_000_000;
    breaker = new CircuitBreaker({
      threshold: 3,
      baseCooldownMs: 30_000,
      now: () => clock,
    });
  });

  it("stays closed below the threshold", () => {
    expect(breaker.isOpen("OPENAI")).toBe(false);
    breaker.recordFailure("OPENAI", "NETWORK");
    breaker.recordFailure("OPENAI", "NETWORK");
    expect(breaker.isOpen("OPENAI")).toBe(false);
  });

  it("opens once the threshold is reached", () => {
    for (let i = 0; i < 3; i++) breaker.recordFailure("OPENAI", "NETWORK");
    expect(breaker.isOpen("OPENAI")).toBe(true);
    expect(breaker.cooldownRemaining("OPENAI")).toBeGreaterThan(0);
  });

  it("closes again after the cooldown elapses", () => {
    for (let i = 0; i < 3; i++) breaker.recordFailure("OPENAI", "NETWORK");
    expect(breaker.isOpen("OPENAI")).toBe(true);

    // Derive the wait rather than assuming it: the cooldown is scaled by failure
    // kind and count, so a hardcoded duration here would rot silently.
    const remaining = breaker.cooldownRemaining("OPENAI");
    expect(remaining).toBeGreaterThan(0);

    clock += remaining;
    expect(breaker.isOpen("OPENAI")).toBe(false);
    expect(breaker.cooldownRemaining("OPENAI")).toBe(0);
  });

  it("gives an auth failure a longer cooldown than a rate limit", () => {
    // A rate limit clears on its own; a rejected key does not, so retrying it
    // sooner just wastes the user's time.
    const rateBreaker = new CircuitBreaker({
      threshold: 1,
      baseCooldownMs: 30_000,
      now: () => 0,
    });
    const authBreaker = new CircuitBreaker({
      threshold: 1,
      baseCooldownMs: 30_000,
      now: () => 0,
    });

    const rate = rateBreaker.recordFailure("OPENAI", "RATE_LIMIT");
    const auth = authBreaker.recordFailure("OPENAI", "AUTH");

    expect(rate.open).toBe(true);
    expect(auth.open).toBe(true);
    expect(auth.cooldownMs).toBeGreaterThan(rate.cooldownMs);
  });

  it("caps the cooldown so a long outage is still retried", () => {
    const capped = new CircuitBreaker({
      threshold: 1,
      baseCooldownMs: 30_000,
      now: () => 0,
    });
    for (let i = 0; i < 40; i++) capped.recordFailure("OPENAI", "OTHER");
    expect(capped.cooldownRemaining("OPENAI")).toBeLessThanOrEqual(10 * 60_000);
  });

  it("resets immediately on success, so recovery needs no waiting", () => {
    for (let i = 0; i < 5; i++) breaker.recordFailure("OPENAI", "OTHER");
    expect(breaker.isOpen("OPENAI")).toBe(true);

    breaker.recordSuccess("OPENAI");
    expect(breaker.isOpen("OPENAI")).toBe(false);
    expect(breaker.snapshot()).toHaveLength(0);
  });

  it("tracks providers independently", () => {
    // The whole point of failing over: one dead provider must not disable the
    // others.
    for (let i = 0; i < 3; i++) breaker.recordFailure("OPENAI", "AUTH");
    expect(breaker.isOpen("OPENAI")).toBe(true);
    expect(breaker.isOpen("ANTHROPIC")).toBe(false);
    expect(breaker.isOpen("GEMINI")).toBe(false);
  });

  it("reports its state for diagnostics", () => {
    breaker.recordFailure("OPENAI", "AUTH");
    breaker.recordFailure("OPENAI", "AUTH");
    breaker.recordFailure("OPENAI", "AUTH");

    const snapshot = breaker.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({
      provider: "OPENAI",
      failures: 3,
      open: true,
    });
  });
});

describe("toFailureKind", () => {
  it("maps provider error kinds onto breaker vocabulary", () => {
    expect(toFailureKind("RATE_LIMIT")).toBe("RATE_LIMIT");
    expect(toFailureKind("AUTH")).toBe("AUTH");
    expect(toFailureKind("NOT_CONFIGURED")).toBe("AUTH");
    expect(toFailureKind("TIMEOUT")).toBe("NETWORK");
    expect(toFailureKind("OUTAGE")).toBe("NETWORK");
    expect(toFailureKind("SOMETHING_NEW")).toBe("OTHER");
  });
});

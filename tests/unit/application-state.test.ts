import { describe, it, expect } from "vitest";
import {
  evaluateTransition,
  canTransition,
  allowedTransitions,
} from "@/domain/application-state";

describe("Application state machine", () => {
  it("rejects SAVED -> OFFER (the canonical invalid transition)", () => {
    const decision = evaluateTransition("SAVED", "OFFER");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("SAVED");
    expect(decision.reason).toContain("OFFER");
  });

  it("rejects a self-transition", () => {
    expect(evaluateTransition("APPLIED", "APPLIED").allowed).toBe(false);
  });

  it("allows the normal forward path", () => {
    for (const [from, to] of [
      ["SAVED", "ANALYZING"],
      ["ANALYZING", "READY_TO_APPLY"],
      ["READY_TO_APPLY", "APPLIED"],
      ["APPLIED", "SCREENING"],
      ["SCREENING", "INTERVIEW"],
      ["INTERVIEW", "FINAL_INTERVIEW"],
      ["FINAL_INTERVIEW", "OFFER"],
    ] as const) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("treats terminal states as final except for archival", () => {
    expect(canTransition("REJECTED", "INTERVIEW")).toBe(false);
    expect(canTransition("REJECTED", "ARCHIVED")).toBe(true);
    expect(canTransition("ARCHIVED", "APPLIED")).toBe(false);
  });

  it("refuses to advance past READY_TO_APPLY without a sealed snapshot", () => {
    const decision = evaluateTransition("READY_TO_APPLY", "APPLIED", {
      requiresSnapshot: true,
      hasSnapshot: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("snapshot");
  });

  it("allows APPLIED and flags that it seals a snapshot", () => {
    const decision = evaluateTransition("READY_TO_APPLY", "APPLIED", {
      requiresSnapshot: true,
      hasSnapshot: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.sealsSnapshot).toBe(true);
  });

  it("exposes only legitimate transitions per state", () => {
    expect(allowedTransitions("SAVED")).not.toContain("OFFER");
    expect(allowedTransitions("ARCHIVED")).toEqual([]);
  });
});

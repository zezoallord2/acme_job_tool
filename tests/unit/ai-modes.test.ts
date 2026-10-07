import { describe, it, expect } from "vitest";
import {
  AI_MODES,
  availableModes,
  modeDefinition,
  resolveMode,
} from "@/domain/ai-modes";

/**
 * The three modes exist to answer one question honestly: who pays. These tests
 * pin down the two places that could quietly lie to a customer — plan gating and
 * what happens when the chosen mode cannot actually run.
 */
describe("AI modes", () => {
  it("offers exactly three modes", () => {
    expect(AI_MODES.map((m) => m.id)).toEqual(["BASIC_AI", "MANUAL", "BYOK"]);
  });

  it("states who pays for every mode", () => {
    for (const mode of AI_MODES) {
      expect(mode.costOwner.length, mode.id).toBeGreaterThan(0);
      expect(mode.tagline.length, mode.id).toBeGreaterThan(0);
    }
  });

  it("never degrades a paying customer to Manual Mode silently", () => {
    // The regression that motivated this: Basic AI failed, the user received a
    // copy-paste box, and the product looked broken with no explanation.
    expect(modeDefinition("BASIC_AI").onUnavailable).toBe("SHOW_ERROR");
    expect(modeDefinition("BYOK").onUnavailable).toBe("SHOW_ERROR");
    // Manual is the one mode where falling back is the feature.
    expect(modeDefinition("MANUAL").onUnavailable).toBe("SHOW_MANUAL");
  });

  it("gates Basic AI to paid plans only", () => {
    expect(modeDefinition("BASIC_AI").availableOn).toBe("PAID");
    // BYOK costs Acme Jobs nothing, so free accounts can use it too.
    expect(modeDefinition("BYOK").availableOn).toBe("ANY");
    expect(modeDefinition("MANUAL").availableOn).toBe("ANY");
  });
});

describe("resolveMode", () => {
  it("treats an explicit Manual choice as Manual", () => {
    expect(
      resolveMode({
        storedProvider: "MANUAL",
        hasOwnKey: true,
        isComplete: true,
      }),
    ).toBe("MANUAL");
  });

  it("defaults to Basic AI when nothing is stored", () => {
    // The change that stopped every workflow opening in Manual Mode: a brand-new
    // account has no saved preference and must get AI, not a copy-paste box.
    expect(
      resolveMode({
        storedProvider: null,
        hasOwnKey: false,
        isComplete: true,
      }),
    ).toBe("BASIC_AI");
    expect(
      resolveMode({
        storedProvider: undefined,
        hasOwnKey: false,
        isComplete: false,
      }),
    ).toBe("BASIC_AI");
  });

  it("honours an explicit Basic AI choice even when a key exists", () => {
    // Regression: with no dedicated value, a customer who once added a key could
    // not get back to Acme-funded AI without deleting their key.
    expect(
      resolveMode({
        storedProvider: "ACME_BASIC",
        hasOwnKey: true,
        isComplete: true,
      }),
    ).toBe("BASIC_AI");
  });

  it("treats a named provider with a stored key as BYOK", () => {
    expect(
      resolveMode({
        storedProvider: "GEMINI",
        hasOwnKey: true,
        isComplete: true,
      }),
    ).toBe("BYOK");
  });

  it("does not strand a free account that picked BYOK before adding a key", () => {
    expect(
      resolveMode({
        storedProvider: "GEMINI",
        hasOwnKey: false,
        isComplete: false,
      }),
    ).toBe("MANUAL");
    // A paid account gets Basic AI in the same situation instead.
    expect(
      resolveMode({
        storedProvider: "GEMINI",
        hasOwnKey: false,
        isComplete: true,
      }),
    ).toBe("BASIC_AI");
  });

  it("treats the retired local provider as Manual", () => {
    expect(
      resolveMode({
        storedProvider: "RETIRED_LOCAL",
        hasOwnKey: false,
        isComplete: false,
      }),
    ).toBe("MANUAL");
  });
});

describe("availableModes", () => {
  it("hides Basic AI from free accounts but still shows Manual and BYOK", () => {
    const ids = availableModes(false).map((m) => m.id);
    expect(ids).toEqual(["MANUAL", "BYOK"]);
  });

  it("offers all three to paying accounts", () => {
    expect(availableModes(true).map((m) => m.id)).toEqual([
      "BASIC_AI",
      "MANUAL",
      "BYOK",
    ]);
  });
});

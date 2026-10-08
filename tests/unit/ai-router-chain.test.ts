import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import {
  aiAvailability,
  executeWithFallback,
  providerCandidates,
  providerLabel,
} from "@/ai/router";
import { globalBreaker } from "@/ai/circuit-breaker";

/**
 * AI is the default for every account: server Gemini -> server OpenRouter ->
 * the user's own key. Manual Mode is never returned silently as if it were AI.
 */

const REQUEST = {
  workflowId: "JOB_ANALYSIS" as const,
  promptVersion: "test",
  systemPrompt: "sys",
  userPrompt: "user",
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
}

const OK_GEMINI = {
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
};
const OK_CHAT = { choices: [{ message: { content: '{"ok":true}' } }] };

beforeEach(() => {
  globalBreaker.reset();
  setEnv({
    ACME_AI_ENABLED: "true",
    AI_MODE_PRIORITY: "gemini,openrouter",
    DEFAULT_AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "g-key",
    OPENROUTER_API_KEY: "o-key",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setEnv({
    ACME_AI_ENABLED: "false",
    AI_MODE_PRIORITY: undefined,
    DEFAULT_AI_PROVIDER: "manual",
    GEMINI_API_KEY: undefined,
    OPENROUTER_API_KEY: undefined,
  });
  globalBreaker.reset();
});

describe("AI provider chain", () => {
  it("orders server Gemini, server OpenRouter, then the user's own key", () => {
    const names = providerCandidates({
      userApiKey: { provider: "OPENAI", key: "user-key" },
    }).map((p) => `${p.name}:${p.costModel}`);
    expect(names).toEqual([
      "GEMINI:ACME_FUNDED",
      "OPENROUTER:ACME_FUNDED",
      "OPENAI:BYOK",
    ]);
  });

  it("sends the Gemini key in a header, never in the URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify(OK_GEMINI), { status: 200 });
      }),
    );
    const result = await executeWithFallback(REQUEST);
    expect(result.provider.name).toBe("GEMINI");
    expect(calls[0]!.url).not.toContain("g-key");
    expect(
      (calls[0]!.init?.headers as Record<string, string>)["x-goog-api-key"],
    ).toBe("g-key");
    expect(providerLabel(result.provider.name)).toBe("Gemini");
  });

  it("falls through to OpenRouter, then BYOK, when earlier providers fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("generativelanguage"))
          return new Response("quota", { status: 429 });
        if (u.includes("openrouter"))
          return new Response("bad key", { status: 401 });
        return new Response(JSON.stringify(OK_CHAT), { status: 200 });
      }),
    );
    const result = await executeWithFallback(REQUEST, {
      userApiKey: { provider: "OPENAI", key: "user-key" },
    });
    expect(result.provider.name).toBe("OPENAI");
    expect(result.provider.costModel).toBe("BYOK");
    expect(result.attempts.map((a) => a.provider)).toEqual([
      "GEMINI",
      "OPENROUTER",
    ]);
  });

  it("skips a provider whose circuit breaker is open", async () => {
    for (let i = 0; i < 3; i += 1)
      globalBreaker.recordFailure("GEMINI", "AUTH");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(OK_CHAT), { status: 200 })),
    );
    const result = await executeWithFallback(REQUEST);
    expect(result.provider.name).toBe("OPENROUTER");
    expect(result.attempts[0]).toMatchObject({
      provider: "GEMINI",
      kind: "CIRCUIT_OPEN",
    });
  });

  it("reports AI as unavailable with the reason when no key exists", async () => {
    setEnv({ GEMINI_API_KEY: undefined, OPENROUTER_API_KEY: undefined });
    const availability = await aiAvailability();
    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toMatch(/GEMINI/);
    }
    // The fallback result is clearly Manual, so callers can say so.
    const result = await executeWithFallback(REQUEST);
    expect(result.provider.name).toBe("MANUAL");
    expect(result.usedFallback).toBe(true);
  });
});

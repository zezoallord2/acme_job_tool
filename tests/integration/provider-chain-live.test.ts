import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resetEnvCache } from "@/lib/env";
import { executeWithFallback, resolveProvider } from "@/ai/router";
import { CircuitBreaker } from "@/ai/circuit-breaker";

/**
 * Real end-to-end check of the provider chain.
 *
 * Reads `.env` directly rather than process.env, because tests/setup.ts deletes
 * every provider credential on purpose so the rest of the suite proves the $0
 * configuration genuinely works. Weakening that to make this run would trade a
 * real guarantee for convenience.
 */
function readDotEnv(name: string): string | undefined {
  try {
    const text = readFileSync(join(process.cwd(), ".env"), "utf8");
    const m = text.match(new RegExp(`^${name}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}

const groqKey = readDotEnv("OPENAI_API_KEY");
const openrouterKey = readDotEnv("OPENROUTER_API_KEY");
const live = Boolean(groqKey);

const prompt = {
  workflowId: "resume.bullet_rewrite" as never,
  promptVersion: "test",
  systemPrompt:
    "You improve CV writing. Reply with the improved sentence only. Never invent numbers.",
  userPrompt:
    'Rewrite: "Built Power BI dashboards during an internship." Add no figures.',
  maxOutputTokens: 200,
};

describe.skipIf(!live)("provider chain, live", () => {
  beforeAll(() => {
    if (groqKey) process.env.OPENAI_API_KEY = groqKey;
    if (openrouterKey) process.env.OPENROUTER_API_KEY = openrouterKey;
    process.env.OPENAI_MODEL = readDotEnv("OPENAI_MODEL")!;
    process.env.OPENAI_BASE_URL = readDotEnv("OPENAI_BASE_URL")!;
    process.env.OPENROUTER_MODEL = readDotEnv("OPENROUTER_MODEL")!;
    process.env.ACME_AI_ENABLED = "true";
    process.env.DEFAULT_AI_PROVIDER = "openai";
    resetEnvCache();
  });

  it("produces real text from the first provider in the chain", async () => {
    const result = await executeWithFallback(prompt);
    expect(result.provider.name).not.toBe("MANUAL");
    expect(result.response.manual).toBe(false);
    expect(result.response.rawText.trim().length).toBeGreaterThan(10);
  }, 120_000);

  it("resolves to a real provider rather than Manual Mode", async () => {
    const resolution = await resolveProvider();
    expect(["OPENAI", "OPENROUTER"]).toContain(resolution.provider.name);
  }, 30_000);

  it("has more than one provider configured, so failover is possible", async () => {
    const configured = ["OPENAI_API_KEY", "OPENROUTER_API_KEY"].filter((k) =>
      readDotEnv(k),
    );
    expect(configured.length).toBeGreaterThanOrEqual(2);
  });

  it("skips a provider the breaker has opened", () => {
    // Proves the failover mechanism itself without waiting on a real outage.
    const breaker = new CircuitBreaker({ threshold: 2, now: () => 0 });
    breaker.recordFailure("OPENAI", "AUTH");
    breaker.recordFailure("OPENAI", "AUTH");
    expect(breaker.isOpen("OPENAI")).toBe(true);
    expect(breaker.isOpen("OPENROUTER")).toBe(false);
  });
});

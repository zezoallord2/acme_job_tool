import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resetEnvCache } from "@/lib/env";
import { OpenAIProvider } from "@/ai/providers/byok";
import { resolveProvider, aiAvailability } from "@/ai/router";

/**
 * Live provider smoke test.
 *
 * Opt-in, and deliberately does NOT use process.env for the key: tests/setup.ts
 * deletes every provider credential so the rest of the suite proves the $0
 * configuration genuinely works. Weakening that to make this test run would
 * trade a real guarantee for convenience, so this file reads `.env` directly and
 * skips itself when there is nothing to read.
 *
 * It exists because the provider chain has broken in ways unit tests cannot see:
 * a model name that no longer exists returns 404, and an unreachable endpoint
 * silently falls back to Manual Mode, which looks identical to "AI is just weak".
 */
function readDotEnv(name: string): string | undefined {
  try {
    const text = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = text.match(new RegExp(`^${name}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}

const key = process.env.OPENAI_API_KEY ?? readDotEnv("OPENAI_API_KEY");
const baseUrl = process.env.OPENAI_BASE_URL ?? readDotEnv("OPENAI_BASE_URL");
const model = process.env.OPENAI_MODEL ?? readDotEnv("OPENAI_MODEL");
const live = Boolean(key);

describe.skipIf(!live)("live provider (needs OPENAI_API_KEY)", () => {
  beforeAll(() => {
    // The router reads process.env through env(); point it at the same
    // credentials this file verified against.
    if (key) process.env.OPENAI_API_KEY = key;
    if (baseUrl) process.env.OPENAI_BASE_URL = baseUrl;
    if (model) process.env.OPENAI_MODEL = model;
    process.env.ACME_AI_ENABLED = "true";
    // setup.ts pins DEFAULT_AI_PROVIDER=manual so the rest of the suite proves
    // the $0 path works; without overriding it the router correctly short-
    // circuits to Manual before it ever inspects a key.
    process.env.DEFAULT_AI_PROVIDER = "openai";
    resetEnvCache();
  });

  it("returns real text, not an empty string", async () => {
    const provider = new OpenAIProvider({
      name: "OPENAI",
      model: model ?? "gpt-4o-mini",
      apiKey: key!,
      costLabel: "test",
      baseUrl,
    });

    expect(await provider.isAvailable()).toBe(true);

    const res = await provider.generate({
      workflowId: "resume.bullet_rewrite" as never,
      promptVersion: "test",
      systemPrompt:
        "You improve CV writing. Reply with the improved sentence only. Never invent numbers that were not given to you.",
      userPrompt:
        'Rewrite: "Built Power BI dashboards during an internship at a pharma company." Do not add any figures.',
    });

    expect(res.rawText.trim().length).toBeGreaterThan(10);
    expect(res.rawText.toLowerCase()).toContain("power bi");
  }, 120_000);

  it("does not silently degrade when a provider is configured", async () => {
    const status = await aiAvailability();
    // With a key present the router must resolve a real provider, not Manual.
    expect(status.available).toBe(true);
    expect(status.available && status.provider).not.toBe("MANUAL");
  }, 60_000);
});

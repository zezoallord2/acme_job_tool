import type { AIProviderName } from "@prisma/client";
import { AIProviderError, type AIProvider, type AIRequest } from "./provider";
import { ManualAIProvider } from "./providers/manual";
import {
  AnthropicProvider,
  GeminiProvider,
  OpenAIProvider,
  OpenRouterProvider,
} from "./providers/byok";
import { env } from "@/lib/env";
import { logWarn } from "@/lib/logger";
import { globalBreaker, toFailureKind } from "@/ai/circuit-breaker";

/**
 * Provider selection.
 *
 * AI is the default for every account. The chain is:
 *
 *   server Gemini (free tier) -> server OpenRouter (free model) -> user's BYOK key
 *
 * driven by AI_MODE_PRIORITY. Manual Mode is never reached silently: when the
 * chain is exhausted the caller gets an explicit failure and the UI offers
 * Manual Mode as a separate button. Every hosted attempt goes through the
 * process-wide circuit breaker so a dead provider costs one timeout, not one
 * per request.
 */

/** Human label for the provider that actually produced an output. */
export const PROVIDER_LABELS: Record<AIProviderName, string> = {
  GEMINI: "Gemini",
  OPENROUTER: "OpenRouter",
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  MANUAL: "Manual",
  ACME_BASIC: "Acme AI",
  RETIRED_LOCAL: "Manual",
};

export function providerLabel(name: AIProviderName | string): string {
  return PROVIDER_LABELS[name as AIProviderName] ?? String(name);
}

export interface ProviderResolution {
  provider: AIProvider;
  chain: AIProviderName[];
  usedFallback: boolean;
  reason: string;
}

export interface RouterDeps {
  /** User-supplied BYOK key. Never logged, never sent to the browser. */
  userApiKey?: { provider: AIProviderName; key: string } | null;
  preferManual?: boolean;
  /**
   * Refuse to degrade to Manual Mode, and throw instead.
   *
   * Set for paying accounts. A free user receiving a copy-paste prompt package is
   * getting what they signed up for; a Complete Edition user receiving one is
   * being short-changed, and a silent downgrade hides a server misconfiguration
   * that the operator needs to see.
   */
  requireRealAI?: boolean;
}

function buildByok(
  name: AIProviderName,
  key: string,
  fundedByAcme = false,
): AIProvider | null {
  const e = env();
  const label = fundedByAcme
    ? "Included by Acme Jobs — subject to plan limits"
    : "Bring Your Own Key — billed to your provider account";
  const costModel = fundedByAcme ? "ACME_FUNDED" : "BYOK";
  switch (name) {
    case "OPENAI":
      return new OpenAIProvider({
        name,
        model: e.OPENAI_MODEL,
        apiKey: key,
        costLabel: label,
        costModel,
        baseUrl: e.OPENAI_BASE_URL,
      });
    case "ANTHROPIC":
      return new AnthropicProvider({
        name,
        model: e.ANTHROPIC_MODEL,
        apiKey: key,
        costLabel: label,
        costModel,
      });
    case "GEMINI":
      return new GeminiProvider({
        name,
        model: e.GEMINI_MODEL,
        apiKey: key,
        costLabel: label,
        costModel,
      });
    case "OPENROUTER":
      return new OpenRouterProvider({
        name,
        model: e.OPENROUTER_MODEL,
        apiKey: key,
        costLabel: label,
        costModel,
      });
    default:
      return null;
  }
}

/** Server keys are usable, but only when explicitly configured. */
function serverKeyFor(name: AIProviderName): string | undefined {
  const e = env();
  switch (name) {
    case "OPENAI":
      return e.OPENAI_API_KEY;
    case "ANTHROPIC":
      return e.ANTHROPIC_API_KEY;
    case "GEMINI":
      return e.GEMINI_API_KEY;
    case "OPENROUTER":
      return e.OPENROUTER_API_KEY;
    default:
      return undefined;
  }
}

const SERVER_PROVIDERS: AIProviderName[] = [
  "GEMINI",
  "OPENROUTER",
  "OPENAI",
  "ANTHROPIC",
];

/**
 * Ordered candidates: server-held keys in AI_MODE_PRIORITY order, then the
 * user's own key. Server keys are skipped when ACME_AI_ENABLED is off.
 */
export function providerCandidates(deps: RouterDeps = {}): AIProvider[] {
  const e = env();
  const candidates: AIProvider[] = [];
  if (e.ACME_AI_ENABLED) {
    const order = e.AI_MODE_PRIORITY.map(
      (p) => p.toUpperCase() as AIProviderName,
    ).filter((p) => SERVER_PROVIDERS.includes(p));
    for (const name of order) {
      const key = serverKeyFor(name);
      if (!key) continue;
      const p = buildByok(name, key, true);
      if (p) candidates.push(p);
    }
  }
  if (deps.userApiKey?.key) {
    const byok = buildByok(deps.userApiKey.provider, deps.userApiKey.key);
    if (byok) candidates.push(byok);
  }
  return candidates;
}

export async function resolveProvider(
  deps: RouterDeps = {},
): Promise<ProviderResolution> {
  const e = env();
  const manual = new ManualAIProvider();

  if (deps.preferManual || e.DEFAULT_AI_PROVIDER === "manual") {
    return {
      provider: manual,
      chain: ["MANUAL"],
      usedFallback: false,
      reason: "Manual Mode selected.",
    };
  }

  const candidates = providerCandidates(deps);
  const usable = candidates.find((p) => !globalBreaker.isOpen(p.name));
  if (usable) {
    return {
      provider: usable,
      chain: candidates.map((p) => p.name),
      usedFallback: usable !== candidates[0],
      reason:
        usable.costModel === "BYOK"
          ? "Using your own API key."
          : "Server-configured provider.",
    };
  }

  logWarn(
    { operation: "ai.resolve" },
    "No configured AI provider available; Manual Mode is the only option",
  );
  return {
    provider: manual,
    chain: ["MANUAL"],
    usedFallback: true,
    reason: "No AI provider available — Manual Mode.",
  };
}

export type AIAvailability =
  | { available: true; provider: AIProviderName; label: string }
  | { available: false; reason: string; fix: string };

/**
 * Whether real AI can run at all, and if not, what the user should do about it.
 *
 * This exists because the failure was invisible: the router quietly degraded to
 * Manual Mode, so a broken API key looked identical to "the AI is bad". The UI
 * now has something honest to show instead.
 */
export async function aiAvailability(
  deps: RouterDeps = {},
): Promise<AIAvailability> {
  const e = env();
  const candidates = providerCandidates(deps);

  if (candidates.length === 0) {
    const missing = (["GEMINI", "OPENROUTER"] as const).filter(
      (p) => !serverKeyFor(p),
    );
    return {
      available: false,
      reason: !e.ACME_AI_ENABLED
        ? "AI assistance is switched off on this server (ACME_AI_ENABLED=false)."
        : `No AI provider key is configured on this server${
            missing.length ? ` (missing: ${missing.join(", ")})` : ""
          }.`,
      fix: "Set GEMINI_API_KEY (free at aistudio.google.com/apikey) or OPENROUTER_API_KEY on the server, or add your own key in Settings.",
    };
  }

  const resolution = await resolveProvider(deps);
  const name = resolution.provider.name;
  if (name === "MANUAL") {
    return {
      available: false,
      reason:
        "Every configured AI provider is temporarily failing (circuit breaker open).",
      fix: "Try again in a few minutes, or use Manual Mode for now.",
    };
  }
  return { available: true, provider: name, label: providerLabel(name) };
}

/**
 * Executes a request against the first provider that works, then falls back.
 * Manual Mode never "fails" — it always returns a prompt package.
 */
export interface ExecuteResult {
  response: Awaited<ReturnType<AIProvider["generate"]>>;
  provider: AIProvider;
  usedFallback: boolean;
  attempts: Array<{
    provider: AIProviderName;
    errorCode: string;
    kind: string;
  }>;
}

export async function executeWithFallback(
  request: AIRequest,
  deps: RouterDeps = {},
): Promise<ExecuteResult> {
  const attempts: ExecuteResult["attempts"] = [];
  const candidates = providerCandidates(deps);

  for (const provider of candidates) {
    // Skip a provider that has recently failed hard. Retrying it costs the user
    // a full timeout on every request and changes nothing.
    if (globalBreaker.isOpen(provider.name)) {
      attempts.push({
        provider: provider.name,
        errorCode: "CIRCUIT_OPEN",
        kind: "CIRCUIT_OPEN",
      });
      continue;
    }

    if (!(await provider.isAvailable())) {
      attempts.push({
        provider: provider.name,
        errorCode: "NOT_CONFIGURED",
        kind: "NOT_CONFIGURED",
      });
      continue;
    }
    try {
      const response = await provider.generate(request);
      globalBreaker.recordSuccess(provider.name);
      return {
        response,
        provider,
        usedFallback: candidates.indexOf(provider) > 0,
        attempts,
      };
    } catch (e2) {
      const err =
        e2 instanceof AIProviderError
          ? e2
          : new AIProviderError(
              provider.name,
              "UNKNOWN",
              e2 instanceof Error ? e2.message : "unknown",
            );
      const trip = globalBreaker.recordFailure(
        provider.name,
        toFailureKind(err.kind),
      );
      if (trip.open) {
        logWarn(
          { operation: "ai.circuit", provider: provider.name },
          `Provider ${provider.name} tripped the circuit breaker; skipping it for ${Math.round(
            trip.cooldownMs / 1000,
          )}s`,
        );
      }
      attempts.push({
        provider: provider.name,
        errorCode: err.kind,
        kind: err.kind,
      });
      // A non-retryable error on one provider (bad key, quota exhausted) says
      // nothing about the next one, so keep walking the chain. Only an oversized
      // prompt fails identically everywhere.
      if (err.kind === "CONTENT_TOO_LARGE") break;
    }
  }

  // Manual Mode is a legitimate answer for a free account and a broken promise
  // for a paying one. A Complete Edition customer who silently receives a
  // prompt-to-copy instead of the finished work would conclude the product is
  // useless, and would be right.
  if (deps.requireRealAI) {
    const tried =
      attempts.length === 0
        ? "no AI provider is configured on this server"
        : `every provider failed (${attempts
            .map((a) => `${a.provider}: ${a.kind}`)
            .join(", ")})`;
    throw new AIProviderError(
      attempts[0]?.provider ?? "GEMINI",
      "NOT_CONFIGURED",
      `AI is unavailable: ${tried}. This is a server configuration problem, not yours.`,
    );
  }

  const manual = new ManualAIProvider();
  const response = await manual.generate(request);
  return { response, provider: manual, usedFallback: true, attempts };
}

export function aiCostSummary(hasOwnKey = false): Array<{
  provider: string;
  available: boolean;
  costModel: string;
  label: string;
}> {
  const e = env();
  const server = (name: AIProviderName, key: string | undefined) => ({
    provider: `${providerLabel(name)} (server, free tier)`,
    available: Boolean(e.ACME_AI_ENABLED && key),
    costModel: "ACME_FUNDED",
    label: "Default for every account — included, subject to daily limits",
  });
  return [
    server("GEMINI", e.GEMINI_API_KEY),
    server("OPENROUTER", e.OPENROUTER_API_KEY),
    {
      provider: "Your own key (BYOK)",
      available: hasOwnKey,
      costModel: "BYOK",
      label:
        "Optional. Used only when the server AI is unavailable; billed to your provider account",
    },
    {
      provider: "Manual Mode",
      available: true,
      costModel: "FREE_MANUAL",
      label:
        "Always available as a secondary option: copy a prompt, paste the answer. Cost: $0",
    },
  ];
}

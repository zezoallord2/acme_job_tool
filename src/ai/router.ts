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
 * Provider selection. Manual Mode is always present, so a zero-cost
 * configuration can never fail to produce a usable workflow.
 *
 * Default order: hosted providers with a usable free tier -> manual. The local
 * (Ollama) provider was removed; it resolved to an endpoint that does not exist
 * on hosted machines, so accounts silently fell back to Manual Mode.
 */

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

  // 1. User's own key takes precedence when they supplied one.
  if (deps.userApiKey?.key) {
    const byok = buildByok(deps.userApiKey.provider, deps.userApiKey.key);
    if (byok) {
      return {
        provider: byok,
        chain: [deps.userApiKey.provider],
        usedFallback: false,
        reason: "Using your own API key.",
      };
    }
  }

  // 2. Configured zero-cost order.
  const validProviders: AIProviderName[] = [
    "MANUAL",
    "OPENAI",
    "ANTHROPIC",
    "GEMINI",
    "OPENROUTER",
  ];
  const order = e.AI_MODE_PRIORITY.map(
    (p) => p.toUpperCase() as AIProviderName,
  ).filter((p) => validProviders.includes(p));
  if (order.length === 0) order.push("MANUAL");

  for (const candidate of order) {
    if (candidate === "MANUAL") {
      return {
        provider: manual,
        chain: ["MANUAL"],
        usedFallback: false,
        reason: "Manual Mode.",
      };
    }
    const key = serverKeyFor(candidate);
    if (key) {
      if (!e.ACME_AI_ENABLED) continue;
      const p = buildByok(candidate, key, true);
      if (p)
        return {
          provider: p,
          chain: [candidate],
          usedFallback: false,
          reason: "Server-configured provider.",
        };
    }
  }

  logWarn(
    { operation: "ai.resolve" },
    "No configured AI provider available; using Manual Mode",
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

  if (!e.ACME_AI_ENABLED && !deps.userApiKey?.key) {
    return {
      available: false,
      reason: "AI assistance is switched off on this server.",
      fix: "Set ACME_AI_ENABLED=true, or add your own API key in Settings.",
    };
  }

  const resolution = await resolveProvider(deps);
  const name = resolution.provider.name;

  if (name === "MANUAL") {
    const missing = (["GEMINI", "OPENAI", "ANTHROPIC"] as const).filter(
      (p) => !serverKeyFor(p),
    );
    const named = missing.length
      ? ` No key configured for ${missing.join(", ")}.`
      : "";
    return {
      available: false,
      reason: `No AI provider is reachable, so everything falls back to Manual Mode.${named}`,
      fix: "Add a free Google AI Studio key in Settings (about 2 minutes, no card needed).",
    };
  }

  const labels: Record<string, string> = {
    GEMINI: "Google Gemini",
    OPENAI: "OpenAI",
    ANTHROPIC: "Anthropic",
    OPENROUTER: "OpenRouter",
    MANUAL: "Manual Mode",
  };
  return {
    available: true,
    provider: name,
    label: labels[name] ?? name,
  };
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
  const e = env();
  const attempts: ExecuteResult["attempts"] = [];

  const candidates: AIProvider[] = [];

  if (deps.userApiKey?.key) {
    const byok = buildByok(deps.userApiKey.provider, deps.userApiKey.key);
    if (byok) candidates.push(byok);
  }

  const configuredOrder = e.AI_MODE_PRIORITY.map(
    (name) => name.toUpperCase() as AIProviderName,
  );
  for (const name of configuredOrder) {
    if (name === "MANUAL") continue;
    if (!e.ACME_AI_ENABLED) continue;
    // Server-held credentials power the one-click production experience. They
    // are never eligible unless the operator explicitly accepts that cost.
    const key = serverKeyFor(name);
    if (key) {
      const p = buildByok(name, key, true);
      if (p) candidates.push(p);
    }
  }

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
      if (!err.retryable) break;
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

export function aiCostSummary(): Array<{
  provider: string;
  available: boolean;
  costModel: string;
  label: string;
}> {
  const e = env();
  return [
    {
      provider: "Manual Mode",
      available: true,
      costModel: "FREE_MANUAL",
      label: "Cost to Acme Jobs: $0",
    },
    {
      provider: "OpenAI (BYOK)",
      available: Boolean(e.OPENAI_API_KEY),
      costModel: "BYOK",
      label: "Billed to your OpenAI account",
    },
    {
      provider: "Anthropic (BYOK)",
      available: Boolean(e.ANTHROPIC_API_KEY),
      costModel: "BYOK",
      label: "Billed to your Anthropic account",
    },
    {
      provider: "Google Gemini (BYOK)",
      available: Boolean(e.GEMINI_API_KEY),
      costModel: "BYOK",
      label: "Billed to your Google account",
    },
    {
      provider: "OpenRouter (BYOK)",
      available: Boolean(e.OPENROUTER_API_KEY),
      costModel: "BYOK",
      label: "Billed to your OpenRouter account",
    },
    {
      provider: "Acme Integrated AI",
      available: Boolean(
        e.ACME_AI_ENABLED &&
        (e.OPENAI_API_KEY ||
          e.ANTHROPIC_API_KEY ||
          e.GEMINI_API_KEY ||
          e.OPENROUTER_API_KEY),
      ),
      costModel: "ACME_FUNDED",
      label: e.ACME_AI_ENABLED
        ? "Included by Acme Jobs — subject to plan limits"
        : "Disabled until the operator configures a production provider",
    },
  ];
}

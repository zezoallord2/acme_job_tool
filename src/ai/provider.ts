import type { AIProviderName } from "@prisma/client";
import type { WorkflowId } from "./workflow-ids";

/** Explicit user gesture from the shared workflow panel to try local Ollama. */
export const LOCAL_EXECUTION_REQUEST = "__ACME_RUN_LOCAL__";

/**
 * AI output is untrusted input. Every provider returns raw text plus metadata;
 * schema validation, evidence validation, consistency validation and safety
 * validation all happen in application code afterwards.
 */
export interface AIRequest {
  workflowId: WorkflowId;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  /** When true the provider must answer with JSON that matches `jsonHint`. */
  expectJson?: boolean;
  jsonHint?: string;
  maxOutputTokens?: number;
  temperature?: number;
  traceId?: string;
}

export interface AIResponse {
  rawText: string;
  provider: AIProviderName;
  model: string;
  promptVersion: string;
  durationMs: number;
  /** Manual mode returns a prompt for the user to run elsewhere. */
  manual: boolean;
  inputTokens?: number;
  outputTokens?: number;
  warnings?: string[];
}

export interface AIProvider {
  readonly name: AIProviderName;
  /** Cost responsibility, surfaced verbatim in AI settings. */
  readonly costModel: "FREE_MANUAL" | "FREE_LOCAL" | "BYOK" | "ACME_FUNDED";
  readonly costLabel: string;
  isConfigured(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  generate(request: AIRequest): Promise<AIResponse>;
  /** Optional cheap availability probe used by health checks. */
  health(): Promise<{ ok: boolean; detail: string }>;
}

export class AIProviderError extends Error {
  readonly provider: AIProviderName;
  readonly kind:
    | "TIMEOUT"
    | "RATE_LIMIT"
    | "OUTAGE"
    | "MALFORMED_JSON"
    | "INVALID_STRUCTURED_RESPONSE"
    | "CONTENT_TOO_LARGE"
    | "REFUSAL"
    | "CONTRADICTORY"
    | "NOT_CONFIGURED"
    | "CIRCUIT_OPEN"
    | "UNKNOWN";
  readonly retryable: boolean;

  constructor(
    provider: AIProviderName,
    kind: AIProviderError["kind"],
    message: string,
    retryable = true,
  ) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.kind = kind;
    this.retryable = retryable;
  }
}

export const PROVIDER_COST_INFO: Record<
  AIProviderName,
  { costModel: string; label: string }
> = {
  // `ACME_BASIC` is a mode, not a provider: it records who pays rather than how
  // the request is made. The concrete provider is chosen from server config.
  ACME_BASIC: {
    costModel: "ACME_FUNDED",
    label: "Basic AI — included in your plan, no provider bill",
  },
  MANUAL: {
    costModel: "FREE_MANUAL",
    label: "Manual Mode — cost to Acme Jobs: $0",
  },
  LOCAL: {
    costModel: "FREE_LOCAL",
    label: "Local AI — API cost: $0 (runs on your machine)",
  },
  OPENAI: {
    costModel: "BYOK",
    label: "Bring Your Own Key — billed to your provider account",
  },
  ANTHROPIC: {
    costModel: "BYOK",
    label: "Bring Your Own Key — billed to your provider account",
  },
  GEMINI: {
    costModel: "BYOK",
    label: "Bring Your Own Key — billed to your provider account",
  },
  OPENROUTER: {
    costModel: "BYOK",
    label: "Bring Your Own Key — billed to your provider account",
  },
};

/** Failure taxonomy used by retries, circuit breakers and the Debug Center. */
export function classifyProviderFailure(
  message: string,
  status?: number,
): AIProviderError["kind"] {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("429"))
    return "RATE_LIMIT";
  if (status === 402 || status === 403 || m.includes("insufficient_quota"))
    return "NOT_CONFIGURED";
  if (
    m.includes("abort") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("etimedout")
  )
    return "TIMEOUT";
  if (
    m.includes("503") ||
    m.includes("502") ||
    m.includes("overloaded") ||
    m.includes("service unavailable")
  )
    return "OUTAGE";
  if (m.includes("json") || m.includes("unexpected token"))
    return "MALFORMED_JSON";
  if (m.includes("refus")) return "REFUSAL";
  if (
    m.includes("context length") ||
    m.includes("too long") ||
    m.includes("maximum context")
  )
    return "CONTENT_TOO_LARGE";
  return "UNKNOWN";
}

import { env } from "@/lib/env";
import {
  AIProviderError,
  classifyProviderFailure,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "../provider";
import type { AIProviderName } from "@prisma/client";

/**
 * Bring-Your-Own-Key providers.
 *
 * Keys are supplied by the user (BYOK). Acme Jobs never pays for these calls and
 * never sends a server-side key to the browser. Each adapter is a thin HTTP call
 * so the rest of the application never learns a provider's wire format.
 */

export interface ByokOptions {
  name: AIProviderName;
  model: string;
  apiKey: string;
  timeoutMs?: number;
  costLabel: string;
  costModel?: "BYOK" | "ACME_FUNDED";
  /** OpenAI-compatible host override, for Groq, Together, LM Studio and such. */
  baseUrl?: string;
}

const DEFAULT_TIMEOUT = 90_000;

/**
 * Hard ceiling on a single prompt, in characters (~500k tokens of slack, far
 * above any real workflow). A CV plus a job description plus an evidence ledger
 * is a few tens of thousands; anything past this is a bug, and sending it would
 * be both expensive and a privacy problem.
 */
const MAX_PROMPT_CHARS = 400_000;

async function callJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: AIProviderName,
): Promise<{ body: unknown; durationMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new AIProviderError(
        provider,
        classifyProviderFailure(text, res.status),
        `${provider} returned http ${res.status}`,
      );
    }
    try {
      return { body: JSON.parse(text), durationMs: Date.now() - started };
    } catch {
      throw new AIProviderError(
        provider,
        "MALFORMED_JSON",
        `${provider} returned a non-JSON response.`,
      );
    }
  } catch (e) {
    if (e instanceof AIProviderError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new AIProviderError(provider, "TIMEOUT", `${provider} timed out.`);
    }
    throw new AIProviderError(
      provider,
      classifyProviderFailure(e instanceof Error ? e.message : "unknown"),
      e instanceof Error ? e.message : `${provider} request failed`,
    );
  } finally {
    clearTimeout(timer);
  }
}

abstract class BaseByokProvider implements AIProvider {
  abstract readonly name: AIProviderName;
  readonly costModel: "BYOK" | "ACME_FUNDED";
  readonly costLabel: string;
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly timeoutMs: number;

  constructor(opts: ByokOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    this.costLabel = opts.costLabel;
    this.costModel = opts.costModel ?? "BYOK";
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.apiKey && this.model);
  }

  async isAvailable(): Promise<boolean> {
    return this.isConfigured();
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    if (!(await this.isConfigured()))
      return { ok: false, detail: "no key supplied" };
    return { ok: true, detail: "key present (not probed — avoid paid call)" };
  }

  protected abstract call(
    request: AIRequest,
  ): Promise<{ body: unknown; durationMs: number }>;

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!(await this.isConfigured())) {
      throw new AIProviderError(
        this.name,
        "NOT_CONFIGURED",
        `${this.name} has no API key.`,
        false,
      );
    }

    // Refuse an oversized prompt before it leaves the process.
    //
    // This guard used to live on LocalAIProvider alone, so removing the local
    // provider also removed the only size limit in the codebase. A runaway prompt
    // would otherwise ship a user's entire career history to a third party and
    // bill them for it. Enforced here because every hosted provider inherits it.
    const promptChars = request.systemPrompt.length + request.userPrompt.length;
    if (promptChars > MAX_PROMPT_CHARS) {
      throw new AIProviderError(
        this.name,
        "CONTENT_TOO_LARGE",
        `Prompt is ${promptChars} characters; the limit is ${MAX_PROMPT_CHARS}. Nothing was sent.`,
        false,
      );
    }

    const { body, durationMs } = await this.call(request);
    const rawText = this.extractText(body);
    if (!rawText) {
      throw new AIProviderError(
        this.name,
        "MALFORMED_JSON",
        `${this.name} returned no text content.`,
      );
    }
    return {
      rawText,
      provider: this.name,
      model: this.model,
      promptVersion: request.promptVersion,
      durationMs,
      manual: false,
    };
  }

  protected abstract extractText(body: unknown): string;
}

export class OpenAIProvider extends BaseByokProvider {
  readonly name: AIProviderName = "OPENAI";

  /**
   * Most OpenAI-compatible endpoints speak the same wire format at a different
   * URL: Groq, Together, Fireworks, LM Studio, vLLM, and the Ollama bridge all
   * do. Hardcoding api.openai.com meant only OpenAI itself could ever be used,
   * even though Groq's free tier is one of the few that is genuinely usable.
   */
  private readonly baseUrl: string;

  constructor(opts: ByokOptions) {
    super(opts);
    this.baseUrl = (opts.baseUrl ?? env().OPENAI_BASE_URL ?? "").replace(
      /\/+$/,
      "",
    );
  }

  protected async call(request: AIRequest) {
    const endpoint = this.baseUrl
      ? `${this.baseUrl}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
    return callJson(
      endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxOutputTokens ?? 2048,
          ...(request.expectJson
            ? { response_format: { type: "json_object" } }
            : {}),
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      },
      this.timeoutMs,
      this.name,
    );
  }

  protected extractText(body: unknown): string {
    const b = body as { choices?: Array<{ message?: { content?: string } }> };
    return b.choices?.[0]?.message?.content ?? "";
  }
}

export class AnthropicProvider extends BaseByokProvider {
  readonly name: AIProviderName = "ANTHROPIC";

  protected async call(request: AIRequest) {
    return callJson(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxOutputTokens ?? 4096,
          temperature: request.temperature ?? 0.3,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.userPrompt }],
        }),
      },
      this.timeoutMs,
      this.name,
    );
  }

  protected extractText(body: unknown): string {
    const b = body as { content?: Array<{ type?: string; text?: string }> };
    return (b.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  }
}

export class GeminiProvider extends BaseByokProvider {
  readonly name: AIProviderName = "GEMINI";

  protected async call(request: AIRequest) {
    return callJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
          generationConfig: {
            temperature: request.temperature ?? 0.3,
            responseMimeType: request.expectJson
              ? "application/json"
              : undefined,
          },
        }),
      },
      this.timeoutMs,
      this.name,
    );
  }

  protected extractText(body: unknown): string {
    const b = body as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (b.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
  }
}

export class OpenRouterProvider extends BaseByokProvider {
  readonly name: AIProviderName = "OPENROUTER";

  protected async call(request: AIRequest) {
    return callJson(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          // OpenRouter uses these for attribution, so they follow APP_URL
          // rather than being hard-coded to a port.
          "HTTP-Referer": env().APP_URL,
          "X-Title": "Acme Jobs",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: request.temperature ?? 0.3,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      },
      this.timeoutMs,
      this.name,
    );
  }

  protected extractText(body: unknown): string {
    const b = body as { choices?: Array<{ message?: { content?: string } }> };
    return b.choices?.[0]?.message?.content ?? "";
  }
}

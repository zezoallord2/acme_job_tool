import {
  AIProviderError,
  classifyProviderFailure,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "../provider";
import type { AIProviderName } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Local AI — optional, free, no API key, no cloud account.
 *
 * Targets Ollama (`/api/chat`) and any llama.cpp-compatible HTTP endpoint.
 * Acme Jobs never requires it: if it is unreachable, Manual Mode is used.
 */

export interface LocalAIOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxContext?: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class LocalAIProvider implements AIProvider {
  readonly name: AIProviderName;
  readonly costModel = "FREE_LOCAL" as const;
  readonly costLabel = "Local AI — API cost: $0 (runs on your machine)";

  private readonly baseUrl: string | undefined;
  private readonly model: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxContext: number;
  private readonly allowRemote: boolean;
  private readonly maxResponseBytes: number;
  private readonly apiKey: string | undefined;

  constructor(opts: LocalAIOptions = {}) {
    const e = env();
    this.name = "LOCAL";
    this.baseUrl = opts.baseUrl ?? e.LOCAL_AI_BASE_URL ?? undefined;
    this.model = opts.model ?? e.LOCAL_AI_MODEL ?? undefined;
    this.timeoutMs = opts.timeoutMs ?? e.LOCAL_AI_TIMEOUT_MS;
    this.maxContext = opts.maxContext ?? e.LOCAL_AI_MAX_CONTEXT;
    this.allowRemote = e.LOCAL_AI_ALLOW_REMOTE;
    this.maxResponseBytes = e.LOCAL_AI_MAX_RESPONSE_BYTES;
    this.apiKey = e.LOCAL_AI_API_KEY;
  }

  private endpointPolicy(): { ok: boolean; detail: string } {
    if (!this.baseUrl) return { ok: false, detail: "not configured" };
    try {
      const url = new URL(this.baseUrl);
      const localHosts = new Set([
        "localhost",
        "127.0.0.1",
        "[::1]",
        "::1",
        "host.docker.internal",
      ]);
      if (!this.allowRemote && !localHosts.has(url.hostname)) {
        return {
          ok: false,
          detail:
            "remote local-AI endpoints are blocked; use loopback or explicitly set LOCAL_AI_ALLOW_REMOTE=true",
        };
      }
      if (
        this.allowRemote &&
        !localHosts.has(url.hostname) &&
        url.protocol !== "https:"
      ) {
        return {
          ok: false,
          detail: "remote local-AI endpoints must use HTTPS",
        };
      }
      if (this.allowRemote && !localHosts.has(url.hostname) && !this.apiKey) {
        return {
          ok: false,
          detail: "remote local-AI endpoints require LOCAL_AI_API_KEY",
        };
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, detail: "endpoint must use HTTP or HTTPS" };
      }
      return { ok: true, detail: "endpoint allowed" };
    } catch {
      return { ok: false, detail: "invalid endpoint URL" };
    }
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.baseUrl && this.model && this.endpointPolicy().ok);
  }

  /** Probes the endpoint; a false result must simply route to Manual Mode. */
  async isAvailable(): Promise<boolean> {
    if (!(await this.isConfigured())) return false;
    const health = await this.health();
    return health.ok;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    const endpoint = this.endpointPolicy();
    if (!endpoint.ok) return endpoint;
    if (!this.model) return { ok: false, detail: "no model selected" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`${this.baseUrl!.replace(/\/$/, "")}/api/tags`, {
        signal: controller.signal,
        headers: this.apiKey
          ? { authorization: `Bearer ${this.apiKey}` }
          : undefined,
      });
      if (!res.ok) return { ok: false, detail: `http ${res.status}` };
      const body = (await res.json()) as { models?: Array<{ name?: string }> };
      const names = (body.models ?? [])
        .map((m) => m.name ?? "")
        .filter(Boolean);
      const matched =
        names.some((n) => n === this.model) ||
        names.some((n) => n.startsWith(`${this.model}:`)) ||
        names.some((n) => n.startsWith(this.model!));
      return matched
        ? { ok: true, detail: `${this.model} available` }
        : {
            ok: false,
            detail: `model "${this.model}" not installed (found: ${names.slice(0, 5).join(", ") || "none"})`,
          };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.name : "unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    if (!(await this.isConfigured())) {
      throw new AIProviderError(
        "LOCAL",
        "NOT_CONFIGURED",
        "Local AI is not configured.",
        false,
      );
    }
    const promptChars = request.systemPrompt.length + request.userPrompt.length;
    const promptCharLimit = this.maxContext * 4;
    if (promptChars > promptCharLimit) {
      throw new AIProviderError(
        "LOCAL",
        "CONTENT_TOO_LARGE",
        `Local AI input is too large (${promptChars} characters; limit ${promptCharLimit}). Shorten the source text and try again.`,
        false,
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl!.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: request.expectJson ? "json" : undefined,
          options: {
            num_ctx: this.maxContext,
            temperature: request.temperature ?? 0.3,
          },
          keep_alive: "2m",
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AIProviderError(
          "LOCAL",
          classifyProviderFailure(text, res.status),
          `Local AI returned http ${res.status}`,
        );
      }
      const declaredLength = Number(res.headers.get("content-length") ?? 0);
      if (declaredLength > this.maxResponseBytes) {
        throw new AIProviderError(
          "LOCAL",
          "CONTENT_TOO_LARGE",
          "Local AI response exceeded the safe size limit.",
          false,
        );
      }
      const responseText = await res.text();
      if (
        new TextEncoder().encode(responseText).byteLength >
        this.maxResponseBytes
      ) {
        throw new AIProviderError(
          "LOCAL",
          "CONTENT_TOO_LARGE",
          "Local AI response exceeded the safe size limit.",
          false,
        );
      }
      let body: OllamaChatResponse;
      try {
        body = JSON.parse(responseText) as OllamaChatResponse;
      } catch {
        throw new AIProviderError(
          "LOCAL",
          "MALFORMED_JSON",
          "Local AI returned an invalid transport response.",
          false,
        );
      }
      if (body.error) {
        throw new AIProviderError(
          "LOCAL",
          classifyProviderFailure(body.error),
          body.error,
        );
      }
      const rawText = body.message?.content ?? "";
      if (!rawText.trim()) {
        throw new AIProviderError(
          "LOCAL",
          "MALFORMED_JSON",
          "Local AI returned an empty response.",
        );
      }
      return {
        rawText,
        provider: "LOCAL",
        model: this.model!,
        promptVersion: request.promptVersion,
        durationMs: Date.now() - started,
        manual: false,
        inputTokens: body.prompt_eval_count,
        outputTokens: body.eval_count,
      };
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new AIProviderError(
          "LOCAL",
          "TIMEOUT",
          `Local AI timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw new AIProviderError(
        "LOCAL",
        classifyProviderFailure(e instanceof Error ? e.message : "unknown"),
        e instanceof Error ? e.message : "Local AI request failed",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

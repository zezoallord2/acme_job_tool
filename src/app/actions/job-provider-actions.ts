"use server";

import { requireAdmin, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { defaultProviders } from "@/jobs/sources/registry";
import { redact } from "@/jobs/sources/common";

/**
 * Admin-only: run ONE live query against one provider and report exactly what
 * happened, including the raw error. Keys are redacted from messages. Note this
 * spends a real credit on keyed providers (SerpAPI, JSearch, Jooble).
 */
export interface ProviderTestResult {
  ok: boolean;
  provider: string;
  count: number;
  ms: number;
  sample: Array<{
    title: string;
    company: string;
    location: string;
    url: string;
  }>;
  error: string | null;
}

export async function testJobProviderAction(
  providerId: string,
  title = "Software Engineer",
): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    await requireSameOrigin();
    const admin = await requireAdmin();
    await enforceRateLimit("write", { userId: admin.id });
    const provider = defaultProviders().find((p) => p.id === providerId);
    if (!provider) {
      return {
        ok: false,
        provider: providerId,
        count: 0,
        ms: 0,
        sample: [],
        error: "Unknown provider id (or excluded by JOB_SEARCH_PROVIDERS).",
      };
    }
    const reason = provider.unavailableReason?.() ?? null;
    if (reason) {
      return {
        ok: false,
        provider: providerId,
        count: 0,
        ms: 0,
        sample: [],
        error: reason,
      };
    }
    const rows = await provider.search({
      title: title.slice(0, 80) || "Software Engineer",
      workArrangement: "REMOTE",
    });
    return {
      ok: true,
      provider: providerId,
      count: rows.length,
      ms: Date.now() - started,
      sample: rows.slice(0, 3).map((r) => ({
        title: r.title,
        company: r.company,
        location: r.location,
        url: r.sourceUrl,
      })),
      error: null,
    };
  } catch (e) {
    const raw =
      e instanceof Error
        ? `${e.name}: ${e.message}`
        : userFacingMessage(asAppError(e));
    return {
      ok: false,
      provider: providerId,
      count: 0,
      ms: Date.now() - started,
      sample: [],
      error: redact(raw),
    };
  }
}

import { env } from "@/lib/env";
import { consumeQuota, MONTH_MS } from "@/lib/usage-caps";
import { logWarn } from "@/lib/logger";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { providerLabel } from "@/ai/router";
import type { JobRerankOutput, JobSearchPlanOutput } from "@/ai/schemas";
import type {
  DiscoveredJob,
  JobSearchProvider,
  JobSearchQuery,
} from "@/jobs/providers";
import { defaultProviders } from "@/jobs/sources/registry";
import {
  ATS_COMPANIES,
  AtsBoardsProvider,
  companiesBySlug,
  pickCompanies,
} from "@/jobs/sources/ats";
import { redact } from "@/jobs/sources/common";
import {
  generateQueries,
  workModeLabel,
  type JobSearchProfile,
} from "@/jobs/search-profile";
import type { LocationPreference } from "@/jobs/location";

/**
 * The job search agent.
 *
 *   a) plan: the LLM turns the profile into 4-8 diverse title queries and picks
 *      company boards for the target industry (deterministic fallback when AI
 *      is unavailable — the search still runs, and says how it was planned);
 *   b) fan out: every provider × its share of the queries, in parallel, each
 *      isolated with a timeout and retry; per-provider health is recorded and
 *      returned, never swallowed; paid-credit providers sit behind quotas;
 *   c) (caller) dedupe → location filter → deterministic score, then
 *   d) rerank: the LLM re-orders the top ~60 against the profile and writes a
 *      one-line "why this fits" for each.
 */

export type HealthStatus = "ok" | "empty" | "error" | "skipped" | "quota";

export interface ProviderHealth {
  id: string;
  label: string;
  status: HealthStatus;
  count: number;
  message?: string;
  ms: number;
  signupUrl?: string;
}

export interface PlannedQuery {
  title: string;
  reason: string;
}

export interface SearchPlan {
  queries: PlannedQuery[];
  companies: string[];
  plannedBy: string;
}

/** How many of the planned queries each provider receives. */
const QUERY_BUDGET: Record<string, number> = {
  "google-jobs": 2,
  jsearch: 2,
  jooble: 2,
  usajobs: 2,
  adzuna: 3,
  himalayas: 4,
  jobicy: 4,
};

/** Monthly credit guards: [env limit key, per-user env key]. */
interface QuotaRule {
  global: number;
  perUser: number;
  /** Credits one query consumes (SerpAPI bills per page). */
  cost: number;
}

function quotaRule(providerId: string): QuotaRule | null {
  const e = env();
  switch (providerId) {
    case "google-jobs":
      return {
        global: e.SERPAPI_MONTHLY_GLOBAL,
        perUser: e.SERPAPI_MONTHLY_PER_USER,
        cost: e.SERPAPI_PAGES,
      };
    case "jsearch":
      return {
        global: e.JSEARCH_MONTHLY_GLOBAL,
        perUser: e.JSEARCH_MONTHLY_PER_USER,
        cost: 1,
      };
    case "jooble":
      return { global: e.JOOBLE_MONTHLY_GLOBAL, perUser: 1_000, cost: 1 };
    default:
      return null;
  }
}

async function withinQuota(
  providerId: string,
  userId: string | null,
): Promise<boolean> {
  const rule = quotaRule(providerId);
  if (!rule) return true;
  for (let i = 0; i < rule.cost; i += 1) {
    if (!(await consumeQuota(`${providerId}:global`, rule.global, MONTH_MS))) {
      return false;
    }
  }
  if (userId) {
    return consumeQuota(
      `${providerId}:u:${userId}`,
      rule.perUser,
      MONTH_MS,
      userId,
    );
  }
  return true;
}

function timeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(`${label} timed out after ${Math.round(ms / 1000)}s`),
          ),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// a) Plan
// ---------------------------------------------------------------------------

export function profileSummary(profile: JobSearchProfile): string {
  return [
    `Target roles: ${profile.primaryTargetRoles.join(", ") || "(not set)"}`,
    `Adjacent roles the experience supports: ${profile.adjacentRoles.join(", ") || "(none)"}`,
    `Seniority: ${profile.seniority ?? "unknown"}; years of experience: ${profile.yearsExperience ?? "unknown"}`,
    `Skills: ${profile.hardSkills.join(", ") || "(none)"}`,
    `Tools: ${profile.tools.join(", ") || "(none)"}`,
    `Industries: ${profile.industries.join(", ") || "(not set)"}`,
    `Education: ${profile.education.join("; ") || "(none)"}`,
    `Certifications: ${profile.certifications.join(", ") || "(none)"}`,
    `Languages: ${profile.languages.join(", ") || "(none)"}`,
    `Location: ${[profile.targetCity, profile.targetCountry].filter(Boolean).join(", ") || "(not set)"}; work style: ${workModeLabel(profile.workMode)}`,
  ].join("\n");
}

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

export function deterministicPlan(
  profile: JobSearchProfile,
  seed?: string | null,
): SearchPlan {
  const queries: PlannedQuery[] = [];
  const seen = new Set<string>();
  const push = (title: string, reason: string) => {
    const key = normTitle(title);
    if (!key || seen.has(key) || queries.length >= 8) return;
    seen.add(key);
    queries.push({ title: title.trim(), reason });
  };
  if (seed) push(seed, "Your search");
  for (const q of generateQueries(profile, 8)) push(q.title, q.reason);
  return {
    queries,
    companies: pickCompanies(profile.industries).map((c) => c.slug),
    plannedBy: "rules",
  };
}

export async function planSearch(input: {
  userId: string;
  profile: JobSearchProfile;
  seed?: string | null;
  useAI: boolean;
}): Promise<SearchPlan> {
  const fallback = deterministicPlan(input.profile, input.seed);
  if (!input.useAI) return fallback;

  const outcome = await runWorkflow<JobSearchPlanOutput>({
    userId: input.userId,
    workflowId: "JOB_SEARCH_PLAN",
    context: {
      profile: profileSummary(input.profile),
      seed: input.seed ?? "",
      companies: ATS_COMPANIES.map(
        (c) => `${c.slug}: ${c.name} [${c.industries.join(", ")}]`,
      ),
    },
    userApiKey: await getUserApiKeyForWorkflow(input.userId),
    preferManual: false,
  });
  if (!outcome.ok) {
    logWarn(
      { operation: "jobs.plan" },
      `AI query planning unavailable (${outcome.code}); using rule-based queries`,
    );
    return {
      ...fallback,
      plannedBy: `rules (AI unavailable: ${outcome.code})`,
    };
  }

  const queries: PlannedQuery[] = [];
  const seen = new Set<string>();
  const push = (q: PlannedQuery) => {
    const key = normTitle(q.title);
    if (!key || seen.has(key) || queries.length >= 8) return;
    seen.add(key);
    queries.push(q);
  };
  if (input.seed) push({ title: input.seed, reason: "Your search" });
  outcome.data.queries.forEach((q) =>
    push({ title: q.title.replace(/["']/g, ""), reason: q.reason }),
  );
  // Never fewer than 4 when the profile can supply more.
  fallback.queries.forEach((q) => queries.length < 4 && push(q));

  const companies = companiesBySlug(outcome.data.companies).map((c) => c.slug);
  return {
    queries,
    companies: companies.length >= 4 ? companies : fallback.companies,
    plannedBy: providerLabel(outcome.provider),
  };
}

// ---------------------------------------------------------------------------
// b) Fan out
// ---------------------------------------------------------------------------

export interface FanOutInput {
  plan: SearchPlan;
  preference: LocationPreference;
  workArrangement: JobSearchQuery["workArrangement"];
  location?: string;
  userId: string | null;
  providers?: JobSearchProvider[];
  /** Overall per-provider budget in ms. */
  timeoutMs?: number;
}

export async function fanOut(
  input: FanOutInput,
): Promise<{ jobs: DiscoveredJob[]; health: ProviderHealth[] }> {
  const providers = input.providers ?? defaultProviders();
  const companies = companiesBySlug(input.plan.companies);
  const baseTimeout = input.timeoutMs ?? env().JOB_PROVIDER_TIMEOUT_MS;

  const tasks = providers.map(
    async (
      provider,
    ): Promise<{
      jobs: DiscoveredJob[];
      health: ProviderHealth;
    }> => {
      const started = Date.now();
      const label = provider.meta?.label ?? provider.id;
      const base = {
        id: provider.id,
        label,
        signupUrl: provider.meta?.signupUrl,
      };
      const reason = provider.unavailableReason?.() ?? null;
      if (reason) {
        return {
          jobs: [],
          health: {
            ...base,
            status: "skipped",
            count: 0,
            message: reason,
            ms: 0,
          },
        };
      }
      if (provider instanceof AtsBoardsProvider)
        provider.useCompanies(companies);

      const budget = QUERY_BUDGET[provider.id] ?? input.plan.queries.length;
      const queries = input.plan.queries.slice(0, budget);
      const jobs: DiscoveredJob[] = [];
      const errors: string[] = [];
      let quotaHit = false;
      // Company boards download whole boards once (cached), so give them longer.
      const limit =
        provider.meta?.kind === "company-boards"
          ? baseTimeout * 3
          : baseTimeout;

      await Promise.all(
        queries.map(async (q) => {
          if (!(await withinQuota(provider.id, input.userId))) {
            quotaHit = true;
            return;
          }
          try {
            const rows = await timeout(
              provider.search({
                title: q.title,
                location: input.location,
                countryCode:
                  input.preference.countryCode?.toLowerCase() ?? undefined,
                workArrangement: input.workArrangement,
              }),
              limit,
              label,
            );
            jobs.push(...rows);
          } catch (e) {
            errors.push(redact(e instanceof Error ? e.message : String(e)));
          }
        }),
      );

      const ms = Date.now() - started;
      const unique = new Map(
        jobs.map((j) => [`${j.provider}:${j.externalId}`, j]),
      );
      const count = unique.size;
      let status: HealthStatus;
      let message: string | undefined;
      if (count > 0) {
        status = "ok";
        if (errors.length) message = `partial: ${errors[0]}`;
      } else if (errors.length) {
        status = "error";
        message = errors[0];
      } else if (quotaHit) {
        status = "quota";
        message = "monthly free quota reached";
      } else {
        status = "empty";
      }
      return {
        jobs: [...unique.values()],
        health: { ...base, status, count, message, ms },
      };
    },
  );

  const settled = await Promise.all(tasks);
  return {
    jobs: settled.flatMap((s) => s.jobs),
    health: settled.map((s) => s.health),
  };
}

// ---------------------------------------------------------------------------
// d) Rerank
// ---------------------------------------------------------------------------

export interface RerankEntry {
  fit: number;
  why: string;
}

export async function rerankWithAI(input: {
  userId: string;
  profile: JobSearchProfile;
  jobs: DiscoveredJob[];
}): Promise<{ byIndex: Map<number, RerankEntry>; rankedBy: string | null }> {
  if (input.jobs.length === 0) return { byIndex: new Map(), rankedBy: null };
  const listings = input.jobs.map(
    (j, i) =>
      `${i}. ${j.title} — ${j.company} — ${j.location} — ${j.description
        .slice(0, 280)
        .replace(/\s+/g, " ")}`,
  );
  const outcome = await runWorkflow<JobRerankOutput>({
    userId: input.userId,
    workflowId: "JOB_RERANK",
    context: { profile: profileSummary(input.profile), listings },
    userApiKey: await getUserApiKeyForWorkflow(input.userId),
    preferManual: false,
  });
  if (!outcome.ok) {
    logWarn(
      { operation: "jobs.rerank" },
      `AI re-ranking unavailable (${outcome.code}); keeping rule-based order`,
    );
    return { byIndex: new Map(), rankedBy: null };
  }
  const byIndex = new Map<number, RerankEntry>();
  for (const row of outcome.data.ranked) {
    if (row.i < 0 || row.i >= input.jobs.length || byIndex.has(row.i)) continue;
    byIndex.set(row.i, {
      fit: Math.round(row.fit),
      why: row.why.replace(/\s+/g, " ").trim().slice(0, 200),
    });
  }
  return { byIndex, rankedBy: providerLabel(outcome.provider) };
}

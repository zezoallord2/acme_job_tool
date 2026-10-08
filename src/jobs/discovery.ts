import { createHash } from "node:crypto";
import { getEntitlementState } from "@/services/entitlement-service";
import { enforceDailyCap } from "@/lib/usage-caps";
import {
  fanOut,
  planSearch,
  rerankWithAI,
  type ProviderHealth,
  type RerankEntry,
  type SearchPlan,
} from "./agent";
import {
  matchJobLocation,
  normalizeJobLocation,
  normalizeTargetLocation,
  type LocationMatch,
  type LocationPreference,
  type NormalizedLocation,
  type WorkMode,
} from "./location";
import { scoreJobAgainstProfile, type ProfileFit } from "./matching";
import type { DiscoveredJob, JobSearchProvider } from "./providers";
import {
  buildJobSearchProfile,
  loadProfileRows,
  type GeneratedQuery,
  type JobSearchProfile,
} from "./search-profile";

/**
 * Jobs for You: the one automatic search path, driven by the search agent
 * (src/jobs/agent.ts).
 *
 *   plan queries (AI, rule fallback) → fan out to every provider (health per
 *   provider) → deduplicate → location filter (soft default, one-click widen)
 *   → deterministic score → AI re-rank of the top ~60 with "why this fits".
 *
 * Results are not hidden behind a plan: everything that survives the filters is
 * returned and the UI pages through it. Cost is controlled by caching the raw
 * fan-out for 30 minutes and capping fresh searches per day.
 */

export interface RankedJob {
  job: DiscoveredJob;
  location: NormalizedLocation;
  locationMatch: LocationMatch;
  fit: ProfileFit;
  /** Which profile-derived query produced this row (diagnostics). */
  query: string;
  /** One-line AI explanation of the fit, when the re-ranker ran. */
  why?: string;
  /** AI ordering signal (0-100). Never shown as a probability. */
  aiFit?: number;
}

export interface JobsForYouResult {
  profile: JobSearchProfile;
  preference: LocationPreference;
  queries: GeneratedQuery[];
  /** Every row that survived the filters, best first. */
  results: RankedJob[];
  totalMatched: number;
  rejectedByLocation: number;
  unclearLocation: number;
  /** Per-provider status, shown in the UI ("Adzuna ✓ 18, Jooble ✗ key missing"). */
  health: ProviderHealth[];
  /** Kept for older callers: the failing providers only. */
  providerErrors: Array<{ provider: string; message: string }>;
  fromCache: boolean;
  generatedAt: string;
  /** "Gemini" when the AI planned the queries, "rules" otherwise. */
  plannedBy: string;
  /** Provider label when AI re-ranked the results, else null. */
  rankedBy: string | null;
  /** Set when today's fresh-search cap was reached and older results are shown. */
  notice: string | null;
}

export interface JobsForYouOptions {
  userId: string;
  /** Ignore the cache and run a fresh search (counts toward the daily cap). */
  refresh?: boolean;
  /**
   * Strict location mode, default ON: only jobs whose location is confirmed to
   * satisfy the preference are shown. Turning it off also surfaces jobs whose
   * location could not be verified, clearly labelled.
   */
  strictLocation?: boolean;
  /** "city" (default), "country" (whole target country) or "any" (no place). */
  area?: "city" | "country" | "any";
  /** Work style override, used by the widen controls. */
  workMode?: WorkMode;
  /** User-typed search; the agent still expands it into variants. */
  manual?: { title: string; location?: string; workMode?: WorkMode };
  /** Return only cached results (dashboard); null when nothing is cached. */
  cacheOnly?: boolean;
  /** Turn the AI planner and re-ranker off (tests, cost-sensitive callers). */
  useAI?: boolean;
  /** Provider override (tests). */
  providers?: JobSearchProvider[];
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 128;
const RERANK_TOP = 60;

interface RawEntry {
  plan: SearchPlan;
  merged: DiscoveredJob[];
  health: ProviderHealth[];
  fetchedAt: number;
  /** AI re-rank results, keyed by job identity, reused across filter changes. */
  reranked: Map<string, RerankEntry>;
  rankedBy: string | null;
}

const resultCache = new Map<string, { expiresAt: number; value: RawEntry }>();
/** Last raw result per user, kept past expiry to serve when the cap is hit. */
const lastByUser = new Map<string, RawEntry>();

function fingerprint(parts: unknown): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

function jobKey(job: DiscoveredJob): string {
  return `${job.provider}:${job.externalId}`;
}

/** Deduplicate across queries and sources: URL first, then company/title/place. */
export function deduplicate(jobs: DiscoveredJob[]): DiscoveredJob[] {
  const byUrl = new Map<string, DiscoveredJob>();
  const byShape = new Map<string, DiscoveredJob>();
  const out: DiscoveredJob[] = [];
  for (const job of jobs) {
    const url = job.sourceUrl
      .trim()
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
    const shape = [job.company, job.title, job.location]
      .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
      .join("|");
    if (url && byUrl.has(url)) continue;
    if (byShape.has(shape)) continue;
    if (url) byUrl.set(url, job);
    byShape.set(shape, job);
    out.push(job);
  }
  return out;
}

export function buildPreference(
  profile: JobSearchProfile,
  options: {
    area?: "city" | "country" | "any";
    workMode?: WorkMode;
    manual?: { title: string; location?: string; workMode?: WorkMode };
  },
): LocationPreference {
  const manualLocation = options.manual?.location?.trim();
  const base = normalizeTargetLocation(
    manualLocation ||
      [profile.targetCity, profile.targetCountry].filter(Boolean).join(", ") ||
      null,
  );
  const area = options.area ?? "city";
  const workMode =
    options.workMode ?? options.manual?.workMode ?? profile.workMode;
  if (area === "any") {
    // "Anywhere" widens both place and work style: every real listing passes.
    return {
      city: null,
      region: null,
      country: null,
      countryCode: null,
      workMode: "ANY",
    };
  }
  return {
    city: area === "country" ? null : base.city,
    region: base.region,
    country: base.country,
    countryCode: base.countryCode,
    workMode,
  };
}

function cacheGet(key: string): RawEntry | null {
  const hit = resultCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: RawEntry): void {
  if (resultCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
  resultCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

/** Clears the in-process Jobs for You cache (tests / manual refresh). */
export function clearDiscoveryCache(): void {
  resultCache.clear();
  lastByUser.clear();
}

export async function searchForYou(
  options: JobsForYouOptions,
): Promise<JobsForYouResult | null> {
  const entitlement = await getEntitlementState(options.userId);
  const useAI = options.useAI !== false;

  const rows = await loadProfileRows(options.userId);
  const profile = buildJobSearchProfile(options.userId, rows);
  const preference = buildPreference(profile, options);
  const strict = options.strictLocation !== false && options.area !== "any";

  const manual = options.manual?.title?.trim()
    ? {
        title: options.manual.title.trim(),
        location: options.manual.location?.trim() || undefined,
        workMode: options.manual.workMode,
      }
    : null;

  const effectiveMode =
    options.workMode ?? manual?.workMode ?? profile.workMode;
  const workArrangement = arrangementOf(effectiveMode);
  const location =
    manual?.location ??
    ([preference.city, preference.country].filter(Boolean).join(", ") ||
      undefined);

  const key = fingerprint({
    user: options.userId,
    manual: manual?.title ?? null,
    location: location ?? null,
    workArrangement,
    profile: [
      profile.primaryTargetRoles,
      profile.adjacentRoles,
      profile.hardSkills.slice(0, 8),
    ],
    useAI,
  });

  let entry = options.refresh ? null : cacheGet(key);
  let fromCache = entry !== null;
  let notice: string | null = null;

  if (!entry && options.cacheOnly) return null;

  if (!entry) {
    try {
      await enforceDailyCap(
        options.userId,
        "jobRefresh",
        entitlement.isComplete,
      );
    } catch (e) {
      const stale = lastByUser.get(options.userId);
      if (!stale) throw e;
      entry = stale;
      fromCache = true;
      notice = e instanceof Error ? e.message : "Daily search limit reached.";
    }
  }

  if (!entry) {
    const plan = await planSearch({
      userId: options.userId,
      profile,
      seed: manual?.title ?? null,
      useAI,
    });
    const { jobs, health } = await fanOut({
      plan,
      preference,
      workArrangement,
      location: workArrangement === "REMOTE" ? undefined : location,
      userId: options.userId,
      providers: options.providers,
    });
    entry = {
      plan,
      merged: deduplicate(jobs),
      health,
      fetchedAt: Date.now(),
      reranked: new Map(),
      rankedBy: null,
    };
    // An all-failed search is not cached: the next visit should try again.
    if (health.some((h) => h.status === "ok")) {
      cacheSet(key, entry);
      lastByUser.set(options.userId, entry);
    }
  }

  const raw = entry;
  const pipeline = runPipeline({
    jobs: raw.merged,
    profile,
    preference,
    strict,
    query: raw.plan.queries[0]?.title ?? "",
  });

  // Re-rank the top of the list with AI, reusing earlier rankings so widening
  // the location filter does not re-run the model for rows it already saw.
  if (useAI && pipeline.ranked.length) {
    const top = pipeline.ranked.slice(0, RERANK_TOP);
    const unseen = top.filter((r) => !raw.reranked.has(jobKey(r.job)));
    if (unseen.length > Math.min(10, top.length / 3)) {
      const { byIndex, rankedBy } = await rerankWithAI({
        userId: options.userId,
        profile,
        jobs: unseen.map((r) => r.job),
      });
      byIndex.forEach((value, i) =>
        raw.reranked.set(jobKey(unseen[i]!.job), value),
      );
      if (rankedBy) raw.rankedBy = rankedBy;
    }
  }

  const ranked = mergeRerank(pipeline.ranked, raw.reranked);

  return {
    profile,
    preference,
    queries: raw.plan.queries.map((q) => ({
      title: q.title,
      keywords: profile.preferredKeywords,
      reason: q.reason,
    })),
    results: ranked,
    totalMatched: ranked.length,
    rejectedByLocation: pipeline.rejectedByLocation,
    unclearLocation: pipeline.unclearLocation,
    health: raw.health,
    providerErrors: raw.health
      .filter((h) => h.status === "error")
      .map((h) => ({ provider: h.id, message: h.message ?? "failed" })),
    fromCache,
    generatedAt: new Date(raw.fetchedAt).toISOString(),
    plannedBy: raw.plan.plannedBy,
    rankedBy: raw.rankedBy,
    notice,
  };
}

/**
 * AI-ranked rows first (by AI fit, ties by deterministic score), then the rest
 * in deterministic order. Every row is kept.
 */
export function mergeRerank(
  ranked: RankedJob[],
  reranked: Map<string, RerankEntry>,
): RankedJob[] {
  const withAi = ranked.map((r) => {
    const ai = reranked.get(jobKey(r.job));
    return ai ? { ...r, why: ai.why || undefined, aiFit: ai.fit } : r;
  });
  const scored = withAi.filter((r) => r.aiFit !== undefined);
  const rest = withAi.filter((r) => r.aiFit === undefined);
  scored.sort((a, b) => b.aiFit! - a.aiFit! || b.fit.score - a.fit.score);
  return [...scored, ...rest];
}

/**
 * Strict location decision.
 *
 * With "Any work style" the strict setting still means the user's stated place
 * matters: a Berlin office listing must not appear for a Cairo user. So ANY is
 * resolved against the job's actual mode — remote roles use remote eligibility,
 * office roles use the geography rule. The `matchJobLocation` "anything goes"
 * contract for ANY is preserved for non-strict searches only.
 */
export function decideLocation(
  location: NormalizedLocation,
  preference: LocationPreference,
  strict: boolean,
): LocationMatch {
  if (preference.workMode === "ANY" && strict) {
    return location.remoteType === "REMOTE"
      ? matchJobLocation(location, { ...preference, workMode: "REMOTE" })
      : matchJobLocation(location, { ...preference, workMode: "ONSITE" });
  }
  return matchJobLocation(location, preference);
}

export interface PipelineResult {
  ranked: RankedJob[];
  rejectedByLocation: number;
  unclearLocation: number;
}

/**
 * The fixed pipeline, extracted so it can be unit tested without a database or
 * a network: normalize → hard location filter → score → rank.
 */
export function runPipeline(input: {
  jobs: DiscoveredJob[];
  profile: JobSearchProfile;
  preference: LocationPreference;
  strict: boolean;
  query?: string;
}): PipelineResult {
  const { profile, preference, strict } = input;
  let rejectedByLocation = 0;
  let unclearLocation = 0;
  const located: Array<{
    job: DiscoveredJob;
    location: NormalizedLocation;
    match: LocationMatch;
  }> = [];

  for (const job of input.jobs) {
    const location = normalizeJobLocation({
      location: job.location,
      workArrangement: job.workArrangement,
      tags: job.tags,
      title: job.title,
    });
    const match = decideLocation(location, preference, strict);
    if (match.status === "REJECTED") {
      rejectedByLocation += 1;
      continue;
    }
    if (match.status === "UNKNOWN") {
      unclearLocation += 1;
      // Strict mode hides what it cannot confirm — except for remote requests,
      // where an unqualified "Remote" listing is eligible rather than wrong.
      // (With "Any work style" the effective mode mirrors the job's own mode.)
      const effectiveMode =
        strict && preference.workMode === "ANY"
          ? location.remoteType === "REMOTE"
            ? "REMOTE"
            : "ONSITE"
          : preference.workMode;
      const keep = !strict || effectiveMode === "REMOTE";
      if (!keep) continue;
    }
    located.push({ job, location, match });
  }

  const ranked: RankedJob[] = located
    .map((row) => ({
      job: row.job,
      location: row.location,
      locationMatch: row.match,
      query: input.query ?? "",
      fit: scoreJobAgainstProfile(row.job, profile, {
        locationStatus: row.match.status,
      }),
    }))
    .sort((a, b) => {
      if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
      const aTime = a.job.postedAt ? Date.parse(a.job.postedAt) : 0;
      const bTime = b.job.postedAt ? Date.parse(b.job.postedAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.job.title.localeCompare(b.job.title);
    });

  return { ranked, rejectedByLocation, unclearLocation };
}

/** Server-side plan limit. The UI never decides how many rows are allowed. */
export function limitResults<T>(results: T[], limit: number): T[] {
  if (!Number.isFinite(limit)) return results;
  return results.slice(0, Math.max(0, Math.floor(limit)));
}

function arrangementOf(
  mode: WorkMode,
): "REMOTE" | "HYBRID" | "ON_SITE" | "NO_PREFERENCE" {
  switch (mode) {
    case "REMOTE":
      return "REMOTE";
    case "HYBRID":
      return "HYBRID";
    case "ONSITE":
      return "ON_SITE";
    default:
      return "NO_PREFERENCE";
  }
}

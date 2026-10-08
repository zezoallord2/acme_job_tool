import { createHash } from "node:crypto";
import { getEntitlementState } from "@/services/entitlement-service";
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
import { searchJobs, type DiscoveredJob } from "./providers";
import {
  buildJobSearchProfile,
  generateQueries,
  loadProfileRows,
  type GeneratedQuery,
  type JobSearchProfile,
} from "./search-profile";

/**
 * Jobs for You: the one automatic search path.
 *
 * Pipeline order is fixed and unit tested:
 *   normalize → deduplicate → hard location filter → score → rank → limit.
 *
 * Every query comes from the user's CV / profile records, results are cached by
 * a content fingerprint for 15 minutes, and the free/paid row limits are applied
 * here on the server so the UI cannot show more than the plan allows.
 */

export interface RankedJob {
  job: DiscoveredJob;
  location: NormalizedLocation;
  locationMatch: LocationMatch;
  fit: ProfileFit;
  /** Which profile-derived query produced this row (diagnostics). */
  query: string;
}

export interface JobsForYouResult {
  profile: JobSearchProfile;
  preference: LocationPreference;
  queries: GeneratedQuery[];
  results: RankedJob[];
  /** Rows surviving every filter, before the plan limit. */
  totalMatched: number;
  /** Dropped by the hard location filter. */
  rejectedByLocation: number;
  /** Kept but not confirmable (only surfaced when strict mode is off). */
  unclearLocation: number;
  providerErrors: Array<{ provider: string; message: string }>;
  fromCache: boolean;
  generatedAt: string;
  /** Plan limit applied to `results`. */
  limit: number;
}

export interface JobsForYouOptions {
  userId: string;
  /** Ignore the cache and run a fresh search. */
  refresh?: boolean;
  /**
   * Strict location mode, default ON: only jobs whose location is confirmed to
   * satisfy the preference are shown. Turning it off also surfaces jobs whose
   * location could not be verified, clearly labelled.
   */
  strictLocation?: boolean;
  /** "city" (default) keeps the search in the target city area; "country" widens
   *  it to the whole target country. */
  area?: "city" | "country";
  /** Work style override, used by the broadening controls. */
  workMode?: WorkMode;
  /** Manual single-query search, secondary to the profile search. */
  manual?: { title: string; location?: string; workMode?: WorkMode };
  maxQueries?: number;
  maxResults?: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 64;
const resultCache = new Map<string, { expiresAt: number; value: CacheEntry }>();

interface CacheEntry {
  merged: DiscoveredJob[];
  providerErrors: Array<{ provider: string; message: string }>;
  fetchedAt: number;
}

function fingerprint(parts: unknown): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
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
      .replace(/[?#].*$/, "");
    const shape = [job.company, job.title, job.location]
      .map((value) => value.trim().toLowerCase())
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
    area?: "city" | "country";
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
  return {
    city: area === "country" ? null : base.city,
    region: base.region,
    country: base.country,
    countryCode: base.countryCode,
    workMode,
  };
}

function cacheGet(key: string): CacheEntry | null {
  const hit = resultCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: CacheEntry): void {
  if (resultCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
  resultCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

/** Clears the in-process Jobs for You cache (tests / manual refresh). */
export function clearDiscoveryCache(): void {
  resultCache.clear();
}

export async function searchForYou(
  options: JobsForYouOptions,
): Promise<JobsForYouResult> {
  const entitlement = await getEntitlementState(options.userId);
  const maxQueries = options.maxQueries ?? entitlement.limits.jobsForYouQueries;
  const maxResults = options.maxResults ?? entitlement.limits.jobsForYouResults;

  const rows = await loadProfileRows(options.userId);
  const profile = buildJobSearchProfile(options.userId, rows);
  const preference = buildPreference(profile, options);

  const manual = options.manual?.title?.trim()
    ? {
        title: options.manual.title.trim(),
        location: options.manual.location?.trim() || undefined,
        workMode: options.manual.workMode,
      }
    : null;

  const queries: GeneratedQuery[] = manual
    ? [
        {
          title: manual.title,
          keywords: profile.preferredKeywords,
          reason: "Manual search",
        },
      ]
    : generateQueries(profile, maxQueries);

  const strict = options.strictLocation !== false;

  const key = fingerprint({
    queries: queries.map((query) => [query.title, query.keywords]),
    preference,
    strict,
    area: options.area ?? "city",
    manual: manual ? (manual.location ?? null) : null,
  });

  let entry = options.refresh ? null : cacheGet(key);
  let fromCache = true;
  if (!entry) {
    fromCache = false;
    const settled = await Promise.all(
      queries.map(async (query) => {
        const result = await searchJobs({
          title: query.title,
          location:
            manual?.location ??
            preference.city ??
            preference.country ??
            undefined,
          workArrangement: manual?.workMode
            ? arrangementOf(manual.workMode)
            : profile.workMode === "ANY"
              ? "NO_PREFERENCE"
              : arrangementOf(profile.workMode),
          keywords: [...query.keywords, ...profile.tools],
        }).catch(() => ({
          jobs: [] as DiscoveredJob[],
          providerErrors: [{ provider: "all", message: "Search unavailable" }],
        }));
        return { query, result };
      }),
    );

    const providerErrors = new Map<
      string,
      { provider: string; message: string }
    >();
    const merged: DiscoveredJob[] = [];
    for (const { result } of settled) {
      merged.push(...result.jobs);
      for (const error of result.providerErrors) {
        providerErrors.set(`${error.provider}:${error.message}`, error);
      }
    }

    entry = {
      merged: deduplicate(merged),
      providerErrors: [...providerErrors.values()],
      fetchedAt: Date.now(),
    };
    cacheSet(key, entry);
  }

  const pipeline = runPipeline({
    jobs: entry.merged,
    profile,
    preference,
    strict,
    query: queries[0]?.title ?? "",
  });

  return {
    profile,
    preference,
    queries,
    results: limitResults(pipeline.ranked, maxResults),
    totalMatched: pipeline.ranked.length,
    rejectedByLocation: pipeline.rejectedByLocation,
    unclearLocation: pipeline.unclearLocation,
    providerErrors: entry.providerErrors,
    fromCache,
    generatedAt: new Date(entry.fetchedAt).toISOString(),
    limit: maxResults,
  };
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

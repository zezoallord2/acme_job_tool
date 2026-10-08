import type {
  DiscoveredJob,
  JobSearchProvider,
  JobSearchQuery,
  ProviderMeta,
} from "@/jobs/providers";
import {
  cached,
  isRemoteText,
  plainText,
  requestJson,
  toIso,
  usable,
} from "./common";

/**
 * Sources that need a free key. Without the key each one is a no-op whose
 * `unavailableReason()` says exactly which variable is missing, so the health
 * strip shows "Adzuna ✗ key missing" instead of a silent zero.
 */

const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Adzuna — per-country index, 50 rows per page, ~250 requests/day free.
// Terms: listings must carry an "Adzuna" credit linking to Adzuna.
// ---------------------------------------------------------------------------

export const ADZUNA_COUNTRIES = new Set([
  "gb",
  "us",
  "de",
  "fr",
  "au",
  "nz",
  "ca",
  "in",
  "pl",
  "br",
  "at",
  "za",
  "es",
  "it",
  "nl",
  "be",
  "ch",
  "mx",
  "sg",
]);

interface AdzunaJob {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  created?: string;
  contract_time?: string;
  category?: { label?: string };
}

export class AdzunaProvider implements JobSearchProvider {
  readonly id = "adzuna";
  readonly meta: ProviderMeta = {
    label: "Adzuna",
    kind: "keyed",
    signupUrl: "https://developer.adzuna.com/signup",
    attribution: { name: "Adzuna", url: "https://www.adzuna.com" },
  };
  constructor(
    private readonly appId = process.env.ADZUNA_APP_ID ?? "",
    private readonly appKey = process.env.ADZUNA_APP_KEY ?? "",
    private readonly extraCountries: string[] = (
      process.env.ADZUNA_COUNTRIES ?? "us,gb"
    )
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
    private readonly base = "https://api.adzuna.com/v1/api/jobs",
  ) {}

  unavailableReason(): string | null {
    return this.appId && this.appKey
      ? null
      : "key missing (ADZUNA_APP_ID / ADZUNA_APP_KEY)";
  }

  /** The target country when Adzuna covers it, plus the configured extras. */
  countriesFor(query: JobSearchQuery): string[] {
    const list = [
      query.countryCode?.toLowerCase(),
      ...this.extraCountries,
    ].filter((c): c is string => Boolean(c && ADZUNA_COUNTRIES.has(c)));
    return [...new Set(list)].slice(0, 3);
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (this.unavailableReason()) return [];
    const remote = query.workArrangement === "REMOTE";
    const results = await Promise.all(
      this.countriesFor(query).map((country) =>
        cached(
          `adzuna:${country}:${query.title}:${remote}:${query.location ?? ""}`,
          HOUR,
          async () => {
            const url = new URL(`${this.base}/${country}/search/1`);
            url.searchParams.set("app_id", this.appId);
            url.searchParams.set("app_key", this.appKey);
            url.searchParams.set("results_per_page", "50");
            url.searchParams.set(
              "what",
              remote ? `${query.title} remote` : query.title,
            );
            url.searchParams.set("content-type", "application/json");
            // Only pass `where` when the place is in this country's index.
            if (!remote && query.location && country === query.countryCode) {
              url.searchParams.set("where", query.location);
            }
            const body = await requestJson<{ results?: AdzunaJob[] }>(
              url.toString(),
            );
            return body.results ?? [];
          },
        ),
      ),
    );
    return results
      .flat()
      .map((j): DiscoveredJob => {
        const location = String(
          j.location?.display_name ?? "Location not listed",
        );
        return {
          externalId: String(j.id ?? j.redirect_url ?? ""),
          provider: this.id,
          title: plainText(String(j.title ?? "")),
          company: String(j.company?.display_name ?? "").trim(),
          location,
          workArrangement: isRemoteText(`${location} ${j.title ?? ""}`)
            ? "REMOTE"
            : null,
          // Adzuna returns a snippet only; the full text is on the listing.
          description: plainText(String(j.description ?? "")),
          sourceUrl: String(j.redirect_url ?? ""),
          postedAt: toIso(j.created),
          tags: [j.contract_time, j.category?.label].filter((t): t is string =>
            Boolean(t),
          ),
        };
      })
      .filter((j) => usable(j));
  }
}

// ---------------------------------------------------------------------------
// Jooble — POST search. The free key is 500 requests for its LIFETIME, so the
// agent guards it with a monthly budget (JOOBLE_MONTHLY_GLOBAL).
// ---------------------------------------------------------------------------

interface JoobleJob {
  id?: number | string;
  title?: string;
  company?: string;
  location?: string;
  snippet?: string;
  link?: string;
  updated?: string;
  type?: string;
  source?: string;
}

export class JoobleProvider implements JobSearchProvider {
  readonly id = "jooble";
  readonly meta: ProviderMeta = {
    label: "Jooble",
    kind: "keyed",
    signupUrl: "https://jooble.org/api/about",
    attribution: { name: "Jooble", url: "https://jooble.org" },
  };
  constructor(
    private readonly apiKey = process.env.JOOBLE_API_KEY ?? "",
    private readonly base = "https://jooble.org/api",
  ) {}

  unavailableReason(): string | null {
    return this.apiKey ? null : "key missing (JOOBLE_API_KEY)";
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (!this.apiKey) return [];
    const remote = query.workArrangement === "REMOTE";
    const rows = await cached(
      `jooble:${query.title}:${remote ? "remote" : (query.location ?? "")}`,
      6 * HOUR,
      async () => {
        const body = await requestJson<{ jobs?: JoobleJob[] }>(
          `${this.base}/${encodeURIComponent(this.apiKey)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              keywords: query.title,
              location: remote ? "Remote" : (query.location ?? ""),
              page: "1",
            }),
          },
        );
        return body.jobs ?? [];
      },
    );
    return rows
      .map((j): DiscoveredJob => {
        const location = String(
          j.location || (remote ? "Remote" : "Location not listed"),
        );
        return {
          externalId: String(j.id ?? j.link ?? ""),
          provider: this.id,
          title: plainText(String(j.title ?? "")),
          company: String(j.company ?? "").trim(),
          location,
          workArrangement: isRemoteText(location) ? "REMOTE" : null,
          description: plainText(String(j.snippet ?? "")),
          sourceUrl: String(j.link ?? ""),
          postedAt: toIso(j.updated),
          tags: [j.type].filter((t): t is string => Boolean(t)),
          via: j.source ?? null,
        };
      })
      .filter((j) => usable(j));
  }
}

// ---------------------------------------------------------------------------
// USAJobs — US federal roles only. Requires the registered email as the
// User-Agent and the key in Authorization-Key.
// ---------------------------------------------------------------------------

interface UsaJobsItem {
  MatchedObjectDescriptor?: {
    PositionID?: string;
    PositionTitle?: string;
    OrganizationName?: string;
    PositionLocationDisplay?: string;
    PositionURI?: string;
    PublicationStartDate?: string;
    UserArea?: { Details?: { JobSummary?: string } };
  };
}

export class UsaJobsProvider implements JobSearchProvider {
  readonly id = "usajobs";
  readonly meta: ProviderMeta = {
    label: "USAJobs",
    kind: "keyed",
    signupUrl: "https://developer.usajobs.gov/apirequest/",
  };
  constructor(
    private readonly apiKey = process.env.USAJOBS_API_KEY ?? "",
    private readonly userAgent = process.env.USAJOBS_USER_AGENT ?? "",
    private readonly endpoint = "https://data.usajobs.gov/api/search",
  ) {}

  unavailableReason(): string | null {
    if (!this.apiKey) return "key missing (USAJOBS_API_KEY)";
    if (!this.userAgent)
      return "USAJOBS_USER_AGENT (your registered email) missing";
    return null;
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (this.unavailableReason()) return [];
    // Federal jobs are US-only; skip unless the search is remote or in the US.
    const remote = query.workArrangement === "REMOTE";
    if (!remote && query.countryCode && query.countryCode !== "us") return [];
    const rows = await cached(
      `usajobs:${query.title}:${remote}:${query.location ?? ""}`,
      6 * HOUR,
      async () => {
        const url = new URL(this.endpoint);
        url.searchParams.set("Keyword", query.title);
        url.searchParams.set("ResultsPerPage", "50");
        if (remote) url.searchParams.set("RemoteIndicator", "True");
        else if (query.location)
          url.searchParams.set("LocationName", query.location);
        const body = await requestJson<{
          SearchResult?: { SearchResultItems?: UsaJobsItem[] };
        }>(url.toString(), {
          headers: {
            Host: "data.usajobs.gov",
            "User-Agent": this.userAgent,
            "Authorization-Key": this.apiKey,
          },
        });
        return body.SearchResult?.SearchResultItems ?? [];
      },
    );
    return rows
      .map((row): DiscoveredJob => {
        const d = row.MatchedObjectDescriptor ?? {};
        const location = String(d.PositionLocationDisplay ?? "United States");
        return {
          externalId: String(d.PositionID ?? d.PositionURI ?? ""),
          provider: this.id,
          title: String(d.PositionTitle ?? "").trim(),
          company: String(d.OrganizationName ?? "").trim(),
          location,
          workArrangement: remote || isRemoteText(location) ? "REMOTE" : null,
          description: plainText(String(d.UserArea?.Details?.JobSummary ?? "")),
          sourceUrl: String(d.PositionURI ?? ""),
          postedAt: toIso(d.PublicationStartDate),
          tags: ["US federal"],
        };
      })
      .filter((j) => usable(j));
  }
}

// ---------------------------------------------------------------------------
// JSearch — aggregates Google for Jobs (LinkedIn, Indeed, Glassdoor, ZipRecruiter
// listings). Official host is OpenWeb Ninja (x-api-key, `data.jobs[]`, cursor);
// the legacy RapidAPI host (`data[]`) is used when only RAPIDAPI_KEY is set.
// ---------------------------------------------------------------------------

interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_location?: string;
  job_city?: string;
  job_country?: string;
  job_description?: string;
  job_apply_link?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_publisher?: string;
  job_employment_type?: string;
}

export class JSearchProvider implements JobSearchProvider {
  readonly id = "jsearch";
  readonly meta: ProviderMeta = {
    label: "JSearch",
    kind: "keyed",
    signupUrl: "https://app.openwebninja.com/api/jsearch",
  };
  constructor(
    private readonly apiKey = process.env.JSEARCH_API_KEY ?? "",
    private readonly rapidApiKey = process.env.RAPIDAPI_KEY ?? "",
    private readonly pages = Number(process.env.JSEARCH_PAGES ?? 2) || 2,
    private readonly officialBase = "https://api.openwebninja.com/jsearch",
    private readonly rapidBase = "https://jsearch.p.rapidapi.com",
  ) {}

  unavailableReason(): string | null {
    return this.apiKey || this.rapidApiKey
      ? null
      : "key missing (JSEARCH_API_KEY or RAPIDAPI_KEY)";
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (this.unavailableReason()) return [];
    const remote = query.workArrangement === "REMOTE";
    const text = [
      query.title,
      remote ? "remote" : query.location ? `in ${query.location}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const pages = String(Math.max(1, Math.min(5, this.pages)));
    const rows = await cached(
      `jsearch:${text}:${pages}`,
      6 * HOUR,
      async () => {
        if (this.apiKey) {
          const url = new URL(`${this.officialBase}/search-v2`);
          url.searchParams.set("query", text);
          url.searchParams.set("num_pages", pages);
          url.searchParams.set("date_posted", "month");
          if (remote) url.searchParams.set("work_from_home", "true");
          if (query.countryCode && !remote)
            url.searchParams.set("country", query.countryCode);
          const body = await requestJson<{ data?: { jobs?: JSearchJob[] } }>(
            url.toString(),
            { headers: { "x-api-key": this.apiKey }, timeoutMs: 20_000 },
          );
          return body.data?.jobs ?? [];
        }
        const url = new URL(`${this.rapidBase}/search`);
        url.searchParams.set("query", text);
        url.searchParams.set("page", "1");
        url.searchParams.set("num_pages", pages);
        url.searchParams.set("date_posted", "month");
        if (remote) url.searchParams.set("work_from_home", "true");
        if (query.countryCode && !remote)
          url.searchParams.set("country", query.countryCode);
        const body = await requestJson<{ data?: JSearchJob[] }>(
          url.toString(),
          {
            headers: {
              "X-RapidAPI-Key": this.rapidApiKey,
              "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
            timeoutMs: 20_000,
          },
        );
        return body.data ?? [];
      },
    );
    return rows
      .map((j): DiscoveredJob => {
        const location =
          j.job_location ||
          [j.job_city, j.job_country].filter(Boolean).join(", ") ||
          (j.job_is_remote ? "Remote" : "Location not listed");
        return {
          externalId: String(j.job_id ?? j.job_apply_link ?? ""),
          provider: this.id,
          title: String(j.job_title ?? "").trim(),
          company: String(j.employer_name ?? "").trim(),
          location,
          workArrangement: j.job_is_remote ? "REMOTE" : null,
          description: plainText(String(j.job_description ?? "")).slice(
            0,
            20_000,
          ),
          sourceUrl: String(j.job_apply_link ?? ""),
          postedAt: toIso(j.job_posted_at_datetime_utc),
          tags: [j.job_employment_type].filter((t): t is string => Boolean(t)),
          via: j.job_publisher ?? null,
        };
      })
      .filter((j) => usable(j));
  }
}

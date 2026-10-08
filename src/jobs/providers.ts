/**
 * Public job discovery providers.
 *
 * Providers return real, externally hosted vacancies. They never manufacture a
 * result, a keyed provider without its key is a no-op that SAYS so (see
 * `unavailableReason`), and a failing provider is isolated so the other sources
 * still answer. Errors propagate to the caller; they are never swallowed here.
 *
 * The full registry lives in src/jobs/sources/registry.ts.
 */
import {
  filterByTitle,
  parseRelativePosted,
  plainText,
  ProviderError,
  cached,
  requestJson,
  isRemoteText,
  usable,
} from "@/jobs/sources/common";

export interface JobSearchQuery {
  title: string;
  location?: string;
  /** ISO-3166 alpha-2, lower case (e.g. "eg", "us"), when known. */
  countryCode?: string;
  workArrangement?: "REMOTE" | "HYBRID" | "ON_SITE" | "NO_PREFERENCE";
  keywords?: string[];
}

export interface DiscoveredJob {
  externalId: string;
  provider: string;
  title: string;
  company: string;
  location: string;
  workArrangement: "REMOTE" | "HYBRID" | "ON_SITE" | null;
  description: string;
  sourceUrl: string;
  postedAt: string | null;
  tags: string[];
  /** Original publisher when the provider aggregates (e.g. "LinkedIn"). */
  via?: string | null;
}

export type ProviderKind = "keyless" | "keyed" | "company-boards";

export interface ProviderMeta {
  label: string;
  kind: ProviderKind;
  /** Where to get a key (keyed providers). */
  signupUrl?: string;
  /** Required credit shown next to each listing. */
  attribution?: { name: string; url: string };
}

export interface JobSearchProvider {
  readonly id: string;
  readonly meta?: ProviderMeta;
  /** Why this provider cannot run right now ("key missing"), or null. */
  unavailableReason?(): string | null;
  search(query: JobSearchQuery): Promise<DiscoveredJob[]>;
}

const FEED_TTL_MS = 15 * 60 * 1000;

function terms(query: JobSearchQuery): string[] {
  return [query.title, ...(query.keywords ?? [])]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.]+/))
    .filter((value) => value.length > 1);
}

/** Used to order rows inside one provider; global ranking happens later. */
function relevance(job: DiscoveredJob, query: JobSearchQuery): number {
  const haystack =
    `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const wanted = terms(query);
  let score = job.title.toLowerCase().includes(query.title.toLowerCase())
    ? 8
    : 0;
  score += wanted.filter((term) => haystack.includes(term)).length;
  if (
    query.location &&
    job.location.toLowerCase().includes(query.location.toLowerCase())
  ) {
    score += 3;
  }
  if (query.workArrangement === "REMOTE" && job.workArrangement === "REMOTE") {
    score += 3;
  }
  return score;
}

function rank(jobs: DiscoveredJob[], query: JobSearchQuery, limit = 60) {
  return filterByTitle(jobs, query, Number.POSITIVE_INFINITY)
    .map((job) => ({ job, score: relevance(job, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ job }) => job);
}

// ---------------------------------------------------------------------------
// Arbeitnow (keyless). One feed, no server-side search: download, filter here.
// ---------------------------------------------------------------------------

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export class ArbeitnowProvider implements JobSearchProvider {
  readonly id: string;
  readonly meta: ProviderMeta;

  constructor(
    private readonly endpoint = "https://www.arbeitnow.com/api/job-board-api",
    id = "arbeitnow-eu",
  ) {
    this.id = id;
    this.meta = {
      label: id === "arbeitnow-uk" ? "Arbeitnow UK" : "Arbeitnow",
      kind: "keyless",
      attribution: { name: "Arbeitnow", url: "https://www.arbeitnow.com" },
    };
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const sourceJobs = await cached(
      `arbeitnow:${this.endpoint}`,
      FEED_TTL_MS,
      async () => {
        const body = await requestJson<{ data?: ArbeitnowJob[] }>(
          this.endpoint,
        );
        return body.data ?? [];
      },
    );
    const jobs = sourceJobs
      .map((job): DiscoveredJob => ({
        externalId: String(job.slug ?? job.url ?? ""),
        provider: this.id,
        title: String(job.title ?? "").trim(),
        company: String(job.company_name ?? "").trim(),
        location: String(
          job.location ?? (job.remote ? "Remote" : "Location not listed"),
        ),
        workArrangement: job.remote ? "REMOTE" : null,
        description: plainText(String(job.description ?? "")).slice(0, 20_000),
        sourceUrl: String(job.url ?? "").trim(),
        postedAt: job.created_at
          ? new Date(job.created_at * 1000).toISOString()
          : null,
        tags: [...(job.tags ?? []), ...(job.job_types ?? [])].slice(0, 20),
      }))
      .filter((job) => usable(job, 80));
    return rank(jobs, query);
  }
}

// ---------------------------------------------------------------------------
// RemoteOK (keyless). Element 0 is a legal notice; every row is remote.
// Terms: credit Remote OK with a followed link back to the listing.
// ---------------------------------------------------------------------------

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  description?: string;
  tags?: string[];
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
}

export class RemoteOkProvider implements JobSearchProvider {
  readonly id: string;
  readonly meta: ProviderMeta = {
    label: "RemoteOK",
    kind: "keyless",
    attribution: { name: "Remote OK", url: "https://remoteok.com" },
  };

  constructor(
    private readonly endpoint = "https://remoteok.com/api",
    id = "remoteok",
  ) {
    this.id = id;
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const sourceJobs = await cached(
      `remoteok:${this.endpoint}`,
      FEED_TTL_MS,
      async () => {
        const body = await requestJson<unknown>(this.endpoint, {
          headers: { "user-agent": "acme-jobs-discovery/1.0" },
        });
        return Array.isArray(body)
          ? body.filter(
              (row): row is RemoteOkJob =>
                typeof row === "object" && row !== null && "position" in row,
            )
          : [];
      },
    );
    const jobs = sourceJobs
      .map((job): DiscoveredJob => ({
        externalId: String(job.slug ?? job.id ?? job.url ?? ""),
        provider: this.id,
        title: String(job.position ?? "").trim(),
        company: String(job.company ?? "").trim(),
        location: String(job.location || "Remote"),
        workArrangement: "REMOTE",
        description: plainText(String(job.description ?? "")).slice(0, 20_000),
        // The listing page, not the apply link: RemoteOK's terms require the
        // link back to Remote OK itself.
        sourceUrl: String(job.url ?? job.apply_url ?? "").trim(),
        postedAt: job.date ? new Date(job.date).toISOString() : null,
        tags: (job.tags ?? []).slice(0, 20),
      }))
      .filter((job) => usable(job, 80));
    return rank(jobs, query);
  }
}

// ---------------------------------------------------------------------------
// Google Jobs via SerpAPI (keyed). Indexes LinkedIn, Glassdoor, Indeed and
// company sites. 250 free searches/month; each page costs one search, and the
// agent applies a monthly quota guard before calling. Pagination uses
// next_page_token (`start` was discontinued).
// ---------------------------------------------------------------------------

interface SerpApiGoogleJob {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  via?: string;
  share_link?: string;
  apply_options?: Array<{ title?: string; link?: string }>;
  related_links?: Array<{ link?: string; text?: string }>;
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    work_from_home?: boolean;
  };
  posted_at?: string;
}

interface SerpApiResponse {
  error?: string;
  jobs_results?: SerpApiGoogleJob[];
  serpapi_pagination?: { next_page_token?: string };
}

export class SerpApiGoogleJobsProvider implements JobSearchProvider {
  readonly id: string;
  readonly meta: ProviderMeta = {
    label: "Google Jobs",
    kind: "keyed",
    signupUrl: "https://serpapi.com/users/sign_up",
  };
  private readonly apiKey: string;
  private readonly pages: number;

  constructor(
    apiKey = process.env.SERPAPI_API_KEY ?? "",
    private readonly endpoint = "https://serpapi.com/search.json",
    id = "google-jobs",
    pages = Number(process.env.SERPAPI_PAGES ?? 2) || 2,
  ) {
    this.apiKey = apiKey.trim();
    this.id = id;
    this.pages = Math.max(1, Math.min(5, pages));
  }

  unavailableReason(): string | null {
    return this.apiKey ? null : "key missing (SERPAPI_API_KEY)";
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (!this.apiKey) return [];
    const remote = query.workArrangement === "REMOTE";
    const searchText = [query.title, remote ? "remote" : null]
      .filter(Boolean)
      .join(" ");
    if (!query.title.trim()) return [];

    const cacheKey = JSON.stringify([
      this.endpoint,
      searchText,
      query.location ?? "",
      this.pages,
    ]);
    const sourceJobs = await cached(cacheKey, 6 * 60 * 60 * 1000, async () => {
      const rows: SerpApiGoogleJob[] = [];
      let token: string | undefined;
      for (let page = 0; page < this.pages; page += 1) {
        const url = new URL(this.endpoint);
        url.searchParams.set("engine", "google_jobs");
        url.searchParams.set("q", searchText);
        url.searchParams.set("hl", "en");
        if (query.location && !remote) {
          url.searchParams.set("location", query.location);
        }
        if (token) url.searchParams.set("next_page_token", token);
        url.searchParams.set("api_key", this.apiKey);
        const body = await requestJson<SerpApiResponse>(url.toString());
        if (body.error && !Array.isArray(body.jobs_results)) {
          // "Google hasn't returned any results" is an empty page, not a fault.
          if (/hasn't returned any results/i.test(body.error)) break;
          throw new ProviderError("HTTP", body.error);
        }
        rows.push(...(body.jobs_results ?? []));
        token = body.serpapi_pagination?.next_page_token;
        if (!token) break;
      }
      return rows;
    });

    return sourceJobs
      .map((job): DiscoveredJob => {
        const link =
          job.apply_options?.find((o) => o.link?.trim())?.link?.trim() ??
          job.related_links?.find((r) => r.link?.trim())?.link?.trim() ??
          job.share_link?.trim() ??
          "";
        const location = String(job.location ?? "Location not listed");
        const remoteJob =
          job.detected_extensions?.work_from_home === true ||
          isRemoteText(location);
        return {
          externalId: String(job.job_id ?? link),
          provider: this.id,
          title: String(job.title ?? "").trim(),
          company: String(job.company_name ?? "").trim(),
          location,
          workArrangement: remoteJob ? "REMOTE" : null,
          description: plainText(String(job.description ?? "")).slice(
            0,
            20_000,
          ),
          sourceUrl: link,
          postedAt: parseRelativePosted(
            job.detected_extensions?.posted_at ?? job.posted_at,
          ),
          tags: job.detected_extensions?.schedule_type
            ? [job.detected_extensions.schedule_type]
            : [],
          via: job.via ? job.via.replace(/^via\s+/i, "") : null,
        };
      })
      .filter((job) => usable(job, 40));
  }
}

// ---------------------------------------------------------------------------
// Fan-out kept for callers that just want "search everything once".
// ---------------------------------------------------------------------------

export interface SearchResult {
  jobs: DiscoveredJob[];
  providerErrors: Array<{ provider: string; message: string }>;
}

export async function searchJobs(
  query: JobSearchQuery,
  providers?: JobSearchProvider[],
): Promise<SearchResult> {
  const list =
    providers ?? (await import("@/jobs/sources/registry")).defaultProviders();
  const settled = await Promise.allSettled(list.map((p) => p.search(query)));
  const providerErrors: SearchResult["providerErrors"] = [];
  const deduped = new Map<string, DiscoveredJob>();
  const seenUrls = new Set<string>();

  settled.forEach((result, index) => {
    const provider = list[index]!;
    if (result.status === "rejected") {
      providerErrors.push({
        provider: provider.id,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "Unavailable",
      });
      return;
    }
    for (const job of result.value) {
      const url = job.sourceUrl
        .trim()
        .toLowerCase()
        .replace(/[?#].*$/, "");
      const key =
        url || `${job.company}|${job.title}|${job.location}`.toLowerCase();
      if (url && seenUrls.has(url)) continue;
      if (deduped.has(key)) continue;
      if (url) seenUrls.add(url);
      deduped.set(key, job);
    }
  });

  return { jobs: [...deduped.values()], providerErrors };
}

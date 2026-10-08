/**
 * Public job discovery providers.
 *
 * Providers return real, externally hosted vacancies. They never manufacture a
 * result and a failing provider is isolated so another source can still answer.
 */
export interface JobSearchQuery {
  title: string;
  location?: string;
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
}

export interface JobSearchProvider {
  readonly id: string;
  search(query: JobSearchQuery): Promise<DiscoveredJob[]>;
}

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

const SOURCE_CACHE_TTL_MS = 15 * 60 * 1000;

interface CachedSource<T> {
  expiresAt: number;
  jobs: T[];
}

const sourceCache = new Map<string, CachedSource<ArbeitnowJob>>();

/** SerpAPI bills per query, so each distinct query is cached separately. */
const serpCache = new Map<string, CachedSource<SerpApiGoogleJob>>();

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function terms(query: JobSearchQuery): string[] {
  return [query.title, ...(query.keywords ?? [])]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.]+/))
    .filter((value) => value.length > 1);
}

function relevance(job: DiscoveredJob, query: JobSearchQuery): number {
  const haystack =
    `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const wanted = terms(query);
  const title = query.title.toLowerCase();
  let score = job.title.toLowerCase().includes(title) ? 8 : 0;
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

/** Free, keyless listings sourced by Arbeitnow from public employer ATS feeds. */
export class ArbeitnowProvider implements JobSearchProvider {
  readonly id: string;

  constructor(
    private readonly endpoint = "https://www.arbeitnow.com/api/job-board-api",
    id = "arbeitnow-eu",
  ) {
    this.id = id;
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const cached = sourceCache.get(this.endpoint);
      let sourceJobs: ArbeitnowJob[];
      if (cached && cached.expiresAt > Date.now()) {
        sourceJobs = cached.jobs;
      } else {
        const response = await fetch(this.endpoint, {
          headers: { accept: "application/json" },
          signal: controller.signal,
          // The feed is over Next's 2 MB data-cache limit. Cache the parsed data
          // in-process instead of repeatedly downloading it or logging warnings.
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data?: ArbeitnowJob[] };
        sourceJobs = body.data ?? [];
        sourceCache.set(this.endpoint, {
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          jobs: sourceJobs,
        });
      }
      return sourceJobs
        .map((job): DiscoveredJob | null => {
          const title = String(job.title ?? "").trim();
          const company = String(job.company_name ?? "").trim();
          const url = String(job.url ?? "").trim();
          const description = plainText(String(job.description ?? ""));
          if (!title || !company || !url || description.length < 80)
            return null;
          return {
            externalId: String(job.slug ?? url),
            provider: this.id,
            title,
            company,
            location: String(
              job.location ?? (job.remote ? "Remote" : "Location not listed"),
            ),
            workArrangement: job.remote ? "REMOTE" : null,
            description: description.slice(0, 20_000),
            sourceUrl: url,
            postedAt: job.created_at
              ? new Date(job.created_at * 1000).toISOString()
              : null,
            tags: [...(job.tags ?? []), ...(job.job_types ?? [])].slice(0, 20),
          };
        })
        .filter((job): job is DiscoveredJob => job !== null)
        .map((job) => ({ job, score: relevance(job, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map(({ job }) => job);
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface SearchResult {
  jobs: DiscoveredJob[];
  providerErrors: Array<{ provider: string; message: string }>;
}

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
  salary_min?: number | string;
}

interface SerpApiGoogleJob {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  via?: string;
  posted_at?: string;
  related_links?: Array<{ link?: string; text?: string }>;
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    work_from_home?: boolean;
  };
}

/** "3 days ago" / "Over 30 days ago" → ISO; unparseable stays null. */
function parseRelativePosted(value: string | undefined | null): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const now = Date.now();
  if (/just posted|today|now/.test(text)) return new Date(now).toISOString();
  const units: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  };
  const rel = text.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (!rel) return null;
  const ms = units[rel[2]!];
  if (!ms) return null;
  return new Date(now - Number(rel[1]) * ms).toISOString();
}

/**
 * SerpAPI "Google Jobs" endpoint. The key is private: an unset SERPAPI_API_KEY
 * makes the provider a no-op, and every distinct query costs one API credit so
 * responses are cached per query. It returns real listings with original links.
 */
export class SerpApiGoogleJobsProvider implements JobSearchProvider {
  readonly id: string;
  private readonly apiKey: string;

  constructor(
    apiKey = process.env.SERPAPI_API_KEY ?? "",
    private readonly endpoint = "https://serpapi.com/search",
    id = "google-jobs",
  ) {
    this.apiKey = apiKey.trim();
    this.id = id;
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (!this.apiKey) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const biasedByLocation =
        query.workArrangement !== "REMOTE" && Boolean(query.location);
      const searchText = [query.title, biasedByLocation ? query.location : null]
        .filter(Boolean)
        .join(" ");
      if (!searchText.trim()) return [];
      const cacheKey = JSON.stringify([
        query.title,
        query.location ?? "",
        query.workArrangement ?? "",
        query.keywords ?? [],
      ]);
      const cached = serpCache.get(cacheKey);
      let sourceJobs: SerpApiGoogleJob[];
      if (cached && cached.expiresAt > Date.now()) {
        sourceJobs = cached.jobs;
      } else {
        const url = new URL(this.endpoint);
        url.searchParams.set("engine", "google_jobs");
        url.searchParams.set("api_key", this.apiKey);
        url.searchParams.set("q", searchText);
        url.searchParams.set("hl", "en");
        if (biasedByLocation) {
          url.searchParams.set("location", query.location!);
        }
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as {
          error?: string;
          jobs_results?: SerpApiGoogleJob[];
        };
        if (body.error && !Array.isArray(body.jobs_results)) {
          throw new Error(body.error);
        }
        sourceJobs = Array.isArray(body.jobs_results) ? body.jobs_results : [];
        serpCache.set(cacheKey, {
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          jobs: sourceJobs,
        });
      }
      return sourceJobs
        .map((job): DiscoveredJob | null => {
          const title = String(job.title ?? "").trim();
          const company = String(job.company_name ?? "").trim();
          const link =
            (job.related_links ?? [])
              .find((row) => Boolean(row.link?.trim()))
              ?.link?.trim() ?? "";
          const description = plainText(String(job.description ?? ""));
          if (!title || !company || !link || description.length < 40)
            return null;
          const location = String(job.location ?? "Location not listed");
          const remote =
            job.detected_extensions?.work_from_home === true ||
            /remote|work from home|\bwfh\b|fully distributed/i.test(location);
          return {
            externalId: String(job.job_id ?? link),
            provider: this.id,
            title,
            company,
            location,
            workArrangement: remote ? "REMOTE" : null,
            description: description.slice(0, 20_000),
            sourceUrl: link,
            postedAt: parseRelativePosted(
              job.detected_extensions?.posted_at ?? job.posted_at,
            ),
            tags: job.detected_extensions?.schedule_type
              ? [job.detected_extensions.schedule_type]
              : [],
          };
        })
        .filter((job): job is DiscoveredJob => job !== null)
        .map((job) => ({ job, score: relevance(job, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(({ job }) => job);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Free, keyless worldwide remote feed. Isolated like any other provider. */
export class RemoteOkProvider implements JobSearchProvider {
  readonly id: string;

  constructor(
    private readonly endpoint = "https://remoteok.com/api",
    id = "remoteok",
  ) {
    this.id = id;
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const cached = sourceCache.get(this.endpoint);
      let sourceJobs: RemoteOkJob[];
      if (cached && cached.expiresAt > Date.now()) {
        sourceJobs = cached.jobs as RemoteOkJob[];
      } else {
        const response = await fetch(this.endpoint, {
          headers: {
            accept: "application/json",
            // The feed asks automated clients to identify themselves.
            "user-agent": "acme-jobs-discovery/1.0",
          },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as unknown;
        sourceJobs = Array.isArray(body)
          ? body.filter(
              (row): row is RemoteOkJob =>
                typeof row === "object" && row !== null && "position" in row,
            )
          : [];
        sourceCache.set(this.endpoint, {
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          jobs: sourceJobs as unknown as ArbeitnowJob[],
        });
      }
      return sourceJobs
        .map((job): DiscoveredJob | null => {
          const title = String(job.position ?? "").trim();
          const company = String(job.company ?? "").trim();
          const url = String(job.apply_url ?? job.url ?? "").trim();
          const description = plainText(String(job.description ?? ""));
          if (!title || !company || !url || description.length < 80)
            return null;
          return {
            externalId: String(job.slug ?? job.id ?? url),
            provider: this.id,
            title,
            company,
            location: String(job.location ?? "Remote"),
            workArrangement: "REMOTE",
            description: description.slice(0, 20_000),
            sourceUrl: url,
            postedAt: job.date ? new Date(job.date).toISOString() : null,
            tags: (job.tags ?? []).slice(0, 20),
          };
        })
        .filter((job): job is DiscoveredJob => job !== null)
        .map((job) => ({ job, score: relevance(job, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map(({ job }) => job);
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function searchJobs(
  query: JobSearchQuery,
  providers: JobSearchProvider[] = [
    new ArbeitnowProvider(),
    new ArbeitnowProvider(
      "https://www.arbeitnow.co.uk/api/job-board-api",
      "arbeitnow-uk",
    ),
    new RemoteOkProvider(),
    new SerpApiGoogleJobsProvider(),
  ],
): Promise<SearchResult> {
  const settled = await Promise.allSettled(
    providers.map((p) => p.search(query)),
  );
  const providerErrors: SearchResult["providerErrors"] = [];
  const deduped = new Map<string, DiscoveredJob>();
  const seenUrls = new Set<string>();

  settled.forEach((result, index) => {
    const provider = providers[index]!;
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

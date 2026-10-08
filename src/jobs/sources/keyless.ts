import type {
  DiscoveredJob,
  JobSearchProvider,
  JobSearchQuery,
  ProviderMeta,
} from "@/jobs/providers";
import {
  cached,
  decodeEntities,
  filterByTitle,
  isRemoteText,
  plainText,
  requestJson,
  requestText,
  titleMatches,
  toIso,
  usable,
} from "./common";

/**
 * Keyless public job sources. Each respects its published terms:
 * attribution + a link back to the listing, and polling no faster than asked
 * (feeds are cached in-process so many users and queries share one download).
 */

const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Remotive — asks for at most ~4 calls/day, so the feed is cached for 6 hours.
// ---------------------------------------------------------------------------

interface RemotiveJob {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  description?: string;
  publication_date?: string;
  job_type?: string;
  tags?: string[];
  category?: string;
}

export class RemotiveProvider implements JobSearchProvider {
  readonly id = "remotive";
  readonly meta: ProviderMeta = {
    label: "Remotive",
    kind: "keyless",
    attribution: { name: "Remotive", url: "https://remotive.com" },
  };
  constructor(
    private readonly endpoint = process.env.REMOTIVE_API_URL ||
      "https://remotive.com/api/remote-jobs",
  ) {}

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const rows = await cached(
      `remotive:${this.endpoint}`,
      6 * HOUR,
      async () => {
        const body = await requestJson<{ jobs?: RemotiveJob[] }>(this.endpoint);
        return body.jobs ?? [];
      },
    );
    return filterByTitle(
      rows
        .map((j): DiscoveredJob => ({
          externalId: String(j.id ?? j.url ?? ""),
          provider: this.id,
          title: String(j.title ?? "").trim(),
          company: String(j.company_name ?? "").trim(),
          location: `Remote${j.candidate_required_location ? ` (${j.candidate_required_location})` : ""}`,
          workArrangement: "REMOTE",
          description: plainText(String(j.description ?? "")).slice(0, 20_000),
          sourceUrl: String(j.url ?? ""),
          postedAt: toIso(j.publication_date),
          tags: [j.category, j.job_type, ...(j.tags ?? [])]
            .filter((t): t is string => Boolean(t))
            .slice(0, 15),
        }))
        .filter((j) => usable(j)),
      query,
    );
  }
}

// ---------------------------------------------------------------------------
// Himalayas — real search endpoint, 20 rows per page.
// ---------------------------------------------------------------------------

interface HimalayasJob {
  guid?: string;
  title?: string;
  companyName?: string;
  locationRestrictions?: string[];
  excerpt?: string;
  description?: string;
  applicationLink?: string;
  pubDate?: number;
  employmentType?: string;
  seniority?: string[] | string;
  categories?: string[];
}

export class HimalayasProvider implements JobSearchProvider {
  readonly id = "himalayas";
  readonly meta: ProviderMeta = {
    label: "Himalayas",
    kind: "keyless",
    attribution: { name: "Himalayas", url: "https://himalayas.app" },
  };
  constructor(
    private readonly endpoint = "https://himalayas.app/jobs/api/search",
    private readonly pages = 2,
  ) {}

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const rows = await cached(
      `himalayas:${query.title.toLowerCase()}:${query.countryCode ?? ""}`,
      HOUR,
      async () => {
        const out: HimalayasJob[] = [];
        for (let page = 1; page <= this.pages; page += 1) {
          const url = new URL(this.endpoint);
          url.searchParams.set("q", query.title);
          url.searchParams.set("page", String(page));
          url.searchParams.set("sort", "recent");
          if (query.countryCode) {
            url.searchParams.set("country", query.countryCode.toUpperCase());
          }
          const body = await requestJson<{ jobs?: HimalayasJob[] }>(
            url.toString(),
          );
          const jobs = body.jobs ?? [];
          out.push(...jobs);
          if (jobs.length < 20) break;
        }
        return out;
      },
    );
    return rows
      .map((j): DiscoveredJob => ({
        externalId: String(j.guid ?? j.applicationLink ?? ""),
        provider: this.id,
        title: String(j.title ?? "").trim(),
        company: String(j.companyName ?? "").trim(),
        location: j.locationRestrictions?.length
          ? `Remote (${j.locationRestrictions.join(", ")})`
          : "Remote (worldwide)",
        workArrangement: "REMOTE",
        description: plainText(String(j.description ?? j.excerpt ?? "")).slice(
          0,
          20_000,
        ),
        // Link to the Himalayas listing, per their attribution terms.
        sourceUrl: String(j.guid ?? j.applicationLink ?? ""),
        postedAt: toIso(j.pubDate),
        tags: [
          j.employmentType,
          ...(Array.isArray(j.seniority) ? j.seniority : [j.seniority]),
          ...(j.categories ?? []),
        ]
          .filter((t): t is string => Boolean(t))
          .slice(0, 15),
      }))
      .filter((j) => usable(j) && titleMatches(j.title, query.title));
  }
}

// ---------------------------------------------------------------------------
// Jobicy — `tag` search, last 7 days only, poll at most hourly.
// ---------------------------------------------------------------------------

interface JobicyJob {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  jobType?: string[];
  jobIndustry?: string[];
  jobLevel?: string;
}

export class JobicyProvider implements JobSearchProvider {
  readonly id = "jobicy";
  readonly meta: ProviderMeta = {
    label: "Jobicy",
    kind: "keyless",
    attribution: { name: "Jobicy", url: "https://jobicy.com" },
  };
  constructor(
    private readonly endpoint = "https://jobicy.com/api/v2/remote-jobs",
  ) {}

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const rows = await cached(
      `jobicy:${query.title.toLowerCase()}`,
      HOUR,
      async () => {
        const url = new URL(this.endpoint);
        url.searchParams.set("count", "50");
        url.searchParams.set("tag", query.title);
        const body = await requestJson<{ jobs?: JobicyJob[] }>(url.toString());
        return body.jobs ?? [];
      },
    );
    return rows
      .map((j): DiscoveredJob => ({
        externalId: String(j.id ?? j.url ?? ""),
        provider: this.id,
        title: decodeEntities(String(j.jobTitle ?? "")).trim(),
        company: decodeEntities(String(j.companyName ?? "")).trim(),
        location: `Remote${j.jobGeo ? ` (${j.jobGeo})` : ""}`,
        workArrangement: "REMOTE",
        description: plainText(
          String(j.jobDescription ?? j.jobExcerpt ?? ""),
        ).slice(0, 20_000),
        sourceUrl: String(j.url ?? ""),
        postedAt: toIso(j.pubDate),
        tags: [...(j.jobType ?? []), ...(j.jobIndustry ?? []), j.jobLevel ?? ""]
          .filter(Boolean)
          .slice(0, 15),
      }))
      .filter((j) => usable(j) && titleMatches(j.title, query.title));
  }
}

// ---------------------------------------------------------------------------
// We Work Remotely — RSS. Title is "Company: Role".
// ---------------------------------------------------------------------------

function tag(xml: string, name: string): string {
  const m = xml.match(
    new RegExp(
      `<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`,
      "i",
    ),
  );
  return m ? m[1]!.trim() : "";
}

export function parseWwrRss(
  xml: string,
  provider = "weworkremotely",
): DiscoveredJob[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item): DiscoveredJob => {
      const rawTitle = decodeEntities(tag(item, "title"));
      const split = rawTitle.indexOf(": ");
      const company = split > 0 ? rawTitle.slice(0, split) : "";
      const title = split > 0 ? rawTitle.slice(split + 2) : rawTitle;
      const link = tag(item, "link") || tag(item, "guid");
      const region = decodeEntities(tag(item, "region"));
      return {
        externalId: link,
        provider,
        title: title.trim(),
        company: company.trim(),
        location: `Remote${region ? ` (${region})` : ""}`,
        workArrangement: "REMOTE",
        description: plainText(decodeEntities(tag(item, "description"))).slice(
          0,
          20_000,
        ),
        sourceUrl: link,
        postedAt: toIso(tag(item, "pubDate")),
        tags: [tag(item, "category"), tag(item, "type")]
          .map(decodeEntities)
          .filter(Boolean),
      };
    })
    .filter((j) => usable(j));
}

export class WeWorkRemotelyProvider implements JobSearchProvider {
  readonly id = "weworkremotely";
  readonly meta: ProviderMeta = {
    label: "We Work Remotely",
    kind: "keyless",
    attribution: {
      name: "We Work Remotely",
      url: "https://weworkremotely.com",
    },
  };
  constructor(
    private readonly endpoint = "https://weworkremotely.com/remote-jobs.rss",
  ) {}

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const rows = await cached(`wwr:${this.endpoint}`, HOUR, async () =>
      parseWwrRss(
        await requestText(this.endpoint, {
          headers: { "user-agent": "acme-jobs-discovery/1.0" },
        }),
        this.id,
      ),
    );
    return filterByTitle(rows, query);
  }
}

// ---------------------------------------------------------------------------
// Hacker News "Who is hiring?" via the Algolia HN API.
// First line convention: "Company | Role | Location | REMOTE".
// ---------------------------------------------------------------------------

interface HnItem {
  id?: number;
  text?: string | null;
  author?: string;
  created_at?: string;
  children?: HnItem[];
}

export function parseHnComment(item: HnItem): DiscoveredJob | null {
  const html = item.text ?? "";
  if (!html || !item.id) return null;
  const firstLine = decodeEntities(
    (html.split(/<p>/i)[0] ?? "").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  const parts = firstLine
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const company = parts[0]!
    .replace(/\([^)]*\)|https?:\/\/\S+/g, "")
    .trim()
    .slice(0, 120);
  // The role is the part that does not look like a location or work mode.
  const role =
    parts
      .slice(1)
      .find(
        (p) =>
          !/remote|onsite|on-site|hybrid|full[- ]?time|part[- ]?time|contract|\$|€|£|visa/i.test(
            p,
          ) && p.length < 140,
      ) ?? parts[1]!;
  const location =
    parts
      .slice(1)
      .find((p) => /,|remote|onsite|hybrid|[A-Z]{2}\b/.test(p) && p !== role) ??
    "Location not listed";
  return {
    externalId: String(item.id),
    provider: "hn-whoishiring",
    title: role.slice(0, 200),
    company,
    location: location.slice(0, 200),
    workArrangement: isRemoteText(firstLine) ? "REMOTE" : null,
    description: plainText(html).slice(0, 20_000),
    sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    postedAt: toIso(item.created_at),
    tags: ["Hacker News"],
  };
}

export class HackerNewsHiringProvider implements JobSearchProvider {
  readonly id = "hn-whoishiring";
  readonly meta: ProviderMeta = {
    label: "HN Who is hiring",
    kind: "keyless",
    attribution: { name: "Hacker News", url: "https://news.ycombinator.com" },
  };
  constructor(private readonly base = "https://hn.algolia.com/api/v1") {}

  private async thread(): Promise<DiscoveredJob[]> {
    return cached(`hn:${this.base}`, 6 * HOUR, async () => {
      const search = await requestJson<{
        hits?: Array<{ objectID?: string; title?: string }>;
      }>(
        `${this.base}/search_by_date?tags=story,author_whoishiring&hitsPerPage=5`,
      );
      const story = (search.hits ?? []).find((h) =>
        /^ask hn: who is hiring\?/i.test(h.title ?? ""),
      );
      if (!story?.objectID) return [];
      const tree = await requestJson<HnItem>(
        `${this.base}/items/${story.objectID}`,
        { timeoutMs: 15_000 },
      );
      return (tree.children ?? [])
        .map(parseHnComment)
        .filter((j): j is DiscoveredJob => j !== null);
    });
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const rows = await this.thread();
    const escaped = query.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const phrase = new RegExp(`((?:[A-Z][\\w/&+-]*\\s){0,2}${escaped}s?)`, "i");
    const out: DiscoveredJob[] = [];
    for (const j of rows) {
      if (titleMatches(j.title, query.title)) {
        out.push(j);
        continue;
      }
      // Posts often list several roles in prose ("hiring a Senior Product
      // Designer and…"). Use the role exactly as the post words it.
      const m = j.description.match(phrase);
      if (m) {
        // The match is case-insensitive, so drop leading lowercase words
        // ("a", "hiring") that are prose rather than part of the title.
        const title = m[1]!.trim().replace(/^(?:[a-z]\S*\s+)+/, "");
        out.push({ ...j, title: title.slice(0, 120) });
      }
    }
    return out.slice(0, 40);
  }
}

// ---------------------------------------------------------------------------
// The Muse — no free-text search; filter by location, match titles here.
// ---------------------------------------------------------------------------

interface MuseJob {
  id?: number;
  name?: string;
  company?: { name?: string };
  locations?: Array<{ name?: string }>;
  contents?: string;
  refs?: { landing_page?: string };
  publication_date?: string;
  levels?: Array<{ name?: string }>;
  categories?: Array<{ name?: string }>;
}

export class TheMuseProvider implements JobSearchProvider {
  readonly id = "themuse";
  readonly meta: ProviderMeta = {
    label: "The Muse",
    kind: "keyless",
    attribution: { name: "The Muse", url: "https://www.themuse.com" },
  };
  constructor(
    private readonly apiKey = process.env.THEMUSE_API_KEY ?? "",
    private readonly endpoint = "https://www.themuse.com/api/public/jobs",
    private readonly pages = 3,
  ) {}

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    const location =
      query.workArrangement === "REMOTE" || !query.location
        ? "Flexible / Remote"
        : query.location;
    const rows = await cached(`muse:${location}`, HOUR, async () => {
      const out: MuseJob[] = [];
      for (let page = 0; page < this.pages; page += 1) {
        const url = new URL(this.endpoint);
        url.searchParams.set("page", String(page));
        url.searchParams.set("location", location);
        url.searchParams.set("descending", "true");
        if (this.apiKey) url.searchParams.set("api_key", this.apiKey);
        const body = await requestJson<{
          results?: MuseJob[];
          page_count?: number;
        }>(url.toString(), {
          headers: { "user-agent": "Mozilla/5.0 (compatible; AcmeJobs/1.0)" },
        });
        out.push(...(body.results ?? []));
        if (page + 1 >= (body.page_count ?? 0)) break;
      }
      return out;
    });
    return filterByTitle(
      rows
        .map((j): DiscoveredJob => {
          const loc =
            j.locations
              ?.map((l) => l.name)
              .filter(Boolean)
              .join("; ") || "Location not listed";
          return {
            externalId: String(j.id ?? ""),
            provider: this.id,
            title: String(j.name ?? "").trim(),
            company: String(j.company?.name ?? "").trim(),
            location: loc,
            workArrangement: isRemoteText(loc) ? "REMOTE" : null,
            description: plainText(String(j.contents ?? "")).slice(0, 20_000),
            sourceUrl: String(j.refs?.landing_page ?? ""),
            postedAt: toIso(j.publication_date),
            tags: [
              ...(j.levels ?? []).map((l) => l.name ?? ""),
              ...(j.categories ?? []).map((c) => c.name ?? ""),
            ].filter(Boolean),
          };
        })
        .filter((j) => usable(j)),
      query,
    );
  }
}

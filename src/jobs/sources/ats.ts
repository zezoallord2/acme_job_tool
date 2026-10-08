import type {
  DiscoveredJob,
  JobSearchProvider,
  JobSearchQuery,
  ProviderMeta,
} from "@/jobs/providers";
import {
  cached,
  decodeEntities,
  isRemoteText,
  plainText,
  requestJson,
  titleMatches,
  toIso,
  usable,
} from "./common";

/**
 * Company career boards (keyless, public JSON published by the ATS for exactly
 * this purpose). Which companies are searched comes from a curated list; the
 * search agent picks the ones that fit the user's target industry.
 *
 * Every board below was verified live (it returned open roles) when the list
 * was written. A board that disappears simply reports an error in health.
 */

export type AtsName = "greenhouse" | "lever" | "ashby";

export interface AtsCompany {
  slug: string;
  name: string;
  ats: AtsName;
  industries: string[];
}

const c = (
  ats: AtsName,
  slug: string,
  name: string,
  industries: string[],
): AtsCompany => ({ ats, slug, name, industries });

export const ATS_COMPANIES: readonly AtsCompany[] = [
  // Greenhouse
  c("greenhouse", "airbnb", "Airbnb", [
    "travel",
    "marketplace",
    "consumer",
    "design",
  ]),
  c("greenhouse", "stripe", "Stripe", [
    "fintech",
    "payments",
    "developer tools",
  ]),
  c("greenhouse", "figma", "Figma", ["design", "saas", "developer tools"]),
  c("greenhouse", "discord", "Discord", ["consumer", "social", "gaming"]),
  c("greenhouse", "dropbox", "Dropbox", ["saas", "productivity"]),
  c("greenhouse", "reddit", "Reddit", ["social", "consumer", "media"]),
  c("greenhouse", "robinhood", "Robinhood", ["fintech", "consumer"]),
  c("greenhouse", "coinbase", "Coinbase", ["crypto", "fintech"]),
  c("greenhouse", "gitlab", "GitLab", [
    "developer tools",
    "saas",
    "remote-first",
  ]),
  c("greenhouse", "duolingo", "Duolingo", ["education", "consumer", "design"]),
  c("greenhouse", "pinterest", "Pinterest", ["social", "consumer", "design"]),
  c("greenhouse", "lyft", "Lyft", ["mobility", "marketplace"]),
  c("greenhouse", "instacart", "Instacart", [
    "ecommerce",
    "marketplace",
    "logistics",
  ]),
  c("greenhouse", "databricks", "Databricks", ["data", "ai", "saas"]),
  c("greenhouse", "cloudflare", "Cloudflare", ["security", "infrastructure"]),
  c("greenhouse", "twilio", "Twilio", ["communications", "developer tools"]),
  c("greenhouse", "asana", "Asana", ["productivity", "saas"]),
  c("greenhouse", "airtable", "Airtable", ["productivity", "saas"]),
  c("greenhouse", "squarespace", "Squarespace", [
    "design",
    "ecommerce",
    "saas",
  ]),
  c("greenhouse", "webflow", "Webflow", ["design", "saas", "no-code"]),
  c("greenhouse", "anthropic", "Anthropic", ["ai", "research"]),
  c("greenhouse", "brex", "Brex", ["fintech", "saas"]),
  c("greenhouse", "gusto", "Gusto", ["hr", "fintech", "saas"]),
  c("greenhouse", "mongodb", "MongoDB", ["data", "developer tools"]),
  c("greenhouse", "elastic", "Elastic", ["data", "search", "remote-first"]),
  c("greenhouse", "datadog", "Datadog", [
    "observability",
    "saas",
    "infrastructure",
  ]),
  c("greenhouse", "okta", "Okta", ["security", "identity", "saas"]),
  c("greenhouse", "vercel", "Vercel", [
    "developer tools",
    "infrastructure",
    "remote-first",
  ]),
  c("greenhouse", "intercom", "Intercom", ["customer support", "saas"]),
  c("greenhouse", "monzo", "Monzo", ["fintech", "banking"]),
  c("greenhouse", "n26", "N26", ["fintech", "banking"]),
  c("greenhouse", "wise", "Wise", ["fintech", "payments"]),
  c("greenhouse", "careem", "Careem", [
    "mena",
    "mobility",
    "marketplace",
    "fintech",
  ]),
  c("greenhouse", "typeform", "Typeform", ["saas", "design"]),
  c("greenhouse", "calendly", "Calendly", ["productivity", "saas"]),
  c("greenhouse", "netlify", "Netlify", ["developer tools", "remote-first"]),
  // Lever
  c("lever", "spotify", "Spotify", ["media", "consumer", "design"]),
  c("lever", "palantir", "Palantir", ["data", "government", "ai"]),
  c("lever", "toptal", "Toptal", ["freelance", "remote-first", "talent"]),
  c("lever", "binance", "Binance", ["crypto", "fintech"]),
  // Ashby
  c("ashby", "openai", "OpenAI", ["ai", "research"]),
  c("ashby", "notion", "Notion", ["productivity", "saas", "design"]),
  c("ashby", "linear", "Linear", [
    "productivity",
    "developer tools",
    "design",
    "remote-first",
  ]),
  c("ashby", "ramp", "Ramp", ["fintech", "saas"]),
  c("ashby", "plaid", "Plaid", ["fintech", "developer tools"]),
  c("ashby", "supabase", "Supabase", ["developer tools", "remote-first"]),
  c("ashby", "1password", "1Password", ["security", "remote-first"]),
  c("ashby", "posthog", "PostHog", [
    "analytics",
    "developer tools",
    "remote-first",
  ]),
  c("ashby", "sentry", "Sentry", ["developer tools", "observability"]),
  c("ashby", "zapier", "Zapier", ["automation", "saas", "remote-first"]),
  c("ashby", "miro", "Miro", ["design", "collaboration", "saas"]),
  c("ashby", "clickup", "ClickUp", ["productivity", "saas"]),
  c("ashby", "mural", "Mural", ["design", "collaboration", "remote-first"]),
  c("ashby", "gitbook", "GitBook", ["developer tools", "remote-first"]),
];

/** Deterministic fallback when the AI planner is unavailable. */
export function pickCompanies(
  industries: readonly string[],
  limit = 14,
): AtsCompany[] {
  const wanted = industries.map((i) => i.toLowerCase());
  const scored = ATS_COMPANIES.map((co) => ({
    co,
    score: co.industries.filter((i) =>
      wanted.some((w) => w.includes(i) || i.includes(w)),
    ).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  // Always include remote-first employers: they hire across borders.
  const picked = scored.slice(0, limit).map((s) => s.co);
  for (const co of ATS_COMPANIES) {
    if (picked.length >= limit + 4) break;
    if (co.industries.includes("remote-first") && !picked.includes(co)) {
      picked.push(co);
    }
  }
  return picked;
}

export function companiesBySlug(slugs: readonly string[]): AtsCompany[] {
  const set = new Set(slugs.map((s) => s.toLowerCase()));
  return ATS_COMPANIES.filter((co) => set.has(co.slug));
}

interface BoardRow {
  id: string;
  title: string;
  location: string;
  remote: boolean;
  description: string;
  url: string;
  postedAt: string | null;
  tags: string[];
}

async function loadGreenhouse(slug: string): Promise<BoardRow[]> {
  const body = await requestJson<{
    jobs?: Array<{
      id?: number;
      title?: string;
      location?: { name?: string };
      content?: string;
      absolute_url?: string;
      first_published?: string;
      updated_at?: string;
      departments?: Array<{ name?: string }>;
      metadata?: Array<{ name?: string; value?: unknown }>;
    }>;
  }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
    timeoutMs: 15_000,
  });
  return (body.jobs ?? []).map((j) => {
    const location = j.location?.name ?? "Location not listed";
    const workplace = (j.metadata ?? []).find((m) =>
      /workplace/i.test(m.name ?? ""),
    )?.value;
    return {
      id: String(j.id ?? j.absolute_url),
      title: String(j.title ?? ""),
      location,
      remote: isRemoteText(location) || /remote/i.test(String(workplace ?? "")),
      // Greenhouse escapes the HTML once more than usual: decode, then strip.
      description: plainText(decodeEntities(String(j.content ?? ""))),
      url: String(j.absolute_url ?? ""),
      postedAt: toIso(j.first_published ?? j.updated_at),
      tags: (j.departments ?? []).map((d) => d.name ?? "").filter(Boolean),
    };
  });
}

async function loadLever(slug: string): Promise<BoardRow[]> {
  const body = await requestJson<
    Array<{
      id?: string;
      text?: string;
      categories?: { location?: string; team?: string; commitment?: string };
      workplaceType?: string;
      descriptionPlain?: string;
      hostedUrl?: string;
      createdAt?: number;
    }>
  >(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=500`, {
    timeoutMs: 15_000,
  });
  return (Array.isArray(body) ? body : []).map((j) => {
    const location = j.categories?.location ?? "Location not listed";
    return {
      id: String(j.id ?? j.hostedUrl),
      title: String(j.text ?? ""),
      location,
      remote: j.workplaceType === "remote" || isRemoteText(location),
      description: String(j.descriptionPlain ?? ""),
      url: String(j.hostedUrl ?? ""),
      postedAt: toIso(j.createdAt),
      tags: [j.categories?.team, j.categories?.commitment].filter(
        (t): t is string => Boolean(t),
      ),
    };
  });
}

async function loadAshby(slug: string): Promise<BoardRow[]> {
  const body = await requestJson<{
    jobs?: Array<{
      id?: string;
      title?: string;
      location?: string;
      secondaryLocations?: Array<{ location?: string }>;
      isRemote?: boolean;
      workplaceType?: string;
      descriptionPlain?: string;
      jobUrl?: string;
      publishedAt?: string;
      department?: string;
      employmentType?: string;
    }>;
  }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
    timeoutMs: 15_000,
  });
  return (body.jobs ?? []).map((j) => {
    const location = [
      j.location,
      ...(j.secondaryLocations ?? []).map((l) => l.location),
    ]
      .filter(Boolean)
      .join("; ");
    return {
      id: String(j.id ?? j.jobUrl),
      title: String(j.title ?? ""),
      location: location || "Location not listed",
      remote: j.isRemote === true || /remote/i.test(j.workplaceType ?? ""),
      description: String(j.descriptionPlain ?? ""),
      url: String(j.jobUrl ?? ""),
      postedAt: toIso(j.publishedAt),
      tags: [j.department, j.employmentType].filter((t): t is string =>
        Boolean(t),
      ),
    };
  });
}

const LOADERS: Record<AtsName, (slug: string) => Promise<BoardRow[]>> = {
  greenhouse: loadGreenhouse,
  lever: loadLever,
  ashby: loadAshby,
};

const LABELS: Record<AtsName, string> = {
  greenhouse: "Greenhouse boards",
  lever: "Lever boards",
  ashby: "Ashby boards",
};

/**
 * One provider per ATS. `companies` is set by the agent before searching; a
 * board that fails is skipped and reported, the rest still answer.
 */
export class AtsBoardsProvider implements JobSearchProvider {
  readonly id: string;
  readonly meta: ProviderMeta;
  private companies: AtsCompany[];
  readonly boardErrors: string[] = [];

  constructor(
    private readonly ats: AtsName,
    companies: AtsCompany[] = ATS_COMPANIES.filter((co) => co.ats === ats),
    private readonly loader = LOADERS[ats],
  ) {
    this.id = ats;
    this.meta = { label: LABELS[ats], kind: "company-boards" };
    this.companies = companies.filter((co) => co.ats === ats);
  }

  useCompanies(companies: readonly AtsCompany[]): void {
    this.companies = companies.filter((co) => co.ats === this.ats);
  }

  async search(query: JobSearchQuery): Promise<DiscoveredJob[]> {
    if (this.companies.length === 0) return [];
    const settled = await Promise.allSettled(
      this.companies.map(async (co) => ({
        co,
        rows: await cached(`ats:${this.ats}:${co.slug}`, 60 * 60 * 1000, () =>
          this.loader(co.slug),
        ),
      })),
    );
    const out: DiscoveredJob[] = [];
    let failed = 0;
    for (const result of settled) {
      if (result.status === "rejected") {
        failed += 1;
        continue;
      }
      const { co, rows } = result.value;
      for (const r of rows) {
        if (!titleMatches(r.title, query.title)) continue;
        const job: DiscoveredJob = {
          externalId: `${co.slug}:${r.id}`,
          provider: this.id,
          title: r.title.trim(),
          company: co.name,
          location: r.location,
          workArrangement: r.remote ? "REMOTE" : null,
          description: r.description.slice(0, 20_000),
          sourceUrl: r.url,
          postedAt: r.postedAt,
          tags: r.tags,
        };
        if (usable(job)) out.push(job);
      }
    }
    // Every board failing is a provider failure, not an empty result.
    if (failed > 0 && failed === settled.length) {
      const first = settled.find((s) => s.status === "rejected") as
        PromiseRejectedResult | undefined;
      throw first?.reason instanceof Error
        ? first.reason
        : new Error("every company board failed");
    }
    return out;
  }
}

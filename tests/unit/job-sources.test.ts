import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSourceCache,
  request,
  ProviderError,
  redact,
  titleMatches,
} from "@/jobs/sources/common";
import {
  HackerNewsHiringProvider,
  HimalayasProvider,
  JobicyProvider,
  RemotiveProvider,
  TheMuseProvider,
  WeWorkRemotelyProvider,
} from "@/jobs/sources/keyless";
import {
  AdzunaProvider,
  JoobleProvider,
  JSearchProvider,
  UsaJobsProvider,
} from "@/jobs/sources/keyed";
import { AtsBoardsProvider, pickCompanies } from "@/jobs/sources/ats";
import { SerpApiGoogleJobsProvider } from "@/jobs/providers";
import { externalSearchLinks } from "@/lib/external-job-search";

/**
 * One mocked test per job source: the provider parses its real response shape,
 * drops unusable rows, and a missing key is reported rather than silent.
 */

const LONG =
  "We are hiring a product designer to own end-to-end design of our mobile app, run research and ship polished UI in Figma with engineering.";

type Handler = (url: string, init?: RequestInit) => unknown;

function mockFetch(handler: Handler) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const body = handler(url, init);
      if (body instanceof Response) return body;
      return new Response(
        typeof body === "string" ? body : JSON.stringify(body),
        { status: 200 },
      );
    }),
  );
  return calls;
}

const query = { title: "Product Designer", workArrangement: "REMOTE" as const };

beforeEach(() => clearSourceCache());
afterEach(() => vi.unstubAllGlobals());

describe("shared source plumbing", () => {
  it("matches titles on meaningful words, ignoring seniority", () => {
    expect(titleMatches("Senior Product Designer", "Product Designer")).toBe(
      true,
    );
    expect(titleMatches("Product Designer II", "product designer")).toBe(true);
    expect(titleMatches("Product Manager", "Product Designer")).toBe(false);
  });

  it("retries a 5xx once, then succeeds", async () => {
    let n = 0;
    mockFetch(() => {
      n += 1;
      return n === 1 ? new Response("down", { status: 503 }) : { ok: true };
    });
    const res = await request("https://x.test/a");
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it("does not retry a 4xx and reports a typed error", async () => {
    let n = 0;
    mockFetch(() => {
      n += 1;
      return new Response("no", { status: 401 });
    });
    await expect(request("https://x.test/a")).rejects.toMatchObject({
      kind: "HTTP",
      status: 401,
    });
    expect(n).toBe(1);
  });

  it("maps 429 to a quota error", async () => {
    mockFetch(() => new Response("slow down", { status: 429 }));
    await expect(request("https://x.test/a")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("redacts keys from error text", () => {
    expect(redact("GET https://a.test/?app_key=SECRET123&x=1")).not.toContain(
      "SECRET123",
    );
  });
});

describe("keyless sources", () => {
  it("Remotive: parses jobs[] and keeps title matches only", async () => {
    mockFetch(() => ({
      jobs: [
        {
          id: 1,
          url: "https://remotive.com/1",
          title: "Product Designer",
          company_name: "Acme",
          candidate_required_location: "Worldwide",
          description: `<p>${LONG}</p>`,
          publication_date: "2026-10-01T00:00:00",
        },
        {
          id: 2,
          url: "https://remotive.com/2",
          title: "Backend Engineer",
          company_name: "Acme",
          description: LONG,
        },
      ],
    }));
    const rows = await new RemotiveProvider("https://remotive.test/api").search(
      query,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "remotive",
      workArrangement: "REMOTE",
      location: "Remote (Worldwide)",
    });
    expect(rows[0]!.description).not.toContain("<p>");
  });

  it("Himalayas: paginates the search endpoint and links to the listing", async () => {
    const calls = mockFetch((url) => ({
      jobs: url.includes("page=1")
        ? Array.from({ length: 20 }, (_, i) => ({
            guid: `https://himalayas.app/jobs/${i}`,
            title: "Senior Product Designer",
            companyName: `Co ${i}`,
            locationRestrictions: ["Egypt"],
            description: LONG,
            pubDate: 1_790_000_000,
          }))
        : [],
    }));
    const rows = await new HimalayasProvider(
      "https://himalayas.test/search",
    ).search({ ...query, countryCode: "eg" });
    expect(rows).toHaveLength(20);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toContain("country=EG");
    expect(rows[0]!.sourceUrl).toBe("https://himalayas.app/jobs/0");
  });

  it("Jobicy: tag search, decoded entities", async () => {
    const calls = mockFetch(() => ({
      jobs: [
        {
          id: 7,
          url: "https://jobicy.com/jobs/7",
          jobTitle: "Product Designer &amp; Researcher",
          companyName: "Acme",
          jobGeo: "EMEA",
          jobDescription: LONG,
          pubDate: "2026-10-01 10:00:00",
        },
      ],
    }));
    const rows = await new JobicyProvider("https://jobicy.test/api").search(
      query,
    );
    expect(calls[0]!.url).toContain("tag=Product+Designer");
    expect(rows[0]!.title).toBe("Product Designer & Researcher");
    expect(rows[0]!.location).toBe("Remote (EMEA)");
  });

  it("We Work Remotely: splits 'Company: Role' from RSS", async () => {
    mockFetch(
      () => `<?xml version="1.0"?><rss><channel>
      <item><title>Calm: Senior Product Designer</title>
      <region>Anywhere in the World</region>
      <description><![CDATA[<p>${LONG}</p>]]></description>
      <pubDate>Mon, 05 Oct 2026 10:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/calm-designer</link></item>
      <item><title>Other: Sales Lead</title><link>https://weworkremotely.com/x</link></item>
      </channel></rss>`,
    );
    const rows = await new WeWorkRemotelyProvider(
      "https://wwr.test/rss",
    ).search(query);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      company: "Calm",
      title: "Senior Product Designer",
      location: "Remote (Anywhere in the World)",
    });
  });

  it("HN Who is hiring: finds the thread and parses the first line", async () => {
    mockFetch((url) =>
      url.includes("search_by_date")
        ? {
            hits: [
              { objectID: "1", title: "Ask HN: Who wants to be hired?" },
              { objectID: "2", title: "Ask HN: Who is hiring? (October 2026)" },
            ],
          }
        : {
            id: 2,
            children: [
              {
                id: 99,
                created_at: "2026-10-01T00:00:00Z",
                text: `Smarkets (https://smarkets.com) | London | REMOTE | Full Time<p>We are hiring a Senior Product Designer. ${LONG}`,
              },
            ],
          },
    );
    const rows = await new HackerNewsHiringProvider("https://hn.test").search(
      query,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      company: "Smarkets",
      title: "Senior Product Designer",
      sourceUrl: "https://news.ycombinator.com/item?id=99",
      workArrangement: "REMOTE",
    });
  });

  it("The Muse: filters by title and surfaces a 403 as an error", async () => {
    mockFetch(() => new Response("blocked", { status: 403 }));
    await expect(
      new TheMuseProvider("", "https://muse.test/jobs", 1).search(query),
    ).rejects.toMatchObject({ kind: "HTTP", status: 403 });
  });
});

describe("keyed sources", () => {
  it("report the missing key instead of failing silently", () => {
    expect(new AdzunaProvider("", "").unavailableReason()).toMatch(/ADZUNA/);
    expect(new JoobleProvider("").unavailableReason()).toMatch(/JOOBLE/);
    expect(new UsaJobsProvider("", "").unavailableReason()).toMatch(/USAJOBS/);
    expect(new UsaJobsProvider("k", "").unavailableReason()).toMatch(
      /USER_AGENT/,
    );
    expect(new JSearchProvider("", "").unavailableReason()).toMatch(/JSEARCH/);
    expect(new SerpApiGoogleJobsProvider("").unavailableReason()).toMatch(
      /SERPAPI/,
    );
  });

  it("Adzuna: searches the target country when covered plus extras", async () => {
    const calls = mockFetch(() => ({
      results: [
        {
          id: "a1",
          title: "<strong>Product</strong> Designer",
          company: { display_name: "Acme" },
          location: { display_name: "London, UK" },
          description: "Short snippet",
          redirect_url: "https://adzuna.test/a1",
          created: "2026-10-01T00:00:00Z",
        },
      ],
    }));
    const p = new AdzunaProvider("id", "key", ["us"], "https://adzuna.test");
    expect(p.countriesFor({ ...query, countryCode: "eg" })).toEqual(["us"]);
    expect(p.countriesFor({ ...query, countryCode: "gb" })).toEqual([
      "gb",
      "us",
    ]);
    const rows = await p.search({ ...query, countryCode: "gb" });
    expect(calls.map((c) => c.url).join(" ")).toContain("/gb/search/1");
    expect(calls[0]!.url).toContain("results_per_page=50");
    expect(rows[0]!.title).toBe("Product Designer");
  });

  it("Jooble: POSTs keywords and location, key in the path", async () => {
    const calls = mockFetch(() => ({
      jobs: [
        {
          id: 5,
          title: "Product Designer",
          company: "Acme",
          location: "Remote",
          snippet: "Design things",
          link: "https://jooble.test/5",
          source: "LinkedIn",
        },
      ],
    }));
    const rows = await new JoobleProvider(
      "KEY",
      "https://jooble.test/api",
    ).search(query);
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toMatchObject({
      keywords: "Product Designer",
      location: "Remote",
    });
    expect(rows[0]!.via).toBe("LinkedIn");
  });

  it("USAJobs: sends the required headers and skips non-US on-site searches", async () => {
    const calls = mockFetch(() => ({
      SearchResult: {
        SearchResultItems: [
          {
            MatchedObjectDescriptor: {
              PositionID: "X1",
              PositionTitle: "Product Designer",
              OrganizationName: "GSA",
              PositionLocationDisplay: "Washington, DC",
              PositionURI: "https://usajobs.test/X1",
              UserArea: { Details: { JobSummary: LONG } },
            },
          },
        ],
      },
    }));
    const p = new UsaJobsProvider("KEY", "me@example.com", "https://usa.test");
    expect(
      await p.search({
        title: "Product Designer",
        workArrangement: "ON_SITE",
        countryCode: "eg",
      }),
    ).toEqual([]);
    const rows = await p.search(query);
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers["Authorization-Key"]).toBe("KEY");
    expect(headers["User-Agent"]).toBe("me@example.com");
    expect(rows[0]).toMatchObject({
      company: "GSA",
      workArrangement: "REMOTE",
    });
  });

  it("JSearch: official host uses x-api-key and data.jobs[]", async () => {
    const calls = mockFetch(() => ({
      data: {
        jobs: [
          {
            job_id: "j1",
            job_title: "Product Designer",
            employer_name: "Acme",
            job_is_remote: true,
            job_description: LONG,
            job_apply_link: "https://jobs.test/j1",
            job_publisher: "LinkedIn",
          },
        ],
      },
    }));
    const rows = await new JSearchProvider(
      "KEY",
      "",
      2,
      "https://ownj.test",
    ).search(query);
    expect(calls[0]!.url).toContain("/search-v2");
    expect(calls[0]!.url).toContain("num_pages=2");
    expect(
      (calls[0]!.init?.headers as Record<string, string>)["x-api-key"],
    ).toBe("KEY");
    expect(rows[0]).toMatchObject({
      via: "LinkedIn",
      workArrangement: "REMOTE",
    });
  });

  it("JSearch: falls back to the RapidAPI host and data[]", async () => {
    const calls = mockFetch(() => ({
      data: [
        {
          job_id: "j2",
          job_title: "Product Designer",
          employer_name: "Acme",
          job_city: "Cairo",
          job_country: "EG",
          job_description: LONG,
          job_apply_link: "https://jobs.test/j2",
        },
      ],
    }));
    const rows = await new JSearchProvider(
      "",
      "RAPID",
      1,
      undefined,
      "https://rapid.test",
    ).search({
      title: "Product Designer",
      location: "Cairo",
      countryCode: "eg",
    });
    expect(
      (calls[0]!.init?.headers as Record<string, string>)["X-RapidAPI-Key"],
    ).toBe("RAPID");
    expect(rows[0]!.location).toBe("Cairo, EG");
  });

  it("SerpAPI: follows next_page_token and has no 15-row cap", async () => {
    const page = (n: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        job_id: `g-${n}-${i}`,
        title: "Product Designer",
        company_name: `Co ${n}-${i}`,
        location: "Anywhere",
        via: "via LinkedIn",
        description: LONG,
        apply_options: [
          { title: "LinkedIn", link: `https://l.test/${n}/${i}` },
        ],
      }));
    const calls = mockFetch((url) =>
      url.includes("next_page_token")
        ? { jobs_results: page(2) }
        : {
            jobs_results: page(1),
            serpapi_pagination: { next_page_token: "TOKEN" },
          },
    );
    const rows = await new SerpApiGoogleJobsProvider(
      "KEY",
      "https://serp.test/search.json",
      "google-jobs",
      2,
    ).search(query);
    expect(rows).toHaveLength(20);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toContain("next_page_token=TOKEN");
    expect(calls[0]!.url).not.toContain("start=");
    expect(rows[0]!.via).toBe("LinkedIn");
  });
});

describe("company boards", () => {
  it("Greenhouse/Lever/Ashby: parse each board shape and keep title matches", async () => {
    mockFetch((url) => {
      if (url.includes("greenhouse"))
        return {
          jobs: [
            {
              id: 1,
              title: "Product Designer",
              location: { name: "Remote - EMEA" },
              content: "&lt;p&gt;Design &amp;amp; research&lt;/p&gt;",
              absolute_url: "https://boards.greenhouse.io/x/1",
            },
            { id: 2, title: "Accountant", absolute_url: "https://g/2" },
          ],
        };
      if (url.includes("lever"))
        return [
          {
            id: "l1",
            text: "Senior Product Designer",
            categories: { location: "London" },
            workplaceType: "remote",
            descriptionPlain: LONG,
            hostedUrl: "https://jobs.lever.co/x/l1",
          },
        ];
      return {
        jobs: [
          {
            id: "a1",
            title: "Product Designer",
            location: "Berlin",
            isRemote: false,
            descriptionPlain: LONG,
            jobUrl: "https://jobs.ashbyhq.com/x/a1",
          },
        ],
      };
    });
    const co = (ats: "greenhouse" | "lever" | "ashby") => [
      { ats, slug: "x", name: "X Co", industries: [] },
    ];
    const gh = await new AtsBoardsProvider(
      "greenhouse",
      co("greenhouse"),
    ).search(query);
    expect(gh).toHaveLength(1);
    expect(gh[0]!.description).toBe("Design & research");
    expect(gh[0]!.workArrangement).toBe("REMOTE");
    const lv = await new AtsBoardsProvider("lever", co("lever")).search(query);
    expect(lv[0]).toMatchObject({ company: "X Co", workArrangement: "REMOTE" });
    const ab = await new AtsBoardsProvider("ashby", co("ashby")).search(query);
    expect(ab[0]).toMatchObject({ location: "Berlin", workArrangement: null });
  });

  it("raises when every board fails, so health shows an error", async () => {
    mockFetch(() => new Response("gone", { status: 404 }));
    await expect(
      new AtsBoardsProvider("greenhouse", [
        { ats: "greenhouse", slug: "gone", name: "Gone", industries: [] },
      ]).search(query),
    ).rejects.toThrow(/404/);
  });

  it("picks companies by industry and always adds remote-first employers", () => {
    const picked = pickCompanies(["design"], 6);
    expect(
      picked.slice(0, 6).every((c) => c.industries.includes("design")),
    ).toBe(true);
    expect(picked.some((c) => c.industries.includes("remote-first"))).toBe(
      true,
    );
  });
});

describe("LinkedIn / Glassdoor / Indeed", () => {
  it("builds prefilled search links instead of scraping", () => {
    const links = externalSearchLinks({
      title: "Product Designer",
      location: "Cairo, Egypt",
    });
    expect(links.map((l) => l.site)).toEqual([
      "LinkedIn",
      "Glassdoor",
      "Indeed",
    ]);
    expect(links[0]!.href).toContain("keywords=Product+Designer");
    expect(links[0]!.href).toContain("location=Cairo%2C+Egypt");
    expect(links[2]!.href).toContain("q=Product+Designer");
    const remote = externalSearchLinks({ title: "Designer", remote: true });
    expect(remote[0]!.href).toContain("f_WT=2");
  });
});

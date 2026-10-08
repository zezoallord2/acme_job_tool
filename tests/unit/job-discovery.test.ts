import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArbeitnowProvider,
  RemoteOkProvider,
  SerpApiGoogleJobsProvider,
  searchJobs,
  type JobSearchProvider,
} from "@/jobs/providers";
import { previewJobFit } from "@/jobs/matching";

afterEach(() => vi.unstubAllGlobals());

const job = {
  externalId: "1",
  provider: "test",
  title: "Data Analyst",
  company: "Acme",
  location: "Remote",
  workArrangement: "REMOTE" as const,
  description:
    "Use SQL, Python and Power BI to build dashboards and explain commercial trends to business teams.",
  sourceUrl: "https://example.test/jobs/1",
  postedAt: null,
  tags: ["analytics"],
};

describe("job discovery", () => {
  it("normalises and filters a public provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  slug: "one",
                  company_name: "Acme",
                  title: "Data Analyst",
                  description: `<p>${job.description}</p>`,
                  remote: true,
                  url: job.sourceUrl,
                  location: "Remote",
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const results = await new ArbeitnowProvider(
      "https://example.test/api",
      "test",
    ).search({ title: "Data Analyst" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      company: "Acme",
      workArrangement: "REMOTE",
    });
    expect(results[0]?.description).not.toContain("<p>");
  });

  it("keeps working providers and reports a failed provider", async () => {
    const working: JobSearchProvider = {
      id: "working",
      search: async () => [job],
    };
    const failing: JobSearchProvider = {
      id: "failing",
      search: async () => {
        throw new Error("offline");
      },
    };
    const result = await searchJobs({ title: "Data Analyst" }, [
      failing,
      working,
    ]);
    expect(result.jobs).toHaveLength(1);
    expect(result.providerErrors).toEqual([
      { provider: "failing", message: "offline" },
    ]);
  });

  it("deduplicates the same vacancy across sources", async () => {
    const a: JobSearchProvider = { id: "a", search: async () => [job] };
    const b: JobSearchProvider = {
      id: "b",
      search: async () => [{ ...job, externalId: "2", provider: "b" }],
    };
    const result = await searchJobs({ title: "Data Analyst" }, [a, b]);
    expect(result.jobs).toHaveLength(1);
  });

  it("explains a match without claiming a hiring probability", () => {
    const fit = previewJobFit(job, {
      query: { title: "Data Analyst", workArrangement: "REMOTE" },
      skills: ["SQL", "Python", "Power BI"],
    });
    expect(fit.label).toBe("Strong match");
    expect(fit.reasons.join(" ")).toContain("SQL");
    expect(fit.reasons.join(" ").toLowerCase()).not.toContain("chance");
  });

  it("parses a real RemoteOK payload and drops unusable rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { legal: "RemoteOK API terms" },
              {
                id: "9001",
                slug: "remote-data-analyst",
                company: "Remote Co",
                position: "Data Analyst",
                description: `<p>${job.description}</p>`,
                location: "Worldwide",
                tags: ["analytics", "remote"],
                url: "https://remoteok.test/e/9001",
                date: "2026-01-02",
              },
              { id: "9002", company: "No title" },
            ]),
            { status: 200 },
          ),
      ),
    );
    const results = await new RemoteOkProvider(
      "https://example.test/remoteok",
    ).search({ title: "Data Analyst" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "remoteok",
      company: "Remote Co",
      workArrangement: "REMOTE",
      location: "Worldwide",
    });
    expect(results[0]?.description).not.toContain("<p>");
    expect(results[0]?.postedAt).toContain("2026-01-02");
  });

  it("parses a SerpAPI Google Jobs payload and drops unusable rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jobs_results: [
                {
                  job_id: "g-100",
                  title: "Data Analyst",
                  company_name: "Serp Co",
                  location: "Remote",
                  description: `<p>${job.description}</p>`,
                  related_links: [
                    { link: "https://jobs.test/g/100", text: "Apply" },
                  ],
                  posted_at: "3 days ago",
                  detected_extensions: {
                    posted_at: "3 days ago",
                    schedule_type: "Full-time",
                    work_from_home: true,
                  },
                },
                {
                  job_id: "g-101",
                  title: "Data Analyst",
                  company_name: "Missing Link Co",
                  description: `${job.description}`,
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const results = await new SerpApiGoogleJobsProvider(
      "test-api-key",
      "https://example.test/serpapi",
    ).search({ title: "Data Analyst" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "google-jobs",
      company: "Serp Co",
      workArrangement: "REMOTE",
      sourceUrl: "https://jobs.test/g/100",
      tags: ["Full-time"],
    });
    expect(results[0]?.description).not.toContain("<p>");
    expect(results[0]?.postedAt).not.toBeNull();
    const age = Date.now() - Date.parse(results[0]!.postedAt!);
    expect(age).toBeGreaterThan(1_000_000);
    expect(age).toBeLessThan(5 * 86_400_000);
  });

  it("is a no-op without an API key", async () => {
    const results = await new SerpApiGoogleJobsProvider(
      "",
      "https://example.test/serpapi",
    ).search({ title: "Data Analyst" });
    expect(results).toEqual([]);
  });
});

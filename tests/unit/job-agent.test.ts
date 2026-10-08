import { afterEach, describe, expect, it } from "vitest";
import {
  deterministicPlan,
  fanOut,
  profileSummary,
  type SearchPlan,
} from "@/jobs/agent";
import { deduplicate, mergeRerank, runPipeline } from "@/jobs/discovery";
import { normalizeTargetLocation } from "@/jobs/location";
import type { DiscoveredJob, JobSearchProvider } from "@/jobs/providers";
import type { JobSearchProfile } from "@/jobs/search-profile";
import { resetEnvCache } from "@/lib/env";
import { __resetRateLimiterForTests } from "@/lib/rate-limit";

/**
 * The search agent pipeline without a network: fake providers stand in for
 * the real sources so fan-out, health reporting, quota guards, dedupe, the
 * location filter and the AI re-rank merge can be checked deterministically.
 */

const profile: JobSearchProfile = {
  userId: "u1",
  primaryTargetRoles: ["Product Designer"],
  adjacentRoles: ["UX Designer", "UI Designer"],
  proposedRoles: [],
  seniority: "Mid",
  industries: ["design"],
  hardSkills: ["User research", "Prototyping"],
  tools: ["Figma"],
  yearsExperience: 4,
  education: [],
  certifications: [],
  languages: ["English"],
  targetCity: "Cairo",
  targetCountry: "Egypt",
  targetCountryCode: "EG",
  workMode: "REMOTE",
  excludedRoles: [],
  preferredKeywords: ["Figma"],
  hasEnoughData: true,
  sources: ["My CV"],
};

function job(provider: string, i: number, extra: Partial<DiscoveredJob> = {}) {
  return {
    externalId: `${provider}-${i}`,
    provider,
    title: "Product Designer",
    company: `${provider} Co ${i}`,
    location: "Remote (worldwide)",
    workArrangement: "REMOTE" as const,
    description:
      "Own product design in Figma, run user research and prototyping for a remote team.",
    sourceUrl: `https://${provider}.test/jobs/${i}`,
    postedAt: null,
    tags: [],
    ...extra,
  } satisfies DiscoveredJob;
}

function fake(
  id: string,
  rows: (title: string) => DiscoveredJob[] | Promise<DiscoveredJob[]>,
  reason: string | null = null,
): JobSearchProvider {
  return {
    id,
    meta: { label: id.toUpperCase(), kind: "keyless" },
    unavailableReason: () => reason,
    search: async (q) => rows(q.title),
  };
}

const plan: SearchPlan = {
  queries: [
    { title: "Product Designer", reason: "target" },
    { title: "UX Designer", reason: "synonym" },
  ],
  companies: [],
  plannedBy: "test",
};

const preference = {
  city: "Cairo",
  region: null,
  country: "Egypt",
  countryCode: "EG",
  workMode: "REMOTE" as const,
};

afterEach(() => {
  delete process.env.SERPAPI_MONTHLY_GLOBAL;
  resetEnvCache();
  __resetRateLimiterForTests();
});

describe("query planning", () => {
  it("falls back to rule-based queries that keep the user's own search first", () => {
    const p = deterministicPlan(profile, "Visual Designer");
    expect(p.queries[0]!.title).toBe("Visual Designer");
    expect(p.queries.map((q) => q.title)).toContain("Product Designer");
    expect(p.queries.length).toBeLessThanOrEqual(8);
    expect(p.plannedBy).toBe("rules");
    expect(p.companies.length).toBeGreaterThan(0);
  });

  it("summarises only facts present in the profile", () => {
    const text = profileSummary(profile);
    expect(text).toContain("Figma");
    expect(text).toContain("Cairo, Egypt");
  });
});

describe("fan-out and provider health", () => {
  it("reports every provider: ok, empty, error and key missing — nothing swallowed", async () => {
    const { jobs, health } = await fanOut({
      plan,
      preference,
      workArrangement: "REMOTE",
      userId: null,
      providers: [
        fake("alpha", (t) => [job("alpha", t.length)]),
        fake("empty", () => []),
        fake("broken", () => {
          throw new Error("HTTP 500");
        }),
        fake("keyed", () => [job("keyed", 1)], "key missing (KEYED_API_KEY)"),
      ],
    });
    const byId = Object.fromEntries(health.map((h) => [h.id, h]));
    expect(byId.alpha).toMatchObject({ status: "ok", count: 2 });
    expect(byId.empty).toMatchObject({ status: "empty", count: 0 });
    expect(byId.broken).toMatchObject({ status: "error", message: "HTTP 500" });
    expect(byId.keyed).toMatchObject({
      status: "skipped",
      message: "key missing (KEYED_API_KEY)",
    });
    expect(jobs.every((j) => j.provider === "alpha")).toBe(true);
  });

  it("times a hung provider out instead of blocking the search", async () => {
    const { health } = await fanOut({
      plan: { ...plan, queries: plan.queries.slice(0, 1) },
      preference,
      workArrangement: "REMOTE",
      userId: null,
      timeoutMs: 50,
      providers: [fake("slow", () => new Promise(() => undefined))],
    });
    expect(health[0]).toMatchObject({ status: "error" });
    expect(health[0]!.message).toMatch(/timed out/);
  });

  it("stops calling Google Jobs when the monthly quota is used up", async () => {
    process.env.SERPAPI_MONTHLY_GLOBAL = "1";
    resetEnvCache();
    let calls = 0;
    const { health } = await fanOut({
      plan,
      preference,
      workArrangement: "REMOTE",
      userId: "u-quota",
      providers: [
        fake("google-jobs", () => {
          calls += 1;
          return [job("google-jobs", calls)];
        }),
      ],
    });
    // Each query costs SERPAPI_PAGES (2) credits; a budget of 1 allows none.
    expect(calls).toBe(0);
    expect(health[0]).toMatchObject({ status: "quota" });
  });
});

describe("pipeline: fan-out → dedupe → location → rank", () => {
  it("returns 50+ results from 5 sources for a remote search", async () => {
    const sources = ["remotive", "himalayas", "jobicy", "greenhouse", "ashby"];
    const { jobs, health } = await fanOut({
      plan,
      preference,
      workArrangement: "REMOTE",
      userId: null,
      providers: sources.map((id) =>
        fake(id, (t) =>
          Array.from({ length: 6 }, (_, i) =>
            job(id, i + (t.startsWith("UX") ? 100 : 0)),
          ),
        ),
      ),
    });
    // The same vacancy listed twice (same URL) is shown once.
    const merged = deduplicate([...jobs, { ...jobs[0]!, provider: "dup" }]);
    const { ranked } = runPipeline({
      jobs: merged,
      profile,
      preference,
      strict: true,
    });
    expect(health.filter((h) => h.status === "ok")).toHaveLength(5);
    expect(ranked.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ranked.map((r) => r.job.provider)).size).toBe(5);
  });

  it("keeps the location filter as a default that widening relaxes", () => {
    const berlin = job("x", 1, {
      location: "Berlin, Germany",
      workArrangement: null,
      sourceUrl: "https://x.test/berlin",
    });
    const onsite = {
      ...preference,
      workMode: "ONSITE" as const,
      ...normalizeTargetLocation("Cairo, Egypt"),
    };
    const strict = runPipeline({
      jobs: [berlin],
      profile,
      preference: onsite,
      strict: true,
    });
    expect(strict.ranked).toHaveLength(0);
    expect(strict.rejectedByLocation).toBe(1);

    const anywhere = runPipeline({
      jobs: [berlin],
      profile,
      preference: {
        city: null,
        region: null,
        country: null,
        countryCode: null,
        workMode: "ANY",
      },
      strict: false,
    });
    expect(anywhere.ranked).toHaveLength(1);
  });

  it("puts AI-ranked rows first with their 'why this fits' line, keeping every row", () => {
    const { ranked } = runPipeline({
      jobs: [job("a", 1), job("b", 2), job("c", 3)],
      profile,
      preference,
      strict: true,
    });
    const merged = mergeRerank(
      ranked,
      new Map([
        ["c:c-3", { fit: 90, why: "Figma and user research match your CV." }],
        ["a:a-1", { fit: 40, why: "Title matches; seniority unclear." }],
      ]),
    );
    expect(merged.map((r) => r.job.provider)).toEqual(["c", "a", "b"]);
    expect(merged[0]!.why).toMatch(/Figma/);
    expect(merged[2]!.why).toBeUndefined();
  });
});

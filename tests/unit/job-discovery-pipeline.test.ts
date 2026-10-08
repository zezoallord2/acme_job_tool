import { describe, expect, it } from "vitest";
import {
  buildPreference,
  decideLocation,
  deduplicate,
  limitResults,
  runPipeline,
} from "@/jobs/discovery";
import { PLAN_LIMITS } from "@/domain/entitlements";
import {
  normalizeJobLocation,
  normalizeTargetLocation,
  type WorkMode,
} from "@/jobs/location";
import type { JobSearchProfile } from "@/jobs/search-profile";
import type { DiscoveredJob } from "@/jobs/providers";

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    externalId: "1",
    provider: "test",
    title: "Data Analyst",
    company: "Acme",
    location: "Cairo, Egypt",
    workArrangement: null,
    description:
      "Use SQL, Excel and Power BI to build dashboards and explain commercial trends.",
    sourceUrl: "https://example.test/jobs/1",
    postedAt: "2026-01-05T00:00:00.000Z",
    tags: ["analytics"],
    ...overrides,
  };
}

const profile: JobSearchProfile = {
  userId: "user-1",
  primaryTargetRoles: ["Data Analyst"],
  adjacentRoles: [],
  proposedRoles: [],
  seniority: null,
  industries: [],
  hardSkills: ["Excel"],
  tools: ["SQL", "Power BI"],
  yearsExperience: 3,
  education: [],
  certifications: [],
  languages: [],
  targetCity: "Cairo",
  targetCountry: "Egypt",
  targetCountryCode: "EG",
  workMode: "ONSITE",
  excludedRoles: [],
  preferredKeywords: ["SQL"],
  hasEnoughData: true,
  sources: ["My CV"],
};

function preference(workMode: WorkMode, city = "Cairo") {
  const target = normalizeTargetLocation(`${city}, Egypt`);
  return {
    city: target.city,
    region: target.region,
    country: target.country,
    countryCode: target.countryCode,
    workMode,
  };
}

describe("jobs for you pipeline", () => {
  it("deduplicates the same vacancy across queries and sources", () => {
    const merged = deduplicate([
      job(),
      job({ externalId: "2", provider: "other" }),
      job({ externalId: "3", sourceUrl: "https://example.test/jobs/1?v=2" }),
      job({
        externalId: "4",
        title: "Data Engineer",
        sourceUrl: "https://example.test/jobs/4",
      }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((row) => row.title)).toEqual([
      "Data Analyst",
      "Data Engineer",
    ]);
  });

  it("removes wrong-country jobs before any scoring happens", () => {
    const result = runPipeline({
      jobs: [
        job(),
        job({
          externalId: "2",
          title: "Data Analyst",
          location: "Berlin, Germany",
          sourceUrl: "https://example.test/jobs/2",
        }),
        job({
          externalId: "3",
          title: "Data Analyst",
          location: "London, UK",
          sourceUrl: "https://example.test/jobs/3",
        }),
        job({
          externalId: "4",
          title: "Data Analyst",
          location: "New York, United States",
          sourceUrl: "https://example.test/jobs/4",
        }),
      ],
      profile,
      preference: preference("ONSITE"),
      strict: true,
    });

    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]?.job.location).toBe("Cairo, Egypt");
    expect(result.rejectedByLocation).toBe(3);
    // Every survivor is confirmed, not merely tolerated.
    expect(result.ranked[0]?.locationMatch.status).toBe("MATCH");
  });

  it("holds back jobs whose office location cannot be confirmed in strict mode", () => {
    const strict = runPipeline({
      jobs: [job({ location: "Egypt" }), job({ location: "Giza, Egypt" })],
      profile,
      preference: preference("ONSITE"),
      strict: true,
    });
    expect(strict.ranked).toHaveLength(1);
    expect(strict.ranked[0]?.job.location).toBe("Giza, Egypt");
    expect(strict.unclearLocation).toBe(1);

    const relaxed = runPipeline({
      jobs: [job({ location: "Egypt" }), job({ location: "Giza, Egypt" })],
      profile,
      preference: preference("ONSITE"),
      strict: false,
    });
    expect(relaxed.ranked).toHaveLength(2);
    expect(relaxed.unclearLocation).toBe(1);
  });

  it("keeps worldwide and Egypt remote roles but rejects locked-down regions", () => {
    const remoteProfile: JobSearchProfile = {
      ...profile,
      workMode: "REMOTE",
      targetCity: null,
    };
    const result = runPipeline({
      jobs: [
        job({ location: "Remote", workArrangement: "REMOTE" }),
        job({
          externalId: "2",
          location: "Remote - Egypt",
          workArrangement: "REMOTE",
          sourceUrl: "https://example.test/jobs/2",
        }),
        job({
          externalId: "3",
          location: "Remote - Germany only",
          workArrangement: "REMOTE",
          sourceUrl: "https://example.test/jobs/3",
        }),
        job({
          externalId: "4",
          location: "Remote",
          workArrangement: "REMOTE",
          tags: ["eu", "europe"],
          sourceUrl: "https://example.test/jobs/4",
        }),
      ],
      profile: remoteProfile,
      preference: preference("REMOTE", ""),
      strict: true,
    });

    // The confirmed-Egypt remote role scores the location credit above the
    // unqualified "Remote" one, so it ranks first.
    expect(result.ranked.map((row) => row.job.location)).toEqual([
      "Remote - Egypt",
      "Remote",
    ]);
    expect(result.rejectedByLocation).toBe(2);
  });

  it("ranks the strongest profile match first", () => {
    const result = runPipeline({
      jobs: [
        job({
          externalId: "weak",
          title: "Warehouse Assistant",
          description: "General duties in a busy warehouse.",
          sourceUrl: "https://example.test/jobs/weak",
        }),
        job({
          externalId: "strong",
          title: "Senior Data Analyst",
          description:
            "SQL, Power BI and Excel reporting for commercial teams.",
          sourceUrl: "https://example.test/jobs/strong",
        }),
      ],
      profile,
      preference: preference("ONSITE"),
      strict: true,
    });

    expect(result.ranked[0]?.job.externalId).toBe("strong");
    expect(result.ranked[0]?.fit.score).toBeGreaterThan(
      result.ranked[1]?.fit.score ?? 0,
    );
  });

  it("keeps ranking stable: score, then recency, then title", () => {
    const a = job({
      externalId: "a",
      sourceUrl: "https://example.test/jobs/a",
      postedAt: "2026-01-01T00:00:00.000Z",
    });
    const b = job({
      externalId: "b",
      sourceUrl: "https://example.test/jobs/b",
      postedAt: "2026-01-09T00:00:00.000Z",
    });
    const result = runPipeline({
      jobs: [a, b],
      profile,
      preference: preference("ONSITE"),
      strict: true,
    });
    expect(result.ranked[0]?.job.externalId).toBe("b");
  });

  it("widens only the geography when the area is the whole country", () => {
    const cityPref = buildPreference(profile, {});
    expect(cityPref.city).toBe("Cairo");

    const countryPref = buildPreference(profile, { area: "country" });
    expect(countryPref.city).toBeNull();
    expect(countryPref.countryCode).toBe("EG");
  });

  it("lets a manual work-style override reach the preference", () => {
    const override = buildPreference(profile, { workMode: "REMOTE" });
    expect(override.workMode).toBe("REMOTE");
    expect(buildPreference(profile, {}).workMode).toBe("ONSITE");
  });

  it("never hides results behind a plan", () => {
    // Job search shows every match on every plan; paging is a UI concern.
    expect("jobsForYouResults" in PLAN_LIMITS.FREE).toBe(false);
    const rows = Array.from({ length: 12 }, (_, index) => index);
    expect(limitResults(rows, Number.POSITIVE_INFINITY)).toHaveLength(12);
  });

  it("drops the place entirely when widened to any location", () => {
    const anywhere = buildPreference(profile, { area: "any" });
    expect(anywhere.city).toBeNull();
    expect(anywhere.countryCode).toBeNull();
  });

  it("keeps a Cairo profile free of Germany jobs even with Any work style", () => {
    // Regression: the real user's profile is "Cairo, Egypt" with no work-style
    // preference. "Any" previously disabled the location check entirely, so
    // Berlin listings slipped through the strict filter.
    const anyProfile: JobSearchProfile = {
      ...profile,
      workMode: "ANY",
    };
    const anyPref = buildPreference(anyProfile, {});
    expect(anyPref.workMode).toBe("ANY");

    const result = runPipeline({
      jobs: [
        job(),
        job({
          externalId: "2",
          title: "Security Analyst",
          location: "Berlin, Germany",
          sourceUrl: "https://example.test/jobs/2",
        }),
        job({
          externalId: "3",
          title: "Security Analyst",
          location: "Remote",
          workArrangement: "REMOTE",
          sourceUrl: "https://example.test/jobs/3",
        }),
        job({
          externalId: "4",
          title: "Security Analyst",
          location: "Leipzig, Germany",
          sourceUrl: "https://example.test/jobs/4",
        }),
      ],
      profile: anyProfile,
      preference: anyPref,
      strict: true,
    });

    // Cairo job and the worldwide remote role survive; both Germany roles are gone.
    expect(result.ranked.map((row) => row.job.location)).toEqual([
      "Cairo, Egypt",
      "Remote",
    ]);
    expect(result.rejectedByLocation).toBe(2);
  });

  it("treats Any as a pure ranking signal only when strict is turned off", () => {
    const anyProfile: JobSearchProfile = { ...profile, workMode: "ANY" };
    const anyPref = buildPreference(anyProfile, {});
    const result = runPipeline({
      jobs: [job({ location: "Berlin, Germany" }), job()],
      profile: anyProfile,
      preference: anyPref,
      strict: false,
    });
    // Nothing is blocked; the location is deliberately not a hard wall here.
    expect(result.ranked).toHaveLength(2);
    expect(result.rejectedByLocation).toBe(0);
  });

  it("resolves Any+strict per job mode through decideLocation", () => {
    const anyPref = buildPreference({ ...profile, workMode: "ANY" }, {});
    const remoteJob = normalizeJobLocation({
      location: "Remote",
      workArrangement: "REMOTE",
    });
    const officeJob = normalizeJobLocation({ location: "Berlin, Germany" });
    const cairoOffice = normalizeJobLocation({
      location: "Giza, Egypt",
    });
    const germanyRemote = normalizeJobLocation({
      location: "Remote - Germany",
      workArrangement: "REMOTE",
    });

    expect(decideLocation(remoteJob, anyPref, true).status).toBe("UNKNOWN");
    expect(decideLocation(officeJob, anyPref, true).status).toBe("REJECTED");
    expect(decideLocation(cairoOffice, anyPref, true).status).toBe("MATCH");
    expect(decideLocation(germanyRemote, anyPref, true).status).toBe(
      "REJECTED",
    );
  });
});

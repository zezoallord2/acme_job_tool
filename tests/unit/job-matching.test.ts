import { describe, expect, it } from "vitest";
import { scoreJobAgainstProfile, type ProfileSignals } from "@/jobs/matching";
import type { DiscoveredJob } from "@/jobs/providers";

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    externalId: "1",
    provider: "test",
    title: "Data Analyst",
    company: "Acme",
    location: "Cairo, Egypt",
    workArrangement: null,
    description: "Use SQL and Excel to build dashboards for commercial teams.",
    sourceUrl: "https://example.test/jobs/1",
    postedAt: null,
    tags: [],
    ...overrides,
  };
}

const profile: ProfileSignals = {
  primaryTargetRoles: ["Data Analyst"],
  adjacentRoles: [],
  hardSkills: [],
  tools: ["SQL", "Excel", "Power BI"],
  industries: ["Retail"],
  seniority: "Mid",
  yearsExperience: 3,
  education: ["BSc, Computer Science"],
  certifications: [],
  languages: [],
};

describe("profile-based job fit", () => {
  it("labels a matching role with skills as a strong match", () => {
    const fit = scoreJobAgainstProfile(
      job({
        title: "Data Analyst - Retail",
        description:
          "SQL and Excel reporting for a retail business, Power BI dashboards.",
      }),
      profile,
      { locationStatus: "MATCH" },
    );

    expect(fit.label).toBe("Strong Match");
    expect(fit.reasons.length).toBeGreaterThanOrEqual(2);
    expect(fit.reasons.length).toBeLessThanOrEqual(4);
    expect(fit.reasons.join(" ")).toContain("SQL");
    expect(fit.reasons.join(" ").toLowerCase()).toContain("location");
    expect(fit.reasons.join(" ").toLowerCase()).not.toContain("chance");
    expect(fit.reasons.join(" ").toLowerCase()).not.toContain("probability");
    expect(fit.gaps).toEqual([]);
  });

  it("keeps at least two reasons even for a weak job", () => {
    const fit = scoreJobAgainstProfile(
      job({
        title: "Warehouse Operative",
        description: "Physical roles in a busy warehouse environment.",
      }),
      profile,
      { locationStatus: "MATCH" },
    );
    expect(fit.label).toBe("Stretch");
    expect(fit.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("names hard requirements the profile does not hold", () => {
    const fit = scoreJobAgainstProfile(
      job({
        title: "Senior Financial Analyst",
        description:
          "The role requires a CPA certification and an active security clearance. Fluency in German is required.",
      }),
      profile,
      { locationStatus: "UNKNOWN" },
    );

    expect(fit.gaps.length).toBeGreaterThanOrEqual(1);
    expect(fit.gaps.length).toBeLessThanOrEqual(3);
    expect(fit.gaps.join(" ")).toContain("CPA");
    expect(fit.gaps.every((gap) => gap.startsWith("Important gap:"))).toBe(
      true,
    );
  });

  it("does not flag requirements the profile already satisfies", () => {
    const fit = scoreJobAgainstProfile(
      job({
        title: "Data Analyst",
        description:
          "SQL reporting. A completed degree is preferred. Fluent in Arabic.",
      }),
      {
        ...profile,
        certifications: ["CPA"],
        languages: ["Arabic (Native)"],
      },
      { locationStatus: "MATCH" },
    );
    expect(fit.gaps.join(" ")).not.toContain("Arabic");
    expect(fit.gaps.join(" ")).not.toContain("degree");
    expect(fit.gaps.join(" ")).not.toContain("CPA");
  });

  it("asks for more experience than the profile states, as a gap", () => {
    const fit = scoreJobAgainstProfile(
      job({
        title: "Data Analyst",
        description: "SQL reporting with 6+ years of commercial experience.",
      }),
      { ...profile, yearsExperience: 3 },
      { locationStatus: "MATCH" },
    );
    expect(fit.gaps.join(" ")).toContain("6 years");
  });

  it("penalises a seniority clash instead of hiding it", () => {
    const fit = scoreJobAgainstProfile(
      job({ title: "Junior Data Analyst", description: "SQL and Excel work." }),
      { ...profile, seniority: "Senior" },
      { locationStatus: "MATCH" },
    );
    const withoutClash = scoreJobAgainstProfile(
      job({ title: "Senior Data Analyst", description: "SQL and Excel work." }),
      { ...profile, seniority: "Senior" },
      { locationStatus: "MATCH" },
    );
    expect(fit.score).toBeLessThan(withoutClash.score);
  });

  it("gives no location credit when eligibility is unconfirmed", () => {
    const confirmed = scoreJobAgainstProfile(job(), profile, {
      locationStatus: "MATCH",
    });
    const unclear = scoreJobAgainstProfile(job(), profile, {
      locationStatus: "UNKNOWN",
    });
    expect(confirmed.score).toBeGreaterThan(unclear.score);
  });
});

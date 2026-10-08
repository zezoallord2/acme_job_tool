import { describe, expect, it } from "vitest";
import {
  buildJobSearchProfile,
  deriveRoles,
  generateQueries,
  workModeOf,
  type ProfileRows,
} from "@/jobs/search-profile";

function rows(overrides: Partial<ProfileRows> = {}): ProfileRows {
  return {
    career: null,
    targetRoles: [],
    profile: null,
    skills: [],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
    projects: [],
    ...overrides,
  };
}

const cvRows = rows({
  career: {
    targetRolePrimary: "Data Analyst",
    targetRoleSecondary: null,
    targetIndustry: "Retail",
    yearsExperience: 3,
  },
  profile: {
    locationCity: "Cairo",
    locationCountry: "Egypt",
    workArrangement: "ON_SITE",
  },
  skills: [
    { name: "Excel", category: "Tools", isCore: true },
    { name: "SQL", category: "Tools", isCore: true },
    {
      name: "Stakeholder communication",
      category: "Soft skills",
      isCore: false,
    },
  ],
  employment: [
    {
      jobTitle: "Reporting Analyst",
      description: "Built weekly reports in Excel and SQL",
      highlights: [],
    },
  ],
  education: [{ degree: "BSc", fieldOfStudy: "Computer Science" }],
  certifications: [
    { name: "Google Data Analytics", isMandatoryForAnyRole: false },
  ],
  languages: [{ name: "Arabic", proficiency: "Native" }],
  projects: [{ name: "Sales dashboard", techStack: ["Power BI"], role: null }],
});

describe("job search profile", () => {
  it("builds the profile from stored records only", () => {
    const profile = buildJobSearchProfile("user-1", cvRows);

    expect(profile.primaryTargetRoles).toEqual(["Data Analyst"]);
    expect(profile.seniority).toBe("Mid");
    expect(profile.industries).toEqual(["Retail"]);
    expect(profile.tools).toContain("Excel");
    expect(profile.tools).toContain("Power BI");
    expect(profile.hardSkills).toContain("Stakeholder communication");
    expect(profile.education).toEqual(["BSc, Computer Science"]);
    expect(profile.certifications).toEqual(["Google Data Analytics"]);
    expect(profile.languages).toEqual(["Arabic (Native)"]);
    expect(profile.targetCity).toBe("Cairo");
    expect(profile.targetCountryCode).toBe("EG");
    expect(profile.workMode).toBe("ONSITE");
    expect(profile.hasEnoughData).toBe(true);
    expect(profile.sources).toContain("My CV");
    expect(profile.sources).toContain("Job Goals");
  });

  it("searches evidence-backed roles when no explicit goal was set", () => {
    const design = buildJobSearchProfile(
      "user-1",
      rows({
        skills: [{ name: "Figma", category: null, isCore: true }],
      }),
    );
    expect(design.primaryTargetRoles).toEqual([
      "UI Designer",
      "Graphic Designer",
    ]);
    expect(design.sources).toContain("Suggested from your CV");
    expect(design.hasEnoughData).toBe(true);

    const queries = generateQueries(design, 3);
    expect(queries[0]?.title).toBe("UI Designer");
    expect(queries[1]?.title).toBe("Graphic Designer");
  });

  it("turns evidence into chosen, proposed and adjacent roles", () => {
    const chosen = deriveRoles(cvRows);
    expect(chosen.chosen).toEqual(["Data Analyst"]);
    // Reporting experience supports the analyst family, nothing else.
    expect(chosen.adjacent.join("|")).toContain("Reporting Analyst");
    expect(chosen.proposed).toEqual([]);
  });

  it("generates several sensible queries within the limit", () => {
    const profile = buildJobSearchProfile("user-1", cvRows);
    const queries = generateQueries(profile, 4);

    expect(queries[0]?.title).toBe("Data Analyst");
    expect(queries.length).toBeGreaterThan(1);
    expect(queries.length).toBeLessThanOrEqual(4);
    expect(new Set(queries.map((query) => query.title)).size).toBe(
      queries.length,
    );
    // Nothing outside the profile's role family appears.
    const allowed = [...profile.primaryTargetRoles, ...profile.adjacentRoles];
    for (const query of queries) {
      if (query.title.startsWith("Mid ")) continue;
      expect(allowed).toContain(query.title);
    }
  });

  it("falls back to skill words only when even the evidence has no role", () => {
    const profile = buildJobSearchProfile(
      "user-1",
      rows({
        skills: [
          { name: "XenializedRequestHandler", category: null, isCore: true },
        ],
      }),
    );
    expect(profile.primaryTargetRoles).toEqual([]);
    const queries = generateQueries(profile, 3);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]?.title).toBe("XenializedRequestHandler");
  });

  it("maps stored work arrangements onto the location vocabulary", () => {
    expect(workModeOf("ON_SITE")).toBe("ONSITE");
    expect(workModeOf("REMOTE")).toBe("REMOTE");
    expect(workModeOf("HYBRID")).toBe("HYBRID");
    expect(workModeOf("NO_PREFERENCE")).toBe("ANY");
    expect(workModeOf(undefined)).toBe("ANY");
  });
});

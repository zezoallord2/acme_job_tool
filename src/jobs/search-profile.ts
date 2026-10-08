import { prisma } from "@/lib/db";
import { normalizeTargetLocation, type WorkMode } from "@/jobs/location";

/**
 * Deterministic, evidence-only description of what the user is looking for.
 *
 * Everything here is derived from records the user actually has: CV/profile
 * import, employment history, skills, projects, education, certifications,
 * languages and Job Goals. Nothing is invented, and no model call is required
 * for the search to work — AI can propose alternative target roles on top of
 * this structure, but it never writes into it silently.
 */
export interface JobSearchProfile {
  userId: string;
  /** Roles the user chose (Job Goals / target roles). */
  primaryTargetRoles: string[];
  /** Roles the evidence supports as a next step. Used for extra queries. */
  adjacentRoles: string[];
  /** Proposed roles when the user has evidence but has not chosen a target. */
  proposedRoles: string[];
  seniority: "Junior" | "Mid" | "Senior" | null;
  industries: string[];
  hardSkills: string[];
  tools: string[];
  yearsExperience: number | null;
  education: string[];
  certifications: string[];
  languages: string[];
  targetCity: string | null;
  targetCountry: string | null;
  targetCountryCode: string | null;
  workMode: WorkMode;
  excludedRoles: string[];
  preferredKeywords: string[];
  /** False when there is not enough profile to run a useful automatic search. */
  hasEnoughData: boolean;
  /** What the profile was built from, for the "Based on" chips. */
  sources: string[];
}

export interface ProfileRows {
  career: {
    targetRolePrimary: string | null;
    targetRoleSecondary: string | null;
    targetIndustry: string | null;
    yearsExperience: number | null;
  } | null;
  targetRoles: Array<{
    title: string;
    industry: string | null;
    archivedAt: Date | null;
  }>;
  profile: {
    locationCity: string | null;
    locationCountry: string | null;
    workArrangement: string;
  } | null;
  skills: Array<{ name: string; category: string | null; isCore: boolean }>;
  employment: Array<{
    jobTitle: string;
    description: string | null;
    highlights: string[];
  }>;
  education: Array<{ degree: string | null; fieldOfStudy: string | null }>;
  certifications: Array<{ name: string; isMandatoryForAnyRole: boolean }>;
  languages: Array<{ name: string; proficiency: string | null }>;
  projects: Array<{ name: string; techStack: string[]; role: string | null }>;
}

export async function loadProfileRows(userId: string): Promise<ProfileRows> {
  const [
    career,
    targetRoles,
    profile,
    skills,
    employment,
    education,
    certifications,
    languages,
    projects,
  ] = await Promise.all([
    prisma.careerMasterProfile.findUnique({
      where: { userId },
      select: {
        targetRolePrimary: true,
        targetRoleSecondary: true,
        targetIndustry: true,
        yearsExperience: true,
      },
    }),
    prisma.targetRole.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { title: true, industry: true, archivedAt: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        locationCity: true,
        locationCountry: true,
        workArrangement: true,
      },
    }),
    prisma.skill.findMany({
      where: { userId },
      orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }],
      select: { name: true, category: true, isCore: true },
    }),
    prisma.employmentRecord.findMany({
      where: { userId },
      orderBy: [{ startDate: "desc" }],
      select: { jobTitle: true, description: true, highlights: true },
    }),
    prisma.educationRecord.findMany({
      where: { userId },
      orderBy: [{ endDate: "desc" }],
      select: { degree: true, fieldOfStudy: true },
    }),
    prisma.certification.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }],
      select: { name: true, isMandatoryForAnyRole: true },
    }),
    prisma.languageRecord.findMany({
      where: { userId },
      select: { name: true, proficiency: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }],
      select: { name: true, techStack: true, role: true },
    }),
  ]);

  return {
    career,
    targetRoles,
    profile,
    skills,
    employment,
    education,
    certifications,
    languages,
    projects,
  };
}

/**
 * Skill / history evidence → roles that evidence actually supports.
 * A row only fires when the user's own records contain one of its keywords, so
 * the output can never exceed what the profile says.
 */
const EVIDENCE_ROLE_MAP: Array<{ keywords: string[]; roles: string[] }> = [
  {
    keywords: [
      "customer support",
      "customer service",
      "crm",
      "ticketing",
      "zendesk",
      "intercom",
      "client communication",
      "call center",
    ],
    roles: [
      "Customer Success Specialist",
      "Customer Support Specialist",
      "Client Services Associate",
    ],
  },
  {
    keywords: [
      "excel",
      "sql",
      "reporting",
      "dashboard",
      "analytics",
      "power bi",
      "tableau",
      "statistics",
      "data",
    ],
    roles: ["Data Analyst", "Reporting Analyst", "Business Analyst"],
  },
  {
    keywords: [
      "javascript",
      "typescript",
      "react",
      "node",
      "html",
      "css",
      "frontend",
      "web development",
    ],
    roles: ["Frontend Developer", "Web Developer"],
  },
  {
    keywords: ["python", "machine learning", "etl", "pipelines", "pandas"],
    roles: ["Data Analyst", "Junior Data Analyst"],
  },
  {
    keywords: [
      "accounting",
      "bookkeeping",
      "invoice",
      "reconciliation",
      "ledger",
      "payable",
      "receivable",
      "tax",
    ],
    roles: ["Accounts Payable Specialist", "Junior Accountant"],
  },
  {
    keywords: [
      "cybersecurity",
      "security",
      "soc",
      "siem",
      "pentest",
      "incident response",
      "information security",
    ],
    roles: ["Security Analyst", "SOC Analyst"],
  },
  {
    keywords: [
      "marketing",
      "seo",
      "social media",
      "campaign",
      "advertising",
      "content",
    ],
    roles: ["Digital Marketing Specialist", "Marketing Coordinator"],
  },
  {
    keywords: [
      "figma",
      "ui ",
      "ux",
      "graphic design",
      "photoshop",
      "illustrator",
    ],
    roles: ["UI Designer", "Graphic Designer"],
  },
  {
    keywords: [
      "project management",
      "jira",
      "agile",
      "scrum",
      "sprint planning",
    ],
    roles: ["Project Coordinator", "Project Manager"],
  },
  {
    keywords: [
      "recruit",
      "hiring",
      "onboarding",
      "hr ",
      "human resources",
      "payroll",
    ],
    roles: ["Recruitment Coordinator", "HR Assistant"],
  },
  {
    keywords: [
      "sales",
      "lead generation",
      "pipeline",
      "account management",
      "b2b",
    ],
    roles: ["Sales Executive", "Account Executive"],
  },
  {
    keywords: [
      "logistics",
      "supply chain",
      "inventory",
      "warehouse",
      "procurement",
    ],
    roles: ["Logistics Coordinator", "Supply Chain Analyst"],
  },
  {
    keywords: ["technical writing", "copywriting", "editing", "documentation"],
    roles: ["Technical Writer", "Content Writer"],
  },
];

const KNOWN_TOOLS = new Set(
  [
    "excel",
    "power bi",
    "tableau",
    "sql",
    "python",
    "r",
    "javascript",
    "typescript",
    "react",
    "node",
    "node.js",
    "html",
    "css",
    "figma",
    "photoshop",
    "jira",
    "salesforce",
    "hubspot",
    "sap",
    "zendesk",
    "intercom",
    "google analytics",
    "aws",
    "azure",
    "git",
    "docker",
    "linux",
    "word",
    "powerpoint",
    "outlook",
    "slack",
    "notion",
    "qlik",
    "ssis",
    "vba",
  ].map((tool) => tool.toLowerCase()),
);

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function seniorityFromYears(
  years: number | null,
): JobSearchProfile["seniority"] {
  if (years === null || Number.isNaN(years)) return null;
  if (years < 2) return "Junior";
  if (years < 5) return "Mid";
  return "Senior";
}

export function deriveRoles(rows: ProfileRows): {
  chosen: string[];
  proposed: string[];
  adjacent: string[];
} {
  const chosen = [
    rows.career?.targetRolePrimary,
    rows.career?.targetRoleSecondary,
    ...rows.targetRoles.map((role) => role.title),
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());

  const chosenSet = new Set(chosen.map(norm));

  const haystack = [
    ...rows.employment.flatMap((job) => [
      job.jobTitle,
      job.description ?? "",
      ...job.highlights,
    ]),
    ...rows.skills.map((skill) => `${skill.name} ${skill.category ?? ""}`),
    ...rows.projects.flatMap((project) => [
      project.name,
      project.role ?? "",
      ...project.techStack,
    ]),
  ]
    .map(norm)
    .join(" | ");

  const proposed: string[] = [];
  const adjacentPool: string[] = [];
  for (const rule of EVIDENCE_ROLE_MAP) {
    if (!rule.keywords.some((keyword) => haystack.includes(keyword))) continue;
    for (const role of rule.roles) {
      if (chosenSet.has(norm(role))) continue;
      if (proposed.includes(role) && adjacentPool.includes(role)) continue;
      if (chosen.length === 0) {
        if (!proposed.includes(role)) proposed.push(role);
      } else if (!adjacentPool.includes(role)) {
        adjacentPool.push(role);
      }
    }
  }

  // Employment titles are real evidence: they become adjacent search targets
  // when the user already picked a different goal.
  const titles = rows.employment
    .map((job) => job.jobTitle.trim())
    .filter(Boolean)
    .filter((title) => !chosenSet.has(norm(title)));
  for (const title of titles) {
    if (!adjacentPool.includes(title)) adjacentPool.push(title);
  }

  return {
    chosen: [...new Set(chosen)],
    proposed: [...new Set(proposed)],
    adjacent: [...new Set(adjacentPool)],
  };
}

export function workModeOf(arrangement: string | null | undefined): WorkMode {
  switch ((arrangement ?? "").toUpperCase()) {
    case "REMOTE":
      return "REMOTE";
    case "HYBRID":
      return "HYBRID";
    case "ON_SITE":
    case "ONSITE":
      return "ONSITE";
    default:
      return "ANY";
  }
}

/** Builds the search profile from stored records only. No AI, no network. */
export function buildJobSearchProfile(
  userId: string,
  rows: ProfileRows,
): JobSearchProfile {
  const { chosen, proposed, adjacent } = deriveRoles(rows);

  // No explicit job goal is fine: evidence-backed proposals become the primary
  // targets (a Security Analyst who never "chose" a role still searches for it).
  const activeTargets = chosen.length ? chosen : proposed;

  const skillNames = rows.skills
    .map((skill) => skill.name.trim())
    .filter(Boolean);
  const projectTools = rows.projects.flatMap((project) => project.techStack);
  const allSkills = [...new Set([...skillNames, ...projectTools])];

  const tools = allSkills.filter((skill) => KNOWN_TOOLS.has(norm(skill)));
  const hardSkills = allSkills.filter((skill) => !KNOWN_TOOLS.has(norm(skill)));

  const target = normalizeTargetLocation(
    [rows.profile?.locationCity, rows.profile?.locationCountry]
      .filter(Boolean)
      .join(", ") || null,
  );

  const education = rows.education
    .map((record) =>
      [record.degree, record.fieldOfStudy].filter(Boolean).join(", "),
    )
    .filter(Boolean);

  const sources: string[] = [];
  if (rows.employment.length || rows.skills.length || rows.projects.length)
    sources.push("My CV");
  if (chosen.length) sources.push("Job Goals");
  if (proposed.length && !chosen.length) sources.push("Suggested from your CV");
  if (rows.profile?.locationCity || rows.profile?.locationCountry) {
    sources.push(
      [rows.profile.locationCity, rows.profile.locationCountry]
        .filter(Boolean)
        .join(", "),
    );
  }
  if (
    rows.profile?.workArrangement &&
    rows.profile.workArrangement !== "NO_PREFERENCE"
  ) {
    sources.push(workModeLabel(workModeOf(rows.profile.workArrangement)));
  }

  const hasEnoughData =
    chosen.length > 0 ||
    proseLen(proposed) > 0 ||
    rows.employment.length > 0 ||
    rows.skills.length >= 3 ||
    rows.education.length > 0;

  return {
    userId,
    primaryTargetRoles: activeTargets,
    adjacentRoles: adjacent.slice(0, 6),
    proposedRoles: proposed.slice(0, 4),
    seniority: seniorityFromYears(rows.career?.yearsExperience ?? null),
    industries: [
      ...new Set(
        [
          rows.career?.targetIndustry,
          ...rows.targetRoles.map((role) => role.industry),
        ]
          .filter((value): value is string => Boolean(value && value.trim()))
          .map((value) => value.trim()),
      ),
    ],
    hardSkills: hardSkills.slice(0, 20),
    tools: tools.slice(0, 12),
    yearsExperience: rows.career?.yearsExperience ?? null,
    education,
    certifications: rows.certifications.map((record) => record.name),
    languages: rows.languages.map((record) =>
      record.proficiency
        ? `${record.name} (${record.proficiency})`
        : record.name,
    ),
    targetCity: target.city,
    targetCountry: target.country,
    targetCountryCode: target.countryCode,
    workMode: workModeOf(rows.profile?.workArrangement),
    excludedRoles: [],
    preferredKeywords: allSkills.slice(0, 6),
    hasEnoughData,
    sources,
  };
}

function proseLen(values: string[]): number {
  return values.reduce((total, value) => total + value.length, 0);
}

export function workModeLabel(mode: WorkMode): string {
  switch (mode) {
    case "ONSITE":
      return "On-site";
    case "HYBRID":
      return "Hybrid";
    case "REMOTE":
      return "Remote";
    default:
      return "Any";
  }
}

export interface GeneratedQuery {
  title: string;
  keywords: string[];
  /** Why this query exists — shown in internal diagnostics only. */
  reason: string;
}

/**
 * Several sensible queries instead of one literal title. Every query traces
 * back to a profile field; no unrelated role drift is generated.
 */
export function generateQueries(
  profile: JobSearchProfile,
  limit: number,
): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];
  const seen = new Set<string>();
  const push = (
    title: string,
    reason: string,
    keywords: string[] = profile.preferredKeywords,
  ) => {
    const key = norm(title);
    if (!title.trim() || seen.has(key) || queries.length >= limit) return;
    seen.add(key);
    queries.push({ title: title.trim(), keywords, reason });
  };

  const coreKeywords = [...profile.tools, ...profile.hardSkills].slice(0, 5);

  for (const role of profile.primaryTargetRoles)
    push(role, "Chosen target role");

  if (profile.seniority === "Junior" || profile.seniority === "Senior") {
    const primary = profile.primaryTargetRoles[0];
    if (primary && profile.seniority)
      push(
        `${profile.seniority} ${primary}`,
        `${profile.seniority} level evidence`,
      );
  }

  for (const role of profile.adjacentRoles) {
    if (queries.length >= limit) break;
    push(role, "Supported by your experience");
  }

  if (queries.length === 0) {
    // No role evidence at all: fall back to the strongest skill words so the
    // search still returns something real rather than an empty screen.
    for (const skill of coreKeywords) {
      if (queries.length >= limit) break;
      push(skill, "Derived from your skills");
    }
  }

  return queries;
}

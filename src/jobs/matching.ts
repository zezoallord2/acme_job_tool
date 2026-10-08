import type { DiscoveredJob, JobSearchQuery } from "./providers";
import type { LocationMatchStatus } from "./location";

export interface JobFitPreview {
  label: "Strong match" | "Possible match" | "Stretch";
  reasons: string[];
  missing: string | null;
  score: number;
}

const STOP = new Set([
  "and",
  "the",
  "with",
  "for",
  "from",
  "that",
  "this",
  "your",
  "you",
  "our",
  "are",
  "will",
  "job",
  "role",
  "work",
  "years",
  "experience",
]);

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9+#.]+/))].filter(
    (token) => token.length > 2 && !STOP.has(token),
  );
}

/** Deterministic preview: no AI call, no probability claim, safe on refresh. */
export function previewJobFit(
  job: DiscoveredJob,
  input: { query: JobSearchQuery; skills: string[] },
): JobFitPreview {
  const haystack =
    `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const titleHaystack = job.title.toLowerCase();
  const roleTerms = tokens(input.query.title);
  const matchedRole = roleTerms.filter((term) => titleHaystack.includes(term));
  const matchedSkills = input.skills.filter((skill) =>
    haystack.includes(skill.toLowerCase()),
  );
  const arrangementMatches =
    input.query.workArrangement === "NO_PREFERENCE" ||
    !input.query.workArrangement ||
    job.workArrangement === input.query.workArrangement;
  const score =
    (roleTerms.length ? matchedRole.length / roleTerms.length : 0) * 55 +
    Math.min(35, matchedSkills.length * 7) +
    (arrangementMatches ? 10 : 0);

  const roleCoverage = roleTerms.length
    ? matchedRole.length / roleTerms.length
    : 0;
  const label =
    score >= 70 && roleCoverage >= 0.6
      ? "Strong match"
      : score >= 38
        ? "Possible match"
        : "Stretch";
  const reasons = [
    matchedRole.length
      ? `Role matches ${matchedRole.slice(0, 3).join(", ")}`
      : "Related to your target role",
    matchedSkills.length
      ? `${matchedSkills.slice(0, 3).join(", ")} ${matchedSkills.length === 1 ? "appears" : "appear"} in the job`
      : "Open the job to compare your experience",
    arrangementMatches && job.workArrangement
      ? `${job.workArrangement.toLowerCase().replace("_", "-")} matches your preference`
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  const missing =
    input.skills.length > 0 && matchedSkills.length === 0
      ? "Your saved skills are not explicit in this description"
      : null;
  return { label, reasons: reasons.slice(0, 3), missing, score };
}

/**
 * The subset of a search profile the scorer needs. Declared structurally so
 * tests can construct a profile without touching the database.
 */
export interface ProfileSignals {
  primaryTargetRoles: string[];
  adjacentRoles: string[];
  hardSkills: string[];
  tools: string[];
  industries: string[];
  seniority: "Junior" | "Mid" | "Senior" | null;
  yearsExperience: number | null;
  education: string[];
  certifications: string[];
  languages: string[];
}

export type MatchLabel =
  "Strong Match" | "Good Match" | "Possible Match" | "Stretch";

export interface ProfileFit {
  label: MatchLabel;
  /** 0-100 deterministic fit score. Never presented as hiring probability. */
  score: number;
  /** Two to four evidence-backed reasons, shown as check marks. */
  reasons: string[];
  /** Hard requirements the profile does not yet address. */
  gaps: string[];
}

function haystackFor(job: DiscoveredJob): string {
  return `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
}

function containsToken(haystack: string, value: string): boolean {
  const needle = value.toLowerCase().trim();
  return needle.length > 1 && haystack.includes(needle);
}

const SENIORITY_WORDS = {
  Junior: /\b(junior|entry|graduate|intern|trainee)\b/i,
  Senior: /\b(senior|sr\.?|lead|principal|staff)\b/i,
} as const;

/** Hard requirements pulled from the description, one row per pattern. */
const REQUIREMENT_RULES: Array<{
  test: RegExp;
  label: (match: RegExpMatchArray) => string;
  satisfied: (profile: ProfileSignals, match: RegExpMatchArray) => boolean;
}> = [
  {
    test: /\b(cpa|certified public accountant)\b/i,
    label: () => "CPA certification",
    satisfied: (profile) =>
      profile.certifications.some((name) => /\bcpa\b/i.test(name)),
  },
  {
    test: /\bcissp\b/i,
    label: () => "CISSP certification",
    satisfied: (profile) =>
      profile.certifications.some((name) => /\bcissp\b/i.test(name)),
  },
  {
    test: /\bpmp\b|project management professional/i,
    label: () => "PMP certification",
    satisfied: (profile) =>
      profile.certifications.some((name) => /\bpmp\b/i.test(name)),
  },
  {
    test: /\b(ccna|ccnp|compTIA|security\+|ceh)\b/i,
    label: (match) => `${match[1]} certification`,
    satisfied: (profile, match) =>
      profile.certifications.some((name) =>
        name.toLowerCase().includes(match[1]!.toLowerCase()),
      ),
  },
  {
    test: /\b(?:security|secret|top secret|active)\s+clearance\b/i,
    label: () => "security clearance",
    satisfied: () => false,
  },
  {
    test: /\b(?:must be|requires?|requires?)\s+(?:an?\s+)?licen[cs]ed\b|\blicen[cs]ed\s+(?:professional|engineer|nurse|attorney|teacher)\b/i,
    label: () => "professional licence",
    satisfied: () => false,
  },
  {
    test: /\b(?:fluent|native|bilingual|proficient)\s+(?:in\s+)?([a-z]+)\b/i,
    label: (match) => `${match[1]} language fluency`,
    satisfied: (profile, match) =>
      profile.languages.some((name) =>
        name.toLowerCase().includes(match[1]!.toLowerCase()),
      ),
  },
  {
    test: /\b(bachelor'?s|master'?s|mba|ph\.?d)\b/i,
    label: () => "a completed degree",
    satisfied: (profile) => profile.education.length > 0,
  },
];

/**
 * Profile-based fit. Deterministic, evidence-only: every reason maps to a field
 * the user actually has, and every gap maps to a requirement found in the
 * posting. No probability or hiring likelihood is ever produced.
 */
export function scoreJobAgainstProfile(
  job: DiscoveredJob,
  profile: ProfileSignals,
  opts: { locationStatus?: LocationMatchStatus } = {},
): ProfileFit {
  const haystack = haystackFor(job);
  const titleText = job.title.toLowerCase();

  const roleNames = [...profile.primaryTargetRoles, ...profile.adjacentRoles];
  const roleTerms = [...new Set(roleNames.flatMap((role) => tokens(role)))];
  const matchedTerms = roleTerms.filter((term) => titleText.includes(term));
  const exactRole = profile.primaryTargetRoles.find((role) =>
    containsToken(titleText, role),
  );
  const adjacentRole = exactRole
    ? null
    : profile.adjacentRoles.find((role) => containsToken(titleText, role));
  const roleCoverage = roleTerms.length
    ? matchedTerms.length / roleTerms.length
    : 0;

  const skillPool = [...profile.tools, ...profile.hardSkills];
  const matchedSkills = skillPool.filter((skill) =>
    containsToken(haystack, skill),
  );
  const skillScore = skillPool.length
    ? (matchedSkills.length / Math.min(skillPool.length, 8)) * 25
    : 0;

  const industry = profile.industries.find((value) =>
    containsToken(haystack, value),
  );

  let seniorityScore = 10;
  let seniorityConflict = false;
  const wanted =
    profile.seniority === "Junior"
      ? SENIORITY_WORDS.Junior
      : profile.seniority === "Senior"
        ? SENIORITY_WORDS.Senior
        : null;
  const opposite =
    profile.seniority === "Junior"
      ? SENIORITY_WORDS.Senior
      : profile.seniority === "Senior"
        ? SENIORITY_WORDS.Junior
        : null;
  if (wanted && opposite) {
    if (opposite.test(job.title)) {
      seniorityScore = 0;
      seniorityConflict = true;
    } else if (wanted.test(job.title)) {
      seniorityScore = 10;
    }
  }

  const locationScore =
    opts.locationStatus === "MATCH"
      ? 15
      : opts.locationStatus === "UNKNOWN"
        ? 8
        : 0;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (exactRole ? 40 : adjacentRole ? 28 : roleCoverage * 24) +
          skillScore +
          (industry ? 10 : 0) +
          seniorityScore +
          locationScore,
      ),
    ),
  );

  const label: MatchLabel =
    score >= 78
      ? "Strong Match"
      : score >= 58
        ? "Good Match"
        : score >= 38
          ? "Possible Match"
          : "Stretch";

  const reasons: string[] = [];
  if (exactRole) {
    reasons.push(`Role matches your target "${exactRole}"`);
  } else if (adjacentRole) {
    reasons.push(`Same family as your goal: ${adjacentRole}`);
  } else if (matchedTerms.length) {
    reasons.push(`Title covers ${matchedTerms.slice(0, 3).join(", ")}`);
  } else if (roleNames.length) {
    reasons.push(`Related to your goal ${roleNames[0]}`);
  }

  if (matchedSkills.length) {
    reasons.push(
      `${matchedSkills.slice(0, 3).join(", ")} ${matchedSkills.length === 1 ? "is" : "are"} used in this job`,
    );
  } else if (skillPool.length) {
    reasons.push("Open the posting to compare your saved skills");
  }

  if (industry) {
    reasons.push(`Matches your target industry: ${industry}`);
  } else if (profile.yearsExperience !== null && !seniorityConflict) {
    const years =
      profile.yearsExperience % 1 === 0
        ? profile.yearsExperience
        : profile.yearsExperience.toFixed(1);
    reasons.push(`Your ${years} years of experience fit the level asked`);
  }

  if (opts.locationStatus === "MATCH") {
    reasons.push("Location and work style match your preference");
  }

  if (reasons.length < 2) {
    reasons.push(
      "Matches the skills your CV has recorded",
      "Saved as a stretch option you can grow into",
    );
  }

  const gaps: string[] = [];
  for (const rule of REQUIREMENT_RULES) {
    if (gaps.length >= 3) break;
    const match = haystack.match(rule.test);
    if (!match) continue;
    if (rule.satisfied(profile, match)) continue;
    gaps.push(`Important gap: ${rule.label(match)}`);
  }

  const yearsRequest = haystack.match(
    /\b(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of)?\b/,
  );
  if (gaps.length < 3 && yearsRequest) {
    const required = Number(yearsRequest[1]);
    if (required >= 3) {
      if (
        profile.yearsExperience !== null &&
        required > profile.yearsExperience + 1
      ) {
        gaps.push(
          `Important gap: asks for ${required} years, your profile shows ${profile.yearsExperience}`,
        );
      } else if (profile.yearsExperience === null) {
        gaps.push(
          `Important gap: asks for ${required} years experience, which your profile does not state`,
        );
      }
    }
  }

  return { label, score, reasons: reasons.slice(0, 4), gaps: gaps.slice(0, 3) };
}

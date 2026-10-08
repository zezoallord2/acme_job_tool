import type { ResumeContent } from "@/services/resume-service";
import type { EvidenceRecord } from "@/domain/evidence";
import { detectInflation, extractMetrics } from "@/domain/evidence";

/**
 * Resume tailoring rules. Pure and deterministic, shared by the server (which
 * builds and guards the proposal) and the browser (which recomposes the resume
 * live as the user accepts, rejects and edits changes).
 *
 * The evidence-first rule is enforced here, not trusted to the prompt:
 *  - Employers, job titles, locations and dates are never taken from the model.
 *    They are copied from the original resume, so they cannot change.
 *  - Every number in a proposed change must already exist in the user's resume
 *    or evidence. A new number blocks the change.
 *  - A skill that appears nowhere in the resume or evidence blocks the change
 *    and becomes a gap question instead.
 *  - Leadership/scope inflation ("led a team", "managed") without evidence
 *    blocks the change.
 * A blocked change is rejected by default and cannot be accepted as written;
 * the user can still rewrite it in their own words.
 */

export type TailorSection = "summary" | "skills" | "experience";

export interface TailorChange {
  id: string;
  section: TailorSection;
  /** Experience row (index into the original resume) for experience changes. */
  experienceIndex?: number;
  /** Index into the original bullets that this change rewrites, if any. */
  replacesBullet?: number | null;
  before: string | null;
  after: string;
  why: string;
  evidenceIds: number[];
  /** Why the guard refused this change, or null when it is safe to accept. */
  blocked: string | null;
}

export interface TailorGap {
  requirement: string;
  question: string;
}

export interface TailorDecision {
  accepted: boolean;
  /** User's inline edit. Replaces `after` when present. */
  text?: string;
}

export interface TailoringFacts {
  /** Every number that already appears in the resume or the evidence. */
  numbers: Set<number>;
  /** Lower-cased corpus of everything the user has actually said. */
  corpus: string;
  /** Evidence and resume statements, for the inflation check. */
  statements: string[];
}

/** The model output this module consumes (validated upstream by zod). */
export interface TailoringModelOutput {
  summary: string;
  prioritizedSkills: string[];
  experiences: Array<{
    index: number;
    bullets: Array<{
      text: string;
      original: string | null;
      evidenceIds: number[];
      why: string;
    }>;
  }>;
  changes: Array<{ section: string; what: string; why: string }>;
  jobKeywords: string[];
  gaps: TailorGap[];
  needsInput: string[];
}

export function resumeText(content: ResumeContent): string {
  return [
    content.summary,
    content.skills.join(", "),
    ...content.experiences.flatMap((e) => [
      e.title,
      e.company,
      e.location,
      e.startDate,
      e.endDate,
      ...e.bullets,
    ]),
    ...content.projects.flatMap((p) => [
      p.name,
      p.role,
      p.tech.join(", "),
      ...p.bullets,
    ]),
    ...content.education.flatMap((e) => [
      e.institution,
      e.degree,
      e.field,
      e.startDate,
      e.endDate,
    ]),
    ...content.certifications.flatMap((c) => [c.name, c.issuer, c.year]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTailoringFacts(
  original: ResumeContent,
  evidence: readonly EvidenceRecord[],
): TailoringFacts {
  const statements = [
    ...original.experiences.flatMap((e) => e.bullets),
    ...original.projects.flatMap((p) => p.bullets),
    original.summary,
    ...evidence.map((e) => e.statement),
  ].filter((s): s is string => Boolean(s && s.trim()));

  const corpusParts = [
    resumeText(original),
    ...evidence.flatMap((e) => [e.statement, e.tags.join(" ")]),
  ];
  const corpus = corpusParts.join("\n").toLowerCase();

  const numbers = new Set<number>();
  for (const m of extractMetrics(corpusParts.join("\n"))) numbers.add(m.value);
  for (const e of evidence) {
    if (typeof e.metricValue === "number") numbers.add(e.metricValue);
  }
  return { numbers, corpus, statements };
}

/** Numbers in `text` that the user never stated. */
export function newNumbers(text: string, facts: TailoringFacts): string[] {
  const out: string[] = [];
  for (const m of extractMetrics(text)) {
    if (!facts.numbers.has(m.value)) out.push(m.raw.trim());
  }
  return [...new Set(out)];
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

/** A skill is known when the user's own resume or evidence mentions it. */
export function isKnownSkill(skill: string, facts: TailoringFacts): boolean {
  const needle = normalizeSkill(skill);
  return needle.length > 0 && facts.corpus.includes(needle);
}

/** Returns why a piece of generated prose is unsafe, or null. */
export function guardText(text: string, facts: TailoringFacts): string | null {
  const numbers = newNumbers(text, facts);
  if (numbers.length) {
    return `Adds a number you never stated (${numbers.join(", ")}).`;
  }
  const inflation = detectInflation(text, facts.statements);
  if (inflation) {
    return `Claims ${inflation.category.toLowerCase()} ("${inflation.claimed}") that your evidence does not show.`;
  }
  return null;
}

function sameText(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}

/**
 * Turns validated model output into a list of reviewable changes. Nothing here
 * can alter an employer, title, location or date: those fields are not even
 * read from the model output.
 */
export function buildChanges(
  original: ResumeContent,
  output: TailoringModelOutput,
  facts: TailoringFacts,
): { changes: TailorChange[]; gaps: TailorGap[] } {
  const changes: TailorChange[] = [];
  const gaps: TailorGap[] = [...output.gaps];
  const whyFor = (section: string) =>
    output.changes.find((c) => c.section.toLowerCase().startsWith(section))
      ?.why ?? "";

  // --- Summary --------------------------------------------------------------
  const summary = output.summary.trim();
  if (summary && !sameText(summary, original.summary)) {
    changes.push({
      id: "summary",
      section: "summary",
      before: original.summary || null,
      after: summary,
      why:
        whyFor("summary") || "Rewritten to lead with what this job asks for.",
      evidenceIds: [],
      blocked: guardText(summary, facts),
    });
  }

  // --- Skills ---------------------------------------------------------------
  // Reorder only. Known skills (in the resume or evidence) move to the front in
  // the model's order; every original skill is kept; unknown ones become gaps.
  const known: string[] = [];
  const seen = new Set<string>();
  for (const skill of output.prioritizedSkills) {
    const key = normalizeSkill(skill);
    if (!key || seen.has(key)) continue;
    if (!isKnownSkill(skill, facts)) {
      gaps.push({
        requirement: skill.trim(),
        question: `The job mentions ${skill.trim()}. Have you used it? If so, where and how?`,
      });
      continue;
    }
    seen.add(key);
    const originalSpelling =
      original.skills.find((s) => normalizeSkill(s) === key) ?? skill.trim();
    known.push(originalSpelling);
  }
  for (const skill of original.skills) {
    if (!seen.has(normalizeSkill(skill))) {
      seen.add(normalizeSkill(skill));
      known.push(skill);
    }
  }
  const skillsAfter = known.join(", ");
  if (known.length && skillsAfter !== original.skills.join(", ")) {
    changes.push({
      id: "skills",
      section: "skills",
      before: original.skills.join(", ") || null,
      after: skillsAfter,
      why:
        whyFor("skill") ||
        "Reordered so the skills this job asks for come first.",
      evidenceIds: [],
      blocked: null,
    });
  }

  // --- Experience bullets ---------------------------------------------------
  for (const row of output.experiences) {
    const experience = original.experiences[row.index];
    if (!experience) continue;
    const used = new Set<number>();
    row.bullets.forEach((bullet, i) => {
      const text = bullet.text.trim();
      if (!text) return;
      let replaces: number | null = null;
      if (bullet.original) {
        const idx = experience.bullets.findIndex(
          (b, j) => !used.has(j) && sameText(b, bullet.original!),
        );
        if (idx >= 0) replaces = idx;
      }
      if (replaces !== null) {
        used.add(replaces);
        if (sameText(experience.bullets[replaces]!, text)) return;
      }
      changes.push({
        id: `exp-${row.index}-${i}`,
        section: "experience",
        experienceIndex: row.index,
        replacesBullet: replaces,
        before: replaces !== null ? experience.bullets[replaces]! : null,
        after: text,
        why:
          bullet.why ||
          (replaces !== null
            ? "Reworded with the job's language."
            : "New bullet built from your evidence."),
        evidenceIds: bullet.evidenceIds,
        // A brand-new bullet must cite evidence; a rewrite is anchored to the
        // bullet it replaces.
        blocked:
          guardText(text, facts) ??
          (replaces === null && bullet.evidenceIds.length === 0
            ? "New bullet with no evidence cited."
            : null),
      });
    });
  }

  // Deduplicate gaps by requirement.
  const gapKeys = new Set<string>();
  const uniqueGaps = gaps.filter((g) => {
    const key = g.requirement.trim().toLowerCase();
    if (!key || gapKeys.has(key)) return false;
    gapKeys.add(key);
    return true;
  });
  return { changes, gaps: uniqueGaps };
}

/** Default decisions: accept every safe change, reject every blocked one. */
export function defaultDecisions(
  changes: readonly TailorChange[],
): Record<string, TailorDecision> {
  return Object.fromEntries(
    changes.map((c) => [c.id, { accepted: c.blocked === null }]),
  );
}

/**
 * Applies the accepted changes to the original resume. Pure: the same inputs
 * always produce the same resume, on the server and in the browser.
 */
export function composeTailored(
  original: ResumeContent,
  changes: readonly TailorChange[],
  decisions: Record<string, TailorDecision>,
): ResumeContent {
  const textOf = (c: TailorChange): string | null => {
    const d = decisions[c.id];
    if (!d?.accepted) return null;
    const edited = d.text?.trim();
    if (edited) return edited;
    // An unedited blocked change cannot be applied.
    return c.blocked ? null : c.after;
  };

  const next: ResumeContent = structuredClone(original);

  for (const c of changes) {
    const text = textOf(c);
    if (text === null) continue;
    if (c.section === "summary") next.summary = text;
    if (c.section === "skills") {
      next.skills = text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 60);
    }
  }

  next.experiences = original.experiences.map((experience, index) => {
    const rows = changes.filter(
      (c) => c.section === "experience" && c.experienceIndex === index,
    );
    const bullets = [...experience.bullets];
    const added: string[] = [];
    for (const c of rows) {
      const text = textOf(c);
      if (text === null) continue;
      if (c.replacesBullet !== null && c.replacesBullet !== undefined) {
        bullets[c.replacesBullet] = text;
      } else {
        added.push(text);
      }
    }
    return {
      // Identity fields are copied from the original, never from the model.
      company: experience.company,
      title: experience.title,
      location: experience.location,
      startDate: experience.startDate,
      endDate: experience.endDate,
      bullets: [...bullets, ...added].slice(0, 20),
    };
  });

  return next;
}

export interface KeywordCoverage {
  score: number;
  matched: string[];
  missing: string[];
}

/**
 * Share of the job's keywords that appear in the resume. A transparent
 * keyword count, not a hiring probability or an "ATS score".
 */
export function keywordCoverage(
  content: ResumeContent,
  keywords: readonly string[],
): KeywordCoverage {
  const text = resumeText(content).toLowerCase();
  const unique = [
    ...new Map(
      keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 1)
        .map((k) => [k.toLowerCase(), k] as const),
    ).values(),
  ];
  const matched = unique.filter((k) => text.includes(k.toLowerCase()));
  const missing = unique.filter((k) => !text.includes(k.toLowerCase()));
  return {
    score: unique.length
      ? Math.round((matched.length / unique.length) * 100)
      : 0,
    matched,
    missing,
  };
}

/** Keeps only keywords that really appear in the job text. */
export function groundKeywords(
  keywords: readonly string[],
  jobText: string,
): string[] {
  const haystack = jobText.toLowerCase();
  return [
    ...new Set(
      keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 1 && haystack.includes(k.toLowerCase())),
    ),
  ].slice(0, 30);
}

/**
 * Proof obligation used by the eval suite and by the save path: compared with
 * the original, the tailored resume may not contain a new employer, title,
 * location, date or number.
 */
export function newFactsIn(
  original: ResumeContent,
  tailored: ResumeContent,
  facts: TailoringFacts,
): string[] {
  const problems: string[] = [];
  if (tailored.experiences.length !== original.experiences.length) {
    problems.push("Experience entries were added or removed.");
  }
  tailored.experiences.forEach((e, i) => {
    const o = original.experiences[i];
    if (!o) return;
    for (const key of [
      "company",
      "title",
      "location",
      "startDate",
      "endDate",
    ] as const) {
      if (e[key] !== o[key]) {
        problems.push(
          `Experience ${i + 1} ${key} changed: "${o[key]}" → "${e[key]}".`,
        );
      }
    }
  });
  const prose = [
    tailored.summary,
    ...tailored.experiences.flatMap((e) => e.bullets),
  ].join("\n");
  const numbers = newNumbers(prose, facts);
  if (numbers.length) problems.push(`New numbers: ${numbers.join(", ")}.`);
  for (const skill of tailored.skills) {
    if (!isKnownSkill(skill, facts)) problems.push(`New skill: ${skill}.`);
  }
  return problems;
}

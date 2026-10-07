import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { hashContent } from "@/lib/crypto";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { evidenceRecords } from "@/services/evidence-service";
import { RESUME_CONTENT_SCHEMA } from "@/services/resume-service";
import type { WorkflowId } from "@/ai/workflow-ids";
import type { Capability } from "@/domain/entitlements";
import type {
  ApplicationAnswerOutput,
  CareerNarrativeOutput,
  CoverLetterOutput,
  FollowUpOutput,
  LinkedInOutput,
  ResumeBulletOutput,
  ResumeTailoringOutput,
  StarStoryOutput,
  VoiceProfileOutput,
} from "@/ai/schemas";

/**
 * The Studio.
 *
 * Nine workflows already had a prompt, a schema, a validator, a version and a
 * Manual Mode package, but nothing called them. Rather than nine bespoke panels,
 * each workflow is declared once here as data: its fields, how to build its
 * prompt context, and where its validated output is persisted.
 *
 * Adding a workflow is therefore a data change, not a UI change.
 *
 * The persistence rules are the important part:
 *  - Generated documents are DRAFTS. A tailored resume, cover letter, LinkedIn
 *    rewrite or application answer is never sent anywhere and never overwrites
 *    what was already sent.
 *  - Anything derived from the user's career is attached to the evidence that
 *    supports it, and claims the evidence cannot support are reported rather
 *    than dropped.
 */

export interface StudioValues {
  [key: string]: string;
}

export type StudioFieldKind = "text" | "textarea" | "select" | "number";

export interface StudioField {
  name: string;
  label: string;
  kind: StudioFieldKind;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  /** Populated from the user's own records rather than hard-coded. */
  optionsFrom?: "applications";
}

export interface StudioRow {
  label: string;
  value: string;
}

export interface StudioItem {
  title: string;
  detail?: string;
  tags?: string[];
}

export interface StudioResult {
  summary: string;
  /** Where the user should go to review or send the draft. */
  savedPath?: string;
  savedLabel?: string;
  rows: StudioRow[];
  items: StudioItem[];
  warnings: string[];
  needsInput: string[];
}

export interface StudioWorkflow {
  id: WorkflowId;
  capability: Capability;
  title: string;
  description: string;
  actionLabel: string;
  fields: StudioField[];
  buildContext(
    userId: string,
    v: StudioValues,
  ): Promise<Record<string, unknown>>;
  run(userId: string, v: StudioValues, raw: string): Promise<StudioResult>;
}

/** Carries a workflow failure out with its Manual Mode prompt intact. */
export class StudioFailure extends Error {
  readonly userMessage: string;
  readonly errors: string[];
  readonly prompt: unknown;
  readonly code: string;

  constructor(outcome: {
    userMessage: string;
    errors: string[];
    manualFallback: unknown;
    code: string;
  }) {
    super(outcome.userMessage);
    this.name = "StudioFailure";
    this.userMessage = outcome.userMessage;
    this.errors = outcome.errors;
    this.prompt = outcome.manualFallback;
    this.code = outcome.code;
  }
}

/**
 * `raw` is the pasted response. It is required because Manual Mode is the only
 * path these run through in the zero-cost configuration, and an empty paste must
 * not be mistaken for a result.
 */
async function run<T>(
  userId: string,
  id: WorkflowId,
  context: Record<string, unknown>,
  raw: string,
): Promise<{
  data: T;
  warnings: string[];
  interactionId: string;
  promptVersion: string;
}> {
  const outcome = await runWorkflow<T>({
    userId,
    workflowId: id,
    context,
    evidence: await evidenceRecords(userId),
    userApiKey: await getUserApiKeyForWorkflow(userId),
    preferManual: true,
    manualInput: raw,
  });
  if (!outcome.ok) throw new StudioFailure(outcome);
  return {
    data: outcome.data,
    warnings: outcome.warnings,
    interactionId: outcome.interactionId,
    promptVersion: outcome.promptVersion,
  };
}

/** AI evidence ids are numeric positions; only the user's own records survive. */
async function ownedEvidenceIds(
  userId: string,
  ids: number[],
): Promise<string[]> {
  const all = await evidenceRecords(userId);
  return ids
    .map((i) => all[i])
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => e.id)
    .filter(Boolean);
}

function applicationOptions(
  rows: Array<{
    id: string;
    job: { company: string | null; title: string | null } | null;
  }>,
) {
  return rows.map((a) => ({
    value: a.id,
    label: `${a.job?.company ?? "Company"} — ${a.job?.title ?? "Role"}`,
  }));
}

async function loadApplication(userId: string, applicationId: string | null) {
  if (!applicationId) return null;
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: { include: { analysis: { include: { requirements: true } } } },
      matrix: { include: { matches: { include: { requirement: true } } } },
      snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!application) throw Errors.notFound("Application");
  // A job is required for these workflows, so reject the row rather than
  // silently producing a prompt with no job in it.
  if (!application.job) throw Errors.notFound("Job for this application");
  return { ...application, job: application.job };
}

async function activeNarrative(userId: string): Promise<string> {
  const row = await prisma.careerNarrative.findFirst({
    where: { userId, isActive: true },
    orderBy: { version: "desc" },
    select: { narrativeText: true },
  });
  return row?.narrativeText ?? "";
}

async function latestVoiceSamples(userId: string): Promise<string[]> {
  const profile = await prisma.voiceProfile.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
    select: { samples: true },
  });
  if (!profile?.samples) return [];
  return Array.isArray(profile.samples)
    ? profile.samples.filter((s): s is string => typeof s === "string")
    : [];
}

// ---------------------------------------------------------------------------
// RESUME_TAILORING
// ---------------------------------------------------------------------------

const RESUME_TAILORING: StudioWorkflow = {
  id: "RESUME_TAILORING",
  capability: "RESUME_TAILORING_ADVANCED",
  title: "Tailor a resume to this job",
  description:
    "Reorders, re-words and selects from what your evidence supports. It never adds a fact you do not have, and it saves a draft — it does not send anything.",
  actionLabel: "Saving the tailored draft",
  fields: [
    {
      name: "applicationId",
      label: "Application to tailor for",
      kind: "select",
      optionsFrom: "applications",
      hint: "Uses that job's requirements, evidence matrix and the resume you sent.",
    },
  ],
  async buildContext(userId, v) {
    const application = await loadApplication(userId, v.applicationId || null);
    if (!application) {
      throw Errors.validation(
        "Choose an application so the tailored draft is built against a real job.",
      );
    }
    const master = await prisma.resume.findFirst({
      where: { userId, isMaster: true },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const content = RESUME_CONTENT_SCHEMA.parse(
      master?.versions[0]?.content ?? {},
    );
    const matrix = application.matrix;
    return {
      requirements: (application.job.analysis?.requirements ?? []).map((r) => ({
        text: r.text,
        isMustHave: r.isMustHave,
      })),
      matrixSummary: matrix
        ? matrix.matches
            .map((m) => `${m.strength}: ${m.requirement.text}`)
            .join("\n")
        : "(no matrix built yet)",
      currentResume: content,
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const application = await loadApplication(userId, v.applicationId);
    if (!application) {
      throw Errors.validation("Choose an application first.");
    }
    const context = await this.buildContext(userId, v);
    const { data, warnings, interactionId, promptVersion } =
      await run<ResumeTailoringOutput>(
        userId,
        "RESUME_TAILORING",
        context,
        raw,
      );

    // A draft cloned from the Master Resume, linked to the job and application.
    // The draft is created after the workflow runs, so a failed validation never
    // leaves an empty resume behind.
    const { createJobVersion, updateResumeContent } =
      await import("@/services/resume-service");
    const draft = await createJobVersion({
      userId,
      jobId: application.job.id,
      applicationId: application.id,
      label: `Tailored — ${application.job.title ?? "role"}`,
    });

    const bySection: Record<string, string[]> = {
      EXPERIENCE: [],
      PROJECT: [],
      SKILLS: [],
    };
    for (const b of data.bullets) {
      bySection[b.section]?.push(b.text);
    }

    // Created by createJobVersion above; re-read to pick up the version it wrote.
    const master = await prisma.resume.findFirstOrThrow({
      where: { userId, isMaster: true },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const base = RESUME_CONTENT_SCHEMA.parse(master.versions[0]?.content ?? {});

    // `experienceOrder` is a list of indices into the master resume, so the
    // ordering is applied by rank rather than by rewriting the records.
    const rank = (index: number): number => {
      const at = data.experienceOrder.indexOf(index);
      return at === -1 ? Number.MAX_SAFE_INTEGER : at;
    };
    const ordered = base.experiences
      .map((experience, index) => ({ experience, index }))
      .sort((a, b) => rank(a.index) - rank(b.index))
      .map(({ experience, index }) => ({
        ...experience,
        bullets:
          index < bySection.EXPERIENCE.length
            ? [...experience.bullets, ...bySection.EXPERIENCE]
            : experience.bullets,
      }));

    const tailored = {
      ...base,
      summary: data.summary || base.summary,
      skills: data.prioritizedSkills.length
        ? data.prioritizedSkills
        : base.skills,
      experiences: ordered,
    };

    await updateResumeContent({
      userId,
      resumeId: draft.id,
      content: tailored,
    });
    await prisma.resume.update({
      where: { id: draft.id },
      data: {
        generationId: interactionId,
        promptVersion,
        workflowId: "RESUME_TAILORING",
      },
    });
    const version = await prisma.resumeVersion.findFirst({
      where: { resumeId: draft.id },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (version) {
      await prisma.resumeVersion.update({
        where: { id: version.id },
        data: {
          generationId: interactionId,
          promptVersion,
          workflowId: "RESUME_TAILORING",
        },
      });
    }

    return {
      summary:
        "Tailored draft saved. Nothing was sent, and your Master Resume is untouched.",
      savedPath: "/app/resumes",
      savedLabel: "Open your resumes",
      rows: [
        {
          label: "Skills prioritised",
          value: data.prioritizedSkills.join(", ") || "unchanged",
        },
      ],
      items: data.bullets.map((b) => ({
        title: b.text,
        tags: [b.section],
        detail: b.unsupportedAspects.length
          ? `No evidence cited for: ${b.unsupportedAspects.join(", ")}`
          : undefined,
      })),
      warnings: [
        ...warnings,
        ...data.droppedPoints.map((d) => `Dropped: ${d.text} — ${d.reason}`),
      ],
      needsInput: data.needsInput,
    };
  },
};

// ---------------------------------------------------------------------------
// RESUME_BULLET
// ---------------------------------------------------------------------------

const RESUME_BULLET: StudioWorkflow = {
  id: "RESUME_BULLET",
  capability: "RESUME_BULLET_BUILDER",
  title: "Rewrite one bullet",
  description:
    "Rewrites a single bullet using only your evidence, and records which records support it. Saved as a draft bullet you accept or reject.",
  actionLabel: "Saving the draft bullet",
  fields: [
    {
      name: "originalBullet",
      label: "The bullet you have now",
      kind: "textarea",
      required: true,
      minLength: 10,
      hint: "Paste it exactly as it appears on your resume.",
    },
    {
      name: "jobRequirement",
      label: "Requirement it should target",
      kind: "text",
      placeholder: "Advanced Excel reporting",
    },
  ],
  async buildContext(userId, v) {
    const originalBullet = (v.originalBullet ?? "").trim();
    if (originalBullet.length < 10) {
      throw Errors.validation("Paste the bullet you want rewritten.");
    }
    return {
      originalBullet,
      jobRequirement: (v.jobRequirement ?? "").trim() || "general role fit",
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings } = await run<ResumeBulletOutput>(
      userId,
      "RESUME_BULLET",
      context,
      raw,
    );

    const owned = await ownedEvidenceIds(userId, data.usedEvidenceIds);
    // Create the Master Resume if this account has never opened the resumes page.
    // Requiring it to already exist would make this tool fail for a brand-new
    // user, which reads as a broken feature rather than a missing prerequisite.
    const { ensureMasterResume } = await import("@/services/resume-service");
    const master = await ensureMasterResume(userId);

    await prisma.resumeBullet.create({
      data: {
        userId,
        resumeId: master.id,
        evidenceIds: owned,
        text: data.suggestion,
        originalText: (v.originalBullet ?? "").trim(),
        defenseNotes: data.explanation || null,
        // Never accepted automatically: a human decides.
        state: "NEEDS_CONFIRMATION",
        isAccepted: false,
      },
    });

    return {
      summary:
        owned.length > 0
          ? `Saved as a draft bullet supported by ${owned.length} of your records.`
          : "Saved as a draft bullet, but no evidence was cited. Review it before using it.",
      savedPath: "/app/resumes",
      savedLabel: "Open your resumes",
      rows: [
        { label: "Risk", value: data.riskLevel },
        { label: "Evidence cited", value: String(owned.length) },
      ],
      items: [
        {
          title: data.suggestion,
          detail: data.explanation || undefined,
          tags: ["PROPOSED"],
        },
      ],
      warnings: [
        ...warnings,
        ...data.unsupportedAspects.map(
          (u) => `Not supported by evidence: ${u}`,
        ),
      ],
      needsInput: [],
    };
  },
};

// ---------------------------------------------------------------------------
// COVER_LETTER
// ---------------------------------------------------------------------------

const COVER_LETTER: StudioWorkflow = {
  id: "COVER_LETTER",
  capability: "COVER_LETTER_BUILDER",
  title: "Write a cover letter",
  description:
    "Drafts a letter from your evidence and your career narrative. It is saved as a versioned draft; nothing is emailed and no older version is overwritten.",
  actionLabel: "Saving the cover letter draft",
  fields: [
    {
      name: "applicationId",
      label: "Application",
      kind: "select",
      optionsFrom: "applications",
    },
    {
      name: "tone",
      label: "Tone",
      kind: "select",
      options: [
        { value: "STANDARD", label: "Standard" },
        { value: "CONCISE", label: "Concise" },
        { value: "EMAIL", label: "Short email" },
        { value: "MOTIVATION", label: "Motivation-led" },
        { value: "COMPANY", label: "Company-focused" },
        { value: "SELF_INTRODUCTION", label: "Self introduction" },
        { value: "EXPERIENCE", label: "Experience-led" },
      ],
    },
  ],
  async buildContext(userId, v) {
    const application = await loadApplication(userId, v.applicationId || null);
    return {
      company: application?.job.company ?? "not stated",
      role: application?.job.title ?? "not stated",
      jobDescription:
        application?.job.rawDescription?.slice(0, 4000) ?? "(none)",
      tone: (v.tone || "STANDARD").toLowerCase(),
      narrative: await activeNarrative(userId),
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings, interactionId, promptVersion } =
      await run<CoverLetterOutput>(userId, "COVER_LETTER", context, raw);

    const owned = await ownedEvidenceIds(userId, data.usedEvidenceIds);
    const application = await loadApplication(userId, v.applicationId || null);

    // Only one current draft at a time; older versions are kept, not deleted.
    await prisma.coverLetter.updateMany({
      where: {
        userId,
        applicationId: application?.id ?? null,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    const content = {
      subject: data.subject,
      body: data.body,
      tone: v.tone || "STANDARD",
      evidenceIds: owned,
    };

    await prisma.coverLetter.create({
      data: {
        userId,
        applicationId: application?.id ?? null,
        tone: (v.tone || "STANDARD") as never,
        body: data.body,
        content: content as never,
        contentHash: hashContent(content),
        achievementIds: [],
        evidenceIds: owned,
        warnings: [...warnings, ...data.unsupportedCompanyClaims],
        isCurrent: true,
        generationId: interactionId,
        promptVersion,
        workflowId: "COVER_LETTER",
        interactionId,
      },
    });

    return {
      summary: "Cover letter draft saved.",
      savedPath: application
        ? `/app/applications/${application.id}`
        : "/app/applications",
      savedLabel: "Open the application",
      rows: [
        { label: "Subject", value: data.subject || "(none)" },
        { label: "Evidence cited", value: String(owned.length) },
      ],
      items: [{ title: data.body }],
      warnings: [
        ...warnings,
        ...data.unsupportedCompanyClaims.map(
          (u) => `Claim about the company you should verify: ${u}`,
        ),
      ],
      needsInput: data.needsInput,
    };
  },
};

// ---------------------------------------------------------------------------
// LINKEDIN_OPTIMIZER
// ---------------------------------------------------------------------------

const LINKEDIN_OPTIMIZER: StudioWorkflow = {
  id: "LINKEDIN_OPTIMIZER",
  capability: "LINKEDIN_OPTIMIZER",
  title: "Improve your LinkedIn profile",
  description:
    "Returns current versus suggested for every section, with the reason, so you can judge each change instead of accepting a rewrite you cannot defend.",
  actionLabel: "Saving the suggested wording",
  fields: [
    {
      name: "targetRole",
      label: "Role you are aiming at",
      kind: "text",
      required: true,
      minLength: 3,
    },
    {
      name: "currentHeadline",
      label: "Your current headline",
      kind: "text",
    },
    {
      name: "currentAbout",
      label: "Your current About section",
      kind: "textarea",
      rows: 6,
    },
  ],
  async buildContext(userId, v) {
    const targetRole = (v.targetRole ?? "").trim();
    if (targetRole.length < 3) {
      throw Errors.validation("Tell me which role you are aiming at.");
    }
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        firstName: true,
        lastName: true,
        headline: true,
        linkedinUrl: true,
      },
    });
    return {
      targetRole,
      current: {
        headline: (v.currentHeadline || profile?.headline || "").trim(),
        about: (v.currentAbout ?? "").trim(),
      },
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings } = await run<LinkedInOutput>(
      userId,
      "LINKEDIN_OPTIMIZER",
      context,
      raw,
    );

    // No LinkedIn model exists, so the suggestion is stored on the career
    // narrative as an explicit suggestion object rather than invented as a fact.
    const existing = await prisma.careerNarrative.findFirst({
      where: { userId, isActive: true },
      orderBy: { version: "desc" },
    });
    const metadata = {
      linkedinSuggestion: {
        headline: data.headline,
        about: data.about,
        experience: data.experience,
        skillsToFeature: data.skillsToFeature,
      },
    };

    if (existing) {
      await prisma.careerNarrative.update({
        where: { id: existing.id },
        data: { metadata: metadata as never },
      });
    } else {
      const version =
        (await prisma.careerNarrative.count({ where: { userId } })) + 1;
      await prisma.careerNarrative.create({
        data: {
          userId,
          version,
          title: "LinkedIn suggestions",
          narrativeText: "",
          destinationRole: (v.targetRole ?? "").trim() || null,
          isActive: true,
          // A suggestion is not a confirmed fact about the user.
          userConfirmed: false,
          metadata: metadata as never,
        },
      });
    }

    return {
      summary:
        "Suggestions saved. Nothing on your LinkedIn was changed — copy what you agree with.",
      savedPath: "/app/career",
      savedLabel: "Open your Career Profile",
      rows: [
        {
          label: "Suggested headline",
          value: data.headline.suggested || "(no change suggested)",
        },
      ],
      items: [
        {
          title: `Headline: ${data.headline.suggested || data.headline.current}`,
          detail: data.headline.why,
          tags: ["HEADLINE"],
        },
        {
          title: "About section",
          detail: data.about.why,
          tags: ["ABOUT"],
        },
        ...data.experience.map((e) => ({
          title: e.suggested,
          detail: e.why,
          tags: ["EXPERIENCE"],
        })),
        ...data.skillsToFeature.map((s) => ({
          title: s.skill,
          detail: s.why,
          tags: ["SKILL"],
        })),
      ],
      warnings: [
        ...warnings,
        ...data.unsupportedAspects.map(
          (u) => `Not supported by evidence: ${u}`,
        ),
      ],
      needsInput: [],
    };
  },
};

// ---------------------------------------------------------------------------
// APPLICATION_ANSWER
// ---------------------------------------------------------------------------

const APPLICATION_ANSWER: StudioWorkflow = {
  id: "APPLICATION_ANSWER",
  capability: "APPLICATION_QUESTION_BUILDER",
  title: "Answer an application question",
  description:
    "Drafts one answer from your evidence and stores it against the application, flagged with the records that support it.",
  actionLabel: "Saving the answer draft",
  fields: [
    {
      name: "applicationId",
      label: "Application",
      kind: "select",
      optionsFrom: "applications",
    },
    {
      name: "question",
      label: "The question",
      kind: "textarea",
      required: true,
      minLength: 10,
      rows: 4,
    },
    {
      name: "wordLimit",
      label: "Word limit",
      kind: "number",
      placeholder: "120",
    },
  ],
  async buildContext(userId, v) {
    const question = (v.question ?? "").trim();
    if (question.length < 10) {
      throw Errors.validation("Paste the question you have to answer.");
    }
    const application = await loadApplication(userId, v.applicationId || null);
    return {
      question,
      company: application?.job.company ?? "",
      role: application?.job.title ?? "",
      wordLimit: Number(v.wordLimit ?? 120) || 120,
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings, interactionId, promptVersion } =
      await run<ApplicationAnswerOutput>(
        userId,
        "APPLICATION_ANSWER",
        context,
        raw,
      );

    const owned = await ownedEvidenceIds(userId, data.usedEvidenceIds);
    const application = await loadApplication(userId, v.applicationId || null);

    await prisma.applicationAnswer.create({
      data: {
        userId,
        applicationId: application?.id ?? null,
        question: (v.question ?? "").trim(),
        category: "OTHER",
        answer: data.answer,
        evidenceIds: owned,
        warnings: [...warnings, ...data.unsupportedAspects],
        isReusable: false,
        generationId: interactionId,
        promptVersion,
        workflowId: "APPLICATION_ANSWER",
      },
    });

    return {
      summary: "Answer draft saved against the application.",
      savedPath: application
        ? `/app/applications/${application.id}`
        : "/app/applications",
      savedLabel: "Open the application",
      rows: [
        { label: "Evidence cited", value: String(owned.length) },
        { label: "Word count", value: String(data.answer.split(/\s+/).length) },
      ],
      items: [{ title: data.answer }],
      warnings: [
        ...warnings,
        ...data.unsupportedAspects.map(
          (u) => `Not supported by evidence: ${u}`,
        ),
      ],
      needsInput: data.needsInput,
    };
  },
};

// ---------------------------------------------------------------------------
// STAR_STORY
// ---------------------------------------------------------------------------

const STAR_STORY_WORKFLOW: StudioWorkflow = {
  id: "STAR_STORY",
  capability: "STAR_BANK_FULL",
  title: "Structure an achievement as a STAR story",
  description:
    "Turns your own account into Situation, Task, Action, Result. It restructures what you said and never adds a detail you did not give.",
  actionLabel: "Saving the STAR story",
  fields: [
    {
      name: "account",
      label: "Tell the story in your own words",
      kind: "textarea",
      required: true,
      minLength: 30,
      rows: 6,
    },
    {
      name: "category",
      label: "Category",
      kind: "select",
      options: [
        { value: "ACHIEVEMENT", label: "Achievement" },
        { value: "PROBLEM_SOLVING", label: "Problem solving" },
        { value: "FAILURE", label: "Failure" },
        { value: "CONFLICT", label: "Conflict" },
        { value: "LEADERSHIP", label: "Leadership" },
        { value: "CUSTOMER", label: "Customer" },
      ],
    },
  ],
  async buildContext(userId, v) {
    const account = (v.account ?? "").trim();
    if (account.length < 30) {
      throw Errors.validation(
        "Tell the story in a bit more detail so there is something to structure.",
      );
    }
    return {
      account,
      category: v.category || "ACHIEVEMENT",
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings } = await run<StarStoryOutput>(
      userId,
      "STAR_STORY",
      context,
      raw,
    );
    const owned = await ownedEvidenceIds(userId, data.usedEvidenceIds);

    const { createStarStory } = await import("@/services/interview-service");
    const story = await createStarStory(userId, {
      title: data.title,
      category: v.category || "ACHIEVEMENT",
      situation: data.situation,
      task: data.task,
      action: data.action,
      result: data.result,
      learning: data.learning,
      evidenceIds: owned,
      skills: [],
    });

    return {
      summary: "STAR story saved to your bank.",
      savedPath: "/app/stories",
      savedLabel: "Open your stories",
      rows: [
        { label: "Strength", value: story.strength ?? "PARTIAL" },
        { label: "Evidence cited", value: String(owned.length) },
      ],
      items: [{ title: data.title, tags: ["STAR"], detail: data.result }],
      warnings: [
        ...warnings,
        ...data.unsupportedAspects.map(
          (u) => `Not supported by evidence: ${u}`,
        ),
      ],
      needsInput: data.needsInput,
    };
  },
};

// ---------------------------------------------------------------------------
// FOLLOW_UP
// ---------------------------------------------------------------------------

const FOLLOW_UP_WORKFLOW: StudioWorkflow = {
  id: "FOLLOW_UP",
  capability: "FOLLOW_UP_BUILDER",
  title: "Draft a follow-up message",
  description:
    "Drafts a thank-you note or follow-up from what actually happened. Acme Jobs never sends anything; you read it, then send it yourself.",
  actionLabel: "Saving the follow-up draft",
  fields: [
    {
      name: "applicationId",
      label: "Application",
      kind: "select",
      optionsFrom: "applications",
    },
    {
      name: "type",
      label: "Type",
      kind: "select",
      options: [
        { value: "THANK_YOU", label: "Thank-you note" },
        { value: "FOLLOW_UP", label: "Follow-up" },
        { value: "SECOND_FOLLOW_UP", label: "Second follow-up" },
        { value: "WITHDRAWAL", label: "Withdrawal" },
      ],
    },
    { name: "contactName", label: "Who you are writing to", kind: "text" },
    {
      name: "lastInteraction",
      label: "What happened last",
      kind: "text",
      placeholder: "Interview on Tuesday",
    },
  ],
  async buildContext(userId, v) {
    const application = await loadApplication(userId, v.applicationId || null);
    const interview = application
      ? await prisma.interview.findFirst({
          where: { userId, applicationId: application.id },
          orderBy: { scheduledAt: "desc" },
          select: {
            company: true,
            role: true,
            scheduledAt: true,
            interviewerName: true,
          },
        })
      : null;

    let daysSince = 0;
    const last = interview?.scheduledAt ?? application?.createdAt ?? null;
    if (last) {
      daysSince = Math.max(
        0,
        Math.round((Date.now() - new Date(last).getTime()) / 86_400_000),
      );
    }

    return {
      type: v.type || "FOLLOW_UP",
      company: application?.job.company ?? interview?.company ?? "",
      role: application?.job.title ?? interview?.role ?? "",
      contactName:
        (v.contactName ?? "").trim() ||
        interview?.interviewerName ||
        "hiring manager",
      lastInteraction:
        (v.lastInteraction ?? "").trim() ||
        (interview ? "an interview" : "application submitted"),
      daysSince,
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings, interactionId, promptVersion } =
      await run<FollowUpOutput>(userId, "FOLLOW_UP", context, raw);

    const owned = await ownedEvidenceIds(userId, data.mentionsEvidenceIds);
    const application = await loadApplication(userId, v.applicationId || null);

    const { createFollowUp } = await import("@/services/interview-service");
    const followUp = await createFollowUp(userId, {
      applicationId: application?.id ?? null,
      type: (v.type || "FOLLOW_UP") as never,
      subject: data.subject || null,
      body: data.body,
      scheduledFor: null,
    });
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        generationId: interactionId,
        promptVersion,
        workflowId: "FOLLOW_UP",
      },
    });

    return {
      summary: "Draft saved. Nothing was sent — mark it sent once you have.",
      savedPath: "/app/follow-ups",
      savedLabel: "Open your follow-ups",
      rows: [
        { label: "Subject", value: data.subject || "(none)" },
        { label: "Evidence referenced", value: String(owned.length) },
      ],
      items: [{ title: data.body }],
      warnings,
      needsInput: [],
    };
  },
};

// ---------------------------------------------------------------------------
// CAREER_NARRATIVE
// ---------------------------------------------------------------------------

const CAREER_NARRATIVE: StudioWorkflow = {
  id: "CAREER_NARRATIVE",
  capability: "CAREER_NARRATIVE",
  title: "Build your career narrative",
  description:
    "Connects where you came from to where you are going using your own employment history. Saved as unconfirmed until you accept it.",
  actionLabel: "Saving the narrative draft",
  fields: [
    {
      name: "fromRole",
      label: "Where you are now",
      kind: "text",
      required: true,
      minLength: 2,
    },
    {
      name: "toRole",
      label: "Where you are going",
      kind: "text",
      required: true,
      minLength: 2,
    },
    { name: "industry", label: "Target industry", kind: "text" },
  ],
  async buildContext(userId, v) {
    const employment = await prisma.employmentRecord.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 10,
      select: {
        jobTitle: true,
        companyName: true,
        startDate: true,
        endDate: true,
      },
    });
    return {
      fromRole: (v.fromRole ?? "").trim(),
      toRole: (v.toRole ?? "").trim(),
      industry: (v.industry ?? "").trim(),
      employmentHistory: employment,
      evidence: await evidenceRecords(userId),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings } = await run<CareerNarrativeOutput>(
      userId,
      "CAREER_NARRATIVE",
      context,
      raw,
    );
    const owned = await ownedEvidenceIds(userId, data.usedEvidenceIds);

    // One active narrative at a time; older versions are kept.
    await prisma.careerNarrative.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    const version =
      (await prisma.careerNarrative.count({ where: { userId } })) + 1;

    await prisma.careerNarrative.create({
      data: {
        userId,
        version,
        title: data.title || "Career narrative",
        originPoint: data.originPoint || null,
        bridgeSteps: data.bridgeSteps,
        destinationRole:
          data.destinationRole || (v.toRole ?? "").trim() || null,
        targetIndustry:
          data.targetIndustry || (v.industry ?? "").trim() || null,
        coreTheme: data.coreTheme || null,
        narrativeText: data.narrativeText,
        evidenceIds: owned,
        isActive: true,
        // Inference stays unconfirmed until the user says so.
        userConfirmed: false,
      },
    });

    return {
      summary:
        "Narrative saved as a draft. It stays unconfirmed until you accept it, so nothing downstream treats it as fact yet.",
      savedPath: "/app/career",
      savedLabel: "Open your Career Profile",
      rows: [
        { label: "Core theme", value: data.coreTheme || "(none)" },
        { label: "Bridge steps", value: String(data.bridgeSteps.length) },
        { label: "Evidence cited", value: String(owned.length) },
      ],
      items: [
        { title: data.narrativeText, tags: ["NARRATIVE"] },
        ...data.bridgeSteps.map((s) => ({ title: s, tags: ["STEP"] })),
      ],
      warnings: [
        ...warnings,
        ...data.unsupportedAspects.map(
          (u) => `Not supported by evidence: ${u}`,
        ),
      ],
      needsInput: [],
    };
  },
};

// ---------------------------------------------------------------------------
// VOICE_PROFILE
// ---------------------------------------------------------------------------

const VOICE_PROFILE: StudioWorkflow = {
  id: "VOICE_PROFILE",
  capability: "VOICE_PROFILE",
  title: "Learn how you write",
  description:
    "Infers tone and phrasing preferences from your own writing samples. These are preferences, not facts about your career.",
  actionLabel: "Saving your voice profile",
  fields: [
    {
      name: "samples",
      label: "Your writing samples",
      kind: "textarea",
      required: true,
      minLength: 60,
      rows: 8,
      hint: "Paste things you have actually written: emails, a summary, a report intro. Paste works best over several samples.",
    },
  ],
  async buildContext(userId, v) {
    const samples = (v.samples ?? "").trim();
    if (samples.length < 60) {
      throw Errors.validation(
        "Paste a little more of your own writing so there is something to learn from.",
      );
    }
    return {
      samples: [...(await latestVoiceSamples(userId)), samples].join(
        "\n\n---\n\n",
      ),
    };
  },
  async run(userId, v, raw) {
    const context = await this.buildContext(userId, v);
    const { data, warnings } = await run<VoiceProfileOutput>(
      userId,
      "VOICE_PROFILE",
      context,
      raw,
    );
    const version =
      (await prisma.voiceProfile.count({ where: { userId } })) + 1;

    const profile = await prisma.voiceProfile.create({
      data: {
        userId,
        version,
        isDirect: data.isDirect,
        isConcise: data.isConcise,
        isFormal: data.isFormal,
        isConversational: data.isConversational,
        isTechnical: data.isTechnical,
        isSimple: data.isSimple,
        avgSentenceLength: data.avgSentenceLength,
        sampleCount: 1,
        bannedPhrases: data.bannedPhrases,
        preferredPhrases: data.preferredPhrases,
        samples: [(v.samples ?? "").trim()],
        notes: data.notes || null,
      },
    });

    const traits = [
      data.isDirect && "direct",
      data.isConcise && "concise",
      data.isFormal && "formal",
      data.isConversational && "conversational",
      data.isTechnical && "technical",
      data.isSimple && "simple",
    ].filter(Boolean) as string[];

    return {
      summary: `Voice profile saved as version ${profile.version}. Generated writing will follow these preferences.`,
      savedPath: "/app/settings",
      savedLabel: "Open settings",
      rows: [
        { label: "Traits", value: traits.join(", ") || "mixed" },
        {
          label: "Average sentence length",
          value: `${data.avgSentenceLength} words`,
        },
      ],
      items: [
        ...data.preferredPhrases.map((p) => ({ title: p, tags: ["PREFERS"] })),
        ...data.bannedPhrases.map((p) => ({ title: p, tags: ["AVOIDS"] })),
      ],
      warnings,
      needsInput: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const STUDIO_WORKFLOWS: Record<string, StudioWorkflow> = {
  RESUME_TAILORING,
  RESUME_BULLET,
  COVER_LETTER,
  LINKEDIN_OPTIMIZER,
  APPLICATION_ANSWER,
  STAR_STORY: STAR_STORY_WORKFLOW,
  FOLLOW_UP: FOLLOW_UP_WORKFLOW,
  CAREER_NARRATIVE,
  VOICE_PROFILE,
};

export const STUDIO_IDS = Object.keys(STUDIO_WORKFLOWS) as WorkflowId[];

export function studioWorkflow(id: string): StudioWorkflow {
  const def = STUDIO_WORKFLOWS[id];
  if (!def) throw Errors.notFound("Workflow");
  return def;
}

/** Select options for fields that come from the user's own records. */
export async function studioFieldOptions(
  userId: string,
  workflow: StudioWorkflow,
): Promise<Record<string, Array<{ value: string; label: string }>>> {
  const out: Record<string, Array<{ value: string; label: string }>> = {};
  for (const field of workflow.fields) {
    if (field.optionsFrom === "applications") {
      const rows = await prisma.application.findMany({
        where: { userId },
        select: { id: true, job: { select: { company: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      out[field.name] = applicationOptions(rows);
    } else if (field.options) {
      out[field.name] = field.options;
    }
  }
  return out;
}

/** Safe to hand to the client: field descriptors plus resolved options. */
export async function studioDescriptor(
  userId: string,
  workflow: StudioWorkflow,
) {
  const options = await studioFieldOptions(userId, workflow);
  return {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
    actionLabel: workflow.actionLabel,
    fields: workflow.fields.map((f) => ({
      name: f.name,
      label: f.label,
      kind: f.kind,
      hint: f.hint,
      placeholder: f.placeholder,
      required: f.required ?? false,
      minLength: f.minLength,
      rows: f.rows,
      options: options[f.name] ?? [],
    })),
  };
}

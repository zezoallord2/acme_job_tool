import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, Errors } from "@/lib/errors";
import { fetchPublicPageText } from "@/lib/safe-fetch";
import { runWorkflow, getUserApiKeyForWorkflow } from "@/workflows/runner";
import { providerLabel } from "@/ai/router";
import { evidenceRecords } from "@/services/evidence-service";
import { createJob } from "@/services/job-service";
import {
  createJobVersion,
  ensureMasterResume,
  RESUME_CONTENT_SCHEMA,
  updateResumeContent,
  type ResumeContent,
} from "@/services/resume-service";
import {
  buildChanges,
  buildTailoringFacts,
  composeTailored,
  defaultDecisions,
  groundKeywords,
  keywordCoverage,
  type KeywordCoverage,
  type TailorChange,
  type TailorDecision,
  type TailorGap,
} from "@/domain/tailoring";
import type { ResumeTailoringOutput } from "@/ai/schemas";
import type { ManualPromptPackage } from "@/ai/providers/manual";

/**
 * Resume tailoring: one job + one resume in, a reviewable tailored resume out.
 *
 *   resolve job (saved application, pasted text, or a public link)
 *   -> load the source resume (master by default)
 *   -> RESUME_TAILORING on hosted AI (or a Manual Mode paste)
 *   -> code turns the output into guarded changes (src/domain/tailoring.ts)
 *   -> the user accepts / rejects / edits each change
 *   -> save as a new resume version linked to the job and application.
 *
 * Nothing is sent anywhere and the source resume is never modified.
 */

export interface TailorJobInput {
  applicationId?: string | null;
  /** Pasted job description. */
  jobText?: string | null;
  /** Public job link to read when no text was pasted. */
  jobUrl?: string | null;
  jobTitle?: string | null;
  company?: string | null;
}

export interface TailorInput extends TailorJobInput {
  resumeId?: string | null;
  /** Manual Mode paste-back. */
  manualInput?: string | null;
  /** Explicit "Use manual mode": return the prompt instead of calling AI. */
  manualPrompt?: boolean;
}

export interface TailorProposal {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  sourceResumeId: string;
  sourceResumeLabel: string;
  original: ResumeContent;
  changes: TailorChange[];
  gaps: TailorGap[];
  keywords: string[];
  before: KeywordCoverage;
  after: KeywordCoverage;
  generatedBy: string;
  interactionId: string;
  promptVersion: string;
  warnings: string[];
  droppedPoints: Array<{ text: string; reason: string }>;
}

/** Carries an AI failure out with its Manual Mode prompt. */
export class TailorFailure extends Error {
  readonly code: string;
  readonly prompt: ManualPromptPackage | null;
  readonly errors: string[];
  readonly applicationId: string | null;

  constructor(
    outcome: {
      userMessage: string;
      code: string;
      manualFallback: ManualPromptPackage | null;
      errors: string[];
    },
    applicationId: string | null,
  ) {
    super(outcome.userMessage);
    this.name = "TailorFailure";
    this.code = outcome.code;
    this.prompt = outcome.manualFallback;
    this.errors = outcome.errors;
    this.applicationId = applicationId;
  }
}

async function loadApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: { include: { analysis: { include: { requirements: true } } } },
      matrix: { include: { matches: { include: { requirement: true } } } },
    },
  });
  if (!application) throw Errors.notFound("Application");
  if (!application.job) throw Errors.notFound("Job for this application");
  return { ...application, job: application.job };
}

/** Saved application, or a new job + application from pasted text or a link. */
export async function resolveTailorJob(
  userId: string,
  input: TailorJobInput,
): Promise<string> {
  if (input.applicationId) {
    const app = await loadApplication(userId, input.applicationId);
    return app.id;
  }

  let description = (input.jobText ?? "").trim();
  let sourceUrl: string | null = null;
  let pageTitle = "";
  if (description.length < 80 && input.jobUrl?.trim()) {
    const page = await fetchPublicPageText(input.jobUrl.trim());
    description = page.text.slice(0, 30_000);
    sourceUrl = page.url;
    pageTitle = page.title;
  }
  if (description.length < 80) {
    throw Errors.validation(
      "Pick a saved job, paste the job description (at least 80 characters), or paste a public job link.",
    );
  }

  try {
    const job = await createJob(userId, {
      title:
        input.jobTitle?.trim() ||
        pageTitle.split(/[|–-]/)[0]?.trim() ||
        undefined,
      company: input.company?.trim() || undefined,
      description,
      sourceUrl: sourceUrl ?? undefined,
      sourceName: sourceUrl ? new URL(sourceUrl).hostname : "Pasted",
      inputSource: "PASTE",
    });
    const app = await prisma.application.findFirstOrThrow({
      where: { userId, jobId: job.id },
      select: { id: true },
    });
    return app.id;
  } catch (e) {
    // The same description was saved before: tailor against that job.
    if (e instanceof AppError && typeof e.details.jobId === "string") {
      const app = await prisma.application.findFirst({
        where: { userId, jobId: e.details.jobId },
        select: { id: true },
      });
      if (app) return app.id;
    }
    throw e;
  }
}

async function loadSourceResume(userId: string, resumeId?: string | null) {
  const resume = resumeId
    ? await prisma.resume.findFirst({
        where: { id: resumeId, userId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      })
    : await (async () => {
        const master = await ensureMasterResume(userId);
        return prisma.resume.findFirst({
          where: { id: master.id },
          include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        });
      })();
  if (!resume) throw Errors.notFound("Resume");
  const content = RESUME_CONTENT_SCHEMA.parse(
    resume.versions[0]?.content ?? {},
  );
  return { id: resume.id, label: resume.label, content };
}

function evidenceForPrompt(
  records: Awaited<ReturnType<typeof evidenceRecords>>,
) {
  return records.map((e) => ({
    statement: e.statement,
    source: e.sourceDescription || e.sourceType,
    status: e.verificationStatus,
    metric:
      e.metricValue !== null
        ? `${e.metricValue}${e.metricUnit ? ` ${e.metricUnit}` : ""}`
        : undefined,
  }));
}

export async function tailorResume(
  userId: string,
  input: TailorInput,
): Promise<TailorProposal> {
  const applicationId = await resolveTailorJob(userId, input);
  const application = await loadApplication(userId, applicationId);
  const source = await loadSourceResume(userId, input.resumeId);
  const evidence = await evidenceRecords(userId);
  const requirements = (application.job.analysis?.requirements ?? []).map(
    (r) => `${r.isMustHave ? "[must] " : ""}${r.text}`,
  );
  const jobText = application.job.rawDescription;

  const pasted = input.manualInput?.trim() || undefined;
  const outcome = await runWorkflow<ResumeTailoringOutput>({
    userId,
    workflowId: "RESUME_TAILORING",
    context: {
      jobTitle: application.job.title ?? "",
      jobText,
      requirements,
      matrixSummary: application.matrix
        ? application.matrix.matches
            .map((m) => `${m.strength}: ${m.requirement.text}`)
            .join("\n")
        : "(no match breakdown yet)",
      currentResume: source.content,
      evidence: evidenceForPrompt(evidence),
    },
    evidence,
    userApiKey: await getUserApiKeyForWorkflow(userId),
    preferManual: Boolean(pasted) || input.manualPrompt === true,
    manualInput: pasted,
  });
  if (!outcome.ok) throw new TailorFailure(outcome, applicationId);

  const facts = buildTailoringFacts(source.content, evidence);
  const { changes, gaps } = buildChanges(source.content, outcome.data, facts);

  let keywords = groundKeywords(outcome.data.jobKeywords, jobText);
  if (keywords.length === 0) {
    keywords = groundKeywords(
      [
        ...(application.job.analysis?.requirements ?? []).map((r) => r.text),
        ...outcome.data.prioritizedSkills,
      ],
      jobText,
    );
  }
  const tailored = composeTailored(
    source.content,
    changes,
    defaultDecisions(changes),
  );

  const blocked = changes.filter((c) => c.blocked).length;
  const warnings = [...outcome.warnings];
  if (blocked) {
    warnings.unshift(
      `${blocked} suggested change${blocked === 1 ? " was" : "s were"} held back because ${blocked === 1 ? "it adds" : "they add"} something your resume and evidence do not support. You can rewrite ${blocked === 1 ? "it" : "them"} in your own words.`,
    );
  }

  return {
    applicationId,
    jobId: application.job.id,
    jobTitle: application.job.title ?? "this role",
    company: application.job.company ?? "",
    sourceResumeId: source.id,
    sourceResumeLabel: source.label,
    original: source.content,
    changes,
    gaps,
    keywords,
    before: keywordCoverage(source.content, keywords),
    after: keywordCoverage(tailored, keywords),
    generatedBy: outcome.manual ? "Manual" : providerLabel(outcome.provider),
    interactionId: outcome.interactionId,
    promptVersion: outcome.promptVersion,
    warnings,
    droppedPoints: outcome.data.droppedPoints,
  };
}

const ChangeSchema = z.object({
  id: z.string().max(40),
  section: z.enum(["summary", "skills", "experience"]),
  experienceIndex: z.number().int().nonnegative().optional(),
  replacesBullet: z.number().int().nonnegative().nullable().optional(),
  before: z.string().max(4000).nullable(),
  after: z.string().max(4000),
  why: z.string().max(600),
  evidenceIds: z.array(z.number().int().nonnegative()).max(40),
  blocked: z.string().max(600).nullable(),
});

export const SaveTailoredSchema = z.object({
  applicationId: z.string().min(1).max(60),
  sourceResumeId: z.string().min(1).max(60),
  interactionId: z.string().max(60).optional(),
  promptVersion: z.string().max(80).optional(),
  changes: z.array(ChangeSchema).max(120),
  decisions: z.record(
    z.string(),
    z.object({
      accepted: z.boolean(),
      text: z.string().max(4000).optional(),
    }),
  ),
});

/**
 * Saves the reviewed result as a new resume linked to the job. The original is
 * re-read from the database, so the client only chooses which changes to keep;
 * it cannot swap in a different starting resume.
 */
export async function saveTailoredResume(
  userId: string,
  raw: unknown,
): Promise<{ resumeId: string; label: string }> {
  const parsed = SaveTailoredSchema.safeParse(raw);
  if (!parsed.success)
    throw Errors.validation("The tailored resume could not be saved.");
  const input = parsed.data;

  const application = await loadApplication(userId, input.applicationId);
  const source = await loadSourceResume(userId, input.sourceResumeId);
  const decisions = input.decisions as Record<string, TailorDecision>;
  const content = composeTailored(source.content, input.changes, decisions);

  const label = `Tailored — ${application.job.title ?? "role"}${
    application.job.company ? ` at ${application.job.company}` : ""
  }`;
  const draft = await createJobVersion({
    userId,
    jobId: application.job.id,
    applicationId: application.id,
    label: label.slice(0, 190),
  });
  await updateResumeContent({ userId, resumeId: draft.id, content });

  const meta = {
    generationId: input.interactionId ?? null,
    promptVersion: input.promptVersion ?? null,
    workflowId: "RESUME_TAILORING",
  };
  await prisma.resume.update({ where: { id: draft.id }, data: meta });
  const version = await prisma.resumeVersion.findFirst({
    where: { resumeId: draft.id },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (version) {
    await prisma.resumeVersion.update({
      where: { id: version.id },
      data: { ...meta, label: "Tailored" },
    });
  }
  return { resumeId: draft.id, label };
}

/** Options for the "pick the job" and "pick the resume" steps. */
export async function tailorOptions(userId: string) {
  await ensureMasterResume(userId);
  const [applications, resumes] = await Promise.all([
    prisma.application.findMany({
      where: { userId, jobId: { not: null } },
      select: { id: true, job: { select: { title: true, company: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.resume.findMany({
      where: { userId, isArchived: false },
      select: { id: true, label: true, isMaster: true },
      orderBy: [{ isMaster: "desc" }, { updatedAt: "desc" }],
      take: 30,
    }),
  ]);
  return {
    applications: applications.map((a) => ({
      id: a.id,
      label: `${a.job?.title ?? "Role"}${a.job?.company ? ` — ${a.job.company}` : ""}`,
    })),
    resumes: resumes.map((r) => ({
      id: r.id,
      label: r.isMaster ? `${r.label} (master)` : r.label,
      isMaster: r.isMaster,
    })),
  };
}

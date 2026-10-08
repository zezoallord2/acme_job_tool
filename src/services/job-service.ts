import { z } from "zod";
import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { hashContent } from "@/lib/crypto";
import {
  computeEvidenceMatrix,
  type RequirementInput,
} from "@/domain/matching";
import { evidenceRecords } from "./evidence-service";
import type { JobAnalysisOutput } from "@/ai/schemas";
import type { JobInputSource, RequirementPriority } from "@prisma/client";

/**
 * Job service: input, analysis persistence, requirement extraction and the
 * Match Breakdown. Analysis is stored with full workflow/prompt/validator version
 * metadata so any output can be traced back to how it was produced.
 */

export const JobInputSchema = z.object({
  title: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  description: z
    .string()
    .trim()
    .min(80, "Paste the full job description (at least 80 characters)."),
  deadlineAt: z.coerce.date().nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  sourceName: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
  inputSource: z
    .enum(["PASTE", "UPLOAD_PDF", "UPLOAD_DOCX", "UPLOAD_TXT", "MANUAL"])
    .default("PASTE"),
});

export async function createJob(userId: string, input: unknown) {
  const parsed = JobInputSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("Job details could not be saved.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6),
    });
  }
  const d = parsed.data;
  const descriptionHash = hashContent(d.description).slice(0, 32);

  const duplicate = await prisma.jobPosting.findFirst({
    where: { userId, descriptionHash },
    select: { id: true },
  });
  if (duplicate) {
    throw Errors.conflict("You already saved this job description.", {
      jobId: duplicate.id,
    });
  }

  const wordCount = d.description.split(/\s+/).filter(Boolean).length;
  const job = await prisma.jobPosting.create({
    data: {
      userId,
      title: d.title ?? null,
      company: d.company ?? null,
      location: d.location ?? null,
      contactEmail: d.contactEmail ?? null,
      sourceName: d.sourceName ?? null,
      sourceUrl: d.sourceUrl ?? null,
      rawDescription: d.description,
      descriptionHash,
      wordCount,
      inputSource: d.inputSource as JobInputSource,
      deadlineAt: d.deadlineAt ?? null,
      fileName: null,
      fileMime: null,
    },
  });

  await createOrUpdateApplication(userId, job.id);
  return job;
}

export async function createOrUpdateApplication(userId: string, jobId: string) {
  const existing = await prisma.application.findFirst({
    where: { userId, jobId },
  });
  if (existing) return existing;
  return prisma.application.create({
    data: {
      userId,
      jobId,
      status: "SAVED",
      nextAction: "Analyze the job description",
    },
  });
}

export async function getJob(userId: string, jobId: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobId, userId },
    include: { analysis: { include: { requirements: true } } },
  });
  if (!job) throw Errors.notFound("Job");
  return job;
}

export async function listJobs(userId: string, limit = 50) {
  return prisma.jobPosting.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      analysis: { select: { seniority: true, mustHaveRequirements: true } },
      application: {
        select: { id: true, status: true, appliedAt: true, priority: true },
      },
      matrices: {
        select: {
          fitClassification: true,
          coveragePercent: true,
          recommendation: true,
        },
      },
    },
  });
}

export async function deleteJob(userId: string, jobId: string): Promise<void> {
  const result = await prisma.jobPosting.deleteMany({
    where: { id: jobId, userId },
  });
  if (result.count === 0) throw Errors.notFound("Job");
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface SaveAnalysisInput {
  userId: string;
  jobId: string;
  output: JobAnalysisOutput;
  interactionId: string;
  workflowId: string;
  promptVersion: string;
  provider: JobAnalysisOutput extends never ? never : string;
  model: string;
  manual: boolean;
}

const PRIORITY_PATTERNS: Array<{
  priority: RequirementPriority;
  pattern: RegExp;
}> = [
  {
    priority: "CRITICAL",
    pattern:
      /\b(must have|required|mandatory|essential|critical|minimum qualifications)\b/i,
  },
  {
    priority: "HIGH",
    pattern:
      /\b(preferred|strongly preferred|nice to have|bonus|desirable|plus)\b/i,
  },
  {
    priority: "LOW",
    pattern: /\b(familiarity|exposure to|basic understanding)\b/i,
  },
];

export function inferPriority(
  text: string,
  isMustHave: boolean,
): RequirementPriority {
  for (const { priority, pattern } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) return priority;
  }
  return isMustHave ? "HIGH" : "MEDIUM";
}

export async function saveJobAnalysis(input: SaveAnalysisInput) {
  const job = await getJob(input.userId, input.jobId);
  const o = input.output;

  return inTransaction(async (tx) => {
    // Replace-then-recreate keeps requirement ids stable within a single write.
    await tx.jobRequirement.deleteMany({
      where: { jobAnalysisId: job.analysis?.id ?? "__none__" },
    });

    const analysis = await tx.jobAnalysis.upsert({
      where: { jobId: job.id },
      create: {
        userId: input.userId,
        jobId: job.id,
        role: o.role || null,
        company: o.company || null,
        seniority: o.seniority || null,
        summary: o.summary || null,
        mustHaveRequirements: o.mustHaveRequirements,
        preferredRequirements: o.preferredRequirements,
        responsibilities: o.responsibilities,
        hardSkills: o.hardSkills,
        softSkills: o.softSkills,
        tools: o.tools,
        educationRequirements: o.educationRequirements,
        certificationRequirements: o.certificationRequirements,
        experienceRequirement: o.experienceRequirement || null,
        repeatedThemes: o.repeatedThemes,
        importantLanguage: o.importantLanguage,
        dealBreakers: o.dealBreakers,
        warnings: o.needsInput,
        rawResult: JSON.parse(JSON.stringify(o)) as never,
        workflowId: input.workflowId,
        promptVersion: input.promptVersion,
        provider: "MANUAL",
        model: input.model,
        validatorVersion: "VALIDATOR_v3",
        interactionId: input.interactionId,
        manualMode: input.manual,
      },
      update: {
        role: o.role || null,
        company: o.company || null,
        seniority: o.seniority || null,
        summary: o.summary || null,
        mustHaveRequirements: o.mustHaveRequirements,
        preferredRequirements: o.preferredRequirements,
        responsibilities: o.responsibilities,
        hardSkills: o.hardSkills,
        softSkills: o.softSkills,
        tools: o.tools,
        educationRequirements: o.educationRequirements,
        certificationRequirements: o.certificationRequirements,
        experienceRequirement: o.experienceRequirement || null,
        repeatedThemes: o.repeatedThemes,
        importantLanguage: o.importantLanguage,
        dealBreakers: o.dealBreakers,
        warnings: o.needsInput,
        rawResult: JSON.parse(JSON.stringify(o)) as never,
        promptVersion: input.promptVersion,
        model: input.model,
        interactionId: input.interactionId,
        updatedAt: new Date(),
      },
    });

    await tx.jobRequirement.deleteMany({
      where: { jobAnalysisId: analysis.id },
    });
    const allRequirements: Array<{ text: string; isMustHave: boolean }> = [
      ...o.mustHaveRequirements.map((text) => ({ text, isMustHave: true })),
      ...o.preferredRequirements.map((text) => ({ text, isMustHave: false })),
      ...o.responsibilities
        .slice(0, 15)
        .map((text) => ({ text, isMustHave: false })),
    ];
    if (allRequirements.length > 0) {
      await tx.jobRequirement.createMany({
        data: allRequirements.map((r, i) => ({
          jobAnalysisId: analysis.id,
          text: r.text,
          normalizedKey: r.text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .slice(0, 120),
          priority: inferPriority(r.text, r.isMustHave),
          isMustHave: r.isMustHave,
          orderIndex: i,
        })),
      });
    }

    const app = await tx.application.findFirst({
      where: { userId: input.userId, jobId: job.id },
    });
    if (app && app.status === "SAVED") {
      await tx.application.update({
        where: { id: app.id },
        data: { status: "ANALYZING" },
      });
      await tx.applicationStatusEvent.create({
        data: {
          userId: input.userId,
          applicationId: app.id,
          fromStatus: "SAVED",
          toStatus: "ANALYZING",
          reason: "Job analysis completed",
        },
      });
    }

    return analysis;
  });
}

export interface MatrixBuildResult {
  matrixId: string;
  result: ReturnType<typeof computeEvidenceMatrix>;
}

/** Builds or refreshes the Match Breakdown for a job. */
export async function buildEvidenceMatrix(
  userId: string,
  jobId: string,
): Promise<MatrixBuildResult> {
  const job = await getJob(userId, jobId);
  if (!job.analysis)
    throw Errors.validation(
      "Analyze the job description before building the match breakdown.",
    );

  const requirements: RequirementInput[] = job.analysis.requirements.map(
    (r) => ({
      id: r.id,
      text: r.text,
      priority: r.priority as RequirementPriority,
      isMustHave: r.isMustHave,
    }),
  );
  const evidence = await evidenceRecords(userId);
  const result = computeEvidenceMatrix(requirements, evidence, {
    hardRequirements: job.analysis.mustHaveRequirements,
    softRequirements: job.analysis.preferredRequirements,
  });

  const saved = await inTransaction(async (tx) => {
    const matrix = await tx.evidenceMatrix.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: {
        userId,
        jobId,
        coverageStrong: result.coverage.strong,
        coveragePartial: result.coverage.partial,
        coverageMissing: result.coverage.missing,
        coverageUnknown: result.coverage.unknown,
        coveragePercent: result.coveragePercent,
        fitClassification: result.fitClassification,
        recommendation: result.recommendation,
        tailoringEffort: result.tailoringEffort,
        explanation: result.explanation,
        criticalGaps: result.criticalGaps,
        strongSignals: result.strongSignals,
      },
      update: {
        coverageStrong: result.coverage.strong,
        coveragePartial: result.coverage.partial,
        coverageMissing: result.coverage.missing,
        coverageUnknown: result.coverage.unknown,
        coveragePercent: result.coveragePercent,
        fitClassification: result.fitClassification,
        recommendation: result.recommendation,
        tailoringEffort: result.tailoringEffort,
        explanation: result.explanation,
        criticalGaps: result.criticalGaps,
        strongSignals: result.strongSignals,
        updatedAt: new Date(),
      },
    });

    await tx.evidenceMatch.deleteMany({ where: { matrixId: matrix.id } });
    const rows = result.matches.map((m) => ({
      userId,
      matrixId: matrix.id,
      requirementId: m.requirementId,
      evidenceId: m.supportingEvidenceIds[0] ?? null,
      strength: m.strength,
      priority: m.priority,
      matchBasis: m.matchBasis.slice(0, 300),
      confidence: m.confidence,
      recommendedAction: m.recommendedAction,
      isDealBreaker: m.isDealBreaker,
      explanation: m.explanation,
    }));
    if (rows.length) await tx.evidenceMatch.createMany({ data: rows });

    const app = await tx.application.findFirst({ where: { userId, jobId } });
    if (app) {
      await tx.application.update({
        where: { id: app.id },
        data: {
          fitClassification: result.fitClassification,
          effort: result.tailoringEffort,
          priority: result.recommendation,
        },
      });
      await tx.application.update({
        where: { id: app.id },
        data: { matrix: { connect: { id: matrix.id } } },
      });
    }
    return matrix;
  });

  return { matrixId: saved.id, result };
}

export async function getEvidenceMatrix(userId: string, jobId: string) {
  const matrix = await prisma.evidenceMatrix.findUnique({
    where: { userId_jobId: { userId, jobId } },
    include: {
      matches: {
        include: {
          requirement: true,
          evidence: {
            select: {
              id: true,
              statement: true,
              sourceDescription: true,
              verificationStatus: true,
            },
          },
        },
        orderBy: [{ priority: "asc" }],
      },
    },
  });
  if (!matrix) throw Errors.notFound("Evidence matrix");
  return matrix;
}

export async function recordRequirementsReviewed(
  userId: string,
  jobId: string,
): Promise<void> {
  const app = await prisma.application.findFirst({ where: { userId, jobId } });
  if (!app) throw Errors.notFound("Application");
  await prisma.application.update({
    where: { id: app.id },
    data: { nextAction: "Tailor your resume", updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action: "requirements.reviewed",
      entity: "JobPosting",
      entityId: jobId,
      outcome: "success",
    },
  });
}

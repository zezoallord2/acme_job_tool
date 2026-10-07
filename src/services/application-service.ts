import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import {
  evaluateTransition,
  allowedTransitions,
} from "@/domain/application-state";
import { hashContent } from "@/lib/crypto";
import type { ApplicationStatus, Prisma } from "@prisma/client";

/**
 * Application service. The state machine, the immutable sent snapshot and
 * optimistic concurrency all live here so no caller can bypass them.
 */

export async function listApplications(
  userId: string,
  opts?: { status?: ApplicationStatus[] },
) {
  return prisma.application.findMany({
    where: {
      userId,
      ...(opts?.status?.length ? { status: { in: opts.status } } : {}),
    },
    orderBy: [{ nextActionDue: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          deadlineAt: true,
          sourceName: true,
        },
      },
      matrix: {
        select: {
          fitClassification: true,
          coveragePercent: true,
          recommendation: true,
        },
      },
      resumes: {
        where: { isArchived: false },
        select: { id: true, label: true, isMaster: true },
      },
      interviews: { select: { id: true, scheduledAt: true, stage: true } },
      snapshots: { select: { id: true, sealedAt: true } },
      followUps: {
        where: { status: "DRAFT" },
        select: { id: true, scheduledFor: true, type: true },
      },
      _count: { select: { answers: true, coverLetters: true } },
    },
  });
}

export async function getApplication(userId: string, applicationId: string) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      statusEvents: { orderBy: { createdAt: "asc" } },
      resumes: {
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
      coverLetters: { where: { isCurrent: true } },
      answers: true,
      snapshots: { orderBy: { createdAt: "desc" } },
      readinessChecks: true,
      matrix: {
        include: {
          matches: { include: { requirement: true, evidence: true } },
        },
      },
      interviews: true,
      followUps: { orderBy: { scheduledFor: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      outcomes: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!app) throw Errors.notFound("Application");
  return app;
}

export interface TransitionOptions {
  reason?: string;
  actorType?: string;
  traceId?: string;
  /** Version the caller believes it read; mismatch produces a conflict. */
  expectedVersion?: number;
  /** Whether a sealed snapshot must already exist (default: true past READY). */
  requireSnapshot?: boolean;
}

/**
 * Validates first, then writes the state change and its history event in one
 * transaction. A rejected transition performs no write at all.
 */
export async function transitionApplication(
  userId: string,
  applicationId: string,
  to: ApplicationStatus,
  opts: TransitionOptions = {},
) {
  const current = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { snapshots: { select: { id: true }, take: 1 } },
  });
  if (!current) throw Errors.notFound("Application");

  if (
    opts.expectedVersion !== undefined &&
    opts.expectedVersion !== current.version
  ) {
    throw Errors.conflict(
      "This application changed since you last loaded it.",
      {
        expectedVersion: opts.expectedVersion,
        currentVersion: current.version,
      },
    );
  }

  const decision = evaluateTransition(current.status, to, {
    requiresSnapshot:
      opts.requireSnapshot ??
      !["SAVED", "ANALYZING", "ARCHIVED", "WITHDRAWN"].includes(to),
    hasSnapshot: current.snapshots.length > 0,
  });

  if (!decision.allowed) {
    // Thrown before any write: no partial update, no history entry.
    throw new (await import("@/lib/errors")).AppError({
      code: "INVALID_TRANSITION",
      category: "CONFLICT",
      message:
        decision.reason ?? `Cannot move from ${current.status} to ${to}.`,
      details: {
        from: current.status,
        to,
        allowed: allowedTransitions(current.status),
      },
    });
  }

  return inTransaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === "APPLIED" && !current.appliedAt
          ? { appliedAt: new Date() }
          : {}),
        ...(["OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"].includes(to)
          ? { closedAt: new Date() }
          : {}),
      },
    });
    await tx.applicationStatusEvent.create({
      data: {
        userId,
        applicationId,
        fromStatus: current.status,
        toStatus: to,
        reason: opts.reason ?? null,
        actorType: opts.actorType ?? "user",
        traceId: opts.traceId ?? null,
      },
    });
    return updated;
  });
}

/**
 * Creates the immutable sent snapshot. Once written the row can never change:
 * the hash is stored so any mutation is detectable, and updates are refused.
 */
export async function sealApplicationSnapshot(
  userId: string,
  applicationId: string,
) {
  return inTransaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, userId },
      include: {
        job: { include: { analysis: true } },
        snapshots: true,
        resumes: {
          include: {
            sections: true,
            versions: { orderBy: { version: "desc" }, take: 1 },
          },
        },
        coverLetters: { where: { isCurrent: true } },
        answers: true,
        matrix: { include: { matches: true } },
      },
    });
    if (!app) throw Errors.notFound("Application");
    if (app.snapshots.length > 0) {
      // Idempotent: re-sealing returns the original snapshot untouched.
      return app.snapshots[0]!;
    }
    if (!app.job)
      throw Errors.validation(
        "This application has no job description to snapshot.",
      );

    const resume = app.resumes.find((r) => !r.isMaster) ?? app.resumes[0];
    const resumeContent = resume
      ? {
          label: resume.label,
          template: resume.template,
          sections: resume.sections.map((s) => ({
            type: s.type,
            title: s.title,
            content: s.content,
          })),
          latestVersion: resume.versions[0]?.content ?? null,
        }
      : null;

    const letter = app.coverLetters[0];
    const evidenceState = await tx.evidence.findMany({
      where: { userId },
      select: {
        id: true,
        statement: true,
        verificationStatus: true,
        metricValue: true,
        metricUnit: true,
        metricStatus: true,
      },
    });

    const payload = {
      jobDescription: app.job.rawDescription,
      jobAnalysis: app.job.analysis
        ? {
            role: app.job.analysis.role,
            company: app.job.analysis.company,
            seniority: app.job.analysis.seniority,
            summary: app.job.analysis.summary,
            mustHaveRequirements: app.job.analysis.mustHaveRequirements,
            preferredRequirements: app.job.analysis.preferredRequirements,
            responsibilities: app.job.analysis.responsibilities,
          }
        : null,
      evidenceMatrix: app.matrix
        ? {
            fitClassification: app.matrix.fitClassification,
            recommendation: app.matrix.recommendation,
            coveragePercent: app.matrix.coveragePercent,
            matches: app.matrix.matches.map((m) => ({
              strength: m.strength,
              priority: m.priority,
              explanation: m.explanation,
            })),
          }
        : null,
      resumeContent,
      coverLetterContent: letter
        ? { subject: letter.body.slice(0, 120), body: letter.body }
        : null,
      answers: app.answers.map((a) => ({
        question: a.question,
        answer: a.answer,
      })),
      evidenceState,
      contactInfo: {
        sourceName: app.job.sourceName,
        contactEmail: app.job.contactEmail,
        location: app.job.location,
      },
    };

    const contentHash = hashContent(payload);

    return tx.applicationSnapshot.create({
      data: {
        userId,
        applicationId,
        label:
          `Sent — ${app.job.company ?? "company"} ${app.job.title ?? ""}`.trim(),
        jobDescription: app.job.rawDescription,
        jobAnalysis: payload.jobAnalysis as never,
        evidenceMatrix: payload.evidenceMatrix as never,
        resumeContent: payload.resumeContent as never,
        coverLetterContent: payload.coverLetterContent as never,
        answers: payload.answers as never,
        evidenceState: payload.evidenceState as never,
        contactInfo: payload.contactInfo as never,
        contentHash,
        isImmutable: true,
        applicationStatus: "APPLIED",
      },
    });
  });
}

export async function updateApplicationMeta(
  userId: string,
  applicationId: string,
  data: {
    userPriority?: number;
    nextAction?: string | null;
    nextActionDue?: Date | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactRole?: string | null;
    notes?: string | null;
    expectedVersion?: number;
  },
) {
  const current = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!current) throw Errors.notFound("Application");
  if (
    data.expectedVersion !== undefined &&
    data.expectedVersion !== current.version
  ) {
    throw Errors.conflict(
      "This application changed since you last loaded it.",
      {
        expectedVersion: data.expectedVersion,
        currentVersion: current.version,
      },
    );
  }
  if (data.notes !== undefined && data.notes !== null) {
    await prisma.applicationNote.create({
      data: { userId, applicationId, body: data.notes },
    });
  }
  return prisma.application.update({
    where: { id: applicationId },
    data: {
      ...(data.userPriority !== undefined
        ? { userPriority: data.userPriority }
        : {}),
      ...(data.nextAction !== undefined ? { nextAction: data.nextAction } : {}),
      ...(data.nextActionDue !== undefined
        ? { nextActionDue: data.nextActionDue }
        : {}),
      ...(data.contactName !== undefined
        ? { contactName: data.contactName }
        : {}),
      ...(data.contactEmail !== undefined
        ? { contactEmail: data.contactEmail }
        : {}),
      ...(data.contactRole !== undefined
        ? { contactRole: data.contactRole }
        : {}),
      version: { increment: 1 },
    },
  });
}

export async function recordOutcome(
  userId: string,
  applicationId: string,
  type:
    | "SUBMITTED"
    | "REPLIED"
    | "REJECTED"
    | "SCREENING"
    | "INTERVIEW"
    | "OFFER"
    | "DECLINED"
    | "WITHDRAWN",
  detail?: string,
) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!app) throw Errors.notFound("Application");
  const outcome = await prisma.applicationOutcome.create({
    data: { userId, applicationId, type, detail: detail ?? null },
  });
  if (type === "REJECTED" || type === "WITHDRAWN") {
    await transitionApplication(
      userId,
      applicationId,
      type === "REJECTED" ? "REJECTED" : "WITHDRAWN",
      {
        reason: detail ?? "Outcome recorded",
      },
    ).catch(() => undefined);
  }
  return outcome;
}

export interface TrackerRow {
  id: string;
  company: string | null;
  role: string | null;
  location: string | null;
  source: string | null;
  dateSaved: Date;
  dateApplied: Date | null;
  status: ApplicationStatus;
  evidenceFit: string | null;
  coveragePercent: number | null;
  resumeLabel: string | null;
  interviewDate: Date | null;
  nextAction: string | null;
  nextActionDue: Date | null;
  followUpDue: Date | null;
  noteCount: number;
}

export async function trackerRows(userId: string): Promise<TrackerRow[]> {
  const apps = await prisma.application.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      job: {
        select: {
          company: true,
          title: true,
          location: true,
          sourceName: true,
          createdAt: true,
        },
      },
      matrix: { select: { fitClassification: true, coveragePercent: true } },
      resumes: {
        where: { isArchived: false },
        take: 1,
        select: { label: true },
      },
      interviews: {
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { scheduledAt: true },
      },
      followUps: {
        where: { status: "DRAFT" },
        orderBy: { scheduledFor: "asc" },
        take: 1,
        select: { scheduledFor: true },
      },
      _count: { select: { notes: true } },
    },
  });

  return apps.map((a) => ({
    id: a.id,
    company: a.job?.company ?? null,
    role: a.job?.title ?? null,
    location: a.job?.location ?? null,
    source: a.job?.sourceName ?? null,
    dateSaved: a.job?.createdAt ?? a.createdAt,
    dateApplied: a.appliedAt,
    status: a.status,
    evidenceFit: a.matrix?.fitClassification ?? null,
    coveragePercent: a.matrix?.coveragePercent ?? null,
    resumeLabel: a.resumes[0]?.label ?? null,
    interviewDate: a.interviews[0]?.scheduledAt ?? null,
    nextAction: a.nextAction,
    nextActionDue: a.nextActionDue,
    followUpDue: a.followUps[0]?.scheduledFor ?? null,
    noteCount: a._count.notes,
  }));
}

export async function applicationFunnel(userId: string) {
  const grouped = await prisma.application.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const map: Partial<Record<ApplicationStatus, number>> = {};
  for (const g of grouped) map[g.status] = g._count._all;
  return map;
}

export async function deleteApplication(
  userId: string,
  applicationId: string,
): Promise<void> {
  const result = await prisma.application.deleteMany({
    where: { id: applicationId, userId },
  });
  if (result.count === 0) throw Errors.notFound("Application");
}

export type { Prisma };

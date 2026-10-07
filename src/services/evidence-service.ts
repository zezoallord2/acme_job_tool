import { z } from "zod";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import type { EvidenceRecord } from "@/domain/evidence";
import type {
  ClaimType,
  EvidenceSourceType,
  MetricStatus,
  VerificationStatus,
} from "@prisma/client";

/**
 * Evidence Ledger service. Owns verification transitions so that no caller can
 * promote an inferred record into a fact without an explicit user action.
 */

export const EvidenceInputSchema = z.object({
  statement: z.string().trim().min(5).max(1000),
  claimType: z.enum([
    "SKILL",
    "TOOL",
    "ACHIEVEMENT",
    "RESPONSIBILITY",
    "LEADERSHIP",
    "METRIC",
    "EDUCATION",
    "CERTIFICATION",
    "EMPLOYMENT",
    "DATE",
    "SOFT_SKILL",
  ]),
  sourceType: z.enum([
    "EMPLOYMENT",
    "EDUCATION",
    "CERTIFICATION",
    "PROJECT",
    "VOLUNTEER",
    "SKILL",
    "WORK_SAMPLE",
    "DOCUMENT",
    "INTERVIEW_RECALL",
    "USER_STATEMENT",
    "OTHER",
  ]),
  sourceDescription: z.string().trim().min(2).max(300),
  sourceEntityId: z.string().max(80).nullable().optional(),
  verificationStatus: z
    .enum([
      "VERIFIED",
      "USER_CONFIRMED",
      "UNVERIFIED",
      "CONFLICTED",
      "REJECTED",
    ])
    .default("USER_CONFIRMED"),
  confidenceCategory: z
    .enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"])
    .default("MEDIUM"),
  metricValue: z.number().finite().nullable().optional(),
  metricUnit: z.string().trim().max(40).nullable().optional(),
  metricStatus: z
    .enum(["VERIFIED", "USER_ESTIMATE", "UNKNOWN", "NOT_APPLICABLE"])
    .default("NOT_APPLICABLE"),
  dateRangeStart: z.coerce.date().nullable().optional(),
  dateRangeEnd: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export type EvidenceInput = z.infer<typeof EvidenceInputSchema>;

export async function createEvidence(userId: string, input: unknown) {
  const parsed = EvidenceInputSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("Evidence could not be saved.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 8),
    });
  }
  const d = parsed.data;

  if (d.metricValue !== null && d.metricValue !== undefined && !d.metricUnit) {
    throw Errors.validation(
      'A numeric metric needs a unit, for example "tickets" or "%".',
    );
  }
  if (
    d.dateRangeStart &&
    d.dateRangeEnd &&
    d.dateRangeEnd.getTime() < d.dateRangeStart.getTime()
  ) {
    throw Errors.validation("The end of the date range is before its start.");
  }

  return prisma.evidence.create({
    data: {
      userId,
      statement: d.statement,
      claimType: d.claimType as ClaimType,
      sourceType: d.sourceType as EvidenceSourceType,
      sourceDescription: d.sourceDescription,
      sourceEntityId: d.sourceEntityId ?? null,
      verificationStatus: d.verificationStatus as VerificationStatus,
      confidenceCategory: d.confidenceCategory,
      metricValue: d.metricValue ?? null,
      metricUnit: d.metricUnit ?? null,
      metricStatus: d.metricStatus as MetricStatus,
      dateRangeStart: d.dateRangeStart ?? null,
      dateRangeEnd: d.dateRangeEnd ?? null,
      tags: d.tags,
      createdBy: "user",
      lastConfirmedAt:
        d.verificationStatus === "VERIFIED" ||
        d.verificationStatus === "USER_CONFIRMED"
          ? new Date()
          : null,
    },
  });
}

export async function listEvidence(
  userId: string,
  opts?: { verificationStatus?: VerificationStatus; claimType?: ClaimType },
) {
  return prisma.evidence.findMany({
    where: {
      userId,
      ...(opts?.verificationStatus
        ? { verificationStatus: opts.verificationStatus }
        : {}),
      ...(opts?.claimType ? { claimType: opts.claimType } : {}),
    },
    orderBy: [{ verificationStatus: "desc" }, { updatedAt: "desc" }],
  });
}

/** Domain shape used by matching, claims and consistency. */
export async function evidenceRecords(
  userId: string,
): Promise<EvidenceRecord[]> {
  const rows = await prisma.evidence.findMany({
    where: { userId, verificationStatus: { not: "REJECTED" } },
  });
  return rows.map((r) => ({
    id: r.id,
    statement: r.statement,
    claimType: r.claimType,
    verificationStatus: r.verificationStatus,
    confidenceCategory: r.confidenceCategory,
    metricValue: r.metricValue,
    metricUnit: r.metricUnit,
    metricStatus: r.metricStatus,
    sourceType: r.sourceType,
    sourceDescription: r.sourceDescription,
    tags: r.tags,
    employmentId: r.employmentId,
    projectId: r.projectId,
    educationId: r.educationId,
    certificationId: r.certificationId,
    skillId: r.skillId,
  }));
}

export async function evidenceMap(
  userId: string,
): Promise<Map<string, EvidenceRecord>> {
  const records = await evidenceRecords(userId);
  return new Map(records.map((r) => [r.id, r]));
}

/**
 * Verification transitions are explicit. `UNVERIFIED -> USER_CONFIRMED` requires
 * the user's action, which is what makes the ledger trustworthy.
 */
const VERIFICATION_TRANSITIONS: Record<
  VerificationStatus,
  VerificationStatus[]
> = {
  UNVERIFIED: ["USER_CONFIRMED", "VERIFIED", "REJECTED", "CONFLICTED"],
  USER_CONFIRMED: ["VERIFIED", "UNVERIFIED", "REJECTED", "CONFLICTED"],
  VERIFIED: ["USER_CONFIRMED", "UNVERIFIED", "CONFLICTED", "REJECTED"],
  CONFLICTED: ["USER_CONFIRMED", "VERIFIED", "REJECTED", "UNVERIFIED"],
  REJECTED: ["UNVERIFIED"],
};

export function canChangeVerification(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  return VERIFICATION_TRANSITIONS[from].includes(to);
}

export async function updateVerification(
  userId: string,
  evidenceId: string,
  to: VerificationStatus,
  note?: string,
) {
  const record = await prisma.evidence.findFirst({
    where: { id: evidenceId, userId },
  });
  if (!record) throw Errors.notFound("Evidence");
  if (!canChangeVerification(record.verificationStatus, to)) {
    throw Errors.validation(
      `Evidence cannot move from ${record.verificationStatus} to ${to}.`,
    );
  }
  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      verificationStatus: to,
      lastConfirmedAt:
        to === "USER_CONFIRMED" || to === "VERIFIED" ? new Date() : null,
      ...(to === "REJECTED" && note
        ? { tags: { push: `rejected: ${note.slice(0, 80)}` } }
        : {}),
    },
  });
}

export async function updateEvidence(
  userId: string,
  evidenceId: string,
  input: Partial<EvidenceInput>,
) {
  const parsed = EvidenceInputSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw Errors.validation("Evidence could not be updated.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 8),
    });
  }
  const existing = await prisma.evidence.findFirst({
    where: { id: evidenceId, userId },
  });
  if (!existing) throw Errors.notFound("Evidence");
  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      ...(parsed.data.statement !== undefined
        ? { statement: parsed.data.statement }
        : {}),
      ...(parsed.data.claimType !== undefined
        ? { claimType: parsed.data.claimType as ClaimType }
        : {}),
      ...(parsed.data.sourceDescription !== undefined
        ? { sourceDescription: parsed.data.sourceDescription }
        : {}),
      ...(parsed.data.metricValue !== undefined
        ? { metricValue: parsed.data.metricValue ?? null }
        : {}),
      ...(parsed.data.metricUnit !== undefined
        ? { metricUnit: parsed.data.metricUnit ?? null }
        : {}),
      ...(parsed.data.metricStatus !== undefined
        ? { metricStatus: parsed.data.metricStatus as MetricStatus }
        : {}),
      revision: { increment: 1 },
    },
  });
}

export async function deleteEvidence(
  userId: string,
  evidenceId: string,
): Promise<void> {
  const result = await prisma.evidence.deleteMany({
    where: { id: evidenceId, userId },
  });
  if (result.count === 0) throw Errors.notFound("Evidence");
}

export async function evidenceStats(userId: string) {
  const grouped = await prisma.evidence.groupBy({
    by: ["verificationStatus"],
    where: { userId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {
    VERIFIED: 0,
    USER_CONFIRMED: 0,
    UNVERIFIED: 0,
    CONFLICTED: 0,
    REJECTED: 0,
  };
  for (const g of grouped) counts[g.verificationStatus] = g._count._all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}

export async function recordEvidenceConflict(input: {
  userId: string;
  field: string;
  description: string;
  entityAId?: string | null;
  entityBId?: string | null;
  valueA?: string | null;
  valueB?: string | null;
  evidenceId?: string | null;
  type?: "MISSING" | "CONFLICTING";
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  return prisma.evidenceConflict.create({
    data: {
      userId: input.userId,
      type: input.type ?? "CONFLICTING",
      field: input.field,
      description: input.description,
      entityAId: input.entityAId ?? null,
      entityBId: input.entityBId ?? null,
      valueA: input.valueA ?? null,
      valueB: input.valueB ?? null,
      evidenceId: input.evidenceId ?? null,
      severity: input.severity ?? "MEDIUM",
    },
  });
}

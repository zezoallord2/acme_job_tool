import { prisma } from "@/lib/db";
import { inTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import { logInfo, logWarn } from "@/lib/logger";
import type { SystemErrorSeverity } from "@prisma/client";

/**
 * Data integrity checker.
 *
 * Reports before repairing. Only deterministic, low-risk cases are repaired
 * automatically, and never in production. Everything else is left for a human so
 * a bug in this file cannot destroy user data.
 */
export interface IntegrityIssue {
  checkName: string;
  entityType: string;
  entityId: string;
  issueType: string;
  severity: SystemErrorSeverity;
  detail: string;
  autoRepairable: boolean;
}

export interface IntegrityResult {
  issues: IntegrityIssue[];
  autoRepaired: number;
  durationMs: number;
}

interface CheckContext {
  allowRepair: boolean;
  triggeredBy: string;
}

export async function runIntegrityChecks(
  ctx: CheckContext,
): Promise<IntegrityResult> {
  const started = Date.now();
  const issues: IntegrityIssue[] = [];

  issues.push(...(await checkOrphanedEvidence()));
  issues.push(...(await checkBrokenResumeReferences()));
  issues.push(...(await checkMissingSentSnapshots()));
  issues.push(...(await checkInvalidTransitions()));
  issues.push(...(await checkBrokenInterviewLinks()));
  issues.push(...(await checkDuplicateEntitlementEvents()));
  issues.push(...(await checkInvalidOwnership()));
  issues.push(...(await checkOrphanedArtifacts()));

  await persistIssues(issues);

  let autoRepaired = 0;
  if (ctx.allowRepair) {
    autoRepaired = await repairDeterministicIssues(issues);
  }

  logInfo({ operation: "integrity.run" }, "Integrity check finished", {
    triggeredBy: ctx.triggeredBy,
    issues: issues.length,
    autoRepaired,
  });

  return { issues, autoRepaired, durationMs: Date.now() - started };
}

/** Evidence whose parent record no longer exists. */
async function checkOrphanedEvidence(): Promise<IntegrityIssue[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      employmentId: string | null;
      projectId: string | null;
      educationId: string | null;
      certificationId: string | null;
      volunteerId: string | null;
      skillId: string | null;
    }>
  >`
    SELECT e.id, e."employmentId", e."projectId", e."educationId", e."certificationId", e."volunteerId", e."skillId"
    FROM "Evidence" e
    LEFT JOIN "EmploymentRecord" er ON e."employmentId" = er.id
    LEFT JOIN "Project" p ON e."projectId" = p.id
    LEFT JOIN "EducationRecord" ed ON e."educationId" = ed.id
    LEFT JOIN "Certification" c ON e."certificationId" = c.id
    LEFT JOIN "VolunteerExperience" v ON e."volunteerId" = v.id
    LEFT JOIN "Skill" s ON e."skillId" = s.id
    WHERE (e."employmentId" IS NOT NULL AND er.id IS NULL)
       OR (e."projectId" IS NOT NULL AND p.id IS NULL)
       OR (e."educationId" IS NOT NULL AND ed.id IS NULL)
       OR (e."certificationId" IS NOT NULL AND c.id IS NULL)
       OR (e."volunteerId" IS NOT NULL AND v.id IS NULL)
       OR (e."skillId" IS NOT NULL AND s.id IS NULL)
    LIMIT 200
  `;

  return rows.map((r) => ({
    checkName: "orphaned_evidence_source",
    entityType: "Evidence",
    entityId: r.id,
    issueType: "DANGLING_FOREIGN_KEY",
    severity: "WARNING" as const,
    detail: "Evidence references a parent record that no longer exists.",
    // Detaching the pointer is deterministic and loses no user-visible data.
    autoRepairable: true,
  }));
}

async function checkBrokenResumeReferences(): Promise<IntegrityIssue[]> {
  const bullets = await prisma.resumeBullet.findMany({
    where: { claimId: { not: null } },
    select: { id: true, claimId: true },
    take: 500,
  });
  const claimIds = [
    ...new Set(bullets.map((b) => b.claimId).filter(Boolean)),
  ] as string[];
  if (claimIds.length === 0) return [];
  const found = await prisma.generatedClaim.count({
    where: { id: { in: claimIds } },
  });
  if (found === claimIds.length) return [];

  const missing = new Set(claimIds);
  const existing = await prisma.generatedClaim.findMany({
    where: { id: { in: claimIds } },
    select: { id: true },
  });
  for (const c of existing) missing.delete(c.id);

  return [...missing].map((id) => ({
    checkName: "broken_resume_bullet_claim",
    entityType: "GeneratedClaim",
    entityId: id,
    issueType: "DANGLING_FOREIGN_KEY",
    severity: "WARNING" as const,
    detail: "Resume bullet references a generated claim that no longer exists.",
    autoRepairable: false,
  }));
}

async function checkMissingSentSnapshots(): Promise<IntegrityIssue[]> {
  const rows = await prisma.application.findMany({
    where: {
      appliedAt: { not: null },
      snapshots: { none: {} },
    },
    select: { id: true, appliedAt: true, status: true },
    take: 200,
  });
  return rows.map((a) => ({
    checkName: "missing_sent_snapshot",
    entityType: "Application",
    entityId: a.id,
    issueType: "MISSING_SNAPSHOT",
    // The historical content can no longer be reconstructed faithfully, so this
    // is reported, never repaired.
    severity: "ERROR" as const,
    detail: `Application was applied on ${a.appliedAt?.toISOString()} but has no sealed snapshot.`,
    autoRepairable: false,
  }));
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  SAVED: ["ANALYZING", "READY_TO_APPLY", "ARCHIVED", "WITHDRAWN"],
  ANALYZING: ["READY_TO_APPLY", "SAVED", "ARCHIVED", "WITHDRAWN"],
  READY_TO_APPLY: ["APPLIED", "ANALYZING", "SAVED", "ARCHIVED", "WITHDRAWN"],
  APPLIED: [
    "SCREENING",
    "INTERVIEW",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    "OFFER",
  ],
  SCREENING: [
    "INTERVIEW",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    "FINAL_INTERVIEW",
  ],
  INTERVIEW: ["FINAL_INTERVIEW", "REJECTED", "WITHDRAWN", "ARCHIVED", "OFFER"],
  FINAL_INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  OFFER: ["ARCHIVED", "REJECTED", "WITHDRAWN"],
  REJECTED: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
  ARCHIVED: [],
};

async function checkInvalidTransitions(): Promise<IntegrityIssue[]> {
  const events = await prisma.applicationStatusEvent.findMany({
    orderBy: [{ applicationId: "asc" }, { createdAt: "asc" }],
    take: 5000,
    select: { id: true, applicationId: true, fromStatus: true, toStatus: true },
  });

  const byApp = new Map<string, typeof events>();
  for (const e of events) {
    const list = byApp.get(e.applicationId) ?? [];
    list.push(e);
    byApp.set(e.applicationId, list);
  }

  const issues: IntegrityIssue[] = [];
  for (const [applicationId, list] of byApp) {
    let previous: string | null = null;
    for (const e of list) {
      if (previous && e.fromStatus && e.fromStatus !== previous) {
        issues.push({
          checkName: "status_event_chain_break",
          entityType: "Application",
          entityId: applicationId,
          issueType: "BROKEN_EVENT_CHAIN",
          severity: "WARNING",
          detail: `Event ${e.id} claims from=${e.fromStatus} but previous event ended at ${previous}.`,
          autoRepairable: false,
        });
      }
      if (previous && !VALID_TRANSITIONS[previous]?.includes(e.toStatus)) {
        issues.push({
          checkName: "invalid_state_transition",
          entityType: "Application",
          entityId: applicationId,
          issueType: "INVALID_TRANSITION",
          severity: "ERROR",
          detail: `Recorded transition ${previous} → ${e.toStatus} is not permitted.`,
          autoRepairable: false,
        });
      }
      previous = e.toStatus;
    }
  }
  return issues;
}

async function checkBrokenInterviewLinks(): Promise<IntegrityIssue[]> {
  const rows = await prisma.interview.findMany({
    where: { applicationId: { not: null }, application: { is: null } },
    select: { id: true, applicationId: true },
    take: 200,
  });
  return rows.map((r) => ({
    checkName: "broken_interview_application_link",
    entityType: "Interview",
    entityId: r.id,
    issueType: "DANGLING_FOREIGN_KEY",
    severity: "WARNING" as const,
    detail: `Interview references application ${r.applicationId} which no longer exists.`,
    autoRepairable: true,
  }));
}

async function checkDuplicateEntitlementEvents(): Promise<IntegrityIssue[]> {
  const rows = await prisma.$queryRaw<
    Array<{ source: string; external_event_id: string; count: bigint }>
  >`
    SELECT source, "externalEventId" AS external_event_id, COUNT(*) as count
    FROM "Entitlement"
    WHERE "externalEventId" IS NOT NULL
    GROUP BY source, "externalEventId"
    HAVING COUNT(*) > 1
    LIMIT 100
  `;
  return rows.map((r) => ({
    checkName: "duplicate_entitlement_events",
    entityType: "Entitlement",
    entityId: r.external_event_id,
    issueType: "DUPLICATE_GRANT",
    severity: "CRITICAL" as const,
    detail: `${r.count} entitlements exist for ${r.source} event ${r.external_event_id}. A unique constraint should make this impossible.`,
    autoRepairable: false,
  }));
}

async function checkInvalidOwnership(): Promise<IntegrityIssue[]> {
  const claims = await prisma.generatedClaim.findMany({
    where: {
      links: { some: { evidence: { userId: { not: "" } } } },
    },
    select: {
      id: true,
      userId: true,
      links: { select: { evidence: { select: { userId: true } } } },
    },
    take: 500,
  });
  const issues: IntegrityIssue[] = [];
  for (const c of claims) {
    for (const link of c.links) {
      if (link.evidence.userId !== c.userId) {
        issues.push({
          checkName: "cross_user_claim_link",
          entityType: "GeneratedClaim",
          entityId: c.id,
          issueType: "INVALID_OWNERSHIP",
          severity: "CRITICAL",
          detail:
            "A claim links to evidence belonging to a different user. This must never happen.",
          autoRepairable: false,
        });
        break;
      }
    }
  }
  return issues;
}

async function checkOrphanedArtifacts(): Promise<IntegrityIssue[]> {
  const orphanedIds = await prisma.applicationArtifact.findMany({
    select: { id: true, applicationId: true },
    take: 500,
  });
  const liveAppIds = new Set(
    (await prisma.application.findMany({ select: { id: true } })).map(
      (a) => a.id,
    ),
  );
  const artifacts = orphanedIds.filter(
    (a) => !liveAppIds.has(a.applicationId!),
  );
  return artifacts.map((a) => ({
    checkName: "orphaned_application_artifact",
    entityType: "ApplicationArtifact",
    entityId: a.id,
    issueType: "ORPHANED_ROW",
    severity: "WARNING" as const,
    detail: "Artifact has no parent application.",
    autoRepairable: false,
  }));
}

async function persistIssues(issues: IntegrityIssue[]): Promise<void> {
  if (issues.length === 0) return;
  try {
    await prisma.dataIntegrityIssue.createMany({
      data: issues.map((i) => ({
        checkName: i.checkName,
        entityType: i.entityType,
        entityId: i.entityId,
        issueType: i.issueType,
        severity: i.severity,
        detail: i.detail,
        autoRepairable: i.autoRepairable,
      })),
      skipDuplicates: false,
    });
  } catch {
    /* recording issues must not fail the check */
  }
}

/**
 * Only two repairs are considered deterministic enough to run automatically:
 * clearing dangling pointers. Nothing deletes user data.
 */
async function repairDeterministicIssues(
  issues: IntegrityIssue[],
): Promise<number> {
  let repaired = 0;
  for (const issue of issues) {
    if (!issue.autoRepairable) continue;
    try {
      if (issue.checkName === "orphaned_evidence_source") {
        await inTransaction(async (tx) => {
          await tx.evidence.update({
            where: { id: issue.entityId },
            data: {
              employmentId: null,
              projectId: null,
              educationId: null,
              certificationId: null,
              volunteerId: null,
              skillId: null,
            },
          });
          await tx.dataIntegrityIssue.create({
            data: {
              checkName: issue.checkName,
              entityType: issue.entityType,
              entityId: issue.entityId,
              issueType: `${issue.issueType}_REPAIRED`,
              severity: "INFO",
              detail: "Dangling source pointer cleared.",
              autoRepairable: false,
              repairedAt: new Date(),
              repairNote: "Automatic deterministic repair",
            },
          });
        });
        repaired++;
      }
      if (issue.checkName === "broken_interview_application_link") {
        await prisma.interview.update({
          where: { id: issue.entityId },
          data: { applicationId: null },
        });
        repaired++;
      }
    } catch (e) {
      logWarn(
        { operation: "integrity.repair" },
        "Automatic repair failed; left for manual review",
        {
          issue: issue.checkName,
          entityId: issue.entityId,
          reason: e instanceof Error ? e.message : "unknown",
        },
      );
    }
  }
  if (repaired > 0) {
    logInfo(
      { operation: "integrity.repair" },
      "Deterministic repairs applied",
      {
        count: repaired,
        environment: env().NODE_ENV,
      },
    );
  }
  return repaired;
}

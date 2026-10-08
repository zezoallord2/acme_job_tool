import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import {
  assessClaim,
  type ClaimCandidate,
  type EvidenceRecord,
} from "@/domain/evidence";
import {
  checkConsistency,
  evaluateReadiness,
  type ConsistencyIssue,
  type ReadinessResult,
} from "@/domain/readiness";
import { newIdempotencyKey } from "@/lib/crypto";
import type { ClaimType, ClaimVerificationState } from "@prisma/client";

/**
 * Truth Check + Cross-Document Consistency + Readiness Gate.
 *
 * Every generated claim keeps its evidence links, so "Why is Acme Jobs saying
 * this?" is always answerable.
 */

export interface PersistClaimsInput {
  userId: string;
  interactionId: string;
  generationId?: string;
  artifactType: string;
  artifactId?: string;
  workflowId?: string;
  promptVersion?: string;
  claims: ClaimCandidate[];
  evidence: Map<string, EvidenceRecord>;
}

export interface StoredClaim {
  id: string;
  claimText: string;
  verificationState: ClaimVerificationState;
  riskLevel: string;
  explanation: string;
  supportingEvidenceIds: string[];
  excludedEvidenceIds: string[];
  unsupportedAspects: string[];
}

export async function persistClaims(
  input: PersistClaimsInput,
): Promise<StoredClaim[]> {
  const generationId = input.generationId ?? newIdempotencyKey("gen");
  const stored: StoredClaim[] = [];

  await inTransaction(async (tx) => {
    for (const claim of input.claims) {
      const assessment = assessClaim(claim, input.evidence);
      const row = await tx.generatedClaim.create({
        data: {
          userId: input.userId,
          claimText: claim.text,
          claimType: (claim.type as ClaimType) ?? "ACHIEVEMENT",
          verificationState: assessment.state,
          riskLevel: assessment.riskLevel,
          explanation: assessment.explanation,
          generationId,
          artifactType: input.artifactType,
          artifactId: input.artifactId,
          interactionId: input.interactionId,
          workflowId: input.workflowId,
          promptVersion: input.promptVersion,
        },
      });
      for (const evidenceId of new Set([
        ...assessment.supportingEvidenceIds,
        ...assessment.excludedEvidenceIds,
      ])) {
        if (typeof evidenceId !== "string" || evidenceId.length === 0) continue;
        const alreadyLinked = await tx.claimEvidenceLink.findFirst({
          where: { claimId: row.id, evidenceId },
          select: { id: true },
        });
        if (alreadyLinked) continue;
        await tx.claimEvidenceLink.create({
          data: {
            claimId: row.id,
            evidenceId,
            relation: assessment.supportingEvidenceIds.includes(evidenceId)
              ? "SUPPORTS"
              : "EXCLUDED",
            weight: assessment.supportingEvidenceIds.includes(evidenceId)
              ? 1
              : 0,
          },
        });
      }
      stored.push({
        id: row.id,
        claimText: row.claimText,
        verificationState: row.verificationState,
        riskLevel: row.riskLevel,
        explanation: row.explanation,
        supportingEvidenceIds: assessment.supportingEvidenceIds,
        excludedEvidenceIds: assessment.excludedEvidenceIds,
        unsupportedAspects: assessment.unsupportedAspects,
      });
    }
  });

  return stored;
}

export async function listClaimsForArtifact(
  userId: string,
  artifactType: string,
  artifactId: string,
) {
  return prisma.generatedClaim.findMany({
    where: { userId, artifactType, artifactId: artifactId ?? undefined },
    include: {
      links: {
        include: {
          evidence: {
            select: {
              id: true,
              statement: true,
              sourceDescription: true,
              verificationStatus: true,
              metricValue: true,
              metricUnit: true,
            },
          },
        },
      },
    },
    orderBy: [{ verificationState: "desc" }, { createdAt: "asc" }],
  });
}

export async function confirmClaim(
  userId: string,
  claimId: string,
): Promise<void> {
  const claim = await prisma.generatedClaim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) throw Errors.notFound("Claim");
  await prisma.generatedClaim.update({
    where: { id: claimId },
    data: {
      verificationState: "SUPPORTED",
      explanation: `${claim.explanation} (confirmed by user)`,
    },
  });
}

export async function rejectClaim(
  userId: string,
  claimId: string,
): Promise<void> {
  const claim = await prisma.generatedClaim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) throw Errors.notFound("Claim");
  await prisma.generatedClaim.update({
    where: { id: claimId },
    data: {
      verificationState: "REJECTED",
      explanation: `${claim.explanation} (rejected by user)`,
    },
  });
}

/**
 * Editing a claim into fact requires new evidence. The user may accept an
 * explicit "no evidence" confirmation, which is recorded as USER_CONFIRMED.
 */
export async function editClaim(
  userId: string,
  claimId: string,
  newText: string,
  opts: { evidenceIds?: string[]; acceptWithoutEvidence?: boolean } = {},
): Promise<void> {
  const claim = await prisma.generatedClaim.findFirst({
    where: { id: claimId, userId },
  });
  if (!claim) throw Errors.notFound("Claim");
  const text = newText.trim();
  if (text.length < 5) throw Errors.validation("The claim text is too short.");
  if (!opts.acceptWithoutEvidence && !(opts.evidenceIds?.length ?? 0)) {
    throw Errors.validation(
      "Link at least one piece of evidence, or confirm the claim without evidence.",
    );
  }

  await inTransaction(async (tx) => {
    await tx.generatedClaim.update({
      where: { id: claimId },
      data: {
        claimText: text,
        verificationState: opts.acceptWithoutEvidence
          ? "NEEDS_CONFIRMATION"
          : "SUPPORTED",
        explanation: opts.acceptWithoutEvidence
          ? "Edited and confirmed by the user without linked evidence. Not usable as verified fact."
          : "Edited by the user and linked to evidence.",
      },
    });
    await tx.claimEvidenceLink.deleteMany({ where: { claimId } });
    for (const evidenceId of opts.evidenceIds ?? []) {
      await tx.claimEvidenceLink.create({
        data: { claimId, evidenceId, relation: "SUPPORTS", weight: 1 },
      });
    }
  });
}

export async function addEvidenceToClaim(
  userId: string,
  claimId: string,
  evidenceId: string,
): Promise<void> {
  const [claim, evidence] = await Promise.all([
    prisma.generatedClaim.findFirst({ where: { id: claimId, userId } }),
    prisma.evidence.findFirst({
      where: { id: evidenceId, userId },
      select: { id: true, verificationStatus: true },
    }),
  ]);
  if (!claim) throw Errors.notFound("Claim");
  if (!evidence) throw Errors.notFound("Evidence");
  if (
    evidence.verificationStatus === "REJECTED" ||
    evidence.verificationStatus === "UNVERIFIED"
  ) {
    throw Errors.validation(
      "That evidence is not verified or user-confirmed, so it cannot support a claim.",
      { verificationStatus: evidence.verificationStatus },
    );
  }
  await prisma.claimEvidenceLink.upsert({
    where: { claimId_evidenceId: { claimId, evidenceId } },
    create: { claimId, evidenceId, relation: "SUPPORTS", weight: 1 },
    update: { relation: "SUPPORTS" },
  });
  await prisma.generatedClaim.update({
    where: { id: claimId },
    data: { verificationState: "SUPPORTED" },
  });
}

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

export async function runConsistency(userId: string, applicationId?: string) {
  const [profile, employments, education, skills, evidence, documents] =
    await Promise.all([
      prisma.careerMasterProfile.findUnique({ where: { userId } }),
      prisma.employmentRecord.findMany({ where: { userId } }),
      prisma.educationRecord.findMany({ where: { userId } }),
      prisma.skill.findMany({ where: { userId } }),
      prisma.evidence.findMany({
        where: { userId, verificationStatus: { not: "REJECTED" } },
      }),
      collectDocuments(userId, applicationId),
    ]);

  const issues = checkConsistency({
    profile: {
      jobTitles: employments.map((e) => e.jobTitle),
      employers: employments.map((e) => e.companyName),
      education: education.map((e) =>
        [e.institution, e.degree, e.fieldOfStudy].filter(Boolean).join(" "),
      ),
      tools: skills.map((s) => s.name),
    },
    documents,
    evidence: evidence.map((e) => ({
      id: e.id,
      statement: e.statement,
      metricValue: e.metricValue,
      employmentStart: null,
      employmentEnd: null,
      employer: null,
      jobTitle: null,
      tools: e.tags,
    })),
    employmentDates: employments.map((e) => ({
      employer: e.companyName,
      jobTitle: e.jobTitle,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
  });

  const matrix = applicationId
    ? await prisma.application.findFirst({
        where: { id: applicationId, userId },
        include: {
          resumes: { include: { sections: true } },
          coverLetters: { where: { isCurrent: true } },
          answers: true,
        },
      })
    : null;

  void profile;
  void matrix;
  return issues;
}

async function collectDocuments(userId: string, applicationId?: string) {
  const docs: Array<{
    id: string;
    type: "RESUME" | "COVER_LETTER" | "LINKEDIN" | "ANSWER" | "STAR";
    text: string;
  }> = [];

  const resumes = await prisma.resume.findMany({
    where: {
      userId,
      ...(applicationId ? { applicationId } : { isMaster: true }),
    },
    include: {
      sections: true,
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  for (const r of resumes) {
    const text = [
      ...r.sections.map((s) => flatten(s.content)),
      r.versions[0] ? flatten(r.versions[0].content) : "",
    ]
      .filter(Boolean)
      .join("\n");
    docs.push({ id: r.id, type: "RESUME", text });
  }

  const letters = await prisma.coverLetter.findMany({
    where: {
      userId,
      ...(applicationId ? { applicationId } : { isCurrent: true }),
    },
  });
  for (const l of letters)
    docs.push({ id: l.id, type: "COVER_LETTER", text: l.body });

  const answers = await prisma.applicationAnswer.findMany({
    where: { userId },
  });
  for (const a of answers)
    docs.push({ id: a.id, type: "ANSWER", text: `${a.question}\n${a.answer}` });

  const stories = await prisma.starStory.findMany({ where: { userId } });
  for (const s of stories) {
    docs.push({
      id: s.id,
      type: "STAR",
      text: `${s.situation}\n${s.task}\n${s.action}\n${s.result}`,
    });
  }

  return docs;
}

function flatten(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(flatten).join("\n");
  if (content && typeof content === "object") {
    return Object.values(content as Record<string, unknown>)
      .map(flatten)
      .join("\n");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface GateInput {
  userId: string;
  applicationId: string;
  claimScope?: { artifactType: string; artifactId: string };
}

export async function evaluateApplicationReadiness(
  input: GateInput,
): Promise<ReadinessResult> {
  const app = await prisma.application.findFirst({
    where: { id: input.applicationId, userId: input.userId },
    include: {
      job: { include: { analysis: { include: { requirements: true } } } },
      resumes: { where: { isArchived: false } },
      answers: true,
      coverLetters: { where: { isCurrent: true } },
      matrix: true,
    },
  });
  if (!app) throw Errors.notFound("Application");

  const claims = await prisma.generatedClaim.findMany({
    where: {
      userId: input.userId,
      ...(input.claimScope
        ? {
            artifactType: input.claimScope.artifactType,
            artifactId: input.claimScope.artifactId,
          }
        : {}),
    },
  });

  const consistencyIssues: ConsistencyIssue[] = await runConsistency(
    input.userId,
    input.applicationId,
  );

  const profile = await prisma.userProfile.findUnique({
    where: { userId: input.userId },
  });
  const contactComplete = Boolean(
    profile?.firstName?.trim() &&
    profile?.email?.trim() &&
    profile?.phone?.trim(),
  );

  const resumes = app.resumes;
  const isResumeTailored = resumes.some((r) => !r.isMaster);

  const unverifiedMetrics: string[] = [];
  for (const claim of claims) {
    if (
      claim.verificationState === "NEEDS_CONFIRMATION" ||
      claim.verificationState === "UNSUPPORTED"
    ) {
      const numbers = claim.claimText.match(/\d+(?:\.\d+)?\s*%?/g) ?? [];
      unverifiedMetrics.push(
        ...numbers.map((n) => `"${n}" in "${claim.claimText.slice(0, 60)}…"`),
      );
    }
  }

  const defenseProblems = resumes.flatMap((r) =>
    r.isArchived
      ? []
      : [
          {
            text: `${r.label} (${resumes.length} version${resumes.length === 1 ? "" : "s"})`,
            verdict: "DEFENSIBLE",
          },
        ],
  );

  // A REJECTED claim is one the user has explicitly removed, so it is the fix —
  // not a blocker. Only UNSUPPORTED and CONFLICTED claims block a clean READY.
  const unsupportedClaims = claims
    .filter((c) => c.verificationState === "UNSUPPORTED")
    .map((c) => c.claimText);

  const result = evaluateReadiness({
    unsupportedClaims,
    conflictedClaims: claims
      .filter((c) => c.verificationState === "CONFLICTED")
      .map((c) => c.claimText),
    dateConflicts: consistencyIssues
      .filter((i) => i.type === "DATE_MISMATCH")
      .map((i) => i.message),
    educationConflicts: consistencyIssues
      .filter((i) => i.type === "EDUCATION_MISMATCH")
      .map((i) => i.message),
    titleConflicts: consistencyIssues
      .filter((i) => i.type === "TITLE_MISMATCH")
      .map((i) => i.message),
    toolConflicts: consistencyIssues
      .filter((i) => i.type === "TOOL_CONFLICT")
      .map((i) => i.message),
    responsibilityInflations: consistencyIssues
      .filter(
        (i) =>
          i.type === "LEADERSHIP_INFLATION" ||
          i.type === "RESPONSIBILITY_INFLATION",
      )
      .map((i) => i.message),
    requirementsReviewed:
      Boolean(app.job?.analysis?.requirements.length) &&
      app.nextAction !== "Analyze the job description",
    requirementsTotal: app.job?.analysis?.requirements.length ?? 0,
    isResumeTailored,
    contactComplete,
    unverifiedMetrics,
    defenseProblems,
    answerInconsistencies: consistencyIssues
      .filter((i) => i.type === "CONTRADICTION")
      .map((i) => i.message),
  });

  await prisma.readinessCheck.deleteMany({ where: { applicationId: app.id } });
  await prisma.readinessCheck.createMany({
    data: result.checks.map((c) => ({
      userId: input.userId,
      applicationId: app.id,
      category: c.category,
      label: c.label,
      status: c.status,
      blocking: c.blocking,
      detail: c.detail,
      evidenceRefs: c.evidenceRefs,
    })),
  });

  return result;
}

export async function listUnverifiedClaims(userId: string) {
  return prisma.generatedClaim.findMany({
    where: {
      userId,
      verificationState: {
        in: ["UNSUPPORTED", "NEEDS_CONFIRMATION", "CONFLICTED"],
      },
    },
    include: {
      links: {
        include: {
          evidence: {
            select: { id: true, statement: true, sourceDescription: true },
          },
        },
      },
    },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

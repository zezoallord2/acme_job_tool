import { prisma } from "@/lib/db";
import {
  dedupeKeyFor,
  confidenceForOccurrences,
  suggestEvidenceFromInterviewNote,
  type LearningObservation,
} from "@/domain/learning";
import {
  computeAttributePatterns,
  type OutcomeEvent,
} from "@/domain/analytics";
import { Errors } from "@/lib/errors";

/**
 * Learning engine.
 *
 * Hard boundary: nothing here ever writes to My Experience without an
 * explicit user confirmation. Observations become `EvidenceProposal` rows that
 * the user must accept.
 */

export async function recordLearningEvent(input: LearningObservation) {
  const dedupeKey = dedupeKeyFor(input);
  const existing = await prisma.learningEvent.findUnique({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
  });

  if (existing) {
    const occurrences = existing.occurrenceCount + 1;
    return prisma.learningEvent.update({
      where: { id: existing.id },
      data: {
        occurrenceCount: occurrences,
        lastObservedAt: new Date(),
        confidenceCategory: confidenceForOccurrences(
          input.eventType,
          occurrences,
        ),
        supportingData: input.supportingData as never,
      },
    });
  }

  return prisma.learningEvent.create({
    data: {
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      eventType: input.eventType,
      observation: input.observation,
      confidenceCategory: input.confidenceCategory ?? "MEDIUM",
      supportingData: input.supportingData as never,
      dedupeKey,
    },
  });
}

export async function listLearningEvents(userId: string, take = 100) {
  return prisma.learningEvent.findMany({
    where: { userId },
    orderBy: { lastObservedAt: "desc" },
    take,
  });
}

/**
 * Post-interview review: derive proposals, never facts.
 * This is the "They asked about training new employees" path.
 */
export async function generateEvidenceProposalsFromInterview(input: {
  userId: string;
  interviewId: string;
  reflection: string;
}) {
  const suggestions = suggestEvidenceFromInterviewNote(input.reflection);
  const created: string[] = [];

  for (const s of suggestions) {
    const event = await recordLearningEvent({
      userId: input.userId,
      eventType: "NEW_EVIDENCE_DISCOVERED",
      sourceType: "INTERVIEW_REVIEW",
      sourceId: input.interviewId,
      observation: s.proposedStatement,
      subjectKey: s.proposedStatement.toLowerCase(),
      supportingData: {
        rationale: s.rationale,
        relatedEvidenceIds: s.relatedEvidenceIds,
      },
      confidenceCategory: "LOW",
    });

    const existing = await prisma.evidenceProposal.findFirst({
      where: {
        userId: input.userId,
        learningEventId: event.id,
        proposedStatement: s.proposedStatement,
      },
    });
    if (existing) continue;

    const proposal = await prisma.evidenceProposal.create({
      data: {
        userId: input.userId,
        learningEventId: event.id,
        proposedStatement: s.proposedStatement,
        claimType: s.claimType as never,
        sourceType: "INTERVIEW_RECALL",
        sourceDescription: s.sourceDescription,
        confidence: s.confidence,
      },
    });
    created.push(proposal.id);
  }

  return { proposals: suggestions, proposalIds: created };
}

export async function listPendingProposals(userId: string) {
  return prisma.evidenceProposal.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

/** Accepting a proposal is the only way inferred content becomes evidence. */
export async function acceptProposal(userId: string, proposalId: string) {
  const proposal = await prisma.evidenceProposal.findFirst({
    where: { id: proposalId, userId },
  });
  if (!proposal) throw Errors.notFound("Evidence proposal");
  if (proposal.status !== "PENDING")
    throw Errors.conflict("That proposal has already been handled.");

  const evidence = await prisma.evidence.create({
    data: {
      userId,
      statement: proposal.proposedStatement,
      claimType: proposal.claimType,
      sourceType: proposal.sourceType,
      sourceDescription: proposal.sourceDescription,
      verificationStatus: "USER_CONFIRMED",
      confidenceCategory:
        proposal.confidence === "UNKNOWN" ? "LOW" : proposal.confidence,
      authority: "USER_CONFIRMED",
      metricValue: proposal.metricValue,
      metricUnit: proposal.metricUnit,
      metricStatus:
        proposal.metricValue === null ? "NOT_APPLICABLE" : "USER_ESTIMATE",
      createdBy: "learning-proposal",
      lastConfirmedAt: new Date(),
    },
  });

  await prisma.evidenceProposal.update({
    where: { id: proposalId },
    data: {
      status: "APPLIED",
      appliedEvidenceId: evidence.id,
      actedAt: new Date(),
    },
  });
  if (proposal.learningEventId) {
    await prisma.learningEvent.update({
      where: { id: proposal.learningEventId },
      data: {
        acceptedByUser: true,
        actionStatus: "ACCEPTED",
        actedAt: new Date(),
      },
    });
  }
  return evidence;
}

export async function dismissProposal(
  userId: string,
  proposalId: string,
  reason?: string,
) {
  const proposal = await prisma.evidenceProposal.findFirst({
    where: { id: proposalId, userId },
  });
  if (!proposal) throw Errors.notFound("Evidence proposal");
  await prisma.evidenceProposal.update({
    where: { id: proposalId },
    data: { status: "IGNORED", actedAt: new Date(), userNote: reason ?? null },
  });
  if (proposal.learningEventId) {
    await prisma.learningEvent.update({
      where: { id: proposal.learningEventId },
      data: { actionStatus: "IGNORED", actedAt: new Date() },
    });
  }
}

export async function outcomeEventsFor(
  userId: string,
): Promise<OutcomeEvent[]> {
  const rows = await prisma.applicationOutcome.findMany({
    where: { userId },
    orderBy: { occurredAt: "asc" },
    include: {
      application: {
        select: {
          id: true,
          jobId: true,
          fitClassification: true,
          job: { select: { company: true, title: true } },
          resumes: { select: { versions: { select: { id: true }, take: 1 } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    type: r.type,
    occurredAt: r.occurredAt,
    applicationId: r.applicationId,
    fitClassification: r.application.fitClassification,
    company: r.application.job?.company ?? null,
    role: r.application.job?.title ?? null,
    resumeVersionId: r.application.resumes[0]?.versions[0]?.id ?? null,
  }));
}

/**
 * Attribute-level observation, always non-causal.
 *
 * Groups by the dimension the user can actually act on. Fit classification is
 * only available once a matrix exists, so the role family is used as the primary
 * dimension and fit classification is added as a second dimension when present.
 */
export async function outcomePatterns(userId: string) {
  const events = await outcomeEventsFor(userId);
  const applications = await prisma.application.findMany({
    where: { userId },
    select: {
      id: true,
      fitClassification: true,
      job: { select: { title: true, company: true } },
    },
  });
  const byId = new Map(applications.map((a) => [a.id, a]));

  const rolePatterns = computeAttributePatterns(
    events.filter((e) => byId.has(e.applicationId)),
    "role family",
    (e) => {
      const role = byId.get(e.applicationId)?.job?.title;
      return role ? [normalizeRole(role)] : [];
    },
  );

  const fitPatterns = computeAttributePatterns(
    events.filter((e) => byId.get(e.applicationId)?.fitClassification),
    "evidence fit classification",
    (e) => {
      const fit = byId.get(e.applicationId)?.fitClassification;
      return fit
        ? [`your ${fit.replace(/_/g, " ").toLowerCase()} applications`]
        : [];
    },
  );

  return [...rolePatterns, ...fitPatterns].sort(
    (a, b) => b.submissions - a.submissions,
  );
}

/** "Senior Data Analyst (Contract)" -> "data analyst". */
function normalizeRole(title: string): string {
  return title
    .replace(/\(([^)]*)\)/g, "")
    .replace(/\b(senior|snr|junior|jr|lead|head|principal|staff)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

export async function recordPreferenceSignal(
  userId: string,
  key: string,
  value: string,
) {
  return prisma.userPreferenceSignal.upsert({
    where: { userId_key_value: { userId, key, value } },
    create: { userId, key, value },
    update: { weight: { increment: 1 } },
  });
}

export async function preferenceSignals(userId: string) {
  return prisma.userPreferenceSignal.findMany({
    where: { userId },
    orderBy: { weight: "desc" },
    take: 50,
  });
}

/**
 * Global, aggregated product metrics. Aggregated and anonymised: individual
 * private career content never enters global analytics.
 */
export interface GlobalProductInsight {
  metric: string;
  value: number;
  note: string;
}

export async function globalProductInsights(): Promise<GlobalProductInsight[]> {
  const [failures, abandoned, feedback] = await Promise.all([
    prisma.aIInteraction.groupBy({
      by: ["workflowId"],
      where: { status: { in: ["FAILED", "VALIDATION_FAILED"] } },
      _count: { _all: true },
    }),
    prisma.aIInteraction.groupBy({
      by: ["workflowId"],
      where: { status: "MANUAL_AWAITING_INPUT" },
      _count: { _all: true },
    }),
    prisma.aIInteractionFeedback.groupBy({
      by: ["vote"],
      _count: { _all: true },
    }),
  ]);
  const totalFailures = failures.reduce((s, f) => s + f._count._all, 0);
  const helpful = feedback.find((f) => f.vote === "HELPFUL")?._count._all ?? 0;
  const notHelpful =
    feedback.find((f) => f.vote === "NOT_HELPFUL")?._count._all ?? 0;

  return [
    {
      metric: "ai_workflow_failures",
      value: totalFailures,
      note: failures.length
        ? `Most failures: ${failures.sort((a, b) => b._count._all - a._count._all)[0]!.workflowId}`
        : "No workflow failures recorded.",
    },
    {
      metric: "workflow_abandonment_manual",
      value: abandoned.reduce((s, a) => s + a._count._all, 0),
      note: abandoned.length
        ? `Most paused: ${abandoned.sort((a, b) => b._count._all - a._count._all)[0]!.workflowId}`
        : "No paused workflows.",
    },
    {
      metric: "user_feedback_ratio",
      value:
        helpful + notHelpful === 0
          ? 0
          : Math.round((helpful / (helpful + notHelpful)) * 100),
      note: `${helpful} helpful / ${notHelpful} not helpful responses.`,
    },
  ];
}

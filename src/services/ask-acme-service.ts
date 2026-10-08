import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { computeAnalytics, type OutcomeEvent } from "@/domain/analytics";
import { buildPriorities, type PriorityItem } from "@/domain/priorities";
import { scoreOpportunities } from "@/domain/matching";
import { listPendingProposals, outcomePatterns } from "./learning-service";
import { evidenceStats } from "./evidence-service";
import { getEntitlementState } from "./entitlement-service";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Acme Assistant answers from structured records only. When the data needed to answer
 * is missing, the answer says so instead of inventing history.
 */

export interface AskAcmeCitation {
  kind: string;
  id: string;
  label: string;
}

export interface AskAcmeAnswer {
  answer: string;
  citations: AskAcmeCitation[];
  dataGaps: string[];
  suggestedActions: Array<{ label: string; href: string }>;
  /** Present when the deterministic engine already answered. */
  answeredDeterministically: boolean;
}

export async function askAcme(
  userId: string,
  question: string,
): Promise<AskAcmeAnswer> {
  await enforceRateLimit("aiAssist", { userId });
  const q = question.trim().toLowerCase();
  if (!q) throw Errors.validation("Ask a question first.");

  if (
    /what should i work on|what should i do today|today'?s priorities|priorit/.test(
      q,
    )
  ) {
    const items = await todayPriorities(userId);
    if (items.length === 0) {
      return {
        answer:
          "Nothing is due right now. Add a job description or start an interview prep to get useful priorities.",
        citations: [],
        dataGaps: ["No applications or interviews recorded yet."],
        suggestedActions: [
          { label: "Analyze your first job", href: "/app/jobs/new" },
          { label: "Complete your career profile", href: "/app/career" },
        ],
        answeredDeterministically: true,
      };
    }
    return {
      answer: `Based on your real deadlines, here is where to spend time today:\n${items
        .slice(0, 4)
        .map((i) => `${i.rank}. ${i.title} (${i.minutes} min) — ${i.reason}`)
        .join("\n")}`,
      citations: items
        .slice(0, 4)
        .map((i) => ({ kind: "priority", id: i.key, label: i.title })),
      dataGaps: [],
      suggestedActions: items
        .slice(0, 3)
        .map((i) => ({ label: i.title, href: i.href })),
      answeredDeterministically: true,
    };
  }

  if (
    /strongest for|which jobs should i prioritize|where should i spend|best fit|which role/.test(
      q,
    )
  ) {
    const rows = await opportunityRows(userId);
    const scored = scoreOpportunities(rows);
    if (scored.length === 0) {
      return {
        answer:
          "No jobs are saved yet, so there is nothing to compare. Paste a job description to get a ranking.",
        citations: [],
        dataGaps: ["No saved job postings."],
        suggestedActions: [{ label: "Analyze a job", href: "/app/jobs/new" }],
        answeredDeterministically: true,
      };
    }
    return {
      answer: `Ranked by evidence coverage against tailoring effort:\n${scored
        .slice(0, 3)
        .map(
          (s, i) =>
            `${i + 1}. ${s.company || "Unnamed company"} — ${s.role || "role not set"}: ${s.rationale}`,
        )
        .join(
          "\n",
        )}\n\nThese are effort-vs-opportunity rankings, not predictions of who will hire you.`,
      citations: scored.slice(0, 3).map((s) => ({
        kind: "application",
        id: s.applicationId,
        label: `${s.company} ${s.role}`,
      })),
      dataGaps: [],
      suggestedActions: [
        { label: "Compare effort vs opportunity", href: "/app/opportunities" },
      ],
      answeredDeterministically: true,
    };
  }

  if (
    /unverified|which claims|need verification|need confirmation|unsupported/.test(
      q,
    )
  ) {
    const claims = await prisma.generatedClaim.findMany({
      where: {
        userId,
        verificationState: {
          in: ["UNSUPPORTED", "NEEDS_CONFIRMATION", "CONFLICTED"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, claimText: true, verificationState: true },
    });
    const unverifiedEvidence = await prisma.evidence.count({
      where: { userId, verificationStatus: "UNVERIFIED" },
    });
    if (claims.length === 0 && unverifiedEvidence === 0) {
      return {
        answer:
          "Every claim you have generated is supported by verified or user-confirmed evidence.",
        citations: [],
        dataGaps: [],
        suggestedActions: [{ label: "Open Truth Check", href: "/app/claims" }],
        answeredDeterministically: true,
      };
    }
    return {
      answer: [
        claims.length
          ? `${claims.length} generated claim(s) still need attention:`
          : "",
        ...claims
          .slice(0, 5)
          .map(
            (c) =>
              `- "${c.claimText.slice(0, 90)}" (${c.verificationState.replace(/_/g, " ").toLowerCase()})`,
          ),
        unverifiedEvidence
          ? `${unverifiedEvidence} evidence record(s) are marked unverified.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      citations: claims
        .slice(0, 5)
        .map((c) => ({ kind: "claim", id: c.id, label: c.claimText })),
      dataGaps: [],
      suggestedActions: [{ label: "Review claims", href: "/app/claims" }],
      answeredDeterministically: true,
    };
  }

  if (/what did i send|what exactly did i send|what did we send/.test(q)) {
    const companyMatch = question.match(
      /what (?:exactly )?did i send\s+([A-Za-z0-9&.\- ]{2,40})/i,
    );
    const snapshot = companyMatch
      ? await prisma.applicationSnapshot.findFirst({
          where: {
            userId,
            application: {
              job: {
                company: {
                  contains: companyMatch[1]!.trim(),
                  mode: "insensitive",
                },
              },
            },
          },
          include: { application: { include: { job: true } } },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.applicationSnapshot.findFirst({
          where: { userId },
          include: { application: { include: { job: true } } },
          orderBy: { createdAt: "desc" },
        });

    if (!snapshot) {
      return {
        answer:
          "I could not find application details for that. A sent snapshot exists only after you mark an application as applied.",
        citations: [],
        dataGaps: ["No matching application details."],
        suggestedActions: [
          { label: "Open applications", href: "/app/applications" },
        ],
        answeredDeterministically: true,
      };
    }
    return {
      answer: [
        `Application details for ${snapshot.application.job?.company ?? "company"} — ${snapshot.application.job?.title ?? "role"}`,
        `Sealed on ${snapshot.sealedAt.toLocaleDateString()} at status ${snapshot.applicationStatus}.`,
        "The sealed capsule contains the exact job description, resume, cover letter, answers and evidence state you sent. It never changes after sealing.",
      ].join("\n"),
      citations: [
        { kind: "snapshot", id: snapshot.id, label: "Application details" },
      ],
      dataGaps: [],
      suggestedActions: [
        {
          label: "Open the capsule",
          href: `/app/applications/${snapshot.applicationId}/capsule`,
        },
      ],
      answeredDeterministically: true,
    };
  }

  if (/why did you suggest|why is acme saying|why does acme|explain/.test(q)) {
    const claims = await prisma.generatedClaim.findMany({
      where: { userId },
      include: {
        links: {
          include: {
            evidence: {
              select: {
                id: true,
                statement: true,
                sourceDescription: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (claims.length === 0) {
      return {
        answer:
          "No generated claims exist yet, so there is nothing to explain.",
        citations: [],
        dataGaps: [],
        suggestedActions: [{ label: "Tailor a resume", href: "/app/resumes" }],
        answeredDeterministically: true,
      };
    }
    const c = claims[0]!;
    const supported = c.links.filter((l) => l.relation === "SUPPORTS");
    const excluded = c.links.filter((l) => l.relation === "EXCLUDED");
    return {
      answer: [
        `Most recent claim: "${c.claimText}"`,
        `State: ${c.verificationState.replace(/_/g, " ").toLowerCase()}. ${c.explanation}`,
        supported.length
          ? `Evidence used: ${supported.map((l) => l.evidence.statement).join("; ")}`
          : "No supporting evidence was used.",
        excluded.length
          ? `Excluded because unusable: ${excluded.map((l) => l.evidence.statement).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      citations: supported.map((l) => ({
        kind: "evidence",
        id: l.evidence.id,
        label: l.evidence.statement,
      })),
      dataGaps: [],
      suggestedActions: [{ label: "Open Truth Check", href: "/app/claims" }],
      answeredDeterministically: true,
    };
  }

  if (/overdue|follow.?up/.test(q)) {
    const now = new Date();
    const overdue = await prisma.followUp.findMany({
      where: { userId, status: "DRAFT", scheduledFor: { lte: now } },
      include: {
        application: { select: { job: { select: { company: true } } } },
      },
    });
    return {
      answer: overdue.length
        ? `${overdue.length} follow-up(s) are overdue:\n${overdue
            .map(
              (f) =>
                `- ${f.application?.job?.company ?? "Unknown"} (${f.type.replace(/_/g, " ").toLowerCase()})`,
            )
            .join("\n")}`
        : "No follow-ups are overdue right now.",
      citations: overdue.map((f) => ({
        kind: "followup",
        id: f.id,
        label: f.type,
      })),
      dataGaps: [],
      suggestedActions: [{ label: "Open follow-ups", href: "/app/follow-ups" }],
      answeredDeterministically: true,
    };
  }

  if (/new evidence|discovered|learned/.test(q)) {
    const proposals = await listPendingProposals(userId);
    const events = await prisma.learningEvent.findMany({
      where: { userId, eventType: "NEW_EVIDENCE_DISCOVERED" },
      orderBy: { lastObservedAt: "desc" },
      take: 5,
    });
    if (proposals.length === 0 && events.length === 0) {
      return {
        answer:
          "Nothing new has been proposed yet. After an interview review, Acme Jobs may suggest evidence you described but have not recorded.",
        citations: [],
        dataGaps: [],
        suggestedActions: [],
        answeredDeterministically: true,
      };
    }
    return {
      answer: [
        proposals.length
          ? `${proposals.length} evidence proposal(s) awaiting your confirmation:`
          : "",
        ...proposals.slice(0, 5).map((p) => `- ${p.proposedStatement}`),
        "Nothing is added to your career evidence until you accept it.",
      ]
        .filter(Boolean)
        .join("\n"),
      citations: proposals.map((p) => ({
        kind: "proposal",
        id: p.id,
        label: p.proposedStatement,
      })),
      dataGaps: [],
      suggestedActions: [{ label: "Review proposals", href: "/app/learning" }],
      answeredDeterministically: true,
    };
  }

  if (/weakness|struggl|struggled|keep coming up|pattern/.test(q)) {
    const patterns = await outcomePatterns(userId);
    return {
      answer: patterns.length
        ? [
            "Observed patterns (association only, never causation):",
            ...patterns
              .slice(0, 4)
              .map((p) => `- ${p.statement} ${p.sufficiency.message}`),
          ].join("\n")
        : "Not enough outcome data yet to identify any pattern. Record application outcomes to build this view.",
      citations: patterns.slice(0, 4).map((p) => ({
        kind: "pattern",
        id: p.attributeValue,
        label: p.statement,
      })),
      dataGaps:
        patterns.length === 0 ? ["Fewer than 3 submissions recorded."] : [],
      suggestedActions: [{ label: "Open analytics", href: "/app/analytics" }],
      answeredDeterministically: true,
    };
  }

  const [apps, evidence, entitlement] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    evidenceStats(userId),
    getEntitlementState(userId),
  ]);

  return {
    answer:
      `You have ${apps} application(s) and ${evidence.total} evidence record(s) on the ${entitlement.plan === "COMPLETE" ? "Complete" : "Starter"} plan. ` +
      "I can answer questions about today's priorities, job fit, unverified claims, what you sent a company, overdue follow-ups, new evidence and observed patterns. Ask one of those and I will answer from your records.",
    citations: [],
    dataGaps: [],
    suggestedActions: [
      { label: "Today's priorities", href: "/app" },
      { label: "Truth Check", href: "/app/claims" },
    ],
    answeredDeterministically: false,
  };
}

export async function todayPriorities(userId: string): Promise<PriorityItem[]> {
  const now = new Date();
  const [interviews, followUps, applications, career] = await Promise.all([
    prisma.interview.findMany({
      where: { userId, status: { not: "COMPLETED" } },
      select: {
        id: true,
        company: true,
        role: true,
        scheduledAt: true,
        prepNotes: true,
      },
    }),
    prisma.followUp.findMany({
      where: { userId, status: "DRAFT" },
      select: {
        id: true,
        applicationId: true,
        type: true,
        status: true,
        scheduledFor: true,
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.application.findMany({
      where: {
        userId,
        status: {
          in: ["SAVED", "ANALYZING", "READY_TO_APPLY", "APPLIED", "SCREENING"],
        },
      },
      select: {
        id: true,
        status: true,
        nextActionDue: true,
        job: {
          select: {
            company: true,
            title: true,
            deadlineAt: true,
            createdAt: true,
          },
        },
        resumes: { select: { isMaster: true } },
      },
    }),
    prisma.careerMasterProfile.findUnique({
      where: { userId },
      select: { primaryGoal: true },
    }),
  ]);

  const withCompanies = (
    await Promise.all(
      followUps
        .filter((f): f is typeof f & { applicationId: string } =>
          Boolean(f.applicationId),
        )
        .map(async (f) => {
          const app = await prisma.application.findUnique({
            where: { id: f.applicationId },
            select: { job: { select: { company: true, title: true } } },
          });
          return {
            id: f.id,
            applicationId: f.applicationId,
            company: app?.job?.company ?? "Unknown company",
            role: app?.job?.title ?? "role",
            scheduledFor: f.scheduledFor,
            status: f.status,
          };
        }),
    )
  ).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return buildPriorities(
    {
      interviews: interviews.map((i) => ({
        id: i.id,
        company: i.company,
        role: i.role,
        scheduledAt: i.scheduledAt,
        prepComplete: Boolean(i.prepNotes),
      })),
      followUps: withCompanies,
      unfinishedWork: applications.map((a) => ({
        id: a.id,
        applicationId: a.id,
        company: a.job?.company ?? "Unknown company",
        role: a.job?.title ?? "role",
        kind:
          a.resumes.length > 0 && a.resumes.some((r) => !r.isMaster)
            ? "REQUIREMENTS_NOT_REVIEWED"
            : "RESUME_NOT_TAILORED",
        status: a.status,
        deadline: a.job?.deadlineAt ?? null,
      })),
      deadApplications: applications
        .filter((a) => a.status === "SAVED" && a.job)
        .map((a) => ({
          id: a.id,
          company: a.job!.company ?? "Unknown company",
          role: a.job!.title ?? "role",
          deadline: a.job!.deadlineAt,
          savedAt: a.job!.createdAt,
        })),
      userGoal: career?.primaryGoal ?? ("FULL_SYSTEM" as const),
    },
    now,
  );
}

export async function opportunityRows(userId: string) {
  const apps = await prisma.application.findMany({
    where: { userId, status: { notIn: ["ARCHIVED"] } },
    include: {
      job: { select: { company: true, title: true, deadlineAt: true } },
      matrix: {
        select: {
          fitClassification: true,
          coveragePercent: true,
          criticalGaps: true,
          tailoringEffort: true,
          recommendation: true,
        },
      },
    },
    take: 100,
  });
  return apps.map((a) => ({
    applicationId: a.id,
    company: a.job?.company ?? "Unknown",
    role: a.job?.title ?? "Untitled role",
    fitClassification: (a.matrix?.fitClassification ?? "STRETCH") as never,
    coveragePercent: a.matrix?.coveragePercent ?? 0,
    criticalGapCount: a.matrix?.criticalGaps.length ?? 0,
    tailoringEffort: (a.matrix?.tailoringEffort ?? "MEDIUM") as never,
    deadline: a.job?.deadlineAt ?? null,
    userPriority: a.userPriority,
    recommendation: (a.matrix?.recommendation ?? "REVIEW") as never,
  }));
}

export async function analyticsFor(userId: string) {
  const rows = await prisma.applicationOutcome.findMany({
    where: { userId },
    orderBy: { occurredAt: "asc" },
  });
  const events: OutcomeEvent[] = rows.map((r) => ({
    type: r.type,
    occurredAt: r.occurredAt,
    applicationId: r.applicationId,
  }));
  return computeAnalytics(events);
}

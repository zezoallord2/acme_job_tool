/**
 * Test helpers: real users, real records, real sessions.
 *
 * Every helper is scoped to a single test user so tests stay independent and
 * cross-user access is exercised rather than assumed.
 */
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";

let counter = 0;

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(opts?: {
  complete?: boolean;
  admin?: boolean;
  email?: string;
}): Promise<TestUser> {
  counter++;
  const email =
    opts?.email ?? `test-${process.pid}-${Date.now()}-${counter}@acme.test`;
  const password = "correct-horse-battery-staple-9";

  const passwordHash = await hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: `Test ${counter}`,
      passwordHash,
      isAdmin: opts?.admin ?? false,
      settings: { create: {} },
      profile: {
        create: {
          email,
          firstName: `Test${counter}`,
          phone: "+44 20 7000 0000",
          locationCity: "Leeds",
        },
      },
      onboardings: { create: {} },
      entitlements:
        opts?.complete === true
          ? {
              create: {
                plan: "COMPLETE",
                status: "ACTIVE",
                source: "MANUAL_ADMIN",
                externalEventId: `test:${email}`,
              },
            }
          : undefined,
    },
    select: { id: true, email: true },
  });

  return { id: user.id, email: user.email, password };
}

export async function createEvidence(
  userId: string,
  overrides: Partial<{
    statement: string;
    claimType: string;
    sourceType: string;
    verificationStatus: string;
    metricValue: number | null;
    metricUnit: string | null;
    metricStatus: string;
    tags: string[];
    sourceDescription: string;
  }> = {},
) {
  return prisma.evidence.create({
    data: {
      userId,
      statement:
        overrides.statement ?? "Did a thing that supports a requirement.",
      claimType: (overrides.claimType ?? "ACHIEVEMENT") as never,
      sourceType: (overrides.sourceType ?? "EMPLOYMENT") as never,
      sourceDescription: overrides.sourceDescription ?? "Test employment",
      verificationStatus: (overrides.verificationStatus ??
        "USER_CONFIRMED") as never,
      confidenceCategory: "MEDIUM",
      metricValue: overrides.metricValue ?? null,
      metricUnit: overrides.metricUnit ?? null,
      metricStatus: (overrides.metricStatus ?? "NOT_APPLICABLE") as never,
      tags: overrides.tags ?? [],
    },
  });
}

export async function createJobAndApplication(
  userId: string,
  overrides: { description?: string; company?: string; title?: string } = {},
) {
  const description =
    overrides.description ??
    "Data Analyst role. Requirements: advanced Excel, SQL querying, stakeholder reporting experience. " +
      "Must have: 2+ years in an analytics or reporting role. You will build weekly reports for the operations team. " +
      "Certification in a recognised analytics credential is required.";

  const { createJob } = await import("@/services/job-service");
  const job = await createJob(userId, {
    title: overrides.title ?? "Data Analyst",
    company: overrides.company ?? `Test Co ${Date.now()}`,
    description,
    inputSource: "PASTE",
  });

  const application = await prisma.application.findFirstOrThrow({
    where: { userId, jobId: job.id },
  });
  return { job, application };
}

export async function cleanupUser(userId: string): Promise<void> {
  await prisma.user
    .deleteMany({ where: { id: userId } })
    .catch(() => undefined);
}

/**
 * Removes leftover end-to-end test accounts.
 *
 * E2E specs create real users against the same database the demo accounts use.
 * Nothing deleted them afterwards, so a dev database accumulated
 * `e2e-*@acme.test` rows across every run.
 */
export async function cleanupE2eUsers(): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: { email: { contains: "@acme.test" } },
  });
  return count;
}

export async function resetDatabase(): Promise<void> {
  // Order matters: children before parents.
  const tables = [
    "DataIntegrityIssue",
    "WebhookEvent",
    "WorkQueueItem",
    "IdempotencyKey",
    "CircuitBreakerState",
    "ProviderHealth",
    "HealthCheckResult",
    "FeatureFlag",
    "ReleaseRecord",
    "Experiment",
    "SelfImprovementProposal",
    "BugReport",
    "SystemError",
    "TraceRecord",
    "PerformanceMetric",
    "ProductMetric",
    "DataExportRequest",
    "Notification",
    "UserPreferenceSignal",
    "ApplicationOutcome",
    "EvidenceProposal",
    "DistilledPattern",
    "LearningEvent",
    "AIEvaluationResult",
    "AIEvaluationRun",
    "AIEvaluationFixture",
    "PromptCandidate",
    "VersionedArtifact",
    "AIInteractionFeedback",
    "AIInteraction",
    "InterviewAnswer",
    "InterviewQuestion",
    "InterviewSession",
    "SprintTask",
    "SprintDay",
    "Sprint",
    "FollowUp",
    "Interview",
    "StarStory",
    "ApplicationAnswer",
    "CoverLetter",
    "ResumeBullet",
    "ResumeSection",
    "ResumeVersion",
    "Resume",
    "ApplicationSnapshot",
    "ReadinessCheck",
    "ApplicationNote",
    "ApplicationStatusEvent",
    "ApplicationArtifact",
    "EvidenceMatch",
    "EvidenceMatrix",
    "JobRequirement",
    "JobAnalysis",
    "GeneratedClaim",
    "ClaimEvidenceLink",
    "Application",
    "JobPosting",
    "Achievement",
    "EvidenceConflict",
    "EvidenceSource",
    "CareerFactRecord",
    "Evidence",
    "TargetRole",
    "CareerNarrative",
    "VoiceProfile",
    "AwardRecord",
    "LanguageRecord",
    "VolunteerExperience",
    "Project",
    "Certification",
    "EducationRecord",
    "EmploymentRecord",
    "Skill",
    "CareerMasterProfile",
    "OnboardingProgress",
    "UserApiKey",
    "UserIntegration",
    "Entitlement",
    "AuditLog",
    "RateLimitBucket",
    "UserSettings",
    "UserProfile",
    "Session",
  ];
  for (const table of tables) {
    await prisma
      .$executeRawUnsafe(`DELETE FROM "${table}"`)
      .catch(() => undefined);
  }
}

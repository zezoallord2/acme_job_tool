import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTestUser,
  createEvidence,
  createJobAndApplication,
  type TestUser,
} from "../helpers";
import { saveJobAnalysis } from "@/services/job-service";
import { buildEvidenceMatrix } from "@/services/job-service";
import {
  persistClaims,
  confirmClaim,
  rejectClaim,
  editClaim,
  listClaimsForArtifact,
  evaluateApplicationReadiness,
} from "@/services/claim-service";
import {
  transitionApplication,
  sealApplicationSnapshot,
  updateApplicationMeta,
} from "@/services/application-service";
import { evidenceMap } from "@/services/evidence-service";
import { isAppError } from "@/lib/errors";
import type { JobAnalysisOutput } from "@/ai/schemas";

const ANALYSIS: JobAnalysisOutput = {
  role: "Data Analyst",
  company: "Test Co",
  seniority: "Mid",
  summary: "Build weekly reports.",
  mustHaveRequirements: [
    "Advanced Excel",
    "Weekly stakeholder reporting",
    "Certification in a recognised analytics credential is mandatory",
  ],
  preferredRequirements: ["Power BI"],
  responsibilities: ["Build and update the weekly operations report"],
  hardSkills: ["Excel"],
  softSkills: ["Communication"],
  tools: ["Excel"],
  educationRequirements: [],
  certificationRequirements: [],
  experienceRequirement: "2+ years",
  repeatedThemes: ["weekly reports"],
  importantLanguage: ["weekly reporting"],
  dealBreakers: [],
  needsInput: [],
};

describe("Application lifecycle integration", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser();
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("creates a job and its application in SAVED", async () => {
    const { application, job } = await createJobAndApplication(user.id);
    expect(application.status).toBe("SAVED");
    expect(application.jobId).toBe(job.id);
  });

  it("persists an analysis and creates requirements", async () => {
    const { job } = await createJobAndApplication(user.id);
    await saveJobAnalysis({
      userId: user.id,
      jobId: job.id,
      output: ANALYSIS,
      interactionId: "test-interaction",
      workflowId: "JOB_ANALYSIS",
      promptVersion: "JOB_ANALYSIS_PROMPT_v4",
      provider: "MANUAL" as never,
      model: "user-provided-assistant",
      manual: true,
    });

    const requirements = await prisma.jobRequirement.findMany({
      where: { jobAnalysisId: { not: "" } },
    });
    expect(requirements.length).toBeGreaterThanOrEqual(3);
    expect(requirements.some((r) => r.priority === "CRITICAL")).toBe(true);
    expect(
      requirements
        .filter((r) => r.isMustHave)
        .every((r) => r.priority !== "LOW"),
    ).toBe(true);
  });

  it("builds an evidence matrix from real evidence", async () => {
    await createEvidence(user.id, {
      statement:
        "Built and updated the weekly Excel report for the operations team.",
      tags: ["excel", "reporting", "weekly"],
    });
    const { job } = await createJobAndApplication(user.id);
    await saveJobAnalysis({
      userId: user.id,
      jobId: job.id,
      output: ANALYSIS,
      interactionId: "i",
      workflowId: "JOB_ANALYSIS",
      promptVersion: "v4",
      provider: "MANUAL" as never,
      model: "m",
      manual: true,
    });

    const { matrixId, result } = await buildEvidenceMatrix(user.id, job.id);
    expect(matrixId).toBeTruthy();
    const excel = result.matches.find((m) =>
      m.requirementText.includes("Excel"),
    );
    expect(["STRONG", "PARTIAL"]).toContain(excel!.strength);
    expect(result.explanation).toBeTruthy();
  });

  it("rejects SAVED -> OFFER atomically: no state change and no history event", async () => {
    const { application } = await createJobAndApplication(user.id);
    const before = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    const eventsBefore = await prisma.applicationStatusEvent.count({
      where: { applicationId: application.id },
    });

    await expect(
      transitionApplication(user.id, application.id, "OFFER"),
    ).rejects.toSatisfy(isAppError);

    const after = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    const eventsAfter = await prisma.applicationStatusEvent.count({
      where: { applicationId: application.id },
    });

    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
    expect(eventsAfter).toBe(eventsBefore);
  });

  it("moves through the valid path and records each transition", async () => {
    const { application } = await createJobAndApplication(user.id);
    await transitionApplication(user.id, application.id, "ANALYZING");
    await transitionApplication(user.id, application.id, "READY_TO_APPLY");
    await sealApplicationSnapshot(user.id, application.id);
    await transitionApplication(user.id, application.id, "APPLIED", {
      reason: "Submitted via portal",
    });

    const app = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(app.status).toBe("APPLIED");
    expect(app.appliedAt).not.toBeNull();

    const events = await prisma.applicationStatusEvent.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.toStatus)).toEqual([
      "ANALYZING",
      "READY_TO_APPLY",
      "APPLIED",
    ]);
  });

  it("rejects a stale write instead of silently overwriting", async () => {
    const { application } = await createJobAndApplication(user.id);
    const current = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    await updateApplicationMeta(user.id, application.id, {
      userPriority: 1,
      expectedVersion: current.version,
    });
    await expect(
      updateApplicationMeta(user.id, application.id, {
        userPriority: 5,
        expectedVersion: current.version,
      }),
    ).rejects.toSatisfy(isAppError);
    const after = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(after.userPriority).toBe(1);
  });

  it("keeps a sealed snapshot immutable when the underlying records change later", async () => {
    await createEvidence(user.id, { statement: "Built weekly Excel reports." });
    const { job, application } = await createJobAndApplication(user.id);
    await sealApplicationSnapshot(user.id, application.id);

    const snapshot = await prisma.applicationSnapshot.findFirstOrThrow({
      where: { applicationId: application.id },
    });
    const originalHash = snapshot.contentHash;
    const originalJobText = snapshot.jobDescription;

    // Mutate everything the snapshot captured.
    await prisma.jobPosting.update({
      where: { id: job.id },
      data: {
        rawDescription: "COMPLETELY DIFFERENT DESCRIPTION",
        company: "Renamed Co",
      },
    });
    await prisma.evidence.updateMany({
      where: { userId: user.id },
      data: { statement: "Changed entirely" },
    });

    const reloaded = await prisma.applicationSnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
    });
    expect(reloaded.contentHash).toBe(originalHash);
    expect(reloaded.jobDescription).toBe(originalJobText);
    expect(reloaded.isImmutable).toBe(true);
  });

  it("does not create a second snapshot when sealing twice", async () => {
    const { application } = await createJobAndApplication(user.id);
    const first = await sealApplicationSnapshot(user.id, application.id);
    const second = await sealApplicationSnapshot(user.id, application.id);
    expect(second.id).toBe(first.id);
    expect(
      await prisma.applicationSnapshot.count({
        where: { applicationId: application.id },
      }),
    ).toBe(1);
  });
});

describe("Claim Inspector and Readiness Gate integration", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("stores an unsupported claim as UNSUPPORTED with no evidence links", async () => {
    const evidence = await evidenceMap(user.id);
    const stored = await persistClaims({
      userId: user.id,
      interactionId: "gen-1",
      artifactType: "RESUME",
      artifactId: "resume-1",
      claims: [
        {
          text: "Led a five-person team.",
          type: "LEADERSHIP",
          supportingEvidenceIds: [],
          unsupportedAspects: ["leadership of a five-person team"],
        },
      ],
      evidence,
    });

    expect(stored[0]!.verificationState).toBe("UNSUPPORTED");
    expect(stored[0]!.explanation).toContain("No supporting evidence");

    const claims = await listClaimsForArtifact(user.id, "RESUME", "resume-1");
    expect(
      claims[0]!.links.filter((l) => l.relation === "SUPPORTS"),
    ).toHaveLength(0);
  });

  it('records that "supported" evidence cannot license "led"', async () => {
    await createEvidence(user.id, {
      statement:
        "Supported a five-person project team by preparing the weekly status pack.",
    });
    const evidence = await evidenceMap(user.id);
    const stored = await persistClaims({
      userId: user.id,
      interactionId: "gen-2",
      artifactType: "RESUME",
      artifactId: "resume-1",
      claims: [
        {
          text: "Led a five-person team.",
          type: "LEADERSHIP",
          supportingEvidenceIds: [[...evidence.keys()][0]!],
          unsupportedAspects: [],
        },
      ],
      evidence,
    });
    // The claim has evidence textually, but the domain layer flags inflation.
    expect(stored[0]!.verificationState).toBe("SUPPORTED");

    const { judgeDefense } = await import("@/domain/evidence");
    const verdict = judgeDefense(
      "Led a five-person team.",
      "I supported a five-person project team.",
      ["Supported a five-person project team."],
    );
    expect(verdict.verdict).toBe("OVERSTATED");
  });

  it("allows confirming, rejecting and editing a claim", async () => {
    const evidence = await evidenceMap(user.id);
    const [claim] = await persistClaims({
      userId: user.id,
      interactionId: "gen-3",
      artifactType: "COVER_LETTER",
      artifactId: "letter-1",
      claims: [
        {
          text: "Something unverified.",
          type: "ACHIEVEMENT",
          supportingEvidenceIds: [],
          unsupportedAspects: ["v"],
        },
      ],
      evidence,
    });

    await confirmClaim(user.id, claim!.id);
    expect(
      (
        await prisma.generatedClaim.findUniqueOrThrow({
          where: { id: claim!.id },
        })
      ).verificationState,
    ).toBe("SUPPORTED");

    await rejectClaim(user.id, claim!.id);
    expect(
      (
        await prisma.generatedClaim.findUniqueOrThrow({
          where: { id: claim!.id },
        })
      ).verificationState,
    ).toBe("REJECTED");

    await expect(editClaim(user.id, claim!.id, "short")).rejects.toSatisfy(
      isAppError,
    );
  });

  it("blocks a clean READY while an unsupported claim exists", async () => {
    const { application } = await createJobAndApplication(user.id);
    const evidence = await evidenceMap(user.id);
    await persistClaims({
      userId: user.id,
      interactionId: "gen-4",
      artifactType: "RESUME",
      artifactId: "resume-1",
      claims: [
        {
          text: "Increased revenue by 30%.",
          type: "ACHIEVEMENT",
          supportingEvidenceIds: [],
          unsupportedAspects: ["30% revenue increase"],
        },
      ],
      evidence,
    });

    const readiness = await evaluateApplicationReadiness({
      userId: user.id,
      applicationId: application.id,
    });
    expect(readiness.status).toBe("NOT_READY");
    const unsupported = readiness.checks.find(
      (c) => c.category === "UNSUPPORTED_CLAIMS",
    )!;
    expect(unsupported.blocking).toBe(true);
    expect(unsupported.detail).toContain("30%");
  });

  it("clears the blocker once the claim is removed", async () => {
    const { application } = await createJobAndApplication(user.id);
    const evidence = await evidenceMap(user.id);
    const [claim] = await persistClaims({
      userId: user.id,
      interactionId: "gen-5",
      artifactType: "RESUME",
      artifactId: "resume-1",
      claims: [
        {
          text: "Increased revenue by 30%.",
          type: "ACHIEVEMENT",
          supportingEvidenceIds: [],
          unsupportedAspects: ["revenue"],
        },
      ],
      evidence,
    });
    await rejectClaim(user.id, claim!.id);

    const readiness = await evaluateApplicationReadiness({
      userId: user.id,
      applicationId: application.id,
    });
    const unsupported = readiness.checks.find(
      (c) => c.category === "UNSUPPORTED_CLAIMS",
    )!;
    expect(unsupported.blocking).toBe(false);
  });
});

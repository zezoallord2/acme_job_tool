import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTestUser,
  createEvidence,
  createJobAndApplication,
  type TestUser,
} from "../helpers";
import {
  acceptProposal,
  generateEvidenceProposalsFromInterview,
  recordLearningEvent,
  outcomePatterns,
} from "@/services/learning-service";
import { savePostInterviewReview } from "@/services/interview-service";
import { recordOutcome } from "@/services/application-service";
import {
  analyticsFor,
  askAcme,
  todayPriorities,
} from "@/services/ask-acme-service";
import { suggestEvidenceFromInterviewNote } from "@/domain/learning";
import { createInterview } from "@/services/interview-service";
import { isAppError } from "@/lib/errors";

describe("Interview → career learning", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("proposes evidence rather than creating it", async () => {
    const interview = await createInterview(user.id, {
      company: "Meta",
      role: "Data Analyst",
    });

    const before = await prisma.evidence.count({ where: { userId: user.id } });
    const result = await generateEvidenceProposalsFromInterview({
      userId: user.id,
      interviewId: interview.id,
      reflection:
        "They asked about training new employees. I described onboarding two new support agents in March.",
    });

    expect(result.proposals.length).toBeGreaterThan(0);
    const after = await prisma.evidence.count({ where: { userId: user.id } });
    expect(after).toBe(before); // nothing became a fact

    const pending = await prisma.evidenceProposal.findMany({
      where: { userId: user.id, status: "PENDING" },
    });
    expect(pending.length).toBeGreaterThan(0);
  });

  it("only adds evidence after the user accepts", async () => {
    const interview = await createInterview(user.id, {
      company: "Meta",
      role: "Data Analyst",
    });
    await generateEvidenceProposalsFromInterview({
      userId: user.id,
      interviewId: interview.id,
      reflection:
        "I explained how I onboard new employees and trained two of them.",
    });

    const proposal = await prisma.evidenceProposal.findFirstOrThrow({
      where: { userId: user.id },
    });
    const evidence = await acceptProposal(user.id, proposal.id);

    expect(evidence.verificationStatus).toBe("USER_CONFIRMED");
    expect(evidence.authority).toBe("USER_CONFIRMED");
    const updated = await prisma.evidenceProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(updated.status).toBe("APPLIED");
    expect(updated.appliedEvidenceId).toBe(evidence.id);
  });

  it("does not add anything when the proposal is dismissed", async () => {
    const interview = await createInterview(user.id, {
      company: "Meta",
      role: "Data Analyst",
    });
    await generateEvidenceProposalsFromInterview({
      userId: user.id,
      interviewId: interview.id,
      reflection: "I mentioned mentoring a new starter.",
    });
    const proposal = await prisma.evidenceProposal.findFirstOrThrow({
      where: { userId: user.id },
    });

    const { dismissProposal } = await import("@/services/learning-service");
    await dismissProposal(user.id, proposal.id, "Not accurate");

    expect(await prisma.evidence.count({ where: { userId: user.id } })).toBe(0);
  });

  it("saves a post-interview review and creates a follow-up draft on request", async () => {
    const { application } = await createJobAndApplication(user.id);
    const interview = await createInterview(user.id, {
      company: "Meta",
      role: "Data Analyst",
      applicationId: application.id,
    });

    await savePostInterviewReview(user.id, interview.id, {
      questionsAsked: "Tell me about a time you improved a process.",
      wentWell: "Clear structure.",
      feltWeak: "I could not give a number.",
      surprises: "They cared about cost reduction.",
      rememberedExperience: "I rebuilt a process that cut two days of work.",
      interviewerFocus: "Efficiency.",
      followUpNeeded: true,
    });

    const stored = await prisma.interview.findUniqueOrThrow({
      where: { id: interview.id },
    });
    expect(stored.reviewedAt).not.toBeNull();
    expect(stored.status).toBe("COMPLETED");

    const followUps = await prisma.followUp.findMany({
      where: { applicationId: application.id },
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0]!.type).toBe("THANK_YOU");
  });

  it("only proposes a metric when the user omitted a number", () => {
    const withNumber = suggestEvidenceFromInterviewNote(
      "I increased revenue by 30%.",
    );
    expect(withNumber.find((s) => s.claimType === "METRIC")).toBeUndefined();

    const withoutNumber = suggestEvidenceFromInterviewNote(
      "I reduced cost across the team.",
    );
    expect(withoutNumber.find((s) => s.claimType === "METRIC")).toBeDefined();
  });
});

describe("Learning events deduplicate", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("consolidates the same observation instead of creating duplicates", async () => {
    for (let i = 0; i < 4; i++) {
      await recordLearningEvent({
        userId: user.id,
        eventType: "REPEATED_REJECTION_PATTERN",
        sourceType: "APPLICATION_OUTCOME",
        observation: "Rejected three times for the same missing requirement.",
        subjectKey: "missing:sql",
      });
    }
    const events = await prisma.learningEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.occurrenceCount).toBe(4);
    expect(events[0]!.confidenceCategory).toBe("LOW");
  });
});

describe("Outcome learning is careful and non-causal", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("says not enough data before any submission", async () => {
    const analytics = await analyticsFor(user.id);
    expect(analytics.sufficiency.level).toBe("INSUFFICIENT");
    expect(analytics.replyRate).toBeNull();
  });

  it("refuses to call a tiny sample a trend", async () => {
    const { application } = await createJobAndApplication(user.id);
    await recordOutcome(user.id, application.id, "SUBMITTED");
    await recordOutcome(user.id, application.id, "REPLIED");

    const analytics = await analyticsFor(user.id);
    expect(analytics.applicationsSubmitted).toBe(1);
    expect(analytics.sufficiency.level).toBe("DIRECTIONAL");
    expect(analytics.sufficiency.message).toContain("More data is needed");
    expect(analytics.sufficiency.message).not.toMatch(
      /excellent|great|strong/i,
    );
  });

  it("produces association-only patterns", async () => {
    for (let i = 0; i < 6; i++) {
      const { application } = await createJobAndApplication(user.id, {
        company: `Co ${i}`,
        title: `Data Analyst ${i}`,
        description: `Data Analyst role number ${i}. Requirements: advanced Excel and weekly reporting for the operations team. Must have SQL querying experience.`,
      });
      await recordOutcome(user.id, application.id, "SUBMITTED");
      if (i < 2) await recordOutcome(user.id, application.id, "REPLIED");
    }
    const patterns = await outcomePatterns(user.id);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.causal).toBe(false);
      expect(p.statement).toContain("received");
      expect(p.statement).not.toMatch(/increased|improved|caused|boosted/i);
    }
  });
});

describe("Ask Acme answers from structured records only", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("answers what to work on with real reasons", async () => {
    const { application } = await createJobAndApplication(user.id);
    await prisma.application.update({
      where: { id: application.id },
      data: {
        nextAction: "Tailor resume",
        nextActionDue: new Date(Date.now() + 86_400_000),
      },
    });

    const answer = await askAcme(user.id, "What should I work on today?");
    expect(answer.answeredDeterministically).toBe(true);
    expect(answer.answer).toContain("tailoring");
    expect(answer.citations.length).toBeGreaterThan(0);
  });

  it("answers what was sent, from the sealed capsule", async () => {
    const { job, application } = await createJobAndApplication(user.id);
    const { sealApplicationSnapshot } =
      await import("@/services/application-service");
    await sealApplicationSnapshot(user.id, application.id);

    const answer = await askAcme(
      user.id,
      `What exactly did I send ${job.company}?`,
    );
    expect(answer.answer).toContain("capsule");
    expect(answer.citations[0]!.kind).toBe("snapshot");
  });

  it("admits when it has no matching data", async () => {
    const answer = await askAcme(
      user.id,
      "What exactly did I send Nowhere Ltd?",
    );
    expect(answer.answer).toContain("could not find");
    expect(answer.dataGaps.length).toBeGreaterThan(0);
  });

  it("lists unverified claims", async () => {
    const { persistClaims } = await import("@/services/claim-service");
    const { evidenceMap } = await import("@/services/evidence-service");
    await persistClaims({
      userId: user.id,
      interactionId: "g",
      artifactType: "RESUME",
      artifactId: "r",
      claims: [
        {
          text: "Improved retention 30%.",
          type: "ACHIEVEMENT",
          supportingEvidenceIds: [],
          unsupportedAspects: ["retention"],
        },
      ],
      evidence: await evidenceMap(user.id),
    });

    const answer = await askAcme(
      user.id,
      "Which claims still need verification?",
    );
    expect(answer.answer).toContain("retention");
  });

  it("never invents history for an unrelated question", async () => {
    const answer = await askAcme(
      user.id,
      "What is my favourite programming language?",
    );
    expect(answer.answer).toContain("I can answer questions about");
    expect(answer.answeredDeterministically).toBe(false);
  });

  it("never touches another user's data", async () => {
    const other = await createTestUser({ complete: true });
    await createEvidence(other.id, {
      statement: "Other user secret achievement.",
    });
    const { application } = await createJobAndApplication(other.id, {
      company: "Other Co",
    });
    await prisma.application.update({
      where: { id: application.id },
      data: { nextAction: "Other secret action" },
    });

    const answer = await askAcme(user.id, "What should I work on today?");
    expect(answer.answer).not.toContain("Other secret action");

    const priorities = await todayPriorities(user.id);
    expect(JSON.stringify(priorities)).not.toContain("Other Co");

    await prisma.user.deleteMany({ where: { id: other.id } });
  });
});

describe("Learning proposal concurrency", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("refuses to accept the same proposal twice", async () => {
    const interview = await createInterview(user.id, {
      company: "Meta",
      role: "Analyst",
    });
    await generateEvidenceProposalsFromInterview({
      userId: user.id,
      interviewId: interview.id,
      reflection: "I onboarded new employees during my internship.",
    });
    const proposal = await prisma.evidenceProposal.findFirstOrThrow({
      where: { userId: user.id },
    });
    await acceptProposal(user.id, proposal.id);
    await expect(acceptProposal(user.id, proposal.id)).rejects.toSatisfy(
      isAppError,
    );
  });
});

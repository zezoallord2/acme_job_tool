import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createEvidence,
  createJobAndApplication,
  createTestUser,
  type TestUser,
} from "../helpers";
import {
  ensureMasterResume,
  RESUME_CONTENT_SCHEMA,
} from "@/services/resume-service";
import {
  saveTailoredResume,
  tailorResume,
  TailorFailure,
} from "@/services/tailor-service";
import { defaultDecisions } from "@/domain/tailoring";

/**
 * Resume tailoring end to end against a real database. The model output is a
 * Manual Mode paste, so the test is deterministic and needs no API key.
 */

const OUTPUT = {
  summary: "Analyst who rebuilt the month-end reporting pack in Excel.",
  prioritizedSkills: ["Excel", "SQL", "Snowflake"],
  experiences: [],
  changes: [{ section: "summary", what: "Rewrote", why: "Leads with Excel." }],
  jobKeywords: ["Excel", "SQL", "stakeholder reporting", "not-in-the-job"],
  gaps: [
    {
      requirement: "analytics certification",
      question: "Do you hold an analytics certification?",
    },
  ],
  droppedPoints: [],
  needsInput: [],
};

describe("resume tailoring service", () => {
  let user: TestUser;
  let applicationId: string;

  beforeEach(async () => {
    user = await createTestUser({ complete: false });
    await createEvidence(user.id, {
      statement: "Rebuilt the month-end reporting pack in Excel.",
      claimType: "ACHIEVEMENT",
      verificationStatus: "VERIFIED",
    });
    await prisma.skill.createMany({
      data: [
        { userId: user.id, name: "Excel" },
        { userId: user.id, name: "SQL" },
      ],
    });
    await ensureMasterResume(user.id);
    applicationId = (await createJobAndApplication(user.id)).application.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("is available on the free plan and returns a guarded proposal", async () => {
    const proposal = await tailorResume(user.id, {
      applicationId,
      manualInput: JSON.stringify(OUTPUT),
    });
    expect(proposal.generatedBy).toBe("Manual");
    expect(proposal.changes.some((c) => c.section === "summary")).toBe(true);
    // A skill the user never mentioned becomes a question, not a claim.
    expect(proposal.gaps.map((g) => g.requirement)).toContain("Snowflake");
    // Keywords are grounded in the job text.
    expect(proposal.keywords).not.toContain("not-in-the-job");
    expect(proposal.after.score).toBeGreaterThanOrEqual(proposal.before.score);
  });

  it("saves a job-linked version and leaves the master untouched", async () => {
    const master = await prisma.resume.findFirstOrThrow({
      where: { userId: user.id, isMaster: true },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const proposal = await tailorResume(user.id, {
      applicationId,
      manualInput: JSON.stringify(OUTPUT),
    });
    const saved = await saveTailoredResume(user.id, {
      applicationId,
      sourceResumeId: proposal.sourceResumeId,
      interactionId: proposal.interactionId,
      promptVersion: proposal.promptVersion,
      changes: proposal.changes,
      decisions: defaultDecisions(proposal.changes),
    });

    const draft = await prisma.resume.findUniqueOrThrow({
      where: { id: saved.resumeId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    expect(draft.isMaster).toBe(false);
    expect(draft.applicationId).toBe(applicationId);
    expect(draft.workflowId).toBe("RESUME_TAILORING");
    const content = RESUME_CONTENT_SCHEMA.parse(draft.versions[0]!.content);
    expect(content.summary).toBe(OUTPUT.summary);
    expect(content.skills).not.toContain("Snowflake");

    const masterAfter = await prisma.resume.findUniqueOrThrow({
      where: { id: master.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    expect(masterAfter.versions[0]!.contentHash).toBe(
      master.versions[0]!.contentHash,
    );
  });

  it("creates the job from pasted text when no saved job is chosen", async () => {
    const before = await prisma.jobPosting.count({
      where: { userId: user.id },
    });
    const proposal = await tailorResume(user.id, {
      jobText:
        "Reporting Analyst. You will own stakeholder reporting in Excel and SQL, automate the month-end pack and present findings to finance leadership every week.",
      jobTitle: "Reporting Analyst",
      manualInput: JSON.stringify(OUTPUT),
    });
    expect(proposal.jobTitle).toBe("Reporting Analyst");
    expect(await prisma.jobPosting.count({ where: { userId: user.id } })).toBe(
      before + 1,
    );
  });

  it("fails explicitly with a Manual Mode prompt when no AI is configured", async () => {
    const error = await tailorResume(user.id, { applicationId }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TailorFailure);
    const failure = error as TailorFailure;
    expect(failure.message).toMatch(/AI is (not configured|unavailable)/);
    expect(failure.prompt?.fullPrompt).toContain("ABSOLUTE RULES");
    // The resume is rendered as readable text (it used to be "[object Object]").
    expect(failure.prompt?.fullPrompt).toContain("SKILLS: Excel, SQL");
    expect(failure.prompt?.fullPrompt).not.toContain("[object Object]");
    expect(failure.applicationId).toBe(applicationId);
  });

  it("cannot tailor against another user's application", async () => {
    const other = await createTestUser({ complete: true });
    await expect(
      tailorResume(other.id, {
        applicationId,
        manualInput: JSON.stringify(OUTPUT),
      }),
    ).rejects.toThrow();
    await prisma.user.deleteMany({ where: { id: other.id } });
  });
});

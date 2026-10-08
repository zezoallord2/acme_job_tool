import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createEvidence,
  createJobAndApplication,
  createTestUser,
  type TestUser,
} from "../helpers";
import {
  answerAiQuestion,
  InterviewFailure,
  interviewSummary,
  startAiInterview,
} from "@/services/mock-interview-service";

/**
 * The AI mock interview end to end on the FREE plan, with model output pasted
 * in Manual Mode so the test is deterministic and needs no key.
 */

const QUESTIONS = {
  questions: [
    {
      question: "Walk me through your background and why this analyst role.",
      category: "GENERAL",
      slot: "OPENER",
      rationale: "Warm-up",
      expectedSignals: [],
    },
    {
      question: "Tell me about a time you rebuilt a manual report.",
      category: "BEHAVIORAL",
      slot: "BEHAVIOURAL",
      rationale: "Ownership",
      expectedSignals: ["STAR"],
    },
    {
      question: "How would you structure a weekly operations report?",
      category: "ROLE_SPECIFIC",
      slot: "ROLE",
      rationale: "Core skill",
      expectedSignals: [],
    },
    {
      question:
        "The role asks for a certification you do not list. How would you close that gap?",
      category: "RESUME_BASED",
      slot: "GAP",
      rationale: "Gap",
      expectedSignals: [],
      targetsRequirement: "certification",
    },
  ],
};

const FEEDBACK = {
  relevance: 4,
  specificity: 3,
  evidence: 4,
  structure: 3,
  clarity: 4,
  wasVague: false,
  unsupportedClaims: [],
  followUpQuestion: null,
  coachNote: "Good start.",
  strength: "You named the exact report you rebuilt.",
  improvement: "Finish with the result: how long preparation took afterwards.",
  strongerAnswer:
    "At my last role I owned the month-end reporting pack. I rebuilt it in Excel. It saved the team 12 hours a week.",
};

describe("AI mock interview", () => {
  let user: TestUser;
  let applicationId: string;

  beforeEach(async () => {
    user = await createTestUser({ complete: false });
    await createEvidence(user.id, {
      statement: "Rebuilt the month-end reporting pack in Excel.",
      claimType: "ACHIEVEMENT",
      verificationStatus: "VERIFIED",
    });
    applicationId = (await createJobAndApplication(user.id)).application.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("starts on the free plan with a Quick plan: opener first, closer last", async () => {
    const started = await startAiInterview(user.id, {
      applicationId,
      depth: "QUICK",
      manualInput: JSON.stringify(QUESTIONS),
    });
    expect(started.generatedBy).toBe("Manual");
    expect(started.questions).toHaveLength(5);
    expect(started.questions[0]!.slot).toBe("OPENER");
    expect(started.questions.at(-1)!.slot).toBe("CLOSER");
    expect(started.questions.at(-1)!.question).toMatch(/questions for us/);
    expect(started.questions.some((q) => q.slot === "GAP")).toBe(true);
  });

  it("scores an answer, keeps the session open and guards the stronger answer", async () => {
    const { sessionId, questions } = await startAiInterview(user.id, {
      applicationId,
      depth: "QUICK",
      manualInput: JSON.stringify(QUESTIONS),
    });
    const feedback = await answerAiQuestion(user.id, {
      sessionId,
      questionId: questions[1]!.id,
      transcript:
        "I rebuilt the month-end reporting pack in Excel so the team stopped copying numbers by hand.",
      manualInput: JSON.stringify(FEEDBACK),
    });
    expect(feedback.relevance).toBe(4);
    expect(feedback.improvement).toMatch(/result/);
    // "12 hours" was never stated by the user, so that sentence is removed.
    expect(feedback.strongerAnswer).not.toContain("12 hours");
    expect(feedback.strongerAnswer).toContain("rebuilt it in Excel");
    expect(feedback.warnings.join(" ")).toMatch(/Removed 1 sentence/);

    const session = await prisma.interviewSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.status).toBe("IN_PROGRESS");
    expect(session.questionsAsked).toBe(1);

    const summary = await interviewSummary(user.id, sessionId);
    expect(summary.answered).toBe(1);
    expect(summary.strengths).toEqual([FEEDBACK.strength]);
    expect(summary.fixes).toEqual([FEEDBACK.improvement]);
  });

  it("fails explicitly with a Manual Mode prompt when no AI is configured", async () => {
    const error = await startAiInterview(user.id, {
      applicationId,
      depth: "STANDARD",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InterviewFailure);
    const prompt = (error as InterviewFailure).prompt?.fullPrompt ?? "";
    expect(prompt).toContain("QUESTION PLAN");
    expect(prompt).toContain("1. OPENER");
    expect(prompt).toContain("CLOSER");
  });

  it("refuses to score another user's session", async () => {
    const { sessionId, questions } = await startAiInterview(user.id, {
      applicationId,
      depth: "QUICK",
      manualInput: JSON.stringify(QUESTIONS),
    });
    const other = await createTestUser({ complete: true });
    await expect(
      answerAiQuestion(other.id, {
        sessionId,
        questionId: questions[0]!.id,
        transcript: "An answer that is long enough to be scored properly.",
        manualInput: JSON.stringify(FEEDBACK),
      }),
    ).rejects.toThrow();
    await prisma.user.deleteMany({ where: { id: other.id } });
  });
});

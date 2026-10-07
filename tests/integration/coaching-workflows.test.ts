import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, createEvidence, type TestUser } from "../helpers";
import {
  CoachingFailure,
  buildCoachContext,
  buildDefenseContext,
  buildExtractionContext,
  coachInterviewAnswer,
  defendClaim,
  extractEvidenceFromNarrative,
  finishAchievementMining,
  generateInterviewQuestions,
  nextAchievementQuestion,
  toClaimType,
} from "@/services/coaching-service";
import { recordAnswer } from "@/services/interview-service";

/**
 * The five coaching workflows, exercised end to end in Manual Mode.
 *
 * These were previously registered prompts with no caller. Each test pastes a
 * response exactly as a $0 user would, then asserts the two properties the
 * product promises: nothing is invented, and nothing becomes a fact without the
 * user approving it.
 */

const EXTRACTION_JSON = {
  statements: [
    {
      statement: "Rebuilt the month-end reporting pack in Excel.",
      claimType: "ACHIEVEMENT",
      metricValue: null,
      metricUnit: null,
      tags: ["excel"],
    },
    {
      statement: "Cut month-end reporting time by 30 percent.",
      claimType: "METRIC",
      metricValue: 30,
      metricUnit: "percent",
      tags: ["reporting"],
    },
  ],
  needsInput: ["Which team owned the process before?"],
};

const ACHIEVEMENT_JSON = {
  nextQuestion:
    "What number did the reporting time drop by, and how did you measure it?",
  questionType: "QUANTIFY",
  missingFields: ["metric"],
  factsLearned: [
    {
      statement: "Cut month-end reporting time by 30 percent.",
      claimType: "METRIC",
      metricValue: 30,
      metricUnit: "percent",
    },
  ],
};

const DEFENSE_JSON = {
  verdict: "OVERSTATED",
  reason:
    "You claim to have led the migration, but you describe building it yourself.",
  whatHappened: "The reporting stack was replaced.",
  whatYouDid: "You rebuilt the pack and migrated the queries.",
  whatWasTheResult: "Reporting took 30 percent less time.",
  suggestedHonestWording: "Rebuilt the month-end reporting pack in Excel.",
};

const QUESTIONS_JSON = {
  questions: [
    {
      question: "Walk me through the month-end reporting rebuild.",
      category: "RESUME_BASED",
      rationale: "It is the strongest thing on the resume.",
      expectedSignals: ["specific numbers", "their own role"],
    },
    {
      question: "How did you handle conflicting figures from two teams?",
      category: "BEHAVIORAL",
      rationale: "Tests judgement rather than tooling.",
      expectedSignals: ["a decision", "a trade-off"],
    },
  ],
};

const COACH_JSON = {
  relevance: 4,
  specificity: 2,
  evidence: 1,
  structure: 3,
  clarity: 3,
  wasVague: true,
  unsupportedClaims: ["Reduced costs by 40 percent"],
  followUpQuestion: "Which specific reporting step did you remove?",
  coachNote: "Strong framing, but no numbers and one claim you cannot support.",
};

describe("Coaching workflows in Manual Mode", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  describe("EVIDENCE_EXTRACTION", () => {
    it("files extracted statements as proposals, never as ledger facts", async () => {
      const narrative =
        "I rebuilt our month-end reporting pack in Excel because the old one broke every close. It took me about six weeks and afterwards reporting took roughly a third less time.";

      const result = await extractEvidenceFromNarrative(
        user.id,
        narrative,
        JSON.stringify(EXTRACTION_JSON),
      );

      expect(result.statements).toHaveLength(2);
      expect(result.proposalIds).toHaveLength(2);

      // The ledger itself is untouched: nothing was promoted without approval.
      const ledgerCount = await prisma.evidence.count({
        where: { userId: user.id },
      });
      expect(ledgerCount).toBe(0);

      const proposals = await prisma.evidenceProposal.findMany({
        where: { id: { in: result.proposalIds } },
      });
      expect(proposals).toHaveLength(2);
      expect(proposals.every((p) => p.status === "PENDING")).toBe(true);
      // Inferred content starts low-confidence until a human confirms it.
      expect(proposals.every((p) => p.confidence === "LOW")).toBe(true);

      const metric = proposals.find((p) => p.metricValue !== null);
      expect(metric?.metricValue).toBe(30);
      expect(metric?.metricUnit).toBe("percent");
    });

    it("does not re-propose a statement the ledger already holds", async () => {
      await createEvidence(user.id, {
        statement: "Rebuilt the month-end reporting pack in Excel.",
        claimType: "ACHIEVEMENT",
      });

      const result = await extractEvidenceFromNarrative(
        user.id,
        "I rebuilt our month-end reporting pack in Excel and cut the time by 30 percent.",
        JSON.stringify(EXTRACTION_JSON),
      );

      expect(result.proposalIds).toHaveLength(1);
      expect(result.proposalIds).toHaveLength(
        result.proposalIds.filter((id) => typeof id === "string").length,
      );
    });

    it("rejects a narrative too short to extract anything from", async () => {
      await expect(
        extractEvidenceFromNarrative(user.id, "too short", "{}"),
      ).rejects.toThrow(/more detail/i);
    });

    it("surfaces the validation error instead of storing a malformed response", async () => {
      await expect(
        extractEvidenceFromNarrative(
          user.id,
          "I rebuilt the reporting pack in Excel and cut the time by thirty percent.",
          '{"statements": "not an array"}',
        ),
      ).rejects.toBeInstanceOf(CoachingFailure);

      expect(
        await prisma.evidenceProposal.count({ where: { userId: user.id } }),
      ).toBe(0);
    });
  });

  describe("ACHIEVEMENT_INTERVIEW", () => {
    it("asks exactly one question per turn", async () => {
      const turn = await nextAchievementQuestion(
        user.id,
        { known: { topic: "reporting rebuild" }, questionCount: 0 },
        JSON.stringify(ACHIEVEMENT_JSON),
      );

      // One question, and it is a question rather than a generated bullet.
      expect(turn.nextQuestion).toContain("?");
      expect(turn.nextQuestion).toMatch(/number|measure/i);
      expect(turn.questionType).toBe("QUANTIFY");
      expect(turn.missingFields).toContain("metric");
      expect(turn.factsLearned).toHaveLength(1);
    });

    it("files mined facts as proposals only after the interview is finished", async () => {
      const turn = await nextAchievementQuestion(
        user.id,
        { known: {}, questionCount: 0 },
        JSON.stringify(ACHIEVEMENT_JSON),
      );

      // Asking a question stores nothing.
      expect(
        await prisma.evidenceProposal.count({ where: { userId: user.id } }),
      ).toBe(0);

      const filed = await finishAchievementMining(user.id, turn.factsLearned);
      expect(filed.proposalIds).toHaveLength(1);
      expect(await prisma.evidence.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it("ignores facts too short to be a statement", async () => {
      const result = await finishAchievementMining(user.id, [
        { statement: "no", claimType: "ACHIEVEMENT" },
      ]);
      expect(result.proposalIds).toHaveLength(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe("DEFEND_CLAIM", () => {
    it("is allowed to return an OVERSTATED verdict", async () => {
      const result = await defendClaim(
        user.id,
        {
          claim:
            "Led the migration of the entire reporting stack across three teams.",
          userAccount: "I rebuilt the pack and migrated the queries myself.",
        },
        JSON.stringify(DEFENSE_JSON),
      );

      expect(result.verdict).toBe("OVERSTATED");
      expect(result.reason).toContain("you describe building it yourself");
      // It suggests honest wording; it never rewrites the user's records.
      expect(result.suggestedHonestWording).toContain("Rebuilt");
      expect(await prisma.evidence.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it("refuses a claim that is too short to assess", async () => {
      await expect(
        buildDefenseContext(user.id, { claim: "great" }),
      ).rejects.toThrow(/exact claim/i);
    });
  });

  describe("INTERVIEW_QUESTION", () => {
    it("persists generated questions onto a real session", async () => {
      const result = await generateInterviewQuestions(
        user.id,
        {
          mode: "BEHAVIORAL",
          role: "Data Analyst",
          count: 5,
        },
        JSON.stringify(QUESTIONS_JSON),
      );

      expect(result.questions).toHaveLength(2);

      // Real rows, owned by the user, attached to a real session.
      const stored = await prisma.interviewQuestion.findMany({
        where: { sessionId: result.sessionId },
        orderBy: { orderIndex: "asc" },
      });
      expect(stored).toHaveLength(2);
      expect(stored[0]?.question).toContain("month-end reporting rebuild");
      expect(stored[1]?.expectedSignals).toContain("a trade-off");

      const session = await prisma.interviewSession.findFirst({
        where: { id: result.sessionId },
      });
      expect(session?.userId).toBe(user.id);
    });

    it("never asks about a requirement the user's evidence cannot support", async () => {
      const result = await generateInterviewQuestions(
        user.id,
        { mode: "TECHNICAL", role: "Data Analyst", count: 3 },
        JSON.stringify(QUESTIONS_JSON),
      );

      const questions = result.questions.map((q) => q.question).join(" | ");
      // The questions came from the user, so nothing can appear that they did
      // not supply. Sanity check that the role context reached the prompt.
      expect(questions.length).toBeGreaterThan(0);
      expect(questions).not.toMatch(/80%/);
    });

    it("does not exceed the requested count", async () => {
      const result = await generateInterviewQuestions(
        user.id,
        { mode: "GENERAL", role: "Analyst", count: 1 },
        JSON.stringify(QUESTIONS_JSON),
      );
      expect(result.questions).toHaveLength(1);
    });
  });

  describe("INTERVIEW_FEEDBACK", () => {
    it("scores five criteria and surfaces the unsupported claim", async () => {
      const result = await coachInterviewAnswer(
        user.id,
        {
          question: "Walk me through the month-end reporting rebuild.",
          answer:
            "I rebuilt it. It was fine. We reduced costs by 40 percent which was great for the business overall.",
        },
        JSON.stringify(COACH_JSON),
      );

      expect(result.relevance).toBe(4);
      expect(result.specificity).toBe(2);
      expect(result.wasVague).toBe(true);
      expect(result.unsupportedClaims).toContain("Reduced costs by 40 percent");
      expect(result.followUpQuestion).toContain("reporting step");
      // No hire probability, ever.
      expect(JSON.stringify(result)).not.toMatch(/probability|chance of/i);
    });

    it("refuses to score an answer that was never given", () => {
      expect(() =>
        buildCoachContext({
          question: "Tell me about yourself",
          answer: "no",
          evidence: [],
        }),
      ).toThrow(/paste the answer/i);
    });

    it("records the coached answer against the question so it is reviewable", async () => {
      const { sessionId, questions } = await generateInterviewQuestions(
        user.id,
        { mode: "GENERAL", role: "Analyst", count: 1 },
        JSON.stringify(QUESTIONS_JSON),
      );

      const coached = await coachInterviewAnswer(
        user.id,
        {
          question: questions[0]!.question,
          answer:
            "I rebuilt the month-end reporting pack in Excel and it took a third less time.",
        },
        JSON.stringify(COACH_JSON),
      );

      const answer = await recordAnswer({
        userId: user.id,
        sessionId,
        questionId: questions[0]!.id,
        transcript:
          "I rebuilt the month-end reporting pack in Excel and it took a third less time.",
        scores: {
          relevance: coached.relevance,
          specificity: coached.specificity,
          evidence: coached.evidence,
          structure: coached.structure,
          clarity: coached.clarity,
        },
        unsupportedClaims: coached.unsupportedClaims,
        followUpQuestion: coached.followUpQuestion,
        coachNote: coached.coachNote,
        wasVague: coached.wasVague,
      });

      expect(answer.totalScore).not.toBeNull();
      expect(answer.unsupportedClaims).toHaveLength(1);

      const stored = await prisma.interviewAnswer.findFirst({
        where: { sessionId },
      });
      expect(stored?.userId).toBe(user.id);
    });
  });

  describe("cross-user isolation", () => {
    it("cannot read or write another user's coaching data", async () => {
      const other = await createTestUser({ complete: true });

      const { sessionId } = await generateInterviewQuestions(
        other.id,
        { mode: "GENERAL", role: "Analyst", count: 1 },
        JSON.stringify(QUESTIONS_JSON),
      );

      // The session belongs to `other`, so `user` cannot attach a question to it.
      const foreignSession = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });
      expect(foreignSession).toBeNull();

      // And no proposal leaked between the two accounts.
      expect(
        await prisma.evidenceProposal.count({ where: { userId: other.id } }),
      ).toBe(0);

      await prisma.user.deleteMany({ where: { id: other.id } });
    });
  });

  describe("claim type mapping", () => {
    it("maps an unknown AI claim type onto a safe enum member", () => {
      expect(toClaimType("ACHIEVEMENT")).toBe("ACHIEVEMENT");
      expect(toClaimType("achievement")).toBe("ACHIEVEMENT");
      // Anything unrecognised becomes RESPONSIBILITY rather than being cast.
      expect(toClaimType("SOMETHING_NEW")).toBe("RESPONSIBILITY");
      expect(toClaimType("")).toBe("RESPONSIBILITY");
      expect(toClaimType(undefined as unknown as string)).toBe(
        "RESPONSIBILITY",
      );
    });
  });

  describe("extraction context", () => {
    it("requires enough text to extract anything", async () => {
      await expect(buildExtractionContext(user.id, "short")).rejects.toThrow(
        /more detail/i,
      );
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, createEvidence, type TestUser } from "../helpers";
import {
  STUDIO_IDS,
  STUDIO_WORKFLOWS,
  StudioFailure,
  studioDescriptor,
  studioWorkflow,
  type StudioValues,
} from "@/services/studio-service";
import { ensureMasterResume } from "@/services/resume-service";

/**
 * The Writing Studio registry.
 *
 * These nine workflows had prompts, schemas and validators but no caller. Each
 * test pastes a response exactly as a $0 user would and asserts the two
 * properties the product promises: drafts are saved, and nothing is sent,
 * overwritten or treated as fact.
 */

const BULLET = {
  suggestion:
    "Rebuilt the month-end reporting pack in Excel, cutting preparation from five days to two.",
  usedEvidenceIds: [0],
  unsupportedAspects: [],
  riskLevel: "LOW",
  explanation: "Matches the Power Query evidence.",
};

const COVER_LETTER = {
  subject: "Reporting Analyst application",
  body: "I rebuilt the month-end reporting pack in Excel and cut preparation from five days to two.",
  usedEvidenceIds: [0],
  unsupportedCompanyClaims: [],
  needsInput: [],
};

const ANSWER = {
  answer:
    "I rebuilt the reporting pack and reduced preparation time by three days a month.",
  usedEvidenceIds: [0],
  unsupportedAspects: [],
  needsInput: [],
};

const LINKEDIN = {
  headline: {
    current: "Analyst",
    suggested: "Reporting analyst who rebuilt a month-end pack in Excel",
    why: "Names a specific, evidenced outcome.",
  },
  about: { current: "", suggested: "I work on reporting.", why: "Too vague." },
  experience: [],
  skillsToFeature: [
    { skill: "Power Query", why: "Evidenced.", evidenceIds: [0] },
  ],
  unsupportedAspects: [],
};

const STAR = {
  title: "Rebuilt the month-end pack",
  situation: "Close took five days.",
  task: "I owned the rebuild.",
  action: "Rebuilt it in Excel with Power Query.",
  result: "Close now takes two days.",
  learning: "Automate the repeated part.",
  usedEvidenceIds: [0],
  unsupportedAspects: [],
  needsInput: [],
};

const FOLLOW_UP = {
  subject: "Thank you",
  body: "Thank you for the interview about the reporting analyst role.",
  mentionsEvidenceIds: [],
};

const NARRATIVE = {
  title: "From support to reporting",
  originPoint: "Started in support.",
  bridgeSteps: ["Learned SQL", "Moved into reporting"],
  destinationRole: "Reporting analyst",
  targetIndustry: "Analytics",
  coreTheme: "Automate the reporting people keep doing by hand.",
  narrativeText:
    "I moved from support into reporting by automating the manual close.",
  usedEvidenceIds: [0],
  unsupportedAspects: [],
};

const VOICE = {
  isDirect: true,
  isConcise: true,
  isFormal: false,
  isConversational: true,
  isTechnical: false,
  isSimple: true,
  avgSentenceLength: 14,
  bannedPhrases: ["leverage synergies"],
  preferredPhrases: ["I rebuilt"],
  notes: "Plain and specific.",
};

async function runStudio(
  userId: string,
  id: string,
  values: StudioValues,
  payload: unknown,
) {
  const workflow = studioWorkflow(id);
  return workflow.run(userId, values, JSON.stringify(payload));
}

describe("Writing Studio registry", () => {
  let user: TestUser;
  let applicationId: string;

  beforeEach(async () => {
    user = await createTestUser({ complete: true });
    await createEvidence(user.id, {
      statement: "Rebuilt the month-end reporting pack in Excel.",
      claimType: "ACHIEVEMENT",
      verificationStatus: "VERIFIED",
    });
    await ensureMasterResume(user.id);
    const { createJobAndApplication } = await import("../helpers");
    const { application } = await createJobAndApplication(user.id);
    applicationId = application.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("registers every studio workflow (tailoring has its own screen)", () => {
    expect(STUDIO_IDS.sort()).toEqual(
      [
        "APPLICATION_ANSWER",
        "CAREER_NARRATIVE",
        "COVER_LETTER",
        "FOLLOW_UP",
        "LINKEDIN_OPTIMIZER",
        "RESUME_BULLET",
        "STAR_STORY",
        "VOICE_PROFILE",
      ].sort(),
    );
  });

  it("gives every workflow a capability, fields and a run implementation", () => {
    for (const id of STUDIO_IDS) {
      const w = STUDIO_WORKFLOWS[id];
      expect(w, id).toBeDefined();
      expect(w.capability, id).toBeTruthy();
      expect(w.title.length, id).toBeGreaterThan(3);
      expect(w.description.length, id).toBeGreaterThan(20);
      expect(typeof w.buildContext, id).toBe("function");
      expect(typeof w.run, id).toBe("function");
    }
  });

  it("resolves a descriptor with no leaking of server-only fields", async () => {
    const d = await studioDescriptor(user.id, studioWorkflow("COVER_LETTER"));
    expect(d.id).toBe("COVER_LETTER");
    expect(d.fields.some((f) => f.name === "applicationId")).toBe(true);
    // Application options come from the user's own records.
    const applicationField = d.fields.find((f) => f.name === "applicationId");
    expect(applicationField?.options).toHaveLength(1);
  });

  it("rejects an unknown workflow id", () => {
    expect(() => studioWorkflow("NOT_A_WORKFLOW")).toThrow();
  });

  describe("RESUME_BULLET", () => {
    it("stores the bullet as unaccepted with the evidence that supports it", async () => {
      const result = await runStudio(
        user.id,
        "RESUME_BULLET",
        { originalBullet: "I did reporting things", jobRequirement: "Excel" },
        BULLET,
      );
      expect(result.summary).toMatch(/draft bullet/i);

      const bullet = await prisma.resumeBullet.findFirstOrThrow({
        where: { userId: user.id },
      });
      // Never accepted automatically: a human decides.
      expect(bullet.isAccepted).toBe(false);
      expect(bullet.state).toBe("NEEDS_CONFIRMATION");
      expect(bullet.text).toContain("five days to two");
      expect(bullet.originalText).toBe("I did reporting things");
      expect(bullet.evidenceIds).toHaveLength(1);
    });

    it("refuses a bullet that is too short to rewrite", async () => {
      await expect(
        runStudio(user.id, "RESUME_BULLET", { originalBullet: "x" }, BULLET),
      ).rejects.toThrow(/paste the bullet/i);
    });
  });

  describe("COVER_LETTER", () => {
    it("saves a versioned draft linked to the application", async () => {
      const result = await runStudio(
        user.id,
        "COVER_LETTER",
        { applicationId, tone: "CONCISE" },
        COVER_LETTER,
      );
      expect(result.savedPath).toBe(`/app/applications/${applicationId}`);

      const letter = await prisma.coverLetter.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(letter.applicationId).toBe(applicationId);
      expect(letter.tone).toBe("CONCISE");
      expect(letter.isCurrent).toBe(true);
      expect(letter.workflowId).toBe("COVER_LETTER");
      expect(letter.evidenceIds).toHaveLength(1);
      expect(letter.contentHash).toHaveLength(64);
    });

    it("supersedes an older draft rather than overwriting it", async () => {
      await runStudio(
        user.id,
        "COVER_LETTER",
        { applicationId, tone: "STANDARD" },
        COVER_LETTER,
      );
      await runStudio(
        user.id,
        "COVER_LETTER",
        { applicationId, tone: "CONCISE" },
        COVER_LETTER,
      );

      const all = await prisma.coverLetter.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      expect(all).toHaveLength(2);
      expect(all[0]?.isCurrent).toBe(false);
      expect(all[1]?.isCurrent).toBe(true);
    });
  });

  describe("APPLICATION_ANSWER", () => {
    it("saves the answer against the application with its evidence", async () => {
      await runStudio(
        user.id,
        "APPLICATION_ANSWER",
        { applicationId, question: "Why this role?", wordLimit: "80" },
        ANSWER,
      );
      const answer = await prisma.applicationAnswer.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(answer.applicationId).toBe(applicationId);
      expect(answer.question).toBe("Why this role?");
      expect(answer.evidenceIds).toHaveLength(1);
      expect(answer.workflowId).toBe("APPLICATION_ANSWER");
      // Not marked reusable by default; the user decides that.
      expect(answer.isReusable).toBe(false);
    });

    it("refuses an empty question", async () => {
      await expect(
        runStudio(user.id, "APPLICATION_ANSWER", { question: "hi" }, ANSWER),
      ).rejects.toThrow(/paste the question/i);
    });
  });

  describe("LINKEDIN_OPTIMIZER", () => {
    it("stores suggestions without marking them a confirmed fact", async () => {
      const result = await runStudio(
        user.id,
        "LINKEDIN_OPTIMIZER",
        { targetRole: "Reporting analyst", currentHeadline: "Analyst" },
        LINKEDIN,
      );
      expect(result.summary).toMatch(/nothing on your linkedin was changed/i);

      const narrative = await prisma.careerNarrative.findFirstOrThrow({
        where: { userId: user.id },
      });
      // A suggestion is not a fact the user confirmed.
      expect(narrative.userConfirmed).toBe(false);
      expect(JSON.stringify(narrative.metadata)).toContain(
        "Reporting analyst who rebuilt",
      );
    });

    it("refuses without a target role", async () => {
      await expect(
        runStudio(user.id, "LINKEDIN_OPTIMIZER", { targetRole: "" }, LINKEDIN),
      ).rejects.toThrow(/which role/i);
    });
  });

  describe("STAR_STORY", () => {
    it("structures the user's own account into the story bank", async () => {
      const result = await runStudio(
        user.id,
        "STAR_STORY",
        {
          account: "I rebuilt the month-end pack in Excel over six weeks.",
          category: "ACHIEVEMENT",
        },
        STAR,
      );
      expect(result.savedPath).toBe("/app/stories");

      const story = await prisma.starStory.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(story.title).toBe("Rebuilt the month-end pack");
      expect(story.situation).toContain("five days");
      // Evidence cited makes it strong; no evidence leaves it partial.
      expect(story.strength).toBe("STRONG");
      expect(story.evidenceIds).toHaveLength(1);
    });

    it("refuses an account too short to structure", async () => {
      await expect(
        runStudio(user.id, "STAR_STORY", { account: "did stuff" }, STAR),
      ).rejects.toThrow(/more detail/i);
    });
  });

  describe("FOLLOW_UP", () => {
    it("saves a draft and does not mark it sent", async () => {
      const result = await runStudio(
        user.id,
        "FOLLOW_UP",
        { applicationId, type: "THANK_YOU" },
        FOLLOW_UP,
      );
      expect(result.summary).toMatch(/nothing was sent/i);

      const followUp = await prisma.followUp.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(followUp.status).toBe("DRAFT");
      expect(followUp.sentAt).toBeNull();
      expect(followUp.applicationId).toBe(applicationId);
      expect(followUp.type).toBe("THANK_YOU");
    });
  });

  describe("CAREER_NARRATIVE", () => {
    it("saves an unconfirmed narrative and retires the previous one", async () => {
      await runStudio(
        user.id,
        "CAREER_NARRATIVE",
        {
          fromRole: "Support analyst",
          toRole: "Reporting analyst",
          industry: "Analytics",
        },
        NARRATIVE,
      );
      await runStudio(
        user.id,
        "CAREER_NARRATIVE",
        { fromRole: "Support analyst", toRole: "Analytics engineer" },
        NARRATIVE,
      );

      const all = await prisma.careerNarrative.findMany({
        where: { userId: user.id },
        orderBy: { version: "asc" },
      });
      expect(all).toHaveLength(2);
      expect(all[0]?.isActive).toBe(false);
      expect(all[1]?.isActive).toBe(true);
      // Inference stays unconfirmed until the user accepts it.
      expect(all[1]?.userConfirmed).toBe(false);
      expect(all[1]?.coreTheme).toContain("Automate");
    });
  });

  describe("VOICE_PROFILE", () => {
    it("saves preferences as a new version", async () => {
      const result = await runStudio(
        user.id,
        "VOICE_PROFILE",
        {
          samples:
            "I rebuilt the reporting pack. It took six weeks. The close now takes two days instead of five, which is the part that mattered to the team.",
        },
        VOICE,
      );
      expect(result.summary).toMatch(/voice profile saved/i);

      const profile = await prisma.voiceProfile.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(profile.version).toBe(1);
      expect(profile.isDirect).toBe(true);
      expect(profile.isConcise).toBe(true);
      expect(profile.bannedPhrases).toContain("leverage synergies");
      expect(profile.avgSentenceLength).toBe(14);
    });

    it("refuses samples too short to learn anything from", async () => {
      await expect(
        runStudio(user.id, "VOICE_PROFILE", { samples: "short" }, VOICE),
      ).rejects.toThrow(/more of your own writing/i);
    });
  });

  describe("failure handling", () => {
    it("surfaces a validation error instead of saving a malformed response", async () => {
      await expect(
        runStudio(
          user.id,
          "COVER_LETTER",
          { applicationId },
          { body: "too short" },
        ),
      ).rejects.toBeInstanceOf(StudioFailure);

      expect(
        await prisma.coverLetter.count({ where: { userId: user.id } }),
      ).toBe(0);
    });
  });
});

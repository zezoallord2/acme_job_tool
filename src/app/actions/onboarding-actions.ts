"use server";

import { prisma } from "@/lib/db";
import { Errors, userFacingMessage, asAppError } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { UserGoal } from "@prisma/client";

export async function getOnboarding() {
  const user = await requireUser();
  const existing = await prisma.onboardingProgress.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return existing ?? null;
}

export async function saveOnboardingStepAction(
  _prev: unknown,
  formData: FormData,
): Promise<unknown> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });

    const step = String(formData.get("step") ?? "") as OnboardingStepName;
    if (!STEPS.some((s) => s.step === step))
      throw Errors.validation("Unknown onboarding step.");

    const existing =
      (await prisma.onboardingProgress.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })) ??
      (await prisma.onboardingProgress.create({ data: { userId: user.id } }));

    const text = (k: string): string | null => {
      const v = String(formData.get(k) ?? "").trim();
      return v.length ? v.slice(0, 300) : null;
    };

    const data: Record<string, unknown> = { step };

    switch (step) {
      case "FIRST_NAME": {
        const firstName = text("firstName");
        if (!firstName) throw Errors.validation("Enter your first name.");
        data.firstName = firstName;
        break;
      }
      case "EXPERIENCE_LEVEL":
        data.experienceLevel = requireEnum(formData.get("experienceLevel"), [
          "FRESH_GRADUATE",
          "ENTRY_LEVEL",
          "MID_LEVEL",
          "SENIOR",
          "EXECUTIVE",
          "CAREER_CHANGER",
        ]);
        break;
      case "CURRENT_SITUATION": {
        const value = text("currentSituation");
        if (!value)
          throw Errors.validation(
            "Tell us your current situation in one line.",
          );
        data.currentSituation = value;
        break;
      }
      case "TARGET_ROLE": {
        const value = text("targetRole");
        if (!value)
          throw Errors.validation("Enter the role you are targeting.");
        data.targetRole = value;
        break;
      }
      case "TARGET_INDUSTRY":
        data.targetIndustry = text("targetIndustry");
        break;
      case "CAREER_CHANGER":
        data.isCareerChanger =
          String(formData.get("isCareerChanger")) === "true";
        break;
      case "LOCATION_PREFERENCE":
        data.locationPreference = text("locationPreference");
        break;
      case "WORK_PREFERENCE":
        data.workArrangement = requireEnum(formData.get("workArrangement"), [
          "REMOTE",
          "HYBRID",
          "ON_SITE",
          "NO_PREFERENCE",
        ]);
        break;
      case "PRIMARY_GOAL":
        data.primaryGoal = requireEnum(formData.get("primaryGoal"), [
          "IMPROVE_RESUME",
          "BETTER_TARGETING",
          "INTERVIEW_PREP",
          "ORGANIZE_APPLICATIONS",
          "FULL_SYSTEM",
        ]);
        data.snapshotCreatedAt = new Date();
        break;
    }

    await prisma.onboardingProgress.update({
      where: { id: existing.id },
      data,
    });

    if (step === "PRIMARY_GOAL") {
      await buildCareerSnapshot(user.id, {
        firstName: (data.firstName as string | null) ?? existing.firstName,
        experienceLevel:
          (data.experienceLevel as string | null) ?? existing.experienceLevel,
        currentSituation:
          (data.currentSituation as string | null) ?? existing.currentSituation,
        targetRole: (data.targetRole as string | null) ?? existing.targetRole,
        targetIndustry:
          (data.targetIndustry as string | null) ?? existing.targetIndustry,
        isCareerChanger:
          (data.isCareerChanger as boolean | null) ?? existing.isCareerChanger,
        primaryGoal:
          (data.primaryGoal as UserGoal | null) ?? existing.primaryGoal,
      });
    } else {
      await prisma.userProfile.updateMany({
        where: { userId: user.id },
        data: {
          firstName: step === "FIRST_NAME" ? text("firstName") : undefined,
        },
      });
    }

    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

type OnboardingStepName =
  | "FIRST_NAME"
  | "EXPERIENCE_LEVEL"
  | "CURRENT_SITUATION"
  | "TARGET_ROLE"
  | "TARGET_INDUSTRY"
  | "CAREER_CHANGER"
  | "LOCATION_PREFERENCE"
  | "WORK_PREFERENCE"
  | "PRIMARY_GOAL";

const STEPS: Array<{ step: OnboardingStepName; label: string }> = [
  { step: "FIRST_NAME", label: "First name" },
  { step: "EXPERIENCE_LEVEL", label: "Experience level" },
  { step: "CURRENT_SITUATION", label: "Current situation" },
  { step: "TARGET_ROLE", label: "Target role" },
  { step: "TARGET_INDUSTRY", label: "Target industry" },
  { step: "CAREER_CHANGER", label: "Career change" },
  { step: "LOCATION_PREFERENCE", label: "Location preference" },
  { step: "WORK_PREFERENCE", label: "Work preference" },
  { step: "PRIMARY_GOAL", label: "Primary goal" },
];

function requireEnum(
  value: FormDataEntryValue | null,
  allowed: string[],
): string {
  const v = String(value ?? "");
  if (!allowed.includes(v))
    throw Errors.validation("Choose one of the options.");
  return v;
}

/** Career Snapshot: minimum viable career record plus honest completeness. */
async function buildCareerSnapshot(
  userId: string,
  onboarding: {
    firstName: string | null;
    experienceLevel: string | null;
    currentSituation: string | null;
    targetRole: string | null;
    targetIndustry: string | null;
    isCareerChanger: boolean | null;
    primaryGoal: UserGoal | null;
  },
): Promise<void> {
  const yearMap: Record<string, number> = {
    FRESH_GRADUATE: 0,
    ENTRY_LEVEL: 1,
    MID_LEVEL: 4,
    SENIOR: 8,
    EXECUTIVE: 12,
    CAREER_CHANGER: 3,
  };
  const yearsExperience =
    onboarding.experienceLevel !== null
      ? (yearMap[onboarding.experienceLevel] ?? null)
      : null;

  const snapshotStatement = [
    onboarding.firstName
      ? `${onboarding.firstName} is targeting ${onboarding.targetRole ?? "a new role"}.`
      : "",
    onboarding.currentSituation ?? "",
    onboarding.targetIndustry
      ? `Interested in ${onboarding.targetIndustry}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { ensureMasterResume } = await import("@/services/resume-service");
  await ensureMasterResume(userId);

  const completeness = await computeCompleteness(userId);

  await prisma.careerMasterProfile.upsert({
    where: { userId },
    create: {
      userId,
      targetRolePrimary: onboarding.targetRole,
      targetIndustry: onboarding.targetIndustry,
      yearsExperience,
      isCareerChanger: onboarding.isCareerChanger ?? false,
      currentSituation: onboarding.currentSituation,
      primaryGoal: onboarding.primaryGoal ?? "FULL_SYSTEM",
      completenessPercent: completeness,
    },
    update: {
      targetRolePrimary: onboarding.targetRole,
      targetIndustry: onboarding.targetIndustry,
      yearsExperience,
      isCareerChanger: onboarding.isCareerChanger ?? false,
      currentSituation: onboarding.currentSituation,
      primaryGoal: onboarding.primaryGoal ?? "FULL_SYSTEM",
      completenessPercent: completeness,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  if (snapshotStatement.length > 20) {
    const existing = await prisma.evidence.findFirst({
      where: { userId, statement: snapshotStatement },
      select: { id: true },
    });
    if (!existing) {
      await prisma.evidence.create({
        data: {
          userId,
          statement: snapshotStatement,
          claimType: "RESPONSIBILITY",
          sourceType: "USER_STATEMENT",
          sourceDescription: "Career Snapshot created during onboarding",
          verificationStatus: "USER_CONFIRMED",
          confidenceCategory: "MEDIUM",
          authority: "USER_CONFIRMED",
          lastConfirmedAt: new Date(),
          createdBy: "onboarding",
        },
      });
    }
  }

  await prisma.onboardingProgress.updateMany({
    where: { userId, completedAt: null },
    data: { completedAt: new Date(), step: "COMPLETE" },
  });
}

export async function computeCompleteness(userId: string): Promise<number> {
  const [profile, employment, education, skills, evidence, target, resume] =
    await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          firstName: true,
          email: true,
          phone: true,
          locationCity: true,
        },
      }),
      prisma.employmentRecord.count({ where: { userId } }),
      prisma.educationRecord.count({ where: { userId } }),
      prisma.skill.count({ where: { userId } }),
      prisma.evidence.count({
        where: {
          userId,
          verificationStatus: { in: ["VERIFIED", "USER_CONFIRMED"] },
        },
      }),
      prisma.careerMasterProfile.findUnique({
        where: { userId },
        select: { targetRolePrimary: true, professionalSummary: true },
      }),
      prisma.resume.count({ where: { userId, isMaster: true } }),
    ]);

  const checks = [
    Boolean(profile?.firstName),
    Boolean(profile?.email),
    Boolean(profile?.phone),
    Boolean(profile?.locationCity),
    employment > 0,
    education > 0,
    skills > 0,
    evidence > 0,
    Boolean(target?.targetRolePrimary),
    Boolean(target?.professionalSummary),
    resume > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

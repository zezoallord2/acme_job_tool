"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage, Errors } from "@/lib/errors";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { computeCompleteness } from "@/app/actions/onboarding-actions";
import { requireCapability } from "@/services/entitlement-service";
import type { UserGoal } from "@prisma/client";

function fail(e: unknown) {
  return { ok: false, message: userFacingMessage(asAppError(e)) };
}

const goalSchema = z.enum([
  "IMPROVE_RESUME",
  "BETTER_TARGETING",
  "INTERVIEW_PREP",
  "ORGANIZE_APPLICATIONS",
  "FULL_SYSTEM",
]);

export async function saveCareerProfileAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const text = (key: string, max = 200): string =>
      String(formData.get(key) ?? "")
        .trim()
        .slice(0, max);

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        firstName: text("firstName", 80) || null,
        lastName: text("lastName", 80) || null,
        email: text("email", 200) || user.email,
        phone: text("phone", 40) || null,
        locationCity: text("locationCity", 120) || null,
        linkedinUrl: text("linkedinUrl", 300) || null,
      },
      update: {
        firstName: text("firstName", 80) || null,
        lastName: text("lastName", 80) || null,
        email: text("email", 200) || user.email,
        phone: text("phone", 40) || null,
        locationCity: text("locationCity", 120) || null,
        linkedinUrl: text("linkedinUrl", 300) || null,
      },
    });

    const goalParsed = goalSchema.safeParse(text("primaryGoal", 40));
    const completeness = await computeCompleteness(user.id);
    const goal = (
      goalParsed.success ? goalParsed.data : "FULL_SYSTEM"
    ) as UserGoal;

    await prisma.careerMasterProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        targetRolePrimary: text("targetRolePrimary", 120) || null,
        targetRoleSecondary: text("targetRoleSecondary", 120) || null,
        targetIndustry: text("targetIndustry", 120) || null,
        isCareerChanger: formData.get("isCareerChanger") === "true",
        careerChangeFrom: text("careerChangeFrom", 120) || null,
        careerChangeTo: text("careerChangeTo", 120) || null,
        currentSituation: text("currentSituation", 300) || null,
        primaryGoal: goal,
        professionalSummary: text("professionalSummary", 4000) || null,
        headline: text("headline", 160) || null,
        completenessPercent: completeness,
      },
      update: {
        targetRolePrimary: text("targetRolePrimary", 120) || null,
        targetRoleSecondary: text("targetRoleSecondary", 120) || null,
        targetIndustry: text("targetIndustry", 120) || null,
        isCareerChanger: formData.get("isCareerChanger") === "true",
        careerChangeFrom: text("careerChangeFrom", 120) || null,
        careerChangeTo: text("careerChangeTo", 120) || null,
        currentSituation: text("currentSituation", 300) || null,
        primaryGoal: goal,
        professionalSummary: text("professionalSummary", 4000) || null,
        headline: text("headline", 160) || null,
        completenessPercent: completeness,
      },
    });

    revalidatePath("/app/career");
    revalidatePath("/app");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function createEmploymentAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "CAREER_MASTER_PROFILE");

    const companyName = String(formData.get("companyName") ?? "").trim();
    const jobTitle = String(formData.get("jobTitle") ?? "").trim();
    if (!companyName || !jobTitle)
      throw Errors.validation("Company and job title are both required.");

    const startDate = formData.get("startDate")
      ? new Date(String(formData.get("startDate")))
      : null;
    const endDate = formData.get("endDate")
      ? new Date(String(formData.get("endDate")))
      : null;
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw Errors.validation("The end date cannot be before the start date.");
    }

    await prisma.employmentRecord.create({
      data: {
        userId: user.id,
        companyName: companyName.slice(0, 200),
        jobTitle: jobTitle.slice(0, 200),
        location:
          String(formData.get("location") ?? "")
            .trim()
            .slice(0, 200) || null,
        employmentType:
          String(formData.get("employmentType") ?? "")
            .trim()
            .slice(0, 80) || null,
        startDate,
        endDate,
        isCurrent: formData.get("isCurrent") === "true",
        description:
          String(formData.get("description") ?? "")
            .trim()
            .slice(0, 4000) || null,
        highlights: String(formData.get("highlights") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
      },
    });

    const completeness = await computeCompleteness(user.id);
    await prisma.careerMasterProfile.updateMany({
      where: { userId: user.id },
      data: { completenessPercent: completeness },
    });

    revalidatePath("/app/career");
    return { ok: true, message: "Role added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createSkillAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "CAREER_MASTER_PROFILE");

    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 1) throw Errors.validation("Enter a skill name.");

    await prisma.skill.upsert({
      where: { userId_name: { userId: user.id, name } },
      create: {
        userId: user.id,
        name: name.slice(0, 80),
        category:
          String(formData.get("category") ?? "")
            .trim()
            .slice(0, 80) || null,
        isCore: formData.get("isCore") === "true",
      },
      update: { isCore: formData.get("isCore") === "true" },
    });

    const completeness = await computeCompleteness(user.id);
    await prisma.careerMasterProfile.updateMany({
      where: { userId: user.id },
      data: { completenessPercent: completeness },
    });

    revalidatePath("/app/career");
    return { ok: true, message: `Added "${name}".` };
  } catch (e) {
    return fail(e);
  }
}

export async function createEducationAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "CAREER_MASTER_PROFILE");

    const institution = String(formData.get("institution") ?? "").trim();
    if (!institution) throw Errors.validation("Institution is required.");

    await prisma.educationRecord.create({
      data: {
        userId: user.id,
        institution: institution.slice(0, 200),
        degree:
          String(formData.get("degree") ?? "")
            .trim()
            .slice(0, 160) || null,
        fieldOfStudy:
          String(formData.get("fieldOfStudy") ?? "")
            .trim()
            .slice(0, 160) || null,
        startDate: formData.get("startDate")
          ? new Date(String(formData.get("startDate")))
          : null,
        endDate: formData.get("endDate")
          ? new Date(String(formData.get("endDate")))
          : null,
      },
    });

    revalidatePath("/app/career");
    return { ok: true, message: "Education added." };
  } catch (e) {
    return fail(e);
  }
}

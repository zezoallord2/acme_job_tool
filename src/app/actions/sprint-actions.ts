"use server";

import { revalidatePath } from "next/cache";
import { requireSameOrigin, requireUser } from "@/lib/auth";
import { inTransaction } from "@/lib/db";
import { Errors, asAppError, userFacingMessage } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCapability } from "@/services/entitlement-service";
import type { ActionState } from "@/app/actions/state";

const DAY_PLAN = [
  [
    "CAREER_PROFILE",
    "Tighten your My Profile",
    "Confirm your target, contact details and factual career story.",
  ],
  [
    "ACHIEVEMENT_BANK",
    "Build your achievement bank",
    "Capture outcomes, metrics and the evidence behind them.",
  ],
  [
    "MASTER_RESUME",
    "Strengthen the master resume",
    "Create a reliable source resume before tailoring.",
  ],
  [
    "TARGET_ROLES",
    "Define target roles",
    "Choose roles that fit your evidence and direction.",
  ],
  [
    "JOB_ANALYSIS",
    "Analyze one real job",
    "Separate requirements, preferences and deal-breakers.",
  ],
  [
    "RESUME_TAILORING",
    "Tailor with evidence",
    "Match language without inventing experience.",
  ],
  [
    "APPLICATION_WORKFLOW",
    "Check if you are ready to apply",
    "Resolve unsupported claims before sending.",
  ],
  [
    "STAR_STORIES",
    "Build STAR stories",
    "Turn verified achievements into interview-ready stories.",
  ],
  [
    "INTERVIEW_PRACTICE",
    "Practice the hard questions",
    "Answer from evidence and note weak spots.",
  ],
  [
    "TRACKING",
    "Clean the application tracker",
    "Record every status, deadline and next action.",
  ],
  [
    "JOB_ANALYSIS",
    "Compare opportunities",
    "Focus effort on roles with the strongest evidence coverage.",
  ],
  [
    "RESUME_TAILORING",
    "Prepare the next application",
    "Create and inspect another job-specific version.",
  ],
  [
    "INTERVIEW_PRACTICE",
    "Defend your strongest claims",
    "Practice follow-up questions without exaggeration.",
  ],
  [
    "TRACKING",
    "Review and plan the next cycle",
    "Record outcomes, learning and the next highest-value action.",
  ],
] as const;

function fail(error: unknown): ActionState {
  return { ok: false, message: userFacingMessage(asAppError(error)) };
}

export async function startSprintAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "SPRINT_14_DAY");

    const result = await inTransaction(async (tx) => {
      const existing = await tx.sprint.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 13);

      const sprint = await tx.sprint.create({
        data: {
          userId: user.id,
          title: "14-Day Plan",
          status: "ACTIVE",
          startDate,
          endDate,
          currentDay: 1,
        },
        select: { id: true },
      });

      for (let index = 0; index < DAY_PLAN.length; index += 1) {
        const [kind, title, description] = DAY_PLAN[index]!;
        const day = await tx.sprintDay.create({
          data: {
            sprintId: sprint.id,
            dayNumber: index + 1,
            title,
            focus: description,
            minutesTarget: index === 6 || index === 13 ? 30 : 45,
          },
          select: { id: true },
        });
        await tx.sprintTask.create({
          data: {
            userId: user.id,
            sprintId: sprint.id,
            sprintDayId: day.id,
            kind,
            title,
            description,
            orderIndex: index,
          },
        });
      }
      return { id: sprint.id, created: true };
    });

    revalidatePath("/app/sprint");
    return {
      ok: true,
      message: result.created
        ? "Your 14-day sprint is ready. Start with Day 1."
        : "Your active sprint is already here.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSprintTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "SPRINT_14_DAY");

    const taskId = String(formData.get("taskId") ?? "");
    const complete = String(formData.get("complete") ?? "") === "true";
    if (!taskId) throw Errors.validation("Sprint task is required.");

    await inTransaction(async (tx) => {
      const task = await tx.sprintTask.findFirst({
        where: { id: taskId, userId: user.id, sprint: { status: "ACTIVE" } },
        select: { id: true, sprintId: true, sprintDayId: true },
      });
      if (!task) throw Errors.notFound("Sprint task");

      await tx.sprintTask.update({
        where: { id: task.id },
        data: {
          status: complete ? "COMPLETED" : "PENDING",
          completedAt: complete ? new Date() : null,
        },
      });

      if (task.sprintDayId) {
        const remaining = await tx.sprintTask.count({
          where: {
            sprintDayId: task.sprintDayId,
            status: { not: "COMPLETED" },
          },
        });
        await tx.sprintDay.update({
          where: { id: task.sprintDayId },
          data: {
            status: remaining === 0 ? "COMPLETED" : "IN_PROGRESS",
            completedAt: remaining === 0 ? new Date() : null,
          },
        });
      }

      const remaining = await tx.sprintTask.count({
        where: { sprintId: task.sprintId, status: { not: "COMPLETED" } },
      });
      const next = await tx.sprintDay.findFirst({
        where: { sprintId: task.sprintId, status: { not: "COMPLETED" } },
        orderBy: { dayNumber: "asc" },
        select: { dayNumber: true },
      });
      await tx.sprint.update({
        where: { id: task.sprintId },
        data: {
          currentDay: next?.dayNumber ?? 14,
          status: remaining === 0 ? "COMPLETED" : "ACTIVE",
          completedAt: remaining === 0 ? new Date() : null,
        },
      });
    });

    revalidatePath("/app/sprint");
    return {
      ok: true,
      message: complete ? "Task completed." : "Task reopened.",
    };
  } catch (error) {
    return fail(error);
  }
}

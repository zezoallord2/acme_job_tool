"use server";

import { revalidatePath } from "next/cache";
import { requireSameOrigin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";

async function notificationId(
  formData: FormData,
): Promise<{ userId: string; id: string }> {
  await requireSameOrigin();
  const user = await requireUser();
  await enforceRateLimit("write", { userId: user.id });
  const id = String(formData.get("notificationId") ?? "");
  if (!id) throw Errors.validation("Notification is required.");
  return { userId: user.id, id };
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<void> {
  const { userId, id } = await notificationId(formData);
  const result = await prisma.notification.updateMany({
    where: { id, userId, status: "UNREAD" },
    data: { status: "READ", readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.count({ where: { id, userId } });
    if (!exists) throw Errors.notFound("Notification");
  }
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function dismissNotificationAction(
  formData: FormData,
): Promise<void> {
  const { userId, id } = await notificationId(formData);
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { status: "DISMISSED", readAt: new Date() },
  });
  if (result.count === 0) throw Errors.notFound("Notification");
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

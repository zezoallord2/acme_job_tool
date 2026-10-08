import { prisma } from "@/lib/db";
import { analyticsFor } from "@/services/ask-acme-service";
import { recordProductMetric, recordPerformance } from "@/lib/observability";
import { Errors } from "@/lib/errors";
import type { ClaimedJob } from "@/queue/queue";

export async function handleAnalyticsRecalc(
  job: ClaimedJob,
): Promise<{ applications: number }> {
  const started = Date.now();
  const userId = (job.payload as { userId?: string }).userId;

  const users = userId
    ? [userId]
    : (await prisma.user.findMany({ select: { id: true }, take: 500 })).map(
        (u) => u.id,
      );

  for (const id of users) {
    const analytics = await analyticsFor(id).catch(() => null);
    if (!analytics) continue;
    await prisma.productMetric.upsert({
      where: {
        name_bucket: {
          name: "analytics_applications_submitted",
          bucket: currentHour(),
        },
      },
      create: {
        name: "analytics_applications_submitted",
        bucket: currentHour(),
        value: analytics.applicationsSubmitted,
        count: 1,
      },
      update: { value: analytics.applicationsSubmitted },
    });
    await prisma.productMetric.upsert({
      where: {
        name_bucket: { name: "analytics_replies", bucket: currentHour() },
      },
      create: {
        name: "analytics_replies",
        bucket: currentHour(),
        value: analytics.replies,
        count: 1,
      },
      update: { value: analytics.replies },
    });
    await recordProductMetric("analytics_recalculated", 1, {
      userBucket: "aggregate",
    });
  }

  recordPerformance("analytics_recalc_ms", Date.now() - started);
  return { applications: users.length };
}

function currentHour(): Date {
  return new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
}

export async function handleNotificationDispatch(
  job: ClaimedJob,
): Promise<{ created: number }> {
  const userId = (job.payload as { userId: string }).userId;
  if (!userId)
    throw Errors.validation("Notification job is missing a user id.");

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) return { created: 0 };

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  let created = 0;

  if (settings.notifyInterviews) {
    const upcoming = await prisma.interview.findMany({
      where: {
        userId,
        scheduledAt: { gte: now, lte: tomorrow },
        status: { not: "COMPLETED" },
      },
    });
    for (const i of upcoming) {
      const dedupeKey = `interview:${i.id}`;
      const exists = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey } },
      });
      if (exists) continue;
      await prisma.notification.create({
        data: {
          userId,
          type: "INTERVIEW_TOMORROW",
          title: `Interview tomorrow: ${i.company}`,
          body: `${i.role}. Open Interview Prep to prepare.`,
          href: `/app/interviews/${i.id}`,
          dueAt: i.scheduledAt,
          dedupeKey,
        },
      });
      created++;
    }
  }

  if (settings.notifyFollowUps) {
    const due = await prisma.followUp.findMany({
      where: { userId, status: "DRAFT", scheduledFor: { lte: now } },
      take: 20,
    });
    for (const f of due) {
      const dedupeKey = `followup:${f.id}`;
      const exists = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey } },
      });
      if (exists) continue;
      await prisma.notification.create({
        data: {
          userId,
          type: "FOLLOW_UP_DUE",
          title: `Follow-up due: ${f.type.toLowerCase().replace(/_/g, " ")}`,
          body: "Open the application to send it.",
          href: f.applicationId
            ? `/app/applications/${f.applicationId}`
            : "/app/follow-ups",
          dueAt: f.scheduledFor,
          dedupeKey,
        },
      });
      created++;
    }
  }

  return { created };
}

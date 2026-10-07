import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import {
  dismissNotificationAction,
  markNotificationReadAction,
} from "@/app/actions/notification-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, status: { not: "DISMISSED" } },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const unread = notifications.filter(
    (item) => item.status === "UNREAD",
  ).length;
  const due = notifications.filter(
    (item) => item.dueAt && item.dueAt.getTime() <= Date.now(),
  ).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Notifications
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Interview reminders, follow-ups and deadlines generated from your own
          records. No marketing notifications.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Unread"
          value={unread}
          tone={unread ? "warning" : undefined}
        />
        <Stat label="Due" value={due} tone={due ? "negative" : undefined} />
        <Stat label="Visible" value={notifications.length} />
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="You are all caught up"
          description="Reminders appear when an interview, follow-up or application deadline needs attention."
          action={
            <Link href="/app" className="btn-primary">
              Back to dashboard
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Your reminders"
            description="Open the related work, mark it read, or dismiss it from this inbox."
          />
          <ul className="space-y-2">
            {notifications.map((item) => (
              <li
                key={item.id}
                className="card-muted flex flex-wrap items-start gap-3 p-3"
                style={
                  item.status === "UNREAD"
                    ? { borderColor: "var(--brand-accent)" }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {item.title}
                    </p>
                    {item.status === "UNREAD" ? (
                      <span className="badge badge-partial">Unread</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {item.body}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.dueAt
                      ? `Due ${formatDateTime(item.dueAt)}`
                      : `Created ${formatDateTime(item.createdAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.href ? (
                    <Link href={item.href} className="btn-secondary">
                      Open
                    </Link>
                  ) : null}
                  {item.status === "UNREAD" ? (
                    <form action={markNotificationReadAction}>
                      <input
                        type="hidden"
                        name="notificationId"
                        value={item.id}
                      />
                      <button type="submit" className="btn-ghost">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                  <form action={dismissNotificationAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={item.id}
                    />
                    <button type="submit" className="btn-ghost">
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

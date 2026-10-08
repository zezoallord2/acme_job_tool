import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listFollowUps } from "@/services/interview-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui/primitives";
import {
  FollowUpForm,
  MarkFollowUpSentButton,
} from "@/components/follow-up-form";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups" };

const TYPE_LABEL: Record<string, string> = {
  THANK_YOU: "Thank-you note",
  FOLLOW_UP: "Follow-up",
  SECOND_FOLLOW_UP: "Second follow-up",
  WITHDRAWAL: "Withdrawal",
};

export default async function FollowUpsPage() {
  const user = await requireUser();
  const [followUps, canBuild] = await Promise.all([
    listFollowUps(user.id),
    hasCapability(user.id, "FOLLOW_UP_BUILDER"),
  ]);

  const now = Date.now();
  const open = followUps.filter((f) => f.status !== "CANCELLED");
  const pending = open.filter((f) => f.status === "DRAFT");
  const sent = followUps.filter((f) => f.status === "SENT");
  const dueNow = pending.filter(
    (f) => !f.scheduledFor || f.scheduledFor.getTime() <= now,
  );
  const overdue = pending.filter(
    (f) =>
      f.scheduledFor !== null && f.scheduledFor.getTime() < now - 86_400_000,
  );

  const [applications, interviews] = await Promise.all([
    prisma.application.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        job: { select: { company: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.interview.findMany({
      where: { userId: user.id },
      select: { id: true, company: true, role: true, scheduledAt: true },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Follow-ups</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Thank-you notes and follow-ups you actually sent. Acme Jobs tracks
          what is due; it never sends anything on your behalf.
        </p>
      </header>

      {!canBuild ? (
        <Alert
          tone="info"
          title="Follow-Up Message is a Complete Edition feature"
        >
          You can still see what is due and mark messages as sent. Complete
          Edition adds the builder, scheduling and the full follow-up history.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Due now"
          value={dueNow.length}
          tone={dueNow.length ? "warning" : undefined}
        />
        <Stat
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "negative" : undefined}
        />
        <Stat label="Scheduled" value={pending.length - dueNow.length} />
        <Stat label="Sent" value={sent.length} />
      </div>

      {canBuild ? (
        <Card>
          <CardHeader
            title="Write a follow-up"
            description="Reference only what actually happened. Nothing is sent for you."
          />
          <FollowUpForm
            applications={applications.map((a) => ({
              id: a.id,
              label: `${a.job?.company ?? "Company"} — ${a.job?.title ?? "Role"}`,
            }))}
            interviews={interviews.map((i) => ({
              id: i.id,
              label: `${i.company} · ${i.role}${i.scheduledAt ? ` · ${formatDateTime(i.scheduledAt)}` : ""}`,
            }))}
          />
        </Card>
      ) : null}

      {followUps.length === 0 ? (
        <EmptyState
          title="No follow-ups yet"
          description={
            canBuild
              ? "After an interview, write a thank-you note while the conversation is still fresh. Link it to the application so it stays attached to the sent version."
              : "Nothing is due right now. Follow-ups you add will appear here with their status."
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Your follow-ups"
            description="Acme Jobs never sends email. Marking something sent is your own record."
          />
          <ul className="space-y-2">
            {followUps.map((f) => {
              const isOverdue =
                f.status === "DRAFT" &&
                f.scheduledFor !== null &&
                f.scheduledFor.getTime() < now - 86_400_000;
              const isDue =
                f.status === "DRAFT" &&
                (!f.scheduledFor || f.scheduledFor.getTime() <= now);

              return (
                <li key={f.id} className="card-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {TYPE_LABEL[f.type] ?? f.type}
                        {f.application?.job?.company
                          ? ` · ${f.application.job.company}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {f.status === "SENT"
                          ? `Sent ${formatDateTime(f.sentAt)}`
                          : f.scheduledFor
                            ? isOverdue
                              ? `Was due ${relativeTime(f.scheduledFor)}`
                              : `Due ${formatDateTime(f.scheduledFor)}`
                            : "No date set"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {f.status === "DRAFT" && isOverdue ? (
                        <span className="badge badge-missing">Overdue</span>
                      ) : f.status === "DRAFT" && isDue ? (
                        <span className="badge badge-partial">Due now</span>
                      ) : f.status === "SENT" ? (
                        <span className="badge badge-strong">Sent</span>
                      ) : (
                        <span className="badge badge-unknown">Draft</span>
                      )}
                      {f.applicationId ? (
                        <Link
                          href={`/app/applications/${f.applicationId}`}
                          className="btn-ghost"
                        >
                          Application
                        </Link>
                      ) : null}
                      {f.status === "DRAFT" && canBuild ? (
                        <MarkFollowUpSentButton followUpId={f.id} />
                      ) : null}
                    </div>
                  </div>
                  {f.subject ? (
                    <p className="mt-2 text-sm text-[var(--text)]">
                      {f.subject}
                    </p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
                    {f.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

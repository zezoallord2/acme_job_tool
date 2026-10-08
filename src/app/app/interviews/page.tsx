import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listInterviews } from "@/services/interview-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui/primitives";
import { InterviewForm } from "@/components/interview-form";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interviews" };

export default async function InterviewsPage() {
  const user = await requireUser();
  const [interviews, isComplete] = await Promise.all([
    listInterviews(user.id),
    hasCapability(user.id, "INTERVIEW_COMMAND_CENTER"),
  ]);

  const upcoming = interviews.filter(
    (i) => i.scheduledAt && i.scheduledAt.getTime() > Date.now(),
  );
  const pendingReviews = interviews.filter(
    (i) => i.status === "COMPLETED" && !i.reviewedAt,
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-[var(--text)]">Interview</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Prepare from your strongest evidence, review afterwards, and let
            what you remember become new evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/interviews/prep" className="btn-secondary">
            Interview Prep
          </Link>
          <Link href="/app/interviews/practice" className="btn-primary">
            Mock interview
          </Link>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Scheduled"
          value={upcoming.length}
          tone={upcoming.length ? "warning" : undefined}
        />
        <Stat label="Total" value={interviews.length} />
        <Stat
          label="Awaiting review"
          value={pendingReviews.length}
          tone={pendingReviews.length ? "warning" : undefined}
        />
      </div>

      {isComplete ? (
        <Card>
          <CardHeader
            title="Add an interview"
            description="Link it to an application so Interview Prep can use the version you sent."
          />
          <InterviewForm
            applications={await prisma.application.findMany({
              where: { userId: user.id },
              select: {
                id: true,
                job: { select: { company: true, title: true } },
              },
              take: 50,
            })}
          />
        </Card>
      ) : null}

      {interviews.length === 0 ? (
        <EmptyState
          title="No interviews yet"
          description="Add one when you get a call. Interview Prep shows the requirements, the resume you sent, your strongest examples and questions to ask."
        />
      ) : (
        <Card>
          <CardHeader title="All interviews" />
          <ul className="space-y-2">
            {interviews.map((i) => (
              <li
                key={i.id}
                className="card-muted flex flex-wrap items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {i.company} · {i.role}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDateTime(i.scheduledAt)} · {i.stage.toLowerCase()} ·{" "}
                    {i.format.toLowerCase()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/interviews/${i.id}`}
                    className="btn-secondary"
                  >
                    {isComplete ? "Interview Prep" : "Open"}
                  </Link>
                  {isComplete ? (
                    <Link
                      href={`/app/interviews/${i.id}/review`}
                      className="btn-ghost"
                    >
                      Interview Review
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="More interview tools"
          description="Build reusable stories or draft a follow-up when you need them."
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/app/stories" className="btn-secondary">
            Interview Stories
          </Link>
          <Link href="/app/follow-ups" className="btn-secondary">
            Follow-Up Messages
          </Link>
        </div>
      </Card>
    </div>
  );
}

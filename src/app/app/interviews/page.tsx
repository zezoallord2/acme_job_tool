import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listInterviews } from "@/services/interview-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
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
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            Interviews
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Prepare from your strongest evidence, review afterwards, and let
            what you remember become new evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/interviews/prep" className="btn-primary">
            Interview Prep
          </Link>
          <Link href="/app/interviews/practice" className="btn-secondary">
            Practise a mock interview
          </Link>
        </div>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free mock interviews">
          The Starter plan includes a five-question mock interview. Complete
          Edition adds the Interview Command Center, adaptive interviews,
          post-interview review and the Follow-Up Builder.
        </Alert>
      ) : null}

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
            description="Link it to an application so the Command Center can use the sent snapshot."
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
          description="Add one when you get a call. The Command Center shows the requirements, your submitted resume, your strongest evidence and questions to ask."
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
                    {isComplete ? "Command Center" : "Open"}
                  </Link>
                  {isComplete ? (
                    <Link
                      href={`/app/interviews/${i.id}/review`}
                      className="btn-ghost"
                    >
                      Post-interview review
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

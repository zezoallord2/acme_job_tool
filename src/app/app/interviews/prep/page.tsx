import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/services/entitlement-service";
import { listInterviews } from "@/services/interview-service";
import {
  AnswerCoachPanel,
  QuestionBuilderPanel,
} from "@/components/coaching-panels";
import { Alert, Card, CardHeader, Stat } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview Prep" };

/**
 * Prepare against what the employer actually received.
 *
 * Questions are generated from the SENT snapshot and the job's own
 * requirements, not from the current resume, because those are different things
 * and confusing them is how people get caught out.
 */
export default async function InterviewPrepPage() {
  const user = await requireUser();
  const [canPrep, interviews, applications] = await Promise.all([
    hasCapability(user.id, "MOCK_INTERVIEW_ADVANCED"),
    listInterviews(user.id),
    prisma.application.findMany({
      where: { userId: user.id },
      select: { id: true, job: { select: { company: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const upcoming = interviews.filter(
    (i) => i.scheduledAt && i.scheduledAt.getTime() > Date.now(),
  );
  const sentSnapshots = await prisma.applicationSnapshot.count({
    where: { application: { userId: user.id } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Interview Prep</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Generate questions from the role and the resume you actually sent,
          then coach one answer at a time. No hire probability, ever.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Upcoming"
          value={upcoming.length}
          tone={upcoming.length ? "warning" : undefined}
        />
        <Stat label="Sent snapshots" value={sentSnapshots} />
        <Stat label="Applications" value={applications.length} />
      </div>

      {upcoming.length > 0 ? (
        <Alert tone="info" title="Next interview">
          {upcoming[0].company} · {upcoming[0].role} ·{" "}
          {formatDateTime(upcoming[0].scheduledAt)}
        </Alert>
      ) : null}

      {!canPrep ? (
        <Alert tone="info" title="Interview Prep is a Complete Edition feature">
          Starter includes a five-question mock interview. Complete Edition adds
          the Question Builder, the Answer Coach and the Interview Command
          Center.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Question Builder"
          description="Questions come from the job's requirements, the SENT resume and the evidence you actually hold — so you are never surprised by a question about something you never claimed."
        />
        {canPrep ? (
          <QuestionBuilderPanel
            applications={applications.map((a) => ({
              id: a.id,
              label: `${a.job?.company ?? "Company"} — ${a.job?.title ?? "Role"}`,
            }))}
          />
        ) : (
          <Link href="/app/settings" className="btn-primary">
            Upgrade to unlock
          </Link>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Answer Coach"
          description="Five criteria: relevance, specificity, evidence, structure and clarity. If the answer was vague you get one follow-up question instead of a lecture."
        />
        {canPrep ? (
          <AnswerCoachPanel />
        ) : (
          <Link href="/app/settings" className="btn-primary">
            Upgrade to unlock
          </Link>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/app/interviews/practice" className="btn-secondary">
          Practise a mock interview
        </Link>
        <Link href="/app/stories" className="btn-secondary">
          Open the Interview Stories
        </Link>
      </div>
    </div>
  );
}

import { requireUser } from "@/lib/auth";
import { interviewOptions } from "@/services/mock-interview-service";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MockInterviewRunner } from "@/components/mock-interview-runner";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mock interview" };

export default async function PracticePage() {
  const user = await requireUser();
  const options = await interviewOptions(user.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Mock interview</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Pick the job and how long you have. AI builds the questions from the
          job, your resume and the gaps in your evidence, then coaches every
          answer. No hire probability — nobody can know that.
        </p>
      </header>

      <Card>
        <MockInterviewRunner
          applications={options.applications}
          targetRole={options.targetRole}
        />
      </Card>

      {options.recent.length > 0 ? (
        <Card>
          <CardHeader title="Recent interviews" />
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {options.recent.map((s) => (
              <li key={s.id}>
                {formatDate(s.createdAt)} · {s.targetRole ?? "Interview"} ·{" "}
                {s._count.answers} of {s._count.questions} answered
                {s.overallScore !== null ? ` · ${s.overallScore}/5` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { interviewCommandCenter } from "@/services/interview-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  Alert,
  EmptyState,
  StrengthBadge,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview Prep" };

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const user = await requireUser();
  const { interviewId } = await params;
  const isComplete = await hasCapability(user.id, "INTERVIEW_COMMAND_CENTER");

  const data = await interviewCommandCenter(user.id, interviewId);
  const { interview } = data;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/interviews" className="underline">
          Interviews
        </Link>{" "}
        / {interview.company}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title text-[var(--text)]">
            {interview.company} · {interview.role}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {formatDateTime(interview.scheduledAt)} ·{" "}
            {interview.stage.toLowerCase()} · {interview.format.toLowerCase()}
            {interview.interviewerName
              ? ` · with ${interview.interviewerName}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {isComplete ? (
            <>
              <Link
                href={`/app/interviews/${interviewId}/review`}
                className="btn-primary"
              >
                Post-interview review
              </Link>
              <a
                href={`/api/interviews/${interviewId}/brief.pdf`}
                className="btn-secondary"
              >
                Brief PDF
              </a>
            </>
          ) : (
            <Link href="/app/settings" className="btn-primary">
              Upgrade for Interview Prep
            </Link>
          )}
        </div>
      </header>

      {isComplete ? (
        <Alert
          tone={data.usedSentSnapshot ? "success" : "info"}
          title={
            data.usedSentSnapshot
              ? "Using your sent version"
              : "No sent snapshot yet"
          }
        >
          {data.usedSentSnapshot
            ? "Everything below is based on exactly what you sent this employer, not on what your resume says now."
            : "This application has no sealed snapshot, so Interview Prep is using your current resume. Seal the application after you send."}
        </Alert>
      ) : (
        <Alert tone="info" title="Free view">
          The Interview Prep with the sent resume, requirement coverage, likely
          questions and risks is part of Complete Edition.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Job requirements vs your evidence"
            description="What you can defend, and where the gaps are."
          />
          {data.jobRequirements.length === 0 ? (
            <EmptyState
              title="No analysis for this job"
              description="Analyse the job description to see requirement coverage for this interview."
              action={
                data.interview.applicationId ? (
                  <Link
                    href={`/app/applications/${data.interview.applicationId}`}
                    className="btn-secondary"
                  >
                    Open the application
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {data.jobRequirements.map((r, i) => (
                <li
                  key={i}
                  className="card-muted flex flex-wrap items-center gap-2 p-2.5"
                >
                  <StrengthBadge strength={r.strength} />
                  <span className="min-w-0 flex-1 text-sm text-[var(--text)]">
                    {r.text}
                  </span>
                  {r.isMustHave ? (
                    <span className="badge badge-missing">required</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Your strongest evidence" />
            {data.strongestEvidence.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No verified evidence yet. Add evidence so the app can point you
                to real examples.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.strongestEvidence.map((e) => (
                  <li key={e.id} className="text-[var(--text-muted)]">
                    • {e.statement}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Risks and gaps" />
            {data.risks.length + data.gaps.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nothing flagged.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {[...data.risks, ...data.gaps].map((r, i) => (
                  <li key={i} className="text-[var(--color-evidence-partial)]">
                    • {r}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Questions to ask"
            description="Specific questions signal preparation."
          />
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {data.questionsToAsk.map((q, i) => (
              <li key={i}>• {q}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Top STAR stories" />
          {data.topStories.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No stories saved yet.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.topStories.map((s) => (
                <li key={s.id} className="text-[var(--text)]">
                  • {s.title}{" "}
                  <span className="text-xs text-[var(--text-muted)]">
                    ({s.category.toLowerCase()})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Checklist" />
        <ul className="space-y-1.5">
          {data.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={c.done}
                id={`chk-${c.label}`}
              />
              <label htmlFor={`chk-${c.label}`} className="text-[var(--text)]">
                {c.label}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Submitted resume"
          description="The version this employer received."
        />
        <pre
          className="code-block"
          style={{ maxHeight: 320, overflow: "auto" }}
        >
          {JSON.stringify(data.submittedResume, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

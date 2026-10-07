import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getApplication } from "@/services/application-service";
import {
  Card,
  CardHeader,
  Alert,
  EmptyState,
  StatusBadge,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application Capsule" };

/**
 * The permanent record: "what exactly did I send this company?"
 * Reads from the sealed snapshot, never from live rows.
 */
export default async function CapsulePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await requireUser();
  const { applicationId } = await params;

  const app = await getApplication(user.id, applicationId);
  const snapshot = app.snapshots[0];

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Application Capsule
        </h1>
        <EmptyState
          title="Nothing sent yet"
          description="A capsule is created the moment you mark an application as applied. It freezes the job description, resume, cover letter, answers and evidence state exactly as they were."
          action={
            <Link
              href={`/app/applications/${applicationId}`}
              className="btn-primary"
            >
              Back to the application
            </Link>
          }
        />
      </div>
    );
  }

  const resume = snapshot.resumeContent as {
    label?: string;
    template?: string;
    sections?: Array<{ title: string; content: unknown }>;
  } | null;
  const analysis = snapshot.jobAnalysis as Record<string, unknown> | null;
  const matrix = snapshot.evidenceMatrix as Record<string, unknown> | null;
  const letter = snapshot.coverLetterContent as { body?: string } | null;
  const answers = snapshot.answers as Array<{
    question: string;
    answer: string;
  }>;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/applications" className="underline">
          Applications
        </Link>{" "}
        /{" "}
        <Link href={`/app/applications/${applicationId}`} className="underline">
          {app.job?.company ?? "Company not set"}
        </Link>{" "}
        / Capsule
      </nav>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Application Capsule
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {app.job?.company ?? "Company not set"} —{" "}
          {app.job?.title ?? "Role not set"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={snapshot.applicationStatus} />
          <span className="badge badge-strong">
            sealed {formatDate(snapshot.sealedAt)}
          </span>
          <span className="badge badge-unknown">
            hash {snapshot.contentHash.slice(0, 10)}
          </span>
        </div>
      </header>

      <Alert tone="success" title="This record never changes">
        After sealing, editing your Master Resume or any evidence record does
        not alter what you sent. The hash lets you verify that. If a future
        change ever attempted to modify this row, the write would be refused.
      </Alert>

      <Card>
        <CardHeader title="Contact and source" />
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Field
            label="Source"
            value={
              (snapshot.contactInfo as { sourceName?: string })?.sourceName ??
              "—"
            }
          />
          <Field
            label="Location"
            value={
              (snapshot.contactInfo as { location?: string })?.location ?? "—"
            }
          />
          <Field label="Date applied" value={formatDate(app.appliedAt)} />
          <Field label="Role" value={app.job?.title ?? "—"} />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Job analysis at the time of sending" />
        {analysis ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Field
              label="Seniority"
              value={String(analysis.seniority ?? "—")}
            />
            <Field
              label="Experience requirement"
              value={String(analysis.experienceRequirement ?? "—")}
            />
            <div className="sm:col-span-2">
              <dt className="label">Must-have requirements</dt>
              <dd className="text-sm text-[var(--text-muted)]">
                {(
                  (analysis.mustHaveRequirements as string[] | undefined) ?? []
                ).join(" · ") || "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No analysis was stored for this application.
          </p>
        )}
      </Card>

      {matrix ? (
        <Card>
          <CardHeader title="Evidence matrix at the time of sending" />
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Field
              label="Classification"
              value={String(matrix.fitClassification ?? "—")}
            />
            <Field
              label="Recommendation"
              value={String(matrix.recommendation ?? "—")}
            />
            <Field
              label="Coverage"
              value={`${Math.round(Number(matrix.coveragePercent ?? 0) * 100)}%`}
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Resume you sent"
          description={resume?.label ?? "No resume content was captured."}
        />
        {resume?.sections?.length ? (
          <div className="space-y-3">
            {resume.sections.map((s) => (
              <div key={s.title}>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {s.title}
                </h3>
                <pre className="code-block mt-1">
                  {JSON.stringify(s.content, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No resume content was captured.
          </p>
        )}
      </Card>

      {letter?.body ? (
        <Card>
          <CardHeader title="Cover letter you sent" />
          <pre className="code-block">{letter.body}</pre>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Application answers you sent" />
        {answers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No answers were recorded for this application.
          </p>
        ) : (
          <ul className="space-y-3">
            {answers.map((a, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-[var(--text)]">
                  {a.question}
                </p>
                <pre className="code-block mt-1">{a.answer}</pre>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Evidence state at the time of sending"
          description="Exactly which evidence records existed, and their verification status, when you sealed this application."
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Statement</th>
                <th scope="col">Verification</th>
                <th scope="col">Metric</th>
              </tr>
            </thead>
            <tbody>
              {(
                snapshot.evidenceState as Array<{
                  statement: string;
                  verificationStatus: string;
                  metricValue: number | null;
                  metricUnit: string | null;
                }>
              ).map((e, i) => (
                <tr key={i}>
                  <td>{e.statement}</td>
                  <td>
                    {e.verificationStatus.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td>
                    {e.metricValue === null
                      ? "—"
                      : `${e.metricValue} ${e.metricUnit ?? ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Original job description" />
        <pre
          className="code-block"
          style={{ maxHeight: 280, overflow: "auto" }}
        >
          {snapshot.jobDescription}
        </pre>
      </Card>

      <p className="text-sm">
        <Link href={`/app/applications/${applicationId}`} className="underline">
          Back to the application
        </Link>
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-sm text-[var(--text)]">{value}</dd>
    </div>
  );
}
